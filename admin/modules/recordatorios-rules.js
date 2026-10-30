/**
 * Panel estático: reglas del motor de recordatorios 24h.
 */

export function renderRecordatoriosRules(el) {
  if (!el) return;
  el.innerHTML = `
    <details class="recordatorios-rules" open>
      <summary class="recordatorios-rules-summary">Reglas del motor de recordatorios</summary>
      <div class="recordatorios-rules-body">
        <ul class="recordatorios-rules-list">
          <li><strong>Cuándo corre:</strong> lunes a jueves a las 10:00 y domingos a las 18:00 (hora de Buenos Aires). No corre viernes ni sábado.</li>
          <li><strong>Alcance:</strong> solo turnos del <em>día siguiente</em> en el calendario <code>consultorio</code>.</li>
          <li><strong>Clara activa:</strong> si el bot está pausado en admin (<code>clara_active</code>), la corrida se omite por completo.</li>
          <li><strong>Se omiten:</strong> cancelados/anulados, bloqueos, lista de espera, feriados/vacaciones y eventos que no son turnos.</li>
          <li><strong>Teléfono:</strong> primero en el evento de Calendar; si falta, el directorio de Pacientes. Sin número → no se envía y se alerta a Norberto.</li>
          <li><strong>Envío:</strong> plantilla Meta <code>recordatorio_turno_kinesica</code> (Confirmar / Cancelar). Fallos de Meta (p. ej. ventana 24h) se registran como fallidos y alertan al equipo.</li>
          <li><strong>Respuestas:</strong> Confirmar/Cancelar las procesa Clara en el chat en vivo; no aparecen como mutaciones en este listado.</li>
        </ul>
      </div>
    </details>
  `;
}
