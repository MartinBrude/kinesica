/**
 * Kinésica Admin - Cliente HTTP y Capa de API
 * Centraliza las peticiones hacia el backend PHP (/admin/api/*) con credenciales seguras,
 * cabecera de verificación anti-CSRF (X-Kinesica: 1) y detección de sesión caducada.
 */

let onAuthRequiredHandler = null;

/**
 * Registra el callback global que se ejecutará cuando la API responda con 401 Unauthorized.
 * @param {(data: object) => void} handler Callback que muestra la pantalla de login/gate
 */
export function setAuthRequiredHandler(handler) {
  onAuthRequiredHandler = handler;
}

/**
 * Realiza una petición HTTP JSON contra el backend del módulo admin.
 * @param {string} path Ruta relativa dentro de /admin/api/ (ej: "fichas.php")
 * @param {RequestInit} [options={}] Opciones estándar de fetch
 * @returns {Promise<any>} Respuesta deserializada en JSON
 * @throws {Error} Error estructurado con propiedad .auth en caso de 401
 */
export async function api(path, options = {}) {
  const headers = {
    "X-Kinesica": "1",
    ...(options.headers || {}),
  };

  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`api/${path}`, {
    credentials: "same-origin",
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !data.error) {
    if (typeof onAuthRequiredHandler === "function") {
      onAuthRequiredHandler(data);
    }
    const error = new Error("auth");
    error.auth = true;
    error.payload = data;
    throw error;
  }

  if (!res.ok) {
    const error = new Error(data.error || "No se pudo completar");
    error.payload = data;
    error.status = res.status;
    throw error;
  }

  return data;
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) al formato local legible DD/MM/AAAA.
 * @param {string|null|undefined} iso Fecha en formato YYYY-MM-DD
 * @returns {string} Fecha formateada
 */
export function formatDate(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
