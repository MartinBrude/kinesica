/**
 * Kinésica Admin - Markup del formulario de cesiones / cierres.
 */

export function buildHourOptions(selected) {
  const opts = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of ["00", "30"]) {
      if (h === 20 && m === "30") continue;
      const val = `${String(h).padStart(2, "0")}:${m}`;
      opts.push(`<option value="${val}" ${val === selected ? "selected" : ""}>${val} hs</option>`);
    }
  }
  return opts.join("");
}

export function buildCesionFormHtml(todayIso) {
  return `
    <div class="cesiones-form-card" style="background:#fff; border:1px solid var(--line); border-radius:8px; padding:20px; margin-bottom:24px;">
      <h3 style="margin-top:0; margin-bottom:14px; font-size:16px; color:var(--navy);">Programar Excepción: Cesión de Horarios o Cierre</h3>
      <form id="form-horarios-cesion">
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap:14px; margin-bottom:14px;">
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">1. ¿Para quién pasan a estar disponibles?</label>
            <select id="cesion-target-flow" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="to_maria">Disponibles para María (liberada por Norberto)</option>
              <option value="to_norberto">Disponibles para Norberto (liberado por María)</option>
              <option value="closure">Cierre total de consultorio (bloqueo para ambos)</option>
            </select>
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">2. Período de fechas</label>
            <select id="cesion-period-type" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="single_day">Día puntual</option>
              <option value="date_range">Rango de fechas</option>
            </select>
          </div>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap:14px; margin-bottom:14px;">
          <div>
            <label id="lbl-cesion-start" style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Fecha</label>
            <input type="date" id="cesion-start-date" value="" min="${todayIso}" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
          </div>
          <div id="wrapper-cesion-end-date" style="display:none;">
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Hasta fecha</label>
            <input type="date" id="cesion-end-date" value="" min="${todayIso}" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
          </div>
          <div>
            <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">3. Alcance horario</label>
            <select id="cesion-time-scope" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
              <option value="all_day">Jornada completa</option>
              <option value="custom_hours">Franja horaria</option>
            </select>
          </div>
        </div>

        <div id="wrapper-cesion-custom-hours" style="display:none; margin-bottom:14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:12px 14px;">
          <div style="font-size:13px; font-weight:600; color:var(--navy); margin-bottom:8px;">Franjas horarias a habilitar:</div>
          <div id="cesion-franjas-list"></div>
          <button type="button" class="btn light small" id="btn-add-franja" style="margin-top:6px; font-size:12px;">+ Agregar otra franja horaria</button>
        </div>

        <div id="wrapper-cesion-on-leave" class="cesion-on-leave-row" style="display:none; margin-bottom:14px;">
          <label class="cesion-switch" for="cesion-on-leave">
            <input type="checkbox" id="cesion-on-leave" role="switch">
            <span class="cesion-switch-track" aria-hidden="true"><span class="cesion-switch-thumb"></span></span>
            <span class="cesion-switch-copy">
              <strong>Profesional de baja</strong>
              <span class="cesion-switch-hint">Durante el rango no se ofrecen disciplinas que solo atiende quien cede (ej. Acupuntura si viaja María).</span>
            </span>
          </label>
        </div>

        <div style="margin-bottom:14px;">
          <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px;">Motivo o nota interna (opcional)</label>
          <input type="text" id="cesion-reason" placeholder="Ej. Congreso médico, día libre acordado, refacción" maxlength="200" style="width:100%; height:38px; border:1px solid var(--line); border-radius:6px; padding:0 8px;">
        </div>

        <div id="cesion-preview-banner" style="margin-bottom:14px; padding:10px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; font-size:13px; color:#334155;"></div>
        <div id="cesion-conflicts-banner" style="display:none; margin-bottom:14px; padding:10px 14px; border-radius:6px; font-size:13px; line-height:1.4;"></div>

        <div style="display:flex; justify-content:flex-end;">
          <button type="submit" class="btn green" id="btn-save-cesion" disabled>Guardar y habilitar turnos</button>
        </div>
      </form>
    </div>
  `;
}
