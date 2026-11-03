/**
 * Kinésica Admin - Opciones de Secciones para Reporte de Errores
 */

export const ERROR_SECCIONES = [
  // Web Pública y Contenidos
  "Artículos y Patologías",
  "Métodos y Terapias (RPG, Osteopatía, etc.)",
  "Datos de contacto y Ubicación",
  "Páginas de Legales, Términos y Privacidad",
  "Header, Menú de Navegación y Footer",
  
  // Sistema de Agenda y Consultorio
  "Sistema de agenda y Turnos online (Booking)",
  "Horarios de atención",
  "Honorarios y Medios de pago",
  "Registro de Gastos operativos",
  
  // Gestión Clínica de Pacientes
  "Directorio de pacientes",
  "Fichas ATM (Historias Clínicas)",
  "Comparador de sesiones ATM",
  "Fotos clínicas y Adjuntos",
  "Firma digital",
  
  // Asistente Virtual y Comunicación
  "Clara (IA / Asistente Virtual)",
  "Interacciones y Bandeja WhatsApp",
  "Recordatorios automáticos de turnos",
  "Mails automáticos y Notificaciones",
  
  // Seguridad y Administración
  "Administración de usuarios y Roles",
  "Inicio de sesión, Seguridad y Accesos",
  "General / Otro"
];

export function renderSeccionesOptions() {
  return ERROR_SECCIONES.map(
    (sec) => `<option value="${sec}">${sec}</option>`
  ).join("\n");
}
