/**
 * Localized UI copy and grammatical helpers for pathology detail pages.
 */

export const PATHOLOGY_PAGE_UI = {
  es: {
    whatLabel: "Qué es",
    symptomsLabel: "Síntomas",
    treatmentLabel: "Cómo se trata",
    whatIsTitle: (name) => `¿Qué es ${name}?`,
    symptomsTitle: (name) => `¿Qué síntomas se asocian con ${name}?`,
    treatmentTitle: (name) => `¿Cómo se trata ${name} en Kinésica?`,
    evaluationTitle: (name) => `¿Cómo se evalúa ${name}?`,
    urgentTitle: (name) => `¿Cuándo consultar por ${name}?`,
    urgentLead: "Esta información es orientativa y no reemplaza una evaluación médica.",
    urgentList: [
      "Dolor intenso que no mejora con reposo relativo o empeora rápidamente.",
      "Pérdida de fuerza progresiva, alteraciones de sensibilidad o dificultad para caminar.",
      "Traumatismo reciente, fiebre, malestar general o síntomas nuevos no habituales.",
    ],
    urgentClose: "Si aparecen estos signos, consultá de forma prioritaria.",
    urgentLinkLabel: "Condiciones de uso y alcance informativo",
  },
  en: {
    whatLabel: "What it is",
    symptomsLabel: "Symptoms",
    treatmentLabel: "How it is treated",
    whatIsTitle: (name) => `What is ${name}?`,
    symptomsTitle: (name) => `What symptoms are linked to ${name}?`,
    treatmentTitle: (name) => `How is ${name} treated at Kinésica?`,
    evaluationTitle: (name) => `How is ${name} assessed?`,
    urgentTitle: (name) => `When should you seek care for ${name}?`,
    urgentLead: "This information is educational and does not replace medical assessment.",
    urgentList: [
      "Severe pain that does not improve with relative rest or worsens quickly.",
      "Progressive weakness, sensory changes, or difficulty walking.",
      "Recent trauma, fever, general malaise, or new unusual symptoms.",
    ],
    urgentClose: "If these signs appear, seek prompt medical evaluation.",
    urgentLinkLabel: "Conditions of use and informational scope",
  },
  fr: {
    whatLabel: "De quoi s'agit-il",
    symptomsLabel: "Symptômes",
    treatmentLabel: "Comment c'est traité",
    whatIsTitle: (name) => `Qu'est-ce que ${name} ?`,
    symptomsTitle: (name) => `Quels symptômes accompagnent ${name} ?`,
    treatmentTitle: (name) => `Quelle prise en charge pour ${name} chez Kinésica ?`,
    evaluationTitle: (name) => `Comment évalue-t-on ${name} ?`,
    urgentTitle: (name) => `Quand consulter pour ${name} ?`,
    urgentLead: "Ces informations sont indicatives et ne remplacent pas un avis médical.",
    urgentList: [
      "Douleur intense qui ne s'améliore pas avec le repos relatif ou qui s'aggrave rapidement.",
      "Perte de force progressive, troubles de la sensibilité ou difficulté à marcher.",
      "Traumatisme récent, fièvre, malaise général ou symptômes nouveaux inhabituels.",
    ],
    urgentClose: "En présence de ces signes, consultez rapidement.",
    urgentLinkLabel: "Conditions d'utilisation et portée informative",
  },
  pt: {
    whatLabel: "O que é",
    symptomsLabel: "Sintomas",
    treatmentLabel: "Como se trata",
    whatIsTitle: (name) => `O que é ${name}?`,
    symptomsTitle: (name) => `Quais sintomas se associam ${ptA(name)}?`,
    treatmentTitle: (name) => `Como se trata ${name} na Kinésica?`,
    evaluationTitle: (name) => `Como se avalia ${name}?`,
    urgentTitle: (name) => `Quando procurar atendimento por ${name}?`,
    urgentLead: "Este conteúdo é informativo e não substitui avaliação médica.",
    urgentList: [
      "Dor intensa que não melhora com repouso relativo ou piora rapidamente.",
      "Perda progressiva de força, alterações de sensibilidade ou dificuldade para caminhar.",
      "Trauma recente, febre, mal-estar geral ou sintomas novos incomuns.",
    ],
    urgentClose: "Se esses sinais aparecerem, procure avaliação médica prioritária.",
    urgentLinkLabel: "Condições de uso e escopo informativo",
  },
};

function withArticle(lang, name) {
  const first = name.split(" ")[0];
  if (lang === "es") {
    if (first === "contracturas") return `las ${name}`;
    if (first === "pies") return `los ${name}`;
    if (/algia$|itis$|osis$|patía$|ía$|ión$|dad$|ura$|sión$|a$/i.test(first)) return `la ${name}`;
    if (/ismo$|o$|or$/i.test(first) || /^túnel$/i.test(first)) return `el ${name}`;
    return name;
  }
  if (lang === "fr") {
    if (/^[aeiouéèêh]/i.test(first)) return `l'${name}`;
    if (/isme$|age$|ent$|eau$|al$|os$/i.test(first)) return `le ${name}`;
    if (/ie$|ose$|ite$|eur$|ion$|ée$|ure$|e$/i.test(first)) return `la ${name}`;
    return name;
  }
  if (lang === "pt") {
    if (/ão$|a$|gem$|ade$/i.test(first) || /^dor$/i.test(first)) return `a ${name}`;
    if (/o$|ismo$|or$/i.test(first)) return `o ${name}`;
    return name;
  }
  return name;
}

function ptA(name) {
  if (name.startsWith("a ")) return `à ${name.slice(2)}`;
  if (name.startsWith("o ")) return `ao ${name.slice(2)}`;
  return `a ${name}`;
}

export function conditionPhrase(data, lang) {
  const raw = String(data.breadcrumb || data.h1 || "").trim();
  if (!raw) return "";
  if (raw.length <= 5 && raw === raw.toUpperCase()) return raw;
  return withArticle(lang, raw.charAt(0).toLowerCase() + raw.slice(1));
}

export function firstSentence(text) {
  const plain = String(text || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  const match = plain.match(/^.{12,240}?[.!?]/);
  return match ? match[0] : plain;
}
