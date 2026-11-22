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
import { buildDemoConfirmationHtml } from "./serve-booking-demo-mail.mjs";

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
  "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec";

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
        const html = buildDemoConfirmationHtml(body);

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
