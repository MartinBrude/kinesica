/**
 * Manual review curation — Places API only returns ~5 “most relevant”.
 * Use this when Maps has newer reviews we want on the home, or to drop one.
 *
 * Applied by `npm run reviews:fetch` before pick.
 */
export const EXCLUDE_AUTHORS = ["sofia suarez"];

/**
 * Extra reviews (usually newer than the Places subset). Spanish body is kept
 * for all langs; only relativeTime is localized.
 *
 * @type {Record<string, Array<{
 *   author: string,
 *   authorPhoto: string|null,
 *   authorProfile: string|null,
 *   rating: number,
 *   text: string,
 *   language: string,
 *   relativeTime: string,
 *   publishTime: string|null,
 * }>>}
 */
const GABRIEL_ROTMAN = {
  author: "Gabriel Rotman",
  authorPhoto:
    "https://lh3.googleusercontent.com/a-/ALV-UjU1sZgbUvf5_hu4GC95IP3lszyj_ugBsPntmjHporpoV7pMUC2sNg=s128-c0x00000000-cc-rp-mo-ba12",
  authorProfile:
    "https://www.google.com/maps/contrib/111063243092495440410/reviews",
  rating: 5,
  text: "Increíblemente sorprendido para bien, llevo 3 años con un dolor por epicondilitis, en apenas 2 sesiones con el kinesiologo Norberto Brude no tengo dolor, pude volver a entrenar, me despertaba con la mano dormida, no me volvió a suceder! Sinceramente un profesional fuera de serie, y sobre todo supo llevar calma cuando más lo necesitaba.",
  language: "es",
  publishTime: "2026-07-23T02:00:00.000Z",
};

export const SUPPLEMENT_REVIEWS = {
  es: [{ ...GABRIEL_ROTMAN, relativeTime: "Hace 19 horas" }],
  en: [{ ...GABRIEL_ROTMAN, relativeTime: "19 hours ago" }],
  fr: [{ ...GABRIEL_ROTMAN, relativeTime: "il y a 19 heures" }],
  pt: [{ ...GABRIEL_ROTMAN, relativeTime: "há 19 horas" }],
};
