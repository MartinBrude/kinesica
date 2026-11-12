/**
 * Panel estático: reglas del motor de recordatorios 24h.
 */

export function renderRecordatoriosRules(el) {
  if (!el) return;
  el.innerHTML = `
    <details class="recordatorios-rules">
      <summary class="recordatorios-rules-summary">Reglas del motor de recordatorios</summary>
      <div class="recordatorios-rules-body">
        <ul class="recordatorios-rules-list">
          <li><strong>Día previo (n8n):</strong> lunes a jueves a las 10:00 y domingos a las 18:00 (hora de Buenos Aires). Alcance: turnos del <em>día siguiente</em> en <code>consultorio</code>. No corre viernes ni sábado.</li>
          <li><strong>Catch-up mismo día (PHP):</strong> lunes a viernes a las 08:00 AR. Solo turnos de <em>hoy</em> sin <code>sent</code>/<code>sent_email</code> previo para ese <code>calendar_event_id</code>, con ≥60 min de margen. Copy «hoy…».</li>
          <li><strong>Clara activa:</strong> si el bot está pausado en admin (<code>clara_active</code>), ambas ejecuciones se omiten.</li>
          <li><strong>Se omiten:</strong> cancelados/anulados, bloqueos, lista de espera, feriados/vacaciones y eventos que no son turnos.</li>
          <li><strong>Contacto:</strong> teléfono primero (evento de Calendar → directorio de Pacientes). Si no hay teléfono pero hay email → correo. Si no hay ninguno → <code>missing_phone</code>.</li>
          <li><strong>Envío WhatsApp:</strong> plantilla Meta <code>recordatorio_turno_kinesica</code> (Confirmar / Cancelar). Con <code>reminder_template_when_mode=when_phrase</code>, <code>{{3}}</code> es «hoy|mañana a las HH:MM hs». En <code>legacy</code>, el catch-up same-day usa email.</li>
          <li><strong>Un solo recordatorio por turno:</strong> si ya hubo <code>sent</code>/<code>sent_email</code> para el <code>calendar_event_id</code>, el catch-up no reenvía. Además, máximo 1 envío por persona y día (dedupe por teléfono/email/nombre).</li>
          <li><strong>Cargar contacto:</strong> si falta WhatsApp, usá <em>＋ Cargar contacto</em> para cargar teléfono y/o email en el directorio sin forzar el envío.</li>
          <li><strong>Disparo manual:</strong> <em>⚡ Enviar ahora</em> / <em>⚡ Disparar manualmente</em> con las mismas reglas de no reenviar si ya salió.</li>
          <li><strong>Respuestas:</strong> Confirmar/Cancelar las procesa Clara en el chat en vivo; no aparecen como mutaciones en este listado.</li>
        </ul>
      </div>
    </details>
  `;
}
