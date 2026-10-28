/**
 * Kinésica Admin - Cotizaciones Históricas y Conversión Multimoneda para Gastos
 * Consulta en API pública y cálculo de equivalencias EUR / USD / ARS.
 */

export const SEED_GASTOS = [
  { id: "gasto_1", concepto: "AI automation apps", detalle: "", fecha: "2026-10-25", moneda: "EUR", monto: 148.09, monto_eur: 148.09, monto_usd: 160.23, monto_ars: 214730.50, tc_eur_usd: 1.082, tc_eur_ars: 1450.00 },
  { id: "gasto_2", concepto: "AI automation apps", detalle: "", fecha: "2026-09-26", moneda: "EUR", monto: 8.99, monto_eur: 8.99, monto_usd: 10.00, monto_ars: 12817.94, tc_eur_usd: 1.112, tc_eur_ars: 1425.80 },
  { id: "gasto_3", concepto: "Resend Email API", detalle: "Pro Plan anual", fecha: "2026-02-03", moneda: "USD", monto: 200.00, monto_eur: 191.39, monto_usd: 200.00, monto_ars: 247923.44, tc_eur_usd: 1.045, tc_eur_ars: 1295.40 },
  { id: "gasto_4", concepto: "WhatsApp Meta Cloud API", detalle: "Conversaciones de servicio", fecha: "2025-03-28", moneda: "EUR", monto: 35.88, monto_eur: 35.88, monto_usd: 38.86, monto_ars: 41638.74, tc_eur_usd: 1.083, tc_eur_ars: 1160.50 },
];

export function formatMoney(amount, currency = "ARS") {
  const num = Number(amount) || 0;
  const formatted = num.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (currency === "EUR") return `${formatted} €`;
  if (currency === "USD") return `US$ ${formatted}`;
  return `$ ${formatted}`;
}

export const historicalRatesByDate = {
  "2026-10-25": { eurUsd: 1.082, eurArs: 1450.0 },
  "2026-09-26": { eurUsd: 1.112, eurArs: 1425.8 },
  "2026-02-03": { eurUsd: 1.045, eurArs: 1295.4 },
  "2025-03-28": { eurUsd: 1.083, eurArs: 1160.5 },
};

export function getRecordDailyAmounts(gasto, customRates = null) {
  const mon = (gasto.moneda || "EUR").toUpperCase();
  const monto = Number(gasto.monto) || 0;
  const rates = customRates || historicalRatesByDate[gasto.fecha] || { eurUsd: 1.082, eurArs: 1450.0 };
  const tcEurUsd = Number(gasto.tc_eur_usd) > 0 ? Number(gasto.tc_eur_usd) : rates.eurUsd;
  const tcEurArs = Number(gasto.tc_eur_ars) > 0 ? Number(gasto.tc_eur_ars) : rates.eurArs;
  const tcUsdArs = tcEurUsd > 0 ? tcEurArs / tcEurUsd : 1340.0;

  let eur = Number(gasto.monto_eur);
  let usd = Number(gasto.monto_usd);
  let ars = Number(gasto.monto_ars);

  if (!(eur > 0) || !(usd > 0) || !(ars > 0)) {
    if (mon === "EUR") {
      eur = monto;
      usd = Math.round(monto * tcEurUsd * 100) / 100;
      ars = Math.round(monto * tcEurArs * 100) / 100;
    } else if (mon === "USD") {
      usd = monto;
      eur = Math.round((monto / tcEurUsd) * 100) / 100;
      ars = Math.round(monto * tcUsdArs * 100) / 100;
    } else {
      ars = monto;
      eur = Math.round((monto / tcEurArs) * 100) / 100;
      usd = Math.round((monto / tcUsdArs) * 100) / 100;
    }
  }
  return { eur, usd, ars, tcEurUsd, tcEurArs };
}

export function convertAmountByRates(monto, moneda, { eurUsd, eurArs }) {
  const mon = (moneda || "EUR").toUpperCase();
  const usdArs = eurUsd > 0 ? eurArs / eurUsd : 1340.0;
  if (!(monto > 0)) return { eur: 0, usd: 0, ars: 0 };

  if (mon === "EUR") {
    return {
      eur: monto,
      usd: Math.round(monto * eurUsd * 100) / 100,
      ars: Math.round(monto * eurArs * 100) / 100,
    };
  }
  if (mon === "USD") {
    return {
      usd: monto,
      eur: Math.round((monto / eurUsd) * 100) / 100,
      ars: Math.round(monto * usdArs * 100) / 100,
    };
  }
  return {
    ars: monto,
    eur: Math.round((monto / eurArs) * 100) / 100,
    usd: Math.round((monto / usdArs) * 100) / 100,
  };
}

export async function fetchRatesForDateOnline(cleanDate) {
  const today = new Date().toISOString().split("T")[0];
  const dateTag = cleanDate && cleanDate <= today ? cleanDate : "latest";
  const res = await fetch(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateTag}/v1/currencies/eur.json`);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.eur) return null;
  return {
    eurUsd: Math.round((Number(data.eur.usd) || 1.082) * 10000) / 10000,
    eurArs: Math.round((Number(data.eur.ars) || 1450.0) * 100) / 100,
  };
}
