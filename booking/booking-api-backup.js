(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-api-storage"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-api-storage"));
  } else {
    root.KinesicaBookingApiBackup = factory(root.KinesicaBookingApiStorage);
  }
})(typeof self !== "undefined" ? self : this, function (storage) {
  "use strict";

  const isStaticPreviewHost = storage ? storage.isStaticPreviewHost : function () { return false; };

  function getBackupApiUrl(client) {
    if (!client.backupApiUrl || client.isMock) return null;
    return client.backupApiUrl;
  }

  function syncBackupSlots(client, payload) {
    const backupUrl = getBackupApiUrl(client);
    if (!backupUrl || typeof fetch !== "function" || isStaticPreviewHost()) return;
    try {
      fetch(`${backupUrl}?action=sync_client_slots`, {
        method: "POST",
        mode: "cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ action: "sync_client_slots" }, payload)),
      }).catch(() => {});
    } catch (e) {}
  }

  async function fetchSlotsFromBackup(client, dateStr, options) {
    const backupUrl = getBackupApiUrl(client);
    if (!backupUrl || typeof fetch !== "function") return null;
    const practitionerId = (options && options.practitionerId) || "";
    const query = new URLSearchParams({
      action: "get_slots",
      date: dateStr,
      type: "session",
      practitioner: practitionerId,
    });
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const res = await fetch(`${backupUrl}?${query.toString()}`, {
        method: "GET",
        mode: "cors",
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || json.status !== "success" || !Array.isArray(json.availableSlots)) {
        return null;
      }
      return json;
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      return null;
    }
  }

  async function fetchSlotsRangeFromBackup(client, from, to) {
    const backupUrl = getBackupApiUrl(client);
    if (!backupUrl || typeof fetch !== "function") return null;
    const query = new URLSearchParams({
      action: "get_slots_range",
      from: from,
      to: to,
    });
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
    try {
      const res = await fetch(`${backupUrl}?${query.toString()}`, {
        method: "GET",
        mode: "cors",
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);
      if (!res.ok) return null;
      const json = await res.json();
      if (!json || json.status !== "success" || !json.days) {
        return null;
      }
      return json;
    } catch (e) {
      if (timeoutId) clearTimeout(timeoutId);
      return null;
    }
  }

  async function bookViaAdminProxy(client, payload) {
    const proxyUrl = client.adminBookProxyUrl;
    if (!proxyUrl || typeof fetch !== "function") return null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 55000) : null;
    try {
      const res = await fetch(proxyUrl, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Kinesica": "1",
        },
        body: JSON.stringify(Object.assign({}, payload, { action: "book", adminMode: true })),
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);
      const json = await res.json();
      if (json && json.status === "conflict") {
        const conflictErr = new Error(
          json.message || "El horario seleccionado acaba de ser reservado por otro paciente."
        );
        conflictErr.isConflict = true;
        throw conflictErr;
      }
      if (!res.ok || !json || json.status !== "success") {
        const msg = (json && (json.message || json.error)) || `Error admin book (${res.status})`;
        const err = new Error(msg);
        if (/requerid|inv[aá]lid|fuera del horario|anticipaci/i.test(msg)) {
          err.isValidation = true;
        }
        throw err;
      }
      return json;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      throw err;
    }
  }

  async function bookViaBackup(client, payload) {
    const backupUrl = getBackupApiUrl(client);
    if (!backupUrl || typeof fetch !== "function") return null;
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const res = await fetch(`${backupUrl}?action=book`, {
        method: "POST",
        mode: "cors",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({}, payload, { action: "book" })),
        signal: controller ? controller.signal : undefined,
      });
      if (timeoutId) clearTimeout(timeoutId);
      const json = await res.json();
      if (json && json.status === "conflict") {
        const conflictErr = new Error(
          json.message || "El horario seleccionado acaba de ser reservado por otro paciente. Por favor selecciona otro horario disponible."
        );
        conflictErr.isConflict = true;
        throw conflictErr;
      }
      if (!res.ok || !json || json.status !== "success") {
        return null;
      }
      return json;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      if (err && err.isConflict) throw err;
      return null;
    }
  }

  return {
    getBackupApiUrl,
    syncBackupSlots,
    fetchSlotsFromBackup,
    fetchSlotsRangeFromBackup,
    bookViaAdminProxy,
    bookViaBackup,
  };
});
