/**
 * Kinésica GAS — Firma HMAC-SHA256 de confirmación de turno (anti-abuso WhatsApp/mail).
 * Archivo parte del proyecto Apps Script (ámbito global compartido). Ver 00-config.js.
 *
 * Formato del token: v1.<base64url(claims_json)>.<base64url(hmac_sha256)>
 * Secreto compartido con PHP: CONFIRM_TOKEN_SECRET || GAS_API_SECRET || WEBHOOK_SECRET.
 */

const CONFIRM_TOKEN_TTL_SECONDS = 1800; // 30 min para envío y reintento de confirmación

function resolveConfirmTokenSecret() {
  try {
    const props = PropertiesService.getScriptProperties();
    return String(
      props.getProperty("CONFIRM_TOKEN_SECRET")
      || props.getProperty("GAS_API_SECRET")
      || props.getProperty("WEBHOOK_SECRET")
      || ""
    ).trim();
  } catch (e) {
    return "";
  }
}

function confirmTokenBase64Url(input) {
  let encoded;
  if (typeof input === "string") {
    encoded = Utilities.base64EncodeWebSafe(input, Utilities.Charset.UTF_8);
  } else {
    encoded = Utilities.base64EncodeWebSafe(input);
  }
  return String(encoded || "").replace(/=+$/, "");
}

/**
 * Firma un token autocontenido con los datos confiables del turno recién creado.
 * Si no hay secreto configurado, devuelve "" (PHP rechaza WA en modo fail-closed).
 */
function signBookingConfirmationToken(info) {
  if (!info || !info.eventId) return "";
  const secret = resolveConfirmTokenSecret();
  if (!secret) return "";

  const nowSec = Math.floor(Date.now() / 1000);
  const claims = {
    v: 1,
    eid: String(info.eventId || "").trim().slice(0, 160),
    iat: nowSec,
    exp: nowSec + CONFIRM_TOKEN_TTL_SECONDS,
    tel: String(info.telefono || "").trim().slice(0, 30),
    email: String(info.email || "").trim().slice(0, 120),
    nom: String(info.nombre || "").trim().slice(0, 120),
    date: String(info.date || "").trim().slice(0, 20),
    time: String(info.time || "").trim().slice(0, 10),
    pid: String(info.practitionerId || "").trim().toLowerCase().slice(0, 30),
    srv: String(info.especialidad || "").trim().slice(0, 80),
    src: "gas"
  };

  try {
    const payloadB64 = confirmTokenBase64Url(JSON.stringify(claims));
    const signingInput = "v1." + payloadB64;
    const sigBytes = Utilities.computeHmacSha256Signature(
      signingInput,
      secret,
      Utilities.Charset.UTF_8
    );
    return signingInput + "." + confirmTokenBase64Url(sigBytes);
  } catch (e) {
    console.error("signBookingConfirmationToken: " + e);
    return "";
  }
}
