#!/usr/bin/env node
/**
 * Servidor HTTP local para previsualizar el módulo de reservas
 * =============================================================
 * Ejecución: node scripts/serve-booking-demo.mjs
 * Abre: http://localhost:3000/booking/
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTACT } from "./site-contact.mjs";
import { SITE } from "./i18n-urls.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const GAS_WEBHOOK_URL =
  "https://script.google.com/macros/s/AKfycbzO3WZtQ4E3e0mZskicMs8unys26bPiNR3pvRpjbV78AUM9CCpWRGnALPGBqGl4fEBAbw/exec";

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];

  // Proxy local de desarrollo hacia Google Apps Script (elimina problemas de CORS y 302 en navegadores)
  if (reqPath === "/api/booking" || reqPath === "/api/booking/") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      });
      res.end();
      return;
    }

    const incomingUrl = new URL(req.url, `http://${req.headers.host || "localhost:3000"}`);
    const targetUrl = new URL(GAS_WEBHOOK_URL);
    incomingUrl.searchParams.forEach((v, k) => targetUrl.searchParams.set(k, v));

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      const bodyBuffer = Buffer.concat(chunks);
      try {
        const fetchOptions = {
          method: req.method,
          redirect: "follow",
          headers: {
            "Content-Type": req.headers["content-type"] || "text/plain;charset=utf-8",
          },
        };
        if (req.method !== "GET" && req.method !== "HEAD" && bodyBuffer.length > 0) {
          fetchOptions.body = bodyBuffer.toString("utf-8");
        }

        const gasResponse = await fetch(targetUrl.toString(), fetchOptions);
        const text = await gasResponse.text();

        res.writeHead(gasResponse.status, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end(text);
      } catch (err) {
        res.writeHead(502, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ status: "error", message: err.message }));
      }
    });
    return;
  }

  // Soporte para envío de emails de confirmación en desarrollo local
  if (reqPath === "/api/send-confirmation.php") {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
        const apiKey = process.env.RESEND_API_KEY || "";

        const indicacionPuntualidad = body.esMenor
          ? "Al tratarse de un paciente menor de edad, recomendamos presentarse 5 a 10 minutos antes junto a un adulto responsable."
          : "Por las características del espacio y para respetar las sesiones en curso, <strong>te pedimos llegar puntual a la hora de tu turno, ni antes ni después</strong>.";

        const indicacionAcompaniante = body.esMenor
          ? "El menor debe ingresar acompañado por un adulto responsable."
          : "Por razones de espacio y concentración durante el tratamiento, <strong>asistir sin acompañantes</strong> (salvo necesidad de asistencia).";

        const servicioTexto = body.servicio ? ` (${body.servicio})` : "";
        const direccion =
          body.direccion ||
          `${CONTACT.address.streetAddress}, Piso 5º B, ${CONTACT.address.neighborhood} (entre Scalabrini Ortiz y Aráoz)`;

        const html = `<!DOCTYPE html>
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

        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Kinésica <onboarding@resend.dev>",
            to: [body.email],
            subject: `Confirmación de turno - ${body.fecha} (${body.hora} hs)`,
            html: html,
          }),
        });

        const resendData = await resendRes.json();
        res.writeHead(resendRes.status, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ success: resendRes.ok, data: resendData }));
      } catch (e) {
        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  if (reqPath === "/booking" || reqPath === "/booking/" || reqPath === "/turnos" || reqPath === "/turnos/") {
    res.writeHead(302, { Location: "/agendar" });
    res.end();
    return;
  }
  if (reqPath === "/agendar" || reqPath === "/agendar/") {
    reqPath = "/agendar.html";
  } else if (/^\/(en|fr|pt)\/agendar\/?$/.test(reqPath)) {
    reqPath = reqPath.replace(/\/?$/, ".html");
  } else if (reqPath === "/" || reqPath === "") {
    reqPath = "/index.html";
  } else if (/^\/(en|fr|pt)\/?$/.test(reqPath)) {
    reqPath = reqPath.replace(/\/?$/, "/index.html");
  }

  const filePath = path.join(ROOT, reqPath);

  // Seguridad: evitar directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Acceso denegado");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 No encontrado: " + reqPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🌿 Servidor de pruebas de Kinésica corriendo:`);
  console.log(`👉 Abrí en tu navegador: http://localhost:${PORT}/agendar\n`);
  console.log(`Presiona Ctrl+C para detener el servidor.\n`);
});
