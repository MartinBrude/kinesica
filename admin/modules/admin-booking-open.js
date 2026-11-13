import { api } from "./api.js?v=79";
import {
  getModal,
  setModal,
  getWidget,
  setWidget,
  getPicker,
  setPicker,
  getPatients,
  setPatients,
  isPatientsLoaded,
  setPatientsLoaded,
  PUBLIC_BOOKING_API_URL,
} from "./admin-booking-state.js";
import { isAdmin } from "./admin-booking-utils.js";
import {
  buildPicker,
  clearSelection,
  updateHint,
} from "./admin-booking-picker.js";

function showBookingOpenError(message) {
  console.error("[admin-booking]", message);
  try {
    window.alert(message);
  } catch (_) {
    /* ignore */
  }
}

export function closeAdminBooking() {
  const modal = getModal();
  if (!modal) return;
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("kinesica-booking-modal-open");
  clearSelection(false);
}

async function loadPatients() {
  if (isPatientsLoaded()) return;
  const picker = getPicker();
  const input = picker?.querySelector("input");
  if (input) input.disabled = true;
  try {
    const response = await api("pacientes.php");
    setPatients(Array.isArray(response?.items) ? response.items : []);
    setPatientsLoaded(true);
    updateHint(`${getPatients().length} pacientes en el directorio.`);
  } finally {
    if (input) input.disabled = false;
  }
}

async function persistFirstVisit(payload) {
  await api("pacientes.php", {
    method: "POST",
    body: {
      action: "upsert",
      telefono: payload.telefono,
      nombre_completo: payload.nombre,
      dni: payload.dni,
      email: payload.email,
      profesional_habitual: payload.practitionerId || "indistinto",
      motivo_consulta: payload.especialidad || payload.motivo || "",
      origen: "admin",
    },
  });
  setPatientsLoaded(false);
}

export function openAdminBooking() {
  if (!isAdmin()) {
    showBookingOpenError("Tu sesión no tiene permiso para abrir la turnera. Volvé a iniciar sesión.");
    return;
  }
  let modal = getModal();
  modal = document.getElementById("admin-booking-modal");
  setModal(modal);
  if (!modal) {
    showBookingOpenError("No se encontró el modal de la turnera. Recargá la página.");
    return;
  }

  const Widget = window.KinesicaBookingWidget;
  const mount = document.getElementById("admin-booking-widget-mount");
  if (!Widget || !mount) {
    showBookingOpenError("La turnera todavía no cargó. Recargá la página (Cmd+Shift+R) e intentá de nuevo.");
    return;
  }

  let widget = getWidget();
  let picker = getPicker();

  try {
    if (!widget) {
      widget = new Widget(mount, {
        apiUrl: window.__KINESICA_CONFIG__?.bookingApiUrl || window.KINESICA_SITE?.bookingApiUrl || PUBLIC_BOOKING_API_URL,
        adminBookProxyUrl: "api/booking_admin_book.php",
        forceMock: false,
        isModal: true,
        adminMode: true,
        onClose: closeAdminBooking,
        onBookingSuccess: async (payload, result) => {
          const currentWidget = getWidget();
          if (!currentWidget.state.adminPatient) await persistFirstVisit(payload);
          try {
            const eventId = result?.eventId || result?.event_id || "";
            if (eventId) {
              const patient = currentWidget.state.adminPatient;
              await api("turnos.php", {
                method: "POST",
                body: {
                  action: "register",
                  eventId,
                  date: payload?.date || "",
                  time: payload?.time || "",
                  nombre: payload?.nombre || "",
                  telefono: payload?.telefono || "",
                  dni: payload?.dni || "",
                  practitionerId: payload?.practitionerId || "",
                  paciente_id: patient?.id || null,
                  summary: result?.summary || payload?.nombre || "",
                  source: "booking",
                },
              });
            }
          } catch (err) {
            console.warn("No se pudo registrar el turno sombra:", err);
          }
        },
      });
      setWidget(widget);
    }
    picker = getPicker();
    if (!picker || !mount.contains(picker)) {
      picker = buildPicker();
      setPicker(picker);
      const step1 = mount.querySelector("#kb-step-1");
      if (step1) step1.prepend(picker);
      else mount.prepend(picker);
    }
  } catch (err) {
    setWidget(null);
    setPicker(null);
    console.error("No se pudo inicializar la turnera profesional:", err);
    showBookingOpenError("No se pudo abrir la turnera. Recargá la página e intentá de nuevo.");
    return;
  }

  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("kinesica-booking-modal-open");
  loadPatients()
    .then(() => setTimeout(() => getPicker()?.querySelector("input")?.focus(), 80))
    .catch((error) => {
      updateHint("No se pudo cargar el directorio. Podés agendar un paciente de primera vez.");
      console.error("No se pudo cargar el directorio para la turnera profesional:", error);
    });
}
