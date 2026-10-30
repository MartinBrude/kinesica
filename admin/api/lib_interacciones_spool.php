<?php
declare(strict_types=1);

/**
 * Spool en disco: red de seguridad cuando la BD no responde.
 * Los eventos son idempotentes, por lo que reprocesar un lote completo es siempre seguro.
 */

function interacciones_spool_dir(): string
{
    $dir = interacciones_dir() . '/spool';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    return $dir;
}

/** @param list<array> $events eventos normalizados */
function interacciones_spool_append(array $events): bool
{
    if (!$events) {
        return true;
    }
    $dir = interacciones_spool_dir();
    $lines = '';
    foreach ($events as $ev) {
        $lines .= json_encode($ev, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
    }
    $path = $dir . '/pending.jsonl';
    // Si el drenaje rotó el archivo mientras esperábamos el lock, el fd apunta a un lote viejo: reintentar.
    for ($attempt = 0; $attempt < 5; $attempt++) {
        $fh = @fopen($path, 'ab');
        if ($fh === false) {
            return false;
        }
        if (!flock($fh, LOCK_EX)) {
            fclose($fh);
            return false;
        }
        clearstatcache(true, $path);
        $fdStat = fstat($fh);
        $pathStat = @stat($path);
        if ($pathStat === false || ($fdStat['ino'] ?? 0) !== ($pathStat['ino'] ?? -1)) {
            flock($fh, LOCK_UN);
            fclose($fh);
            continue;
        }
        $written = fwrite($fh, $lines);
        fflush($fh);
        if (function_exists('fsync')) {
            @fsync($fh);
        }
        flock($fh, LOCK_UN);
        fclose($fh);
        return $written === strlen($lines);
    }
    return false;
}

function interacciones_spool_pending_count(): int
{
    $dir = interacciones_spool_dir();
    $count = 0;
    // Solo pending + batch (no corrupt-* ni otros).
    foreach (array_merge(
        glob($dir . '/pending.jsonl') ?: [],
        glob($dir . '/batch-*.jsonl') ?: []
    ) as $file) {
        $fh = @fopen($file, 'rb');
        if ($fh === false) {
            continue;
        }
        while (($line = fgets($fh)) !== false) {
            if (trim($line) !== '') {
                $count++;
            }
        }
        fclose($fh);
    }
    return $count;
}

/**
 * Reintegra el spool a la BD. Un lote solo se elimina si TODAS sus líneas se guardaron.
 *
 * @return array{processed:int,remaining:int,busy:bool}
 */
function interacciones_spool_drain(?PDO $pdo = null, int $maxSeconds = 3): array
{
    $dir = interacciones_spool_dir();
    $out = ['processed' => 0, 'remaining' => 0, 'busy' => false];
    $lock = @fopen($dir . '/.drain.lock', 'cb');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        $out['busy'] = true;
        $out['remaining'] = interacciones_spool_pending_count();
        return $out;
    }
    $deadline = microtime(true) + max(1, $maxSeconds);
    try {
        $pdo = interacciones_pdo($pdo);
        interacciones_ensure_schema($pdo);
        $pending = $dir . '/pending.jsonl';
        if (is_file($pending) && filesize($pending) > 0) {
            // Rotar bajo el mismo lock que usan los escritores para no perder appends concurrentes.
            $fh = fopen($pending, 'cb');
            if ($fh !== false && flock($fh, LOCK_EX)) {
                @rename($pending, $dir . '/batch-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.jsonl');
                flock($fh, LOCK_UN);
            }
            if ($fh !== false) {
                fclose($fh);
            }
        }
        foreach (glob($dir . '/batch-*.jsonl') ?: [] as $batch) {
            if (microtime(true) > $deadline) {
                break;
            }
            $fh = @fopen($batch, 'rb');
            if ($fh === false) {
                continue;
            }
            $allOk = true;
            $n = 0;
            $corrupt = '';
            while (($line = fgets($fh)) !== false) {
                $trimmed = trim($line);
                if ($trimmed === '') {
                    continue;
                }
                $ev = json_decode($trimmed, true);
                if (!is_array($ev)) {
                    $corrupt .= $line;
                    continue;
                }
                $norm = interacciones_normalize_event($ev, (string) ($ev['source'] ?? 'spool'));
                if ($norm === null) {
                    $corrupt .= $line;
                    continue;
                }
                try {
                    interacciones_insert_event($pdo, $norm);
                    $n++;
                } catch (Throwable $e) {
                    $allOk = false;
                    break;
                }
            }
            fclose($fh);
            if ($allOk) {
                if ($corrupt !== '') {
                    $corruptPath = $dir . '/corrupt-' . gmdate('YmdHis') . '-' . bin2hex(random_bytes(3)) . '.jsonl';
                    @file_put_contents($corruptPath, $corrupt, LOCK_EX);
                }
                @unlink($batch);
                $out['processed'] += $n;
            } else {
                break;
            }
        }
    } catch (Throwable $e) {
        error_log('interacciones: drain falló: ' . $e->getMessage());
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    $out['remaining'] = interacciones_spool_pending_count();
    return $out;
}
