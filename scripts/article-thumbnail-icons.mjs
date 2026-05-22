/**
 * Article card thumbnails — dot + contour icons (recognizable body regions).
 */
export const CARD_HUES = [198, 168, 205, 178, 192, 210, 165, 188];

export const TEAL = "#2ebfa5";

export function cardHue(index) {
  return CARD_HUES[index % CARD_HUES.length];
}

/** @type {Record<string, string>} */
export const THUMBNAIL_BY_STEM = {
  cefalea: "head",
  dorsalgia: "torso-upper",
  lumbalgia: "torso-lower",
  ciatalgia: "leg-nerve",
  cervicobraquialgia: "neck-arm",
  pubalgia: "groin",
  gonalgia: "knee",
  talalgia: "foot-heel",
  "dolor-sacriiliaco": "pelvis",
  "hernia-disco": "spine-disc",
  "protrusion-discal": "spine-bulge",
  hipercifosis: "spine-kyphosis",
  hiperlordosis: "spine-lordosis",
  "dorso-plano": "spine-flat",
  "genu-valgo": "knees-valgus",
  "genu-varo": "knees-varus",
  "pies-planos": "foot-flat",
  escoliosis: "spine-scoliosis",
  "epicondilitis-lateral": "elbow",
  "epicondilitis-medial": "elbow",
  "impingement-subacromial": "shoulder-raised",
  "manguito-rotador": "shoulder",
  radiculopatia: "spine-roots",
  meniscopatia: "knee",
  "fascitis-plantar": "foot-sole",
  cervicalgia: "neck",
};

function dot(cx, cy, r, fill = TEAL) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

function line(pathD, width = 6) {
  return `<path d="${pathD}" fill="none" stroke="${TEAL}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/** Dots at [x,y,r] + optional contour path. */
function motif(contourPath, points) {
  const dots = points.map(([x, y, r]) => dot(x, y, r ?? 7)).join("\n    ");
  const path = contourPath ? `\n    ${line(contourPath)}` : "";
  return `${dots}${path}`;
}

const ICONS = {
  /** Cabeza en perfil (cefalea). */
  head: () =>
    motif(
      "M355 95 Q375 130 365 175 Q358 210 340 228 Q320 238 305 248",
      [
        [300, 88, 6],
        [312, 72, 8],
        [328, 65, 9],
        [344, 72, 8],
        [356, 88, 6],
        [348, 102, 5],
        [330, 108, 5],
        [312, 105, 5],
        [318, 248, 5],
        [328, 268, 6],
        [338, 288, 5],
      ],
    ),

  /** Cuello + inicio de hombros (cervicalgia). */
  neck: () =>
    motif(
      "M348 78 Q362 120 350 165 Q345 200 338 235",
      [
        [268, 95, 5],
        [268, 118, 6],
        [268, 142, 7],
        [268, 168, 9],
        [268, 195, 10],
        [268, 222, 9],
        [268, 248, 7],
        [295, 72, 7],
        [318, 68, 8],
        [341, 72, 7],
      ],
    ),

  /** Dorsal alta — tórax con curva suave. */
  "torso-upper": () =>
    motif(
      "M352 100 Q368 155 345 210 Q358 250 348 275",
      [
        [262, 108, 5],
        [262, 132, 7],
        [262, 158, 9],
        [262, 185, 12],
        [262, 212, 13],
        [262, 238, 11],
        [262, 262, 8],
        [262, 282, 6],
      ],
    ),

  /** Zona lumbar. */
  "torso-lower": () =>
    motif(
      "M350 145 Q368 200 342 255 Q358 295 348 310",
      [
        [262, 152, 5],
        [262, 178, 7],
        [262, 205, 10],
        [262, 232, 13],
        [262, 258, 14],
        [262, 282, 12],
        [262, 302, 8],
        [262, 318, 5],
      ],
    ),

  /** Columna + irradiación pierna (ciatalgia). */
  "leg-nerve": () =>
    motif(
      "M352 95 Q365 180 348 255 M348 210 Q400 235 425 285",
      [
        [268, 100, 5],
        [268, 130, 7],
        [268, 162, 9],
        [268, 195, 11],
        [268, 228, 10],
        [268, 258, 8],
        [410, 248, 6],
        [422, 272, 6],
        [428, 292, 5],
      ],
    ),

  /** Cuello + brazo (cervicobraquialgia). */
  "neck-arm": () =>
    motif(
      "M348 90 Q360 140 345 185 M345 165 Q395 175 430 225",
      [
        [268, 98, 5],
        [268, 125, 7],
        [268, 152, 8],
        [268, 178, 9],
        [268, 202, 8],
        [305, 78, 6],
        [322, 72, 7],
        [418, 198, 6],
        [432, 225, 6],
        [438, 248, 5],
      ],
    ),

  /** Ingle / pubis. */
  groin: () =>
    motif(
      "M280 200 Q320 175 360 200 Q320 255 280 230 Q320 200 360 230",
      [
        [268, 165, 6],
        [268, 195, 8],
        [268, 225, 8],
        [295, 218, 7],
        [345, 218, 7],
        [320, 248, 8],
      ],
    ),

  /** Rodilla en perfil (gonalgia, meniscopatía). */
  knee: () =>
    motif(
      "M310 95 Q315 175 308 255 M308 200 Q355 195 375 225 Q355 255 325 252",
      [
        [292, 108, 6],
        [292, 148, 7],
        [292, 188, 8],
        [292, 228, 7],
        [368, 218, 9],
        [378, 238, 7],
      ],
    ),

  /** Pie lateral — énfasis talón (talalgia). */
  "foot-heel": () =>
    motif(
      "M200 235 Q260 255 320 248 Q380 238 420 218 Q440 245 425 275 Q380 295 320 288 Q240 285 195 255 Z",
      [
        [210, 232, 5],
        [245, 242, 6],
        [285, 248, 6],
        [320, 246, 6],
        [355, 240, 5],
        [388, 228, 5],
        [418, 248, 8],
        [425, 278, 7],
      ],
    ),

  /** Planta del pie (fascitis plantar). */
  "foot-sole": () =>
    motif(
      "M195 230 Q320 280 445 230 Q320 300 195 230",
      [
        [220, 235, 5],
        [260, 252, 6],
        [300, 262, 7],
        [320, 265, 9],
        [340, 262, 7],
        [380, 252, 6],
        [420, 235, 5],
        [320, 278, 8],
      ],
    ),

  /** Pie plano — arco bajo. */
  "foot-flat": () =>
    motif(
      "M200 240 L440 240 Q320 268 200 240",
      [
        [215, 238, 5],
        [255, 242, 6],
        [295, 244, 6],
        [320, 245, 7],
        [345, 244, 6],
        [385, 242, 6],
        [425, 238, 5],
      ],
    ),

  /** Pelvis / sacroilíaco. */
  pelvis: () =>
    motif(
      "M270 210 Q320 185 370 210 Q320 250 270 230 Q320 210 370 230",
      [
        [268, 175, 6],
        [268, 205, 8],
        [268, 235, 8],
        [268, 265, 7],
        [292, 228, 8],
        [348, 228, 8],
        [320, 258, 7],
      ],
    ),

  /** Disco intervertebral. */
  "spine-disc": () =>
    motif(
      "M352 95 Q365 180 348 275 M248 208 Q232 215 248 222",
      [
        [268, 100, 5],
        [268, 140, 8],
        [268, 180, 11],
        [268, 220, 11],
        [268, 258, 8],
        [238, 215, 7],
      ],
    ),

  "spine-bulge": () =>
    motif(
      "M352 95 Q365 180 348 275 M248 208 Q218 215 235 232 Q218 240 248 222",
      [
        [268, 100, 5],
        [268, 140, 8],
        [268, 180, 11],
        [268, 220, 11],
        [268, 258, 8],
        [228, 222, 8],
      ],
    ),

  "spine-kyphosis": () =>
    motif(
      "M352 110 Q310 175 355 230 Q365 270 348 295",
      [
        [268, 115, 5],
        [268, 150, 8],
        [268, 188, 11],
        [268, 225, 12],
        [268, 260, 9],
        [268, 288, 6],
      ],
    ),

  "spine-lordosis": () =>
    motif(
      "M352 95 Q385 165 335 220 Q380 270 348 300",
      [
        [268, 100, 5],
        [268, 145, 8],
        [268, 192, 12],
        [268, 238, 12],
        [268, 278, 8],
        [268, 302, 5],
      ],
    ),

  "spine-flat": () =>
    motif("M350 100 L352 295", [
      [268, 108, 5],
      [268, 148, 8],
      [268, 188, 10],
      [268, 228, 10],
      [268, 268, 8],
      [268, 298, 5],
    ]),

  "spine-scoliosis": () =>
    motif(
      "M352 95 Q300 155 365 215 Q295 275 348 300",
      [
        [268, 100, 5],
        [260, 135, 7],
        [272, 170, 8],
        [258, 205, 9],
        [270, 240, 9],
        [262, 275, 7],
        [268, 300, 5],
      ],
    ),

  "spine-roots": () =>
    motif(
      "M352 95 Q365 180 348 255 M268 210 Q230 240 215 270 M348 210 Q400 240 418 270",
      [
        [268, 100, 5],
        [268, 150, 8],
        [268, 200, 10],
        [268, 248, 8],
        [218, 255, 5],
        [228, 275, 5],
        [408, 255, 5],
        [418, 275, 5],
      ],
    ),

  /** Dos piernas — valgo (rodillas hacia adentro). */
  "knees-valgus": () =>
    motif(
      "M285 95 Q288 200 282 285 M355 95 Q352 200 358 285 M282 228 Q320 252 358 228",
      [
        [272, 120, 6],
        [272, 200, 7],
        [272, 268, 6],
        [342, 120, 6],
        [342, 200, 7],
        [342, 268, 6],
      ],
    ),

  /** Varo — rodillas hacia afuera. */
  "knees-varus": () =>
    motif(
      "M270 95 Q272 200 268 285 M365 95 Q363 200 367 285 M268 228 Q320 205 367 228",
      [
        [258, 120, 6],
        [258, 200, 7],
        [258, 268, 6],
        [375, 120, 6],
        [375, 200, 7],
        [375, 268, 6],
      ],
    ),

  /** Codo flexionado. */
  elbow: () =>
    motif(
      "M285 120 Q288 200 282 270 M282 195 Q340 175 375 210",
      [
        [272, 135, 6],
        [272, 185, 7],
        [272, 235, 7],
        [365, 198, 8],
        [378, 218, 6],
      ],
    ),

  /** Hombro elevado. */
  "shoulder-raised": () =>
    motif(
      "M348 130 Q360 200 345 280 M345 165 Q280 140 248 105 Q265 85 285 95",
      [
        [268, 145, 6],
        [268, 185, 8],
        [268, 225, 8],
        [268, 265, 7],
        [255, 108, 6],
        [272, 92, 7],
        [292, 98, 6],
      ],
    ),

  /** Hombro + brazo. */
  shoulder: () =>
    motif(
      "M348 120 Q358 200 342 275 M342 175 Q270 200 235 255",
      [
        [268, 135, 6],
        [268, 175, 8],
        [268, 215, 8],
        [268, 255, 7],
        [298, 125, 8],
        [228, 238, 6],
        [238, 262, 5],
      ],
    ),
};

function renderIcon(variant) {
  const fn = ICONS[variant] || ICONS["torso-lower"];
  return fn();
}

export function buildThumbnailSvg(stem, hue) {
  const variant = THUMBNAIL_BY_STEM[stem] || "torso-lower";
  const icon = renderIcon(variant);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-hidden="true">
  <defs>
    <linearGradient id="bg-${stem}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="hsl(${hue} 42% 99%)"/>
      <stop offset="55%" stop-color="hsl(${hue} 38% 96%)"/>
      <stop offset="100%" stop-color="hsl(${hue} 48% 90%)"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#bg-${stem})"/>
  <g transform="translate(0, 4)">${icon}</g>
</svg>
`;
}

/** @deprecated */
export const ICON_PATHS = {};
