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
          <li><strong>Contacto:</strong> teléfono primero (evento de Calendar → directorio de Pacientes). Si no hay teléfono pero hay email (evento o directorio) → se envía el recordatorio por correo. Si no hay teléfono ni email → se alerta a Norberto por WhatsApp.</li>
          <li><strong>Envío WhatsApp:</strong> plantilla Meta <code>recordatorio_turno_kinesica</code> (Confirmar / Cancelar). Fallos de Meta (p. ej. ventana 24h) se registran como fallidos y alertan al equipo.</li>
          <li><strong>Frecuencia máxima:</strong> no se envía ni intenta enviar recordatorio más de una vez por día a nadie. Se deduplica automáticamente por teléfono, email o paciente tanto en la misma corrida como entre corridas del mismo día.</li>
          <li><strong>Cargar contacto:</strong> si falta WhatsApp, usá <em>＋ Cargar contacto</em> para cargar teléfono y/o email en el directorio de pacientes sin enviar todavía. También podés hacerlo al disparar manualmente.</li>
          <li><strong>Disparo manual:</strong> solo si hay WhatsApp o email y todavía no se envió aparece <em>⚡ Enviar ahora</em> (también en omitidos). Sin contacto: solo <em>＋ Cargar contacto</em>. En fallidos con contacto: <em>⚡ Disparar manualmente</em>.</li>
          <li><strong>Respuestas:</strong> Confirmar/Cancelar las procesa Clara en el chat en vivo; no aparecen como mutaciones en este listado.</li>
        </ul>
      </div>
    </details>
  `;
}
