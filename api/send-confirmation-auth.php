<?php
declare(strict_types=1);

/**
 * Firma y verificación HMAC-SHA256 de confirmToken (GAS / backup / admin proxy)
 * + anti-replay por eventId y tope diario global para envíos WhatsApp.
 */

const KINESICA_CONFIRM_TOKEN_TTL_SEC = 1800;
const KINESICA_CONFIRM_TOKEN_MAX_TTL_SEC = 7200;
const KINESICA_CONFIRM_TOKEN_SKEW_SEC = 180;
const KINESICA_CONFIRM_WA_MAX_ATTEMPTS_PER_EVENT = 2;
const KINESICA_CONFIRM_WA_DAILY_CAP = 80;
const KINESICA_CLINIC_ADDRESS_MAIL = 'Charcas 3889, Piso 5º B, Palermo';
const KINESICA_CLINIC_ADDRESS_WA = 'Charcas 3889, 5º B, Palermo';

function kinesica_b64url_encode(string $raw): string
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

function kinesica_b64url_decode(string $b64url): ?string
{
    if ($b64url === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $b64url)) {
        return null;
    }
    $rem = strlen($b64url) % 4;
    if ($rem === 1) {
        return null;
    }
    if ($rem > 0) {
        $b64url .= str_repeat('=', 4 - $rem);
    }
    $decoded = base64_decode(strtr($b64url, '-_', '+/'), true);
    return is_string($decoded) ? $decoded : null;
}

/** @param array<string,mixed> $localCfg @return list<string> */
function kinesica_confirmation_signing_secrets(array $localCfg = []): array
{
    $candidates = [
        getenv('KINESICA_CONFIRM_SECRET') ?: '',
        $_SERVER['KINESICA_CONFIRM_SECRET'] ?? $_ENV['KINESICA_CONFIRM_SECRET'] ?? '',
        $localCfg['confirm_token_secret'] ?? '',
        getenv('KINESICA_GAS_API_SECRET') ?: '',
        $_SERVER['KINESICA_GAS_API_SECRET'] ?? $_ENV['KINESICA_GAS_API_SECRET'] ?? '',
        $localCfg['gas_api_secret'] ?? '',
        getenv('KINESICA_BACKUP_SECRET') ?: '',
        $_SERVER['KINESICA_BACKUP_SECRET'] ?? $_ENV['KINESICA_BACKUP_SECRET'] ?? '',
        $localCfg['webhook_secret'] ?? '',
    ];
    $out = [];
    foreach ($candidates as $raw) {
        $s = trim((string) $raw);
        if ($s !== '' && !in_array($s, $out, true)) {
            $out[] = $s;
        }
    }
    return $out;
}

/** Genera confirmToken compatible con booking/gas/12-confirm-token.js. */
function kinesica_confirmation_sign_token(array $info, array $localCfg = [], string $src = 'backup', ?int $now = null): string
{
    $eventId = trim((string) ($info['eventId'] ?? $info['eid'] ?? ''));
    $secrets = kinesica_confirmation_signing_secrets($localCfg);
    if ($eventId === '' || $secrets === []) {
        return '';
    }
    $iat = $now ?? time();
    $srvRaw = trim((string) ($info['especialidad'] ?? ''));
    if ($srvRaw === '') {
        $srvRaw = trim((string) ($info['motivo'] ?? $info['srv'] ?? ''));
    }
    $claims = [
        'v' => 1,
        'eid' => mb_substr($eventId, 0, 160, 'UTF-8'),
        'iat' => $iat,
        'exp' => $iat + KINESICA_CONFIRM_TOKEN_TTL_SEC,
        'tel' => mb_substr(trim((string) ($info['telefono'] ?? $info['tel'] ?? '')), 0, 30, 'UTF-8'),
        'email' => mb_substr(trim((string) ($info['email'] ?? '')), 0, 120, 'UTF-8'),
        'nom' => mb_substr(trim((string) ($info['nombre'] ?? $info['nom'] ?? '')), 0, 120, 'UTF-8'),
        'date' => mb_substr(trim((string) ($info['date'] ?? $info['fecha'] ?? '')), 0, 20, 'UTF-8'),
        'time' => mb_substr(trim((string) ($info['time'] ?? $info['hora'] ?? '')), 0, 10, 'UTF-8'),
        'pid' => mb_substr(strtolower(trim((string) ($info['practitionerId'] ?? $info['pid'] ?? ''))), 0, 30, 'UTF-8'),
        'srv' => mb_substr($srvRaw, 0, 80, 'UTF-8'),
        'src' => $src,
    ];
    $json = json_encode($claims, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json) || $json === '') {
        return '';
    }
    $signingInput = 'v1.' . kinesica_b64url_encode($json);
    return $signingInput . '.' . kinesica_b64url_encode(hash_hmac('sha256', $signingInput, $secrets[0], true));
}

/**
 * Verifica firma, estructura y vigencia de confirmToken (fail-closed si falta secreto).
 *
 * @return array{ok:bool,reason?:string,claims?:array<string,mixed>}
 */
function kinesica_confirmation_verify_token(string $token, array $localCfg = [], ?int $now = null): array
{
    $token = trim($token);
    if ($token === '') {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_REQUIRED'];
    }
    $secrets = kinesica_confirmation_signing_secrets($localCfg);
    if ($secrets === []) {
        return ['ok' => false, 'reason' => 'CONFIRM_SECRET_MISSING'];
    }
    $parts = explode('.', $token);
    if (count($parts) !== 3 || $parts[0] !== 'v1' || $parts[1] === '' || $parts[2] === '') {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_MALFORMED'];
    }
    $signingInput = 'v1.' . $parts[1];
    $sigValid = false;
    foreach ($secrets as $sec) {
        if (hash_equals(kinesica_b64url_encode(hash_hmac('sha256', $signingInput, $sec, true)), $parts[2])) {
            $sigValid = true;
            break;
        }
    }
    if (!$sigValid) {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_INVALID'];
    }
    $rawJson = kinesica_b64url_decode($parts[1]);
    $claims = is_string($rawJson) ? json_decode($rawJson, true) : null;
    if (!is_array($claims) || (int) ($claims['v'] ?? 0) !== 1) {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_PAYLOAD'];
    }
    $eid = trim((string) ($claims['eid'] ?? ''));
    $iat = (int) ($claims['iat'] ?? 0);
    $exp = (int) ($claims['exp'] ?? 0);
    $ts = $now ?? time();
    if ($eid === '' || $iat <= 0 || $exp <= $iat || ($exp - $iat) > KINESICA_CONFIRM_TOKEN_MAX_TTL_SEC) {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_PAYLOAD'];
    }
    if ($iat > $ts + KINESICA_CONFIRM_TOKEN_SKEW_SEC) {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_NOT_YET_VALID'];
    }
    if ($exp < $ts) {
        return ['ok' => false, 'reason' => 'CONFIRM_TOKEN_EXPIRED'];
    }
    return ['ok' => true, 'claims' => $claims];
}

function kinesica_confirmation_practitioner_label(string $practitionerId): string
{
    $pid = strtolower(trim($practitionerId));
    if ($pid === 'maria') {
        return 'Lic. María Gulin';
    }
    if ($pid === 'norberto') {
        return 'Lic. Norberto Brude';
    }
    return 'Kinésica';
}

function kinesica_confirmation_wa_state_dir(): string
{
    $envDir = trim((string) (getenv('KINESICA_CONFIRM_STATE_DIR') ?: ''));
    return $envDir !== '' ? rtrim($envDir, '/') : (rtrim(sys_get_temp_dir(), '/') . '/kinesica_conf_wa_state');
}

/** @param callable(array<string,mixed>):array{0:array<string,mixed>,1:mixed} $mutator */
function kinesica_confirmation_wa_state_lock(string $eventId, callable $mutator): mixed
{
    $dir = kinesica_confirmation_wa_state_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null;
    }
    $fh = @fopen($dir . '/ev_' . hash('sha256', $eventId) . '.json', 'c+');
    if (!$fh) {
        return null;
    }
    flock($fh, LOCK_EX);
    $state = json_decode((string) stream_get_contents($fh) ?: '{}', true);
    if (!is_array($state)) {
        $state = [];
    }
    [$nextState, $result] = $mutator($state);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, (string) json_encode($nextState));
    flock($fh, LOCK_UN);
    fclose($fh);
    return $result;
}

/**
 * Reserva atómica por eventId (evita duplicados/replay) + tope diario global.
 *
 * @return array{allowed:bool,already_sent?:bool,reason?:string}
 */
function kinesica_confirmation_wa_claim(string $eventId, ?int $now = null): array
{
    $eid = trim($eventId);
    if ($eid === '') {
        return ['allowed' => false, 'reason' => 'EVENT_ID_REQUIRED'];
    }
    $ts = $now ?? time();
    $res = kinesica_confirmation_wa_state_lock($eid, static function (array $state) use ($ts): array {
        if (!empty($state['sent'])) {
            return [$state, ['allowed' => false, 'already_sent' => true, 'reason' => 'WA_ALREADY_SENT']];
        }
        $attempts = (int) ($state['attempts'] ?? 0);
        if ($attempts >= KINESICA_CONFIRM_WA_MAX_ATTEMPTS_PER_EVENT) {
            return [$state, ['allowed' => false, 'reason' => 'WA_EVENT_LIMIT']];
        }
        if (function_exists('kinesica_confirmation_rate_ok')
            && !kinesica_confirmation_rate_ok('wa_global_daily', KINESICA_CONFIRM_WA_DAILY_CAP, 86400)) {
            return [$state, ['allowed' => false, 'reason' => 'WA_DAILY_CAP']];
        }
        $state['attempts'] = $attempts + 1;
        $state['last_attempt_ts'] = $ts;
        return [$state, ['allowed' => true]];
    });
    return is_array($res) ? $res : ['allowed' => false, 'reason' => 'WA_STATE_UNAVAILABLE'];
}

function kinesica_confirmation_wa_mark_sent(string $eventId, ?int $now = null): void
{
    $eid = trim($eventId);
    if ($eid === '') {
        return;
    }
    $ts = $now ?? time();
    kinesica_confirmation_wa_state_lock($eid, static function (array $state) use ($ts): array {
        $state['sent'] = true;
        $state['sent_ts'] = $ts;
        return [$state, true];
    });
}
