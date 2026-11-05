#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  resolveSenderName,
  buildWhatsAppFollowupMessage,
  buildWhatsAppUrl,
} from "../admin/modules/interacciones-message.js";
import { buildInteractionCardHtml, renderAttachmentHtml } from "../admin/modules/interacciones-render.js";
import { filterInteractionsList, renderStatsHeader } from "../admin/modules/interacciones-filter.js";
import { isMartinBrudePhone, getKnownContactName } from "../admin/modules/phone-search.js";

console.log("— verify-interacciones-whatsapp —");

// 1. Tests de resolución de nombre de profesional (resolveSenderName)
assert.equal(resolveSenderName("Norberto"), "Norberto Brude");
assert.equal(resolveSenderName("norberto"), "Norberto Brude");
assert.equal(resolveSenderName("Lic. Norberto Brude"), "Norberto Brude");
assert.equal(resolveSenderName({ name: "Norberto Brude" }), "Norberto Brude");
assert.equal(resolveSenderName({ username: "norberto" }), "Norberto Brude");
assert.equal(resolveSenderName({ first_name: "Norberto", last_name: "Brude" }), "Norberto Brude");

assert.equal(resolveSenderName("María"), "María Gulin");
assert.equal(resolveSenderName("Maria"), "María Gulin");
assert.equal(resolveSenderName("maria"), "María Gulin");
assert.equal(resolveSenderName("Lic. María Gulin"), "María Gulin");
assert.equal(resolveSenderName({ name: "María Gulin" }), "María Gulin");
assert.equal(resolveSenderName({ first_name: "Maria" }), "María Gulin");

assert.equal(resolveSenderName("Martín"), "Martín Brude");
assert.equal(resolveSenderName("Martin"), "Martín Brude");
assert.equal(resolveSenderName("martin"), "Martín Brude");
assert.equal(resolveSenderName("Martín Brude"), "Martín Brude");
assert.equal(resolveSenderName({ name: "Martín Brude" }), "Martín Brude");
assert.equal(resolveSenderName({ username: "martin" }), "Martín Brude");

assert.equal(resolveSenderName(null), "Norberto Brude");
assert.equal(resolveSenderName(undefined), "Norberto Brude");
assert.equal(resolveSenderName(""), "Norberto Brude");
assert.equal(resolveSenderName("Gonzalo Pérez"), "Gonzalo Pérez");

// 2. Tests de texto de seguimiento preescrito (buildWhatsAppFollowupMessage)
const norbertoExpected =
  "Buen día!\nSoy Norberto Brude, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
assert.equal(buildWhatsAppFollowupMessage("Norberto"), norbertoExpected);
assert.equal(buildWhatsAppFollowupMessage({ name: "Lic. Norberto Brude" }), norbertoExpected);

const mariaExpected =
  "Buen día!\nSoy María Gulin, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
assert.equal(buildWhatsAppFollowupMessage("María"), mariaExpected);
assert.equal(buildWhatsAppFollowupMessage({ name: "Lic. María Gulin" }), mariaExpected);

const martinExpected =
  "Buen día!\nSoy Martín Brude, de Kinésica.\nVi que estuviste consultando para coordinar un turno pero no llegamos a agendar.\n¿Te quedó alguna duda? ¿Querés que agendemos la sesión?";
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
assert.ok(cardMaria.includes(encodeURIComponent("Soy María Gulin, de Kinésica.")));

const cardMartin = buildInteractionCardHtml(mockConv, 0, "Martín");
assert.ok(cardMartin.includes(encodeURIComponent("Soy Martín Brude, de Kinésica.")));

const cardNorberto = buildInteractionCardHtml(mockConv, 0, "Norberto");
assert.ok(cardNorberto.includes(encodeURIComponent("Soy Norberto Brude, de Kinésica.")));
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
  { id: "5", wa_id: "549115", patient_name: "Eva", answered: "false", archived: "0" },
];

const allActive = filterInteractionsList(sampleList, "", "all");
assert.equal(allActive.length, 3);
assert.deepEqual(allActive.map((i) => i.id), ["1", "2", "5"]);

const onlyPending = filterInteractionsList(sampleList, "", "pending");
assert.equal(onlyPending.length, 2);
assert.deepEqual(onlyPending.map((i) => i.id), ["1", "5"]);

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
assert.equal(fakeTotalText, "👥 3 personas");

// Test de renderStatsHeader con filtro 'pending' activo por defecto
renderStatsHeader(fakeStatsEl, { cachedInteractions: sampleList, activeStatusFilter: "pending" });
assert.ok(fakeStatsEl.innerHTML.includes('data-filter="pending"'));
assert.ok(fakeStatsEl.innerHTML.includes("filter-pending is-active"));
assert.ok(fakeStatsEl.innerHTML.includes('aria-pressed="true"'));

// 6. Tests de identificación de Martín Brude (+34 658 44 49 35)
assert.ok(isMartinBrudePhone("+34 658 44 49 35"));
assert.ok(isMartinBrudePhone("34658444935"));
assert.ok(isMartinBrudePhone("658444935"));
assert.ok(isMartinBrudePhone("+34658444935"));
assert.equal(isMartinBrudePhone("5491161164311"), false);
assert.equal(getKnownContactName("+34 658 44 49 35"), "Martín Brude");
assert.equal(getKnownContactName("34658444935"), "Martín Brude");

// Verificación de tarjeta sin nombre inicial para +34 658 44 49 35
const cardMartinPhone = buildInteractionCardHtml({
  id: "exec_test_martin",
  wa_id: "34658444935",
  phone_formatted: "+34 658 44 49 35",
  patient_name: "", // vacío a propósito
  time: "12:00",
  summary: "Prueba desde España",
  messages: [{ from: "patient", text: "Hola Clara" }],
}, 0, "Norberto");

assert.ok(cardMartinPhone.includes("Martín Brude"), "Debe mostrar 'Martín Brude' como nombre");
assert.ok(cardMartinPhone.includes('<div class="interaccion-avatar" aria-hidden="true">M</div>'), "Inicial debe ser M");
assert.ok(cardMartinPhone.includes('<div class="chat-bubble-sender">Martín Brude</div>'), "Burbuja de mensaje debe decir Martín Brude");

// Búsqueda tolerante en interacciones
const testListMartin = [
  { id: "m1", wa_id: "34658444935", phone_formatted: "+34 658 44 49 35", patient_name: "Martín Brude", answered: false, archived: false },
  { id: "o1", wa_id: "5491169289637", phone_formatted: "+54 9 11 6928-9637", patient_name: "Olivia Di Carlo", answered: false, archived: false },
];
assert.equal(filterInteractionsList(testListMartin, "martin").length, 1, "Búsqueda 'martin' debe encontrar a Martín Brude");
assert.equal(filterInteractionsList(testListMartin, "martín").length, 1, "Búsqueda 'martín' con tilde debe encontrar a Martín Brude");
assert.equal(filterInteractionsList(testListMartin, "brude").length, 1, "Búsqueda 'brude' debe encontrar a Martín Brude");
assert.equal(filterInteractionsList(testListMartin, "658").length, 1, "Búsqueda '658' debe encontrar a Martín Brude");
assert.equal(filterInteractionsList(testListMartin, "+34 658 44 49 35").length, 1, "Búsqueda por teléfono completo debe encontrar a Martín Brude");

// 7. Renderizado de archivos adjuntos en burbuja de chat (imagen, PDF, audio)
const cardWithAttachments = buildInteractionCardHtml({
  id: "conv_att_1",
  wa_id: "5491155667788",
  phone_formatted: "(+54) 9 11 5566 7788",
  patient_name: "Lucía Gómez",
  time: "14:30",
  summary: "[Envío de documento PDF]",
  has_attachment: true,
  messages: [
    {
      from: "patient",
      time: "14:30",
      text: '[Envío de documento PDF / archivo adjunto: "orden_medica.pdf"]',
      attachment: {
        media_id: "meta_doc_987",
        type: "documento",
        mime: "application/pdf",
        filename: "orden_medica.pdf",
        url: "/admin/api/interacciones_media.php?media_id=meta_doc_987",
        download_url: "/admin/api/interacciones_media.php?media_id=meta_doc_987&download=1",
      },
    },
    {
      from: "patient",
      time: "14:31",
      text: "[Envío de imagen / foto adjunta]",
      attachment: {
        media_id: "meta_img_654",
        type: "imagen",
        mime: "image/jpeg",
        filename: "comprobante.jpg",
        url: "/admin/api/interacciones_media.php?media_id=meta_img_654",
        download_url: "/admin/api/interacciones_media.php?media_id=meta_img_654&download=1",
      },
    },
  ],
}, 0, "Norberto");

assert.ok(cardWithAttachments.includes("interaccion-badge-attachment"), "Debe mostrar badge de archivo adjunto en cabecera");
assert.ok(cardWithAttachments.includes("chat-attachment-document"), "Debe renderizar tarjeta de documento PDF");
assert.ok(cardWithAttachments.includes("orden_medica.pdf"), "Debe mostrar el nombre del archivo PDF");
assert.ok(cardWithAttachments.includes('/admin/api/interacciones_media.php?media_id=meta_doc_987&amp;download=1'), "Debe incluir link de descarga del PDF");
assert.ok(cardWithAttachments.includes("chat-attachment-preview-img"), "Debe renderizar vista previa de imagen");
assert.ok(cardWithAttachments.includes('download="comprobante.jpg"'), "Debe incluir atributo download con el nombre de la imagen");

const audioHtml = renderAttachmentHtml({
  media_id: "meta_aud_321",
  type: "audio",
  mime: "audio/ogg",
  filename: "nota_voz.ogg",
});
assert.ok(audioHtml.includes("<audio controls"), "Debe renderizar reproductor de audio");
assert.ok(audioHtml.includes("Descargar audio"), "Debe incluir botón de descarga de audio");

console.log("interacciones WhatsApp: ok (todas las pruebas pasaron)");
