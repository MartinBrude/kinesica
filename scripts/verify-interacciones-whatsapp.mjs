#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  resolveSenderName,
  buildWhatsAppFollowupMessage,
  buildWhatsAppUrl,
} from "../admin/modules/interacciones-message.js";
import { buildInteractionCardHtml } from "../admin/modules/interacciones-render.js";
import { filterInteractionsList, renderStatsHeader } from "../admin/modules/interacciones-filter.js";

console.log("— verify-interacciones-whatsapp —");

// 1. Tests de resolución de nombre de profesional (resolveSenderName)
assert.equal(resolveSenderName("Norberto"), "Norberto");
assert.equal(resolveSenderName("norberto"), "Norberto");
assert.equal(resolveSenderName("Lic. Norberto Brude"), "Norberto");
assert.equal(resolveSenderName({ name: "Norberto Brude" }), "Norberto");
assert.equal(resolveSenderName({ username: "norberto" }), "Norberto");
assert.equal(resolveSenderName({ first_name: "Norberto", last_name: "Brude" }), "Norberto");

assert.equal(resolveSenderName("María"), "María");
assert.equal(resolveSenderName("Maria"), "María");
assert.equal(resolveSenderName("maria"), "María");
assert.equal(resolveSenderName("Lic. María Gulin"), "María");
assert.equal(resolveSenderName({ name: "María Gulin" }), "María");
assert.equal(resolveSenderName({ first_name: "Maria" }), "María");

assert.equal(resolveSenderName("Martín"), "Martín");
assert.equal(resolveSenderName("Martin"), "Martín");
assert.equal(resolveSenderName("martin"), "Martín");
assert.equal(resolveSenderName("Martín Brude"), "Martín");
assert.equal(resolveSenderName({ name: "Martín Brude" }), "Martín");
assert.equal(resolveSenderName({ username: "martin" }), "Martín");

assert.equal(resolveSenderName(null), "Norberto");
assert.equal(resolveSenderName(undefined), "Norberto");
assert.equal(resolveSenderName(""), "Norberto");
assert.equal(resolveSenderName("Gonzalo Pérez"), "Gonzalo");

// 2. Tests de texto de seguimiento preescrito (buildWhatsAppFollowupMessage)
const norbertoExpected =
  "Buen día!\nSoy Norberto, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
assert.equal(buildWhatsAppFollowupMessage("Norberto"), norbertoExpected);
assert.equal(buildWhatsAppFollowupMessage({ name: "Lic. Norberto Brude" }), norbertoExpected);

const mariaExpected =
  "Buen día!\nSoy María, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
assert.equal(buildWhatsAppFollowupMessage("María"), mariaExpected);
assert.equal(buildWhatsAppFollowupMessage({ name: "Lic. María Gulin" }), mariaExpected);

const martinExpected =
  "Buen día!\nSoy Martín, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
assert.equal(buildWhatsAppFollowupMessage("Martín"), martinExpected);
assert.equal(buildWhatsAppFollowupMessage({ username: "martin" }), martinExpected);

// 3. Tests de armado de URL de WhatsApp (buildWhatsAppUrl)
const urlEs = buildWhatsAppUrl("+34 658 44 49 35", "María");
assert.ok(urlEs.startsWith("https://wa.me/34658444935?text="));
const urlParamsEs = new URL(urlEs).searchParams;
assert.equal(urlParamsEs.get("text"), mariaExpected);

const urlAr = buildWhatsAppUrl("+54 9 11 5560-2178", "Martín");
assert.ok(urlAr.startsWith("https://wa.me/5491155602178?text="));
assert.equal(new URL(urlAr).searchParams.get("text"), martinExpected);

assert.equal(buildWhatsAppUrl("", "Norberto"), "#");
assert.equal(buildWhatsAppUrl(null, "Norberto"), "#");

// 4. Tests de integración con buildInteractionCardHtml
const mockConv = {
  id: "conv_test_1",
  wa_id: "+54 9 11 6484-0132",
  phone_formatted: "+54 9 11 6484-0132",
  patient_name: "Lucía Fernández",
  time: "10:30",
  summary: "Consulta por kinesiología",
  messages: [{ from: "patient", text: "Hola!" }],
};

const cardMaria = buildInteractionCardHtml(mockConv, 0, "María");
assert.ok(cardMaria.includes('class="btn-whatsapp-direct"'));
assert.ok(cardMaria.includes("https://wa.me/5491164840132?text="));
assert.ok(cardMaria.includes(encodeURIComponent("Soy María, de Kinésica.")));

const cardMartin = buildInteractionCardHtml(mockConv, 0, "Martín");
assert.ok(cardMartin.includes(encodeURIComponent("Soy Martín, de Kinésica.")));

const cardNorberto = buildInteractionCardHtml(mockConv, 0, "Norberto");
assert.ok(cardNorberto.includes(encodeURIComponent("Soy Norberto, de Kinésica.")));
assert.ok(cardNorberto.includes('title="Archivar conversación"'));

const mockArchivedConv = {
  ...mockConv,
  id: "conv_test_archived",
  archived: true,
};
const cardArchived = buildInteractionCardHtml(mockArchivedConv, 1, "Norberto");
assert.ok(cardArchived.includes("is-archived"));
assert.ok(cardArchived.includes('title="Desarchivar conversación"'));
assert.ok(cardArchived.includes('data-archived="1"'));

// 5. Tests de filtro por archivadas y estadísticas
const sampleList = [
  { id: "1", wa_id: "549111", patient_name: "Ana", answered: false, archived: false },
  { id: "2", wa_id: "549112", patient_name: "Beto", answered: true, archived: false },
  { id: "3", wa_id: "549113", patient_name: "Carlos", answered: false, archived: true },
  { id: "4", wa_id: "549114", patient_name: "Diana", answered: true, archived: true },
];

const allActive = filterInteractionsList(sampleList, "", "all");
assert.equal(allActive.length, 2);
assert.deepEqual(allActive.map((i) => i.id), ["1", "2"]);

const onlyPending = filterInteractionsList(sampleList, "", "pending");
assert.equal(onlyPending.length, 1);
assert.equal(onlyPending[0].id, "1");

const onlyAnswered = filterInteractionsList(sampleList, "", "answered");
assert.equal(onlyAnswered.length, 1);
assert.equal(onlyAnswered[0].id, "2");

const onlyArchived = filterInteractionsList(sampleList, "", "archived");
assert.equal(onlyArchived.length, 2);
assert.deepEqual(onlyArchived.map((i) => i.id), ["3", "4"]);

// Test de renderStatsHeader con la cápsula de archivadas en lugar del contador
let fakeTotalText = "";
globalThis.document = {
  getElementById: (id) => {
    if (id === "interacciones-total-contacts") {
      return {
        set textContent(val) {
          fakeTotalText = val;
        },
        get textContent() {
          return fakeTotalText;
        },
      };
    }
    return null;
  },
};

const fakeStatsEl = { innerHTML: "" };
renderStatsHeader(fakeStatsEl, { cachedInteractions: sampleList, activeStatusFilter: "all" });
assert.ok(fakeStatsEl.innerHTML.includes('data-filter="archived"'));
assert.ok(fakeStatsEl.innerHTML.includes("2 archivadas"));
assert.ok(!fakeStatsEl.innerHTML.includes('<span class="interacciones-stat-pill">👥'));
assert.equal(fakeTotalText, "👥 2 personas");

console.log("interacciones WhatsApp: ok (todas las pruebas pasaron)");
