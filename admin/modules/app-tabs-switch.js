import { getSessionUser } from "./auth.js?v=83";
import { showLibrary } from "./library.js?v=94";
import { showPacientesView, hidePacientesView } from "./pacientes.js?v=16";
import { showDashboardView, hideDashboardView } from "./dashboard.js?v=13";
import { showConsultorioView, hideConsultorioView, showClaraView, hideClaraView } from "./configuracion.js?v=39";
import { showAdminView, hideAdminView } from "./admin-panel.js?v=94";
import { showInteraccionesView, hideInteraccionesView } from "./interacciones.js?v=18";
import { showRecordatoriosView, hideRecordatoriosView } from "./recordatorios.js?v=25";
import { showEncuestasView, hideEncuestasView } from "./encuestas.js?v=2";
import { closeAllDropdowns } from "./app-tabs-dropdowns.js";
import { closeMobileNav } from "./app-tabs-mobile.js";

/** @param {string} tab @param {string} [subtab] @param {{editId?: string}|null} [routeState] */
export function switchTab(tab, subtab, routeState = null) {
  const btnClinica = document.querySelector("#nav-btn-clinica");
  const btnFichas = document.querySelector("#nav-btn-fichas");
  const btnPacientes = document.querySelector("#nav-btn-pacientes");
  const btnConsultorio = document.querySelector("#nav-btn-consultorio");
  const btnConsultorioAgendar = document.querySelector("#nav-btn-consultorio-agendar");
  const btnConsultorioHorarios = document.querySelector("#nav-btn-consultorio-horarios");
  const btnConsultorioHonorarios = document.querySelector("#nav-btn-consultorio-honorarios");
  const btnWhatsapp = document.querySelector("#nav-btn-whatsapp");
  const btnInteracciones = document.querySelector("#nav-btn-interacciones");
  const btnRecordatorios = document.querySelector("#nav-btn-recordatorios");
  const btnEncuestas = document.querySelector("#nav-btn-encuestas");
  const btnClara = document.querySelector("#nav-btn-clara");
  const btnClaraEstado = document.querySelector("#nav-btn-clara-estado");
  const btnClaraMensajes = document.querySelector("#nav-btn-clara-mensajes");
  const btnClaraPlantilla = document.querySelector("#nav-btn-clara-plantilla");
  const btnClaraPoliticas = document.querySelector("#nav-btn-clara-politicas");
  const btnClaraSimulador = document.querySelector("#nav-btn-clara-simulador");
  const btnAdmin = document.querySelector("#nav-btn-admin");
  const btnAdminUsuarios = document.querySelector("#nav-btn-admin-usuarios");
  const btnAdminGastos = document.querySelector("#nav-btn-admin-gastos");
  const btnAdminErrores = document.querySelector("#nav-btn-admin-errores");
  const btnAdminBackups = document.querySelector("#nav-btn-admin-backups");
  const btnAdminServicios = document.querySelector("#nav-btn-admin-servicios");
  const btnAdminCampana = document.querySelector("#nav-btn-admin-campana");
  const btnAdminCreativos = document.querySelector("#nav-btn-admin-creativos");

  document.querySelectorAll(".admin-nav .btn, .admin-nav .nav-dropdown-item").forEach((b) => b.classList.remove("is-active"));
  document.querySelectorAll(".admin-mobile-dock-btn").forEach((b) => b.classList.remove("is-active"));
  closeAllDropdowns();
  closeMobileNav();

  hideDashboardView();
  hidePacientesView();
  hideConsultorioView();
  hideClaraView();
  hideInteraccionesView();
  hideRecordatoriosView();
  hideEncuestasView();
  hideAdminView();

  if (tab === "inicio") {
    document.getElementById("dock-btn-inicio")?.classList.add("is-active");
    showDashboardView();
  } else if (tab === "pacientes") {
    btnClinica?.classList.add("is-active");
    btnPacientes?.classList.add("is-active");
    showPacientesView();
  } else if (tab === "consultorio" || tab === "agendar" || tab === "horarios" || tab === "honorarios") {
    btnConsultorio?.classList.add("is-active");
    let section = subtab || null;
    if (!section) {
      if (tab === "agendar") section = "agendar";
      else if (tab === "horarios") section = "horarios";
      else if (tab === "honorarios") section = "honorarios";
      else section = "agendar";
    }
    if (section === "horarios") btnConsultorioHorarios?.classList.add("is-active");
    else if (section === "honorarios") btnConsultorioHonorarios?.classList.add("is-active");
    else {
      btnConsultorioAgendar?.classList.add("is-active");
      document.getElementById("dock-btn-agendar")?.classList.add("is-active");
    }
    showConsultorioView(section);
  } else if (tab === "clara" || tab === "configuracion") {
    btnClara?.classList.add("is-active");
    const section = subtab || "mensajes";
    if (section === "estado") btnClaraEstado?.classList.add("is-active");
    else if (section === "plantilla") btnClaraPlantilla?.classList.add("is-active");
    else if (section === "politicas") btnClaraPoliticas?.classList.add("is-active");
    else if (section === "simulador") btnClaraSimulador?.classList.add("is-active");
    else btnClaraMensajes?.classList.add("is-active");
    showClaraView(section);
  } else if (tab === "interacciones" || tab === "chats" || tab === "whatsapp") {
    btnWhatsapp?.classList.add("is-active");
    btnInteracciones?.classList.add("is-active");
    document.getElementById("dock-btn-interacciones")?.classList.add("is-active");
    showInteraccionesView();
  } else if (tab === "recordatorios" || tab === "reminders") {
    btnWhatsapp?.classList.add("is-active");
    btnRecordatorios?.classList.add("is-active");
    document.getElementById("dock-btn-recordatorios")?.classList.add("is-active");
    showRecordatoriosView();
  } else if (tab === "creativos" || tab === "galeria" || tab === "campana-ig" || tab === "campanas-ig" || tab === "instagram" || (tab === "admin" && subtab === "creativos")) {
    btnWhatsapp?.classList.add("is-active");
    btnAdminCreativos?.classList.add("is-active");
    showAdminView("creativos", routeState);
  } else if (tab === "encuestas" || tab === "encuesta") {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches) {
      switchTab("inicio");
      return;
    }
    btnClara?.classList.add("is-active");
    btnEncuestas?.classList.add("is-active");
    showEncuestasView();
  } else if (
    tab === "admin" ||
    tab === "administracion" ||
    tab === "usuarios" ||
    tab === "gastos" ||
    tab === "errores" ||
    tab === "reportes" ||
    tab === "backups" ||
    tab === "copias" ||
    tab === "copias-seguridad" ||
    tab === "servicios" ||
    tab === "consumos" ||
    tab === "cuotas" ||
    tab === "campana" ||
    tab === "campaña" ||
    tab === "turnos-campana"
  ) {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches) {
      switchTab("inicio");
      return;
    }
    const user = getSessionUser();
    if (!user || user.role !== "admin") {
      switchTab("inicio");
      return;
    }
    btnAdmin?.classList.add("is-active");
    let section = subtab || null;
    if (!section) {
      if (tab === "usuarios") section = "usuarios";
      else if (tab === "gastos") section = "gastos";
      else if (tab === "errores" || tab === "reportes") section = "errores";
      else if (tab === "backups" || tab === "copias" || tab === "copias-seguridad") section = "backups";
      else if (tab === "servicios" || tab === "consumos" || tab === "cuotas") section = "servicios";
      else if (tab === "campana" || tab === "campaña" || tab === "turnos-campana") section = "campana";
      else section = "usuarios";
    }
    if (section === "gastos") {
      btnAdminGastos?.classList.add("is-active");
    } else if (section === "errores") {
      btnAdminErrores?.classList.add("is-active");
    } else if (section === "backups") {
      btnAdminBackups?.classList.add("is-active");
    } else if (section === "servicios") {
      btnAdminServicios?.classList.add("is-active");
    } else if (section === "campana" || section === "campaña" || section === "turnos-campana") {
      btnAdminCampana?.classList.add("is-active");
    } else {
      btnAdminUsuarios?.classList.add("is-active");
    }
    showAdminView(section);
  } else {
    btnClinica?.classList.add("is-active");
    btnFichas?.classList.add("is-active");
    showLibrary();
  }
}
