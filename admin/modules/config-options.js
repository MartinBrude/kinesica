/**
 * Kinésica Admin - Gestión de Opciones Personalizadas del Menú de Clara
 * Creación, edición, borrado, asignación de letras correlativas y validación.
 */

export function getNextAvailableLetter(customMenuOptions) {
  const used = new Set(["A", "B", "C", "D", "E"]);
  (customMenuOptions || []).forEach((opt) => {
    if (opt.letter) used.add(opt.letter.toUpperCase());
  });
  const alphabet = "FGHIJKLMNOPQRSTUVWXYZ".split("");
  for (const l of alphabet) {
    if (!used.has(l)) return l;
  }
  return "F";
}

export function renderCustomOptionsList(container, emptyEl, customMenuOptions, onAlert) {
  if (!container) return;
  container.replaceChildren();

  if (!customMenuOptions || customMenuOptions.length === 0) {
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  customMenuOptions.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "custom-option-card";
    row.style.cssText = "background:var(--bg); border:1px solid var(--line); border-radius:var(--radius); padding:14px 16px; display:flex; flex-direction:column; gap:10px;";

    const topBar = document.createElement("div");
    topBar.style.cssText = "display:flex; align-items:center; gap:10px;";

    const letterLabel = document.createElement("span");
    letterLabel.textContent = "Letra:";
    letterLabel.style.cssText = "font-weight:600; font-size:13px; color:var(--navy);";

    const letterInput = document.createElement("input");
    letterInput.type = "text";
    letterInput.maxLength = 2;
    letterInput.value = item.letter || "";
    letterInput.placeholder = "F";
    letterInput.style.cssText = "width:48px; text-transform:uppercase; text-align:center; font-weight:700; padding:6px; border:1px solid var(--line); border-radius:4px; font-size:14px; background:#fff;";
    letterInput.addEventListener("input", (e) => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z]/g, "");
      if (["A", "B", "C", "D", "E"].includes(val)) {
        if (typeof onAlert === "function") {
          onAlert("Las letras A, B, C, D y E están reservadas para las funciones nativas (Turnos, Ubicación, Honorarios, Ropa y Contacto). Por favor elegí desde la F en adelante.");
        }
        val = "";
      }
      e.target.value = val;
      item.letter = val;
    });

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.value = item.label || "";
    titleInput.placeholder = "Título en el menú (ej: ¿Con qué técnicas trabajan?)";
    titleInput.style.cssText = "flex:1; padding:7px 10px; border:1px solid var(--line); border-radius:4px; font-size:14px; background:#fff;";
    titleInput.addEventListener("input", (e) => {
      item.label = e.target.value;
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.textContent = "✕ Eliminar";
    delBtn.style.cssText = "background:transparent; border:1px solid #ef4444; color:#ef4444; border-radius:4px; padding:6px 12px; font-size:12px; font-weight:600; cursor:pointer;";
    delBtn.addEventListener("click", () => {
      customMenuOptions.splice(index, 1);
      renderCustomOptionsList(container, emptyEl, customMenuOptions, onAlert);
    });

    topBar.appendChild(letterLabel);
    topBar.appendChild(letterInput);
    topBar.appendChild(titleInput);
    topBar.appendChild(delBtn);

    const respTextarea = document.createElement("textarea");
    respTextarea.rows = 2;
    respTextarea.value = item.response || "";
    respTextarea.placeholder = "Respuesta exacta que dará Clara al elegir esta opción (ej: En Kinésica nos especializamos en RPG, Kinesiología postural y traumatológica, Osteopatía...)";
    respTextarea.style.cssText = "width:100%; padding:8px 10px; border:1px solid var(--line); border-radius:4px; font-size:13px; font-family:inherit; line-height:1.4; resize:vertical; background:#fff;";
    respTextarea.addEventListener("input", (e) => {
      item.response = e.target.value;
    });

    row.appendChild(topBar);
    row.appendChild(respTextarea);
    container.appendChild(row);
  });
}

export function validateCustomOptions(customMenuOptions, onAlert) {
  const cleanCustom = [];
  const reserved = ["A", "B", "C", "D", "E"];
  for (const opt of customMenuOptions || []) {
    const l = String(opt.letter || "").trim().toUpperCase();
    const label = String(opt.label || "").trim();
    const response = String(opt.response || "").trim();
    if (!l && !label && !response) continue;
    if (!l) {
      if (typeof onAlert === "function") onAlert("Cada opción personalizada debe tener una letra asignada (ej: F).");
      return null;
    }
    if (reserved.includes(l)) {
      if (typeof onAlert === "function") onAlert(`La letra ${l} está reservada para las opciones nativas de Clara. Por favor usá letras de la F en adelante.`);
      return null;
    }
    if (!response) {
      if (typeof onAlert === "function") onAlert(`Por favor ingresá la respuesta para la opción ${l}.`);
      return null;
    }
    cleanCustom.push({ letter: l, label: label || `Opción ${l}`, response });
  }
  return cleanCustom;
}
