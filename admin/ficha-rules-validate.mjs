/**
 * Kinésica Admin - Reglas Clínicas de Validación (ATM / CDI-TTM)
 * Valida campos individuales, pasos del formulario y la ficha integral.
 */

/**
 * Valida tipos y rangos de un campo individual según las reglas clínicas de Kinésica.
 * @param {string} key Nombre del campo
 * @param {*} value Valor a verificar
 * @param {object} [allData={}] Contexto completo de la ficha para correlaciones
 * @returns {string|null} Mensaje de error o null si es válido
 */
export function validateField(key, value, allData = {}) {
  const str = String(value ?? "").trim();

  switch (key) {
    case "edad": {
      if (!str) return "Falta completar la edad";
      if (!/^\d+$/.test(str)) {
        return "La edad no permite texto: debe ser un número entero entre 1 y 120";
      }
      const n = Number(str);
      if (!Number.isInteger(n) || n < 1 || n > 120) {
        return "La edad debe ser un número entero entre 1 y 120";
      }
      return null;
    }
    case "nombre": {
      if (!str) return "Falta completar el nombre completo";
      if (/\d/.test(str)) return "El nombre no puede contener números";
      if (str.length < 2) return "El nombre completo debe tener al menos 2 letras";
      return null;
    }
    case "dni": {
      if (allData?.sinDocumento) return null;
      if (!str) return "Falta completar el DNI / Pasaporte";
      const alphanum = str.replace(/[^a-zA-Z0-9]/g, "");
      if (alphanum.length < 3) return "El DNI / Pasaporte debe tener al menos 3 caracteres";
      return null;
    }
    case "fechaSesion": {
      if (!str) return "Falta completar la fecha de la sesión";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return "La fecha de la sesión debe ser válida (AAAA-MM-DD)";
      return null;
    }
    case "nacimiento": {
      if (!str) return "Falta completar la fecha de nacimiento";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return "La fecha de nacimiento debe ser válida (AAAA-MM-DD)";
      const session = String(allData.fechaSesion || "").slice(0, 10);
      if (session && /^\d{4}-\d{2}-\d{2}$/.test(session) && str > session) {
        return "La fecha de nacimiento no puede ser posterior a la fecha de la sesión";
      }
      return null;
    }
    case "lugarNac":
    case "anotaciones":
    case "fotoUrl":
    case "fotosUrls": {
      return null;
    }
    case "motivo": {
      if (!str) return "Falta seleccionar el motivo de consulta";
      return null;
    }
    case "antecedentes": {
      if (!str) return "Falta completar los antecedentes clínicos";
      return null;
    }
    case "aperturaLibre":
    case "aperturaDolor":
    case "aperturaLibrePost":
    case "aperturaDolorPost": {
      if (!str) return null;
      const clean = str.replace(",", ".");
      if (/[a-zA-Z]/.test(clean) || !/^\d+(\.\d+)?$/.test(clean)) {
        return "Este campo no permite texto: debe ser un número en milímetros";
      }
      const n = Number(clean);
      if (Number.isNaN(n) || n < 0 || n > 500) {
        return "El valor de apertura debe estar entre 0 y 500 mm";
      }
      return null;
    }
    case "protrusion":
    case "latIzq":
    case "latDer":
    case "protrusionPost":
    case "latIzqPost":
    case "latDerPost": {
      if (!str) return null;
      const clean = str.replace(",", ".");
      if (/[a-zA-Z]/.test(clean) || !/^\d+(\.\d+)?$/.test(clean)) {
        return "Este campo no permite texto: debe ser un número en milímetros";
      }
      const n = Number(clean);
      if (Number.isNaN(n) || n < 0 || n > 500) {
        return "El valor debe estar entre 0 y 500 mm";
      }
      return null;
    }
    case "ruidos":
    case "ruidosIzq":
    case "ruidosDer": {
      const isSi = str === "Sí" || allData.ruidos === "Sí";
      if (isSi && !allData.ruidosIzq && !allData.ruidosDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en los ruidos articulares";
      }
      return null;
    }
    case "dolorCondilar":
    case "condilarIzq":
    case "condilarDer": {
      const isSi = str === "Sí" || allData.dolorCondilar === "Sí";
      if (isSi && !allData.condilarIzq && !allData.condilarDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en el dolor condilar a la palpación";
      }
      return null;
    }
    case "desviacion":
    case "desvIzq":
    case "desvDer": {
      const isSi = str === "Sí" || allData.desviacion === "Sí";
      if (isSi && !allData.desvIzq && !allData.desvDer) {
        return "Debe indicar el lado (izquierdo y/o derecho) en la desviación lateral de la trayectoria";
      }
      return null;
    }
    case "desviacionPost":
    case "desvIzqPost":
    case "desvDerPost": {
      const isSi = str === "Sí" || allData.desviacionPost === "Sí";
      if (isSi && !allData.desvIzqPost && !allData.desvDerPost) {
        return "Debe indicar el lado (izquierdo y/o derecho) en la desviación lateral al finalizar la sesión";
      }
      return null;
    }
    case "eva": {
      if (value === "" || value === null || value === undefined) return null;
      const n = Number(value);
      if (Number.isNaN(n) || n < 0 || n > 10) return "La escala EVA debe ser un valor entre 0 y 10";
      return null;
    }
    default:
      return null;
  }
}

/**
 * Valida integralmente la ficha clínica y retorna mapa de errores y estado.
 * @param {object} data Datos de la ficha
 * @returns {{isValid: boolean, errors: Object<string, string>, errorList: string[], firstErrorKey: string|null, firstError: string|null}}
 */
export function validateFicha(data = {}) {
  data = data || {};
  const errors = {};
  const errorList = [];
  const fieldsToCheck = [
    "nombre",
    "dni",
    "fechaSesion",
    "nacimiento",
    "edad",
    "lugarNac",
    "motivo",
    "antecedentes",
    "ruidos",
    "dolorCondilar",
    "aperturaLibre",
    "aperturaDolor",
    "desviacion",
    "protrusion",
    "latIzq",
    "latDer",
    "aperturaLibrePost",
    "aperturaDolorPost",
    "desviacionPost",
    "protrusionPost",
    "latIzqPost",
    "latDerPost",
    "eva",
  ];

  for (const field of fieldsToCheck) {
    const err = validateField(field, data[field], data);
    if (err) {
      errors[field] = err;
      errorList.push(err);
    }
  }

  return {
    isValid: errorList.length === 0,
    errors,
    errorList,
    firstErrorKey: Object.keys(errors)[0] || null,
    firstError: errorList[0] || null,
  };
}

/**
 * Valida los campos correspondientes a un paso específico del formulario.
 * @param {number} stepNumber Número de paso (0 a 4)
 * @param {object} data Datos del formulario
 * @returns {{isValid: boolean, errors: Object<string, string>, errorList: string[], firstErrorKey: string|null, firstError: string|null}}
 */
export function validateStep(stepNumber, data = {}) {
  data = data || {};
  const stepFields = {
    0: ["nombre", "dni", "fechaSesion", "nacimiento", "edad", "motivo", "antecedentes"],
    1: [
      "ruidos",
      "dolorCondilar",
      "aperturaLibre",
      "aperturaDolor",
      "desviacion",
      "protrusion",
      "latIzq",
      "latDer",
      "aperturaLibrePost",
      "aperturaDolorPost",
      "desviacionPost",
      "protrusionPost",
      "latIzqPost",
      "latDerPost",
    ],
    2: [],
    3: ["eva"],
    4: [],
    5: ["anotaciones", "fotoUrl", "fotosUrls"],
  };
  const fields = stepFields[stepNumber] || [];
  const errors = {};
  const errorList = [];
  for (const f of fields) {
    const err = validateField(f, data[f], data);
    if (err) {
      errors[f] = err;
      errorList.push(err);
    }
  }
  return {
    isValid: errorList.length === 0,
    errors,
    errorList,
    firstErrorKey: Object.keys(errors)[0] || null,
    firstError: errorList[0] || null,
  };
}
