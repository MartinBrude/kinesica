/**
 * Manual review curation — Places API only returns ~5 “most relevant”.
 * Use this when Maps has newer reviews we want on the home, or to drop one.
 *
 * Applied by `npm run reviews:fetch` before pick.
 * Relative time labels are computed at render from `publishTime`.
 */
export const EXCLUDE_AUTHORS = ["sofia suarez"];

/**
 * Extra reviews (usually newer than the Places subset). Spanish body is kept
 * for all langs; UI time comes from publishTime in the browser.
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
const MARIANA_GONZALEZ_CADAHIA = {
  author: "Mariana González Cadahía",
  authorPhoto: null,
  authorProfile: null,
  rating: 5,
  text: "Hace años que concurro, la atención de Norberto es excelente. Sabe escuchar para poder determinar sobre que puntos focalizar el trabajo y conoce diversas técnicas que utiliza según la necesidad del paciente. Siempre salí de la consulta sintiéndome mejor que al inicio. Lo recomiendo muchísimo!!!!!",
  language: "es",
  // Approx. from Maps “Hace 15 horas” at scrape (~2026-07-30T13:10Z).
  publishTime: "2026-07-29T22:10:00.000Z",
};

const GABRIEL_ROTMAN = {
  author: "Gabriel Rotman",
  authorPhoto:
    "https://lh3.googleusercontent.com/a-/ALV-UjU1sZgbUvf5_hu4GC95IP3lszyj_ugBsPntmjHporpoV7pMUC2sNg=s128-c0x00000000-cc-rp-mo-ba12",
  authorProfile:
    "https://www.google.com/maps/contrib/111063243092495440410/reviews",
  rating: 5,
  text: "Increíblemente sorprendido para bien, llevo 3 años con un dolor por epicondilitis, en apenas 2 sesiones con el kinesiologo Norberto Brude no tengo dolor, pude volver a entrenar, me despertaba con la mano dormida, no me volvió a suceder! Sinceramente un profesional fuera de serie, y sobre todo supo llevar calma cuando más lo necesitaba.",
  language: "es",
  // Approx. from Maps “Hace 19 horas” at scrape (~2026-07-24T21:05Z).
  publishTime: "2026-07-24T02:05:02.000Z",
};

export const SUPPLEMENT_REVIEWS = {
  es: [MARIANA_GONZALEZ_CADAHIA, GABRIEL_ROTMAN],
  en: [MARIANA_GONZALEZ_CADAHIA, GABRIEL_ROTMAN],
  fr: [MARIANA_GONZALEZ_CADAHIA, GABRIEL_ROTMAN],
  pt: [MARIANA_GONZALEZ_CADAHIA, GABRIEL_ROTMAN],
};
