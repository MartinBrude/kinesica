/**
 * Manual review curation — Places API only returns ~5 “most relevant”.
 * Use this when Maps has newer reviews we want on the home, or to drop one.
 *
 * Applied by `npm run reviews:fetch` before pick.
 * Relative time labels are computed at render from `publishTime`.
 *
 * If a review is not in the page language, translate it (do not drop it).
 * `REVIEW_BODY_BY_AUTHOR` is the translation source for supplements and for
 * any matching author still in another language after the Places fetch.
 */
import { normalizeAuthorKey } from "./google-reviews-pick.mjs";

export const EXCLUDE_AUTHORS = ["sofia suarez"];

const MARIANA_TEXT = {
  es: "Hace años que concurro, la atención de Norberto es excelente. Sabe escuchar para poder determinar sobre que puntos focalizar el trabajo y conoce diversas técnicas que utiliza según la necesidad del paciente. Siempre salí de la consulta sintiéndome mejor que al inicio. Lo recomiendo muchísimo!!!!!",
  en: "I've been coming here for years, and Norberto's care is excellent. He knows how to listen so he can decide where to focus the work, and he uses a range of techniques according to the patient's needs. I always left feeling better than when I arrived. I recommend him highly!!!!!",
  fr: "Je viens le consulter depuis des années, et l'accompagnement de Norberto est excellent. Il sait écouter pour déterminer sur quels points concentrer le travail, et il maîtrise diverses techniques qu'il utilise selon les besoins du patient. Je suis toujours sortie de la séance mieux qu'à l'arrivée. Je le recommande vivement !!!!!",
  pt: "Venho há anos, e o atendimento do Norberto é excelente. Ele sabe escutar para definir em que pontos focar o trabalho e conhece diversas técnicas que usa conforme a necessidade do paciente. Sempre saí da consulta me sentindo melhor do que no início. Recomendo muitíssimo!!!!!",
};

const GABRIEL_TEXT = {
  es: "Increíblemente sorprendido para bien, llevo 3 años con un dolor por epicondilitis, en apenas 2 sesiones con el kinesiologo Norberto Brude no tengo dolor, pude volver a entrenar, me despertaba con la mano dormida, no me volvió a suceder! Sinceramente un profesional fuera de serie, y sobre todo supo llevar calma cuando más lo necesitaba.",
  en: "Incredibly surprised, in a good way: I had epicondylitis pain for 3 years, and after just 2 sessions with kinesiologist Norberto Brude I have no pain, I was able to go back to training, I used to wake up with a numb hand and it hasn't happened again! Truly an outstanding professional, and above all he brought calm when I needed it most.",
  fr: "Agréablement surpris, au-delà de toute attente : je souffrais d'une épicondylite depuis 3 ans, et en à peine 2 séances avec le kinésithérapeute Norberto Brude je n'ai plus de douleur, j'ai pu reprendre l'entraînement, je me réveillais avec la main endormie et cela ne s'est plus reproduit ! Un professionnel hors pair, et surtout il a su m'apporter du calme quand j'en avais le plus besoin.",
  pt: "Incrivelmente surpreso, para melhor: levei 3 anos com dor por epicondilite e, em apenas 2 sessões com o fisioterapeuta Norberto Brude, não tenho mais dor, pude voltar a treinar, acordava com a mão dormente e isso não voltou a acontecer! Sinceramente um profissional fora de série, e acima de tudo soube trazer calma quando mais eu precisava.",
};

/** Author key → body copy per site language. */
export const REVIEW_BODY_BY_AUTHOR = {
  [normalizeAuthorKey("Mariana González Cadahía")]: MARIANA_TEXT,
  [normalizeAuthorKey("Gabriel Rotman")]: GABRIEL_TEXT,
};

/**
 * Extra reviews (usually newer than the Places subset). Body is localized
 * per page language so ES/EN/FR/PT all show the same authors.
 *
 * @type {Record<string, Array<{
 *   author: string,
 *   authorPhoto: string|null,
 *   authorProfile: string|null,
 *   rating: number,
 *   text: string,
 *   language: string,
 *   publishTime: string|null,
 * }>>}
 */
const MARIANA_META = {
  author: "Mariana González Cadahía",
  authorPhoto: null,
  authorProfile: null,
  rating: 5,
  // Approx. from Maps “Hace 15 horas” at scrape (~2026-07-30T13:10Z).
  publishTime: "2026-07-29T22:10:00.000Z",
};

const GABRIEL_META = {
  author: "Gabriel Rotman",
  authorPhoto:
    "https://lh3.googleusercontent.com/a-/ALV-UjU1sZgbUvf5_hu4GC95IP3lszyj_ugBsPntmjHporpoV7pMUC2sNg=s128-c0x00000000-cc-rp-mo-ba12",
  authorProfile:
    "https://www.google.com/maps/contrib/111063243092495440410/reviews",
  rating: 5,
  // Approx. from Maps “Hace 19 horas” at scrape (~2026-07-24T21:05Z).
  publishTime: "2026-07-24T02:05:02.000Z",
};

function reviewInLang(meta, texts, lang) {
  const text = texts[lang] || texts.es;
  return {
    ...meta,
    text,
    language: texts[lang] ? lang : "es",
  };
}

function supplementsForLang(lang) {
  return [
    reviewInLang(MARIANA_META, MARIANA_TEXT, lang),
    reviewInLang(GABRIEL_META, GABRIEL_TEXT, lang),
  ];
}

export const SUPPLEMENT_REVIEWS = {
  es: supplementsForLang("es"),
  en: supplementsForLang("en"),
  fr: supplementsForLang("fr"),
  pt: supplementsForLang("pt"),
};
