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

const server = http.createServer((req, res) => {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/booking" || reqPath === "/booking/") {
    res.writeHead(302, { Location: "/#agendar" });
    res.end();
    return;
  }
  if (reqPath === "/" || reqPath === "") {
    reqPath = "/index.html";
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
  console.log(`👉 Abrí en tu navegador: http://localhost:${PORT}/booking/\n`);
  console.log(`Presiona Ctrl+C para detener el servidor.\n`);
});
