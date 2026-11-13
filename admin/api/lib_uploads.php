<?php
declare(strict_types=1);

/**
 * Kinésica Admin - Gestión y Persistencia de Archivos Adjuntos (Uploads)
 *
 * Protege fotos y videos clínicos contra sobreescrituras en despliegues.
 * Prioriza almacenamiento persistente fuera de public_html (ej. private/uploads)
 * con fallback seguro al directorio local /admin/uploads/.
 */

function kinesica_uploads_candidate_dirs(): array
{
    $dirs = [];

    // 1. Configuración explícita por entorno o config.php
    $env = getenv('KINESICA_UPLOADS_DIR');
    if (is_string($env) && $env !== '') {
        $dirs[] = rtrim($env, '/\\');
    }
    if (function_exists('cfg')) {
        $fromCfg = cfg()['uploads_dir'] ?? '';
        if (is_string($fromCfg) && $fromCfg !== '') {
            $dirs[] = rtrim((string) $fromCfg, '/\\');
        }
    }

    // 2. En producción / hosting (cuando el root web termina en public_html):
    // Usar private/uploads o directorio persistente fuera de public_html para sobrevivir a cualquier deploy.
    $domainRoot = dirname(__DIR__, 3);
    $docRoot = dirname(__DIR__, 2);
    $normalizedDoc = str_replace('\\', '/', $docRoot);
    if (str_ends_with($normalizedDoc, '/public_html') || basename($normalizedDoc) === 'public_html') {
        $dirs[] = $domainRoot . '/private/uploads';
        $dirs[] = $domainRoot . '/uploads';
        $dirs[] = $domainRoot . '/backups/atm/uploads';
    }

    // 3. Directorio estándar en el árbol de la aplicación
    $dirs[] = dirname(__DIR__) . '/uploads';

    return $dirs;
}

function kinesica_uploads_dir(): string
{
    $candidates = kinesica_uploads_candidate_dirs();
    foreach ($candidates as $dir) {
        if (!is_dir($dir)) {
            $parent = dirname($dir);
            if (is_dir($parent) && is_writable($parent)) {
                @mkdir($dir, 0755, true);
            }
        }
        if (is_dir($dir) && is_writable($dir)) {
            $ht = $dir . '/.htaccess';
            if (!is_file($ht)) {
                @file_put_contents($ht, "Require all denied\n");
            }
            return $dir;
        }
    }

    // Fallback asegurado al directorio local
    $fallback = dirname(__DIR__) . '/uploads';
    if (!is_dir($fallback)) {
        @mkdir($fallback, 0755, true);
    }
    $ht = $fallback . '/.htaccess';
    if (!is_file($ht)) {
        @file_put_contents($ht, "Require all denied\n");
    }
    return $fallback;
}

function kinesica_find_upload_file(string $filename): ?string
{
    if (!preg_match('/^[a-f0-9]{32,64}\.(jpe?g|png|webp|mp4|webm|mov|m4v)$/i', $filename)) {
        return null;
    }

    foreach (kinesica_uploads_candidate_dirs() as $dir) {
        $realDir = realpath($dir);
        if ($realDir === false) {
            continue;
        }
        $filePath = $realDir . DIRECTORY_SEPARATOR . $filename;
        $realFilePath = realpath($filePath);
        if (
            $realFilePath !== false &&
            str_starts_with($realFilePath, $realDir . DIRECTORY_SEPARATOR) &&
            is_file($realFilePath)
        ) {
            return $realFilePath;
        }
    }

    return null;
}

function kinesica_delete_upload_file(string $filename): bool
{
    $path = kinesica_find_upload_file($filename);
    if ($path !== null && is_file($path)) {
        return @unlink($path);
    }
    return false;
}
