/**
 * Kinésica Admin - Primitivas de Comparación y Diferencias Clínicas
 * Funciones de cálculo diferencial para texto, valores numéricos, lateralidad y tiempo transcurrido.
 */

export function sideText(left, right) {
  if (left && right) return "Bilateral";
  if (left) return "Izquierdo";
  if (right) return "Derecho";
  return "Sin afectación";
}

export function formatSide(left, right) {
  const isLeft = Boolean(left && left !== "No" && left !== "0" && left !== "false");
  const isRight = Boolean(right && right !== "No" && right !== "0" && right !== "false");
  if (isLeft && isRight) return "Bilateral";
  if (isLeft) return "Izquierda";
  if (isRight) return "Derecha";
  return "";
}

export function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const tA = new Date(String(dateA).slice(0, 10)).getTime();
  const tB = new Date(String(dateB).slice(0, 10)).getTime();
  if (Number.isNaN(tA) || Number.isNaN(tB)) return null;
  return Math.abs(Math.round((tB - tA) / (1000 * 60 * 60 * 24)));
}

export function diffText(label, valA, valB) {
  const a = String(valA || "").trim();
  const b = String(valB || "").trim();
  const changed = a !== b;
  return {
    label,
    changed,
    current: b || "—",
    previous: a || "—",
    trend: "same",
    display: changed ? `${a || "—"} ➔ ${b || "—"}` : (b || "—"),
  };
}

export function diffNumber(label, valA, valB, unit = "", lowerIsBetter = false) {
  const hasA = valA !== "" && valA != null && !Number.isNaN(Number(valA));
  const hasB = valB !== "" && valB != null && !Number.isNaN(Number(valB));
  const numA = hasA ? Number(valA) : null;
  const numB = hasB ? Number(valB) : null;
  const changed = numA !== numB;
  let delta = null;
  let trend = "same";
  if (numA != null && numB != null) {
    const diff = numB - numA;
    if (diff !== 0) {
      delta = diff;
      const isPositive = diff > 0;
      trend = (isPositive && !lowerIsBetter) || (!isPositive && lowerIsBetter) ? "better" : "worse";
    }
  }
  const deltaText = delta != null ? (delta > 0 ? `+${delta}` : `${delta}`) + (unit ? ` ${unit}` : "") : "";
  const curStr = numB != null ? `${numB}${unit ? ` ${unit}` : ""}` : "—";
  const prevStr = numA != null ? `${numA}${unit ? ` ${unit}` : ""}` : "—";
  return {
    label,
    changed,
    current: curStr,
    previous: prevStr,
    delta,
    deltaText,
    unit,
    trend,
    display: changed && numA != null && numB != null ? `${prevStr} ➔ ${curStr}` : curStr,
  };
}

export function diffSide(label, aLeft, aRight, bLeft, bRight) {
  const strA = sideText(aLeft, aRight);
  const strB = sideText(bLeft, bRight);
  const changed = strA !== strB;
  let trend = "same";
  if (changed) {
    if (strB === "Sin afectación") trend = "better";
    else if (strA === "Sin afectación") trend = "worse";
    else if (strA === "Bilateral" && strB !== "Bilateral") trend = "better";
    else if (strA !== "Bilateral" && strB === "Bilateral") trend = "worse";
  }
  return {
    label,
    changed,
    current: strB,
    previous: strA,
    trend,
    display: changed ? `${strA} ➔ ${strB}` : strB,
  };
}
