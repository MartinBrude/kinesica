/**
 * Render recordatorios (fachada).
 */
export {
  RECORDATORIOS_DAY_RADIUS,
  todayISOArgentina,
  addDaysISO,
  buildRecordatorioPages,
  formatRunDayHeader,
  isAppointmentPast,
} from "./recordatorios-render-pages.js?v=1";
export { buildRecordatorioCardHtml } from "./recordatorios-render-card.js?v=1";
export { renderRecordatoriosList, renderRecordatoriosPager } from "./recordatorios-render-list.js?v=1";
