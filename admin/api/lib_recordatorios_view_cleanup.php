<?php
declare(strict_types=1);

/**
 * Limpieza idempotente de ruido/duplicados en `recordatorio_eventos`.
 * En HTTP se ejecuta como máximo cada 5 minutos (o con ?sync=1) para no
 * bloquear cada lectura GET con self-joins DELETE.
 */
function recordatorios_run_view_cleanup(PDO $pdo): void
{
    $cleanupFile = __DIR__ . '/data/.recordatorios_cleanup_ts';
    $runCleanup = PHP_SAPI === 'cli' || !empty($_GET['sync'])
        || !is_file($cleanupFile) || (time() - (int) @filemtime($cleanupFile)) >= 300;
    if (!$runCleanup) {
        return;
    }
    try {
        $todayBA = (new DateTimeImmutable('now', recordatorios_tz()))->format('Y-m-d');
        $pdo->prepare('DELETE FROM recordatorio_eventos WHERE status = "pending" AND appointment_date IS NOT NULL AND appointment_date != "" AND appointment_date < :today')->execute(['today' => $todayBA]);
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE (calendar_event_id LIKE 'test:%' OR exec_id = 'manual-test' OR event_summary LIKE '[PRUEBA]%') AND status != 'pending'");
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE status = 'run_skipped' OR skip_reason = 'clara_inactive'");
        $pdo->exec("DELETE FROM recordatorio_eventos WHERE skip_reason = 'blocked' OR LOWER(patient_name) LIKE '%no dar%' OR LOWER(event_summary) LIKE '%no dar%' OR LOWER(patient_name) LIKE '%bloqueado%' OR LOWER(event_summary) LIKE '%bloqueado%' OR LOWER(patient_name) LIKE '%tk3%' OR LOWER(event_summary) LIKE '%tk3%' OR LOWER(patient_name) LIKE '%tk 3%' OR LOWER(event_summary) LIKE '%tk 3%'");
        $pdo->exec("DELETE pend FROM recordatorio_eventos pend
                    INNER JOIN recordatorio_eventos sent
                      ON (
                        pend.calendar_event_id = sent.calendar_event_id
                        OR REPLACE(pend.calendar_event_id, '@google.com', '') = REPLACE(sent.calendar_event_id, '@google.com', '')
                      )
                     AND pend.calendar_event_id != ''
                     AND pend.calendar_event_id != '_run'
                     AND pend.status IN ('pending', 'missing_phone')
                     AND sent.status IN ('sent', 'sent_email')");
        $pdo->exec("DELETE pend FROM recordatorio_eventos pend
                    INNER JOIN recordatorio_eventos sk
                      ON (
                        pend.calendar_event_id = sk.calendar_event_id
                        OR REPLACE(pend.calendar_event_id, '@google.com', '') = REPLACE(sk.calendar_event_id, '@google.com', '')
                      )
                     AND pend.calendar_event_id != ''
                     AND pend.calendar_event_id != '_run'
                     AND pend.status IN ('pending', 'missing_phone')
                     AND sk.status = 'skipped'
                     AND sk.skip_reason IN ('cancelled', 'event_gone', 'event_moved')");
        $pdo->exec("DELETE r1 FROM recordatorio_eventos r1
                    JOIN recordatorio_eventos r2
                      ON (
                        r1.calendar_event_id = r2.calendar_event_id
                        OR REPLACE(r1.calendar_event_id, '@google.com', '') = REPLACE(r2.calendar_event_id, '@google.com', '')
                      )
                     AND r1.calendar_event_id != ''
                     AND r1.calendar_event_id != '_run'
                     AND r1.id < r2.id
                     AND r1.status = r2.status");
        if (PHP_SAPI !== 'cli') {
            @file_put_contents($cleanupFile, (string) time());
        }
    } catch (Throwable $e) {
        error_log('kinesica recordatorios view: dedupe cleanup: ' . $e->getMessage());
    }
}
