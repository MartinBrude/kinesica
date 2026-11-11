#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildInteractionCardHtml } from "../admin/modules/interacciones-render.js";
import { filterInteractionsList } from "../admin/modules/interacciones-filter.js";
import { CONTACT } from "./site-contact.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

console.log("— verify-meta-interactions —");

// 1. Arquitectura: webhook_meta.php < 250 líneas
const webhookPath = path.join(root, "admin/api/webhook_meta.php");
assert.ok(fs.existsSync(webhookPath), "admin/api/webhook_meta.php debe existir");
const lines = fs.readFileSync(webhookPath, "utf8").split("\n").length;
assert.ok(lines <= 250, `webhook_meta.php supera 250 líneas: ${lines}`);
console.log(`  ✓ webhook_meta.php: ${lines} líneas (<= 250)`);

// 2. Renderizado de tarjeta para conversación de Instagram
const mockIgConv = {
  id: "conv_ig_17841400",
  channel: "instagram",
  wa_id: "ig_marcos_kine",
  phone_formatted: "@marcos_kine",
  patient_name: "Marcos Kine",
  time: "15:45",
  summary: "Hola, vi la publicación de columna y quiero consultar por un turno",
  messages: [{ from: "patient", text: "Hola, vi la publicación de columna y quiero consultar por un turno" }],
  answered: false,
  archived: false,
};

const cardIg = buildInteractionCardHtml(mockIgConv, 0, "Norberto");
assert.ok(cardIg.includes('class="btn-instagram-direct"'), "Debe incluir botón específico para abrir Instagram");
assert.ok(cardIg.includes('https://www.instagram.com/direct/inbox/'), "Debe enlazar a Instagram Direct");
assert.ok(cardIg.includes("interaccion-badge-instagram"), "Debe tener badge visual con gradiente de Instagram");
assert.ok(cardIg.includes("@marcos_kine"), "Debe mostrar el handle de Instagram");
assert.ok(!cardIg.includes("btn-whatsapp-direct"), "No debe mostrar botón de WhatsApp en chats de Instagram");
console.log("  ✓ Renderizado de tarjeta de Instagram DM validado.");

// 3. Filtrado por canal "instagram" / "ig" / "@handle"
const mixedList = [
  { id: "1", channel: "whatsapp", wa_id: "5491155602178", patient_name: "Juan", summary: "Turno", messages: [] },
  { id: "2", channel: "instagram", wa_id: "ig_sofia", patient_name: "Sofia", summary: "Consulta", messages: [] },
  { id: "3", channel: "whatsapp", wa_id: CONTACT.whatsappDigits, patient_name: "Pedro", summary: "RPG", messages: [] },
];

const igFiltered = filterInteractionsList(mixedList, "instagram", "all");
assert.equal(igFiltered.length, 1);
assert.equal(igFiltered[0].id, "2");

const handleFiltered = filterInteractionsList(mixedList, "sofia", "all");
assert.equal(handleFiltered.length, 1);
assert.equal(handleFiltered[0].id, "2");
console.log("  ✓ Filtro de búsqueda por canal 'instagram' y handle validado.");

console.log("✅ Todas las verificaciones de Meta / Instagram en Interacciones pasaron correctamente.\n");
