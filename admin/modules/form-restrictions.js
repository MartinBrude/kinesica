/**
 * Kinésica Admin - Restricciones de Entrada y Filtros en Vivo para Fichas
 * Previene caracteres inválidos, controla rangos de edad, EVA y campos numéricos.
 */

export function setupInputRestrictions(formEl) {
  if (!formEl) return;

  // 1. Entero estricto: Edad (1 a 120) - No permite texto ni símbolos ni números fuera de rango
  const edadInput = formEl.elements.edad;
  if (edadInput) {
    edadInput.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      // Bloquear cualquier tecla que no sea dígito
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    edadInput.addEventListener("input", () => {
      let clean = edadInput.value.replace(/\D/g, "");
      if (clean.length > 3) clean = clean.slice(0, 3);
      if (edadInput.value !== clean) {
        edadInput.value = clean;
      }
      if (clean) {
        const n = Number(clean);
        const valid = Number.isInteger(n) && n >= 1 && n <= 120;
        edadInput.classList.toggle("input-error", !valid);
        edadInput.title = valid ? "" : "La edad debe ser un número entero entre 1 y 120";
      } else {
        edadInput.title = "";
      }
    });
  }

  // 2. Mediciones mandibulares (milímetros: decimal o entero >= 0) - No permiten texto
  const measurementNames = [
    "aperturaLibre",
    "aperturaDolor",
    "protrusion",
    "latIzq",
    "latDer",
    "aperturaLibrePost",
    "aperturaDolorPost",
    "protrusionPost",
    "latIzqPost",
    "latDerPost",
  ];
  measurementNames.forEach((name) => {
    const el = formEl.elements[name];
    if (!el) return;

    el.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      // Permitir separador decimal solo una vez
      if (e.key === "." || e.key === ",") {
        if (el.value.includes(".") || el.value.includes(",")) {
          e.preventDefault();
        }
        return;
      }
      // Bloquear texto y otros caracteres
      if (!/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    el.addEventListener("input", () => {
      let val = el.value.replace(",", ".");
      val = val.replace(/[^\d.]/g, "");
      const parts = val.split(".");
      if (parts.length > 2) {
        val = parts[0] + "." + parts.slice(1).join("");
      }
      if (el.value !== val) {
        el.value = val;
      }
      if (val) {
        const maxVal = 500;
        const n = Number(val);
        const valid = !Number.isNaN(n) && n >= 0 && n <= maxVal;
        el.classList.toggle("input-error", !valid);
        el.title = valid ? "" : "Debe ser un número entre 0 y 500 mm";
      } else {
        el.title = "";
      }
    });
  });

  // 3. Documento (DNI / Pasaporte): permite números, letras y formato (. y -)
  const dniInput = formEl.elements.dni;
  if (dniInput) {
    dniInput.addEventListener("input", () => {
      const clean = dniInput.value.replace(/[^a-zA-Z0-9.\s-]/g, "");
      if (dniInput.value !== clean) {
        dniInput.value = clean;
      }
    });
  }

  // 4. Nombre completo: no permite dígitos
  const nombreInput = formEl.elements.nombre;
  if (nombreInput) {
    nombreInput.addEventListener("keydown", (e) => {
      if (
        e.key === "Backspace" ||
        e.key === "Delete" ||
        e.key === "Tab" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "Home" ||
        e.key === "End" ||
        e.key === "Enter" ||
        e.ctrlKey ||
        e.metaKey
      ) {
        return;
      }
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
      }
    });

    nombreInput.addEventListener("input", () => {
      const clean = nombreInput.value.replace(/\d/g, "");
      if (nombreInput.value !== clean) {
        nombreInput.value = clean;
      }
    });
  }
}

/**
 * Retorna etiqueta semántica y nivel de severidad para un valor de la escala EVA.
 * @param {number|string} val Valor entre 0 y 10
 * @returns {{label: string, level: string}}
 */
