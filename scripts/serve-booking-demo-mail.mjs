/**
 * HTML confirmation email builder for the local booking demo server.
 */
import { CONTACT } from "./site-contact.mjs";
import { SITE } from "./i18n-urls.mjs";

export function buildDemoConfirmationHtml(body) {
  const indicacionPuntualidad =
    "Por las características del espacio y para respetar las sesiones en curso, <strong>te pedimos llegar puntual a la hora de tu turno, ni antes ni después</strong>.";

  const indicacionAcompaniante = body.esMenor
    ? "El menor debe ingresar acompañado por un adulto responsable."
    : "Por razones de espacio y concentración durante el tratamiento, <strong>asistir sin acompañantes</strong> (salvo necesidad de asistencia).";

  const servicioTexto = body.servicio ? ` (${body.servicio})` : "";
  const direccion =
    body.direccion ||
    `${CONTACT.address.streetAddress}, Piso 5º B, ${CONTACT.address.neighborhood}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 20px; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; }
    .wrapper { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5e9f0; }
    .header { padding: 30px 20px 20px 20px; text-align: center; border-bottom: 2px solid #005f99; }
    .logo { max-width: 180px; height: auto; display: block; margin: 0 auto; }
    .content { padding: 30px 26px; color: #2c3e50; font-size: 15px; line-height: 1.6; }
    .greeting { font-size: 18px; font-weight: 600; color: #1a252f; margin: 0 0 12px 0; }
    .lead-text { color: #556575; margin-bottom: 22px; }
    .card-details { background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #005f99; border-radius: 6px; padding: 16px 18px; margin-bottom: 24px; }
    .detail-item { margin: 6px 0; font-size: 15px; color: #334155; }
    .detail-item strong { min-width: 100px; display: inline-block; color: #005f99; }
    .card-guidelines { background-color: #fafbfc; border: 1px solid #e9ecef; border-radius: 8px; padding: 18px 20px; margin-bottom: 20px; }
    .guidelines-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #005f99; margin: 0 0 12px 0; }
    .guidelines-list { margin: 0; padding-left: 18px; color: #475569; }
    .guidelines-list li { margin-bottom: 9px; font-size: 14px; line-height: 1.5; }
    .footer { text-align: center; padding: 22px; font-size: 12px; color: #8a99a8; background-color: #f8fafc; border-top: 1px solid #edf2f7; }
    .footer a { color: #005f99; text-decoration: none; font-weight: 500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <img src="${SITE}/images/logo.png" alt="Kinésica" class="logo">
    </div>
    <div class="content">
      <h1 class="greeting">Turno confirmado</h1>
      <p class="lead-text">Hola <strong>${body.paciente}</strong>, registramos tu reserva con los siguientes datos:</p>
      <div class="card-details">
        <div class="detail-item"><strong>Fecha:</strong> ${body.fecha}</div>
        <div class="detail-item"><strong>Horario:</strong> ${body.hora} hs</div>
        <div class="detail-item"><strong>Atención:</strong> ${body.profesional}${servicioTexto}</div>
        <div class="detail-item"><strong>Dirección:</strong> ${direccion}</div>
      </div>
      <div class="card-guidelines">
        <div class="guidelines-title">Información importante para tu sesión</div>
        <ul class="guidelines-list">
          <li><strong>Puntualidad:</strong> ${indicacionPuntualidad}</li>
          <li><strong>Ropa adecuada:</strong> Concurrir con <em>ropa cómoda y flexible</em> (short o calza corta; si sos mujer, corpiño no deportivo) que permita evaluar la postura y la zona a tratar.</li>
          <li><strong>Estudios previos:</strong> Traer estudios y derivación médica si los tuviese.</li>
          <li><strong>Acompañantes:</strong> ${indicacionAcompaniante}</li>
        </ul>
      </div>
      <p style="font-size: 13px; color: #64748b; margin-top: 18px;">
        Si necesitás reprogramar o cancelar, por favor avisanos con anticipación para poder disponer del espacio para otro paciente.
      </p>
    </div>
    <div class="footer">
      <p style="margin: 0 0 6px 0;"><strong>Kinésica</strong> · Terapias Manuales & Rehabilitación</p>
      <p style="margin: 0;"><a href="${SITE}" target="_blank">www.kinesica.com.ar</a></p>
    </div>
  </div>
</body>
</html>`;
}
