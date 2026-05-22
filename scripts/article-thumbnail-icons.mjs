/**
 * Article card thumbnails — dot + contour iconography (Kinésica).
 * Reference: vertebrae as sized circles + smooth S-curve line, flat teal on white.
 */
export const CARD_HUES = [198, 168, 205, 178, 192, 210, 165, 188];

export const TEAL = "#2ebfa5";
export const TEAL_SOFT = "#e8f7f4";
export const BG = "#ffffff";

export function cardHue(index) {
  return CARD_HUES[index % CARD_HUES.length];
}

/** @type {Record<string, { variant: string; extra?: string }>} */
export const THUMBNAIL_BY_STEM = {
  cefalea: { variant: "head" },
  dorsalgia: { variant: "upper" },
  lumbalgia: { variant: "lower" },
  ciatalgia: { variant: "sciatica" },
  cervicobraquialgia: { variant: "arm" },
  pubalgia: { variant: "pelvis" },
  gonalgia: { variant: "knee" },
  talalgia: { variant: "foot" },
  "dolor-sacriiliaco": { variant: "sacro" },
  "hernia-disco": { variant: "disc" },
  "protrusion-discal": { variant: "disc-bulge" },
  hipercifosis: { variant: "kyphosis" },
  hiperlordosis: { variant: "lordosis" },
  "dorso-plano": { variant: "flat" },
  "genu-valgo": { variant: "knees-valgus" },
  "genu-varo": { variant: "knees-varus" },
  "pies-planos": { variant: "foot-flat" },
  escoliosis: { variant: "scoliosis" },
  "epicondilitis-lateral": { variant: "elbow-lat" },
  "epicondilitis-medial": { variant: "elbow-med" },
  "impingement-subacromial": { variant: "shoulder-up" },
  "manguito-rotador": { variant: "shoulder-rot" },
  radiculopatia: { variant: "radiculopathy" },
  meniscopatia: { variant: "knee-meniscus" },
  "fascitis-plantar": { variant: "plantar" },
  cervicalgia: { variant: "cervical" },
};

/** 11 levels: small → large → small (cervical → lumbar → sacral). */
const VERTEBRA_SIZES = [5, 6, 7, 9, 11, 13, 13, 11, 9, 7, 5];

function dot(cx, cy, r, fill = TEAL) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
}

function contour(pathD, stroke = TEAL, width = 6) {
  return `<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

/**
 * Spine profile: dots on the left, S-curve on the right (like reference).
 */
function spineProfile(opts = {}) {
  const {
    dotX = 268,
    ys = [92, 118, 142, 165, 188, 212, 235, 258, 278, 292, 302],
    sizes = VERTEBRA_SIZES,
    curve = "M348 88 Q362 148 342 208 Q358 258 348 288",
    dotOffsetX = 0,
    sizeScale = 1,
  } = opts;

  const offsets = Array.isArray(dotOffsetX) ? dotOffsetX : [];
  const dotsMarkup = ys
    .map((y, i) => {
      const r = (sizes[i] ?? 8) * sizeScale;
      const ox =
        offsets[i] ?? (typeof dotOffsetX === "number" ? dotOffsetX : 0);
      return dot(dotX + ox, y, r);
    })
    .join("\n    ");

  return `${dotsMarkup}\n    ${contour(curve)}`;
}

const CURVES = {
  standard: "M348 88 Q362 148 342 208 Q358 258 348 288",
  upper: "M348 92 Q360 140 345 185 Q358 220 348 248",
  lower: "M348 130 Q362 185 340 235 Q358 285 348 302",
  kyphosis: "M348 98 Q318 168 352 218 Q362 268 348 292",
  lordosis: "M348 86 Q378 155 338 210 Q372 262 348 290",
  flat: "M348 90 Q350 190 348 290",
  scoliosis: "M348 90 Q300 150 360 210 Q300 270 348 292",
  cervical: "M348 100 Q358 135 346 168 Q354 195 348 218",
};

function renderIcon(variant) {
  switch (variant) {
    case "head":
      return `
    ${dot(300, 72, 8)}
    ${dot(318, 62, 10)}
    ${dot(336, 72, 8)}
    ${dot(318, 82, 6)}
    ${spineProfile({ ys: [100, 125, 150, 175, 198, 220, 242, 262, 278, 290, 300], sizes: [4, 5, 6, 7, 8, 9, 9, 8, 7, 6, 5], curve: CURVES.cervical })}
  `;
    case "upper":
      return spineProfile({
        ys: [95, 120, 145, 168, 192, 215, 238, 258, 275, 288, 298],
        sizes: [5, 7, 9, 12, 14, 14, 12, 10, 8, 6, 5],
        curve: CURVES.upper,
      });
    case "lower":
      return spineProfile({
        ys: [130, 155, 178, 200, 222, 244, 265, 282, 294, 302, 308],
        sizes: [4, 5, 6, 8, 11, 14, 14, 12, 9, 7, 5],
        curve: CURVES.lower,
      });
    case "cervical":
      return spineProfile({ curve: CURVES.cervical, sizes: [6, 7, 9, 11, 12, 12, 10, 9, 7, 6, 5] });
    case "kyphosis":
      return spineProfile({ curve: CURVES.kyphosis });
    case "lordosis":
      return spineProfile({ curve: CURVES.lordosis });
    case "flat":
      return spineProfile({ curve: CURVES.flat });
    case "scoliosis":
      return spineProfile({
        curve: CURVES.scoliosis,
        dotOffsetX: [0, -8, 6, -10, 8, -6, 10, -8, 6, 0, 0],
      });
    case "sciatica":
      return `
    ${spineProfile({ ys: [90, 115, 140, 165, 190, 214, 238, 260, 278, 290, 300] })}
    ${dot(395, 248, 7)}
    ${dot(410, 268, 6)}
    ${dot(420, 288, 5)}
    ${contour("M348 210 Q390 230 420 288", TEAL, 5)}
  `;
    case "arm":
      return `
    ${spineProfile({ ys: [100, 125, 150, 172, 192, 210, 228, 245, 260, 272, 282], sizes: [5, 6, 8, 10, 11, 11, 10, 9, 8, 7, 6], curve: CURVES.cervical })}
    ${dot(400, 168, 6)}
    ${dot(418, 198, 7)}
    ${dot(428, 228, 6)}
    ${contour("M348 155 Q385 175 428 228", TEAL, 5)}
  `;
    case "radiculopathy":
      return `
    ${spineProfile()}
    ${dot(240, 210, 5)}
    ${dot(220, 240, 5)}
    ${dot(400, 210, 5)}
    ${dot(420, 240, 5)}
    ${contour("M268 212 Q230 240 220 262", TEAL, 4)}
    ${contour("M348 212 Q400 240 420 262", TEAL, 4)}
  `;
    case "pelvis":
    case "sacro":
      return `
    ${spineProfile({ ys: [100, 125, 150, 175, 200, 225, 248, 268, 285, 296, 304], sizes: [5, 6, 8, 10, 11, 12, 12, 10, 8, 6, 5] })}
    ${dot(295, 278, 8)}
    ${dot(345, 278, 8)}
    ${contour("M278 278 Q320 258 362 278", TEAL, 5)}
  `;
    case "disc":
      return `
    ${spineProfile()}
    ${contour("M255 205 Q238 212 255 219", TEAL, 5)}
    ${dot(248, 212, 6, TEAL)}
  `;
    case "disc-bulge":
      return `
    ${spineProfile()}
    ${contour("M255 205 Q225 212 248 228 Q225 235 255 219", TEAL, 5)}
    ${dot(238, 218, 7, TEAL)}
  `;
    case "knee":
    case "knee-meniscus":
      return `
    ${dot(308, 88, 6)}
    ${dot(308, 118, 7)}
    ${dot(308, 148, 8)}
    ${dot(308, 178, 9)}
    ${dot(308, 208, 11)}
    ${dot(308, 238, 10)}
    ${dot(308, 268, 8)}
    ${contour("M332 88 Q338 178 332 268", TEAL)}
    ${dot(348, 208, 10)}
    ${contour("M332 208 Q365 208 378 228 Q365 248 348 248", TEAL, 5)}
  `;
    case "knees-valgus":
      return `
    ${dot(288, 100, 6)}${dot(288, 160, 7)}${dot(288, 220, 8)}${contour("M308 100 Q312 220 308 280", TEAL, 5)}
    ${dot(352, 100, 6)}${dot(352, 160, 7)}${dot(352, 220, 8)}${contour("M332 100 Q328 220 332 280", TEAL, 5)}
    ${contour("M308 228 Q320 248 332 228", TEAL, 5)}
  `;
    case "knees-varus":
      return `
    ${dot(275, 100, 6)}${dot(275, 160, 7)}${dot(275, 220, 8)}${contour("M295 100 Q298 220 295 280", TEAL, 5)}
    ${dot(365, 100, 6)}${dot(365, 160, 7)}${dot(365, 220, 8)}${contour("M345 100 Q342 220 345 280", TEAL, 5)}
    ${contour("M295 228 Q320 208 345 228", TEAL, 5)}
  `;
    case "foot":
    case "foot-flat":
    case "plantar":
      return `
    ${dot(220, 228, 6)}${dot(248, 238, 7)}${dot(278, 242, 8)}${dot(308, 242, 9)}${dot(338, 242, 8)}${dot(368, 238, 7)}${dot(398, 228, 6)}
    ${contour("M210 228 Q320 268 410 228", TEAL)}
    ${variant === "plantar" ? dot(320, 252, 8) : ""}
  `;
    case "elbow-lat":
      return `
    ${dot(280, 120, 6)}${dot(280, 155, 7)}${dot(280, 190, 8)}
    ${contour("M302 120 Q308 190 302 250", TEAL)}
    ${dot(365, 200, 9)}
    ${contour("M302 175 Q340 165 365 200", TEAL, 5)}
  `;
    case "elbow-med":
      return `
    ${dot(360, 120, 6)}${dot(360, 155, 7)}${dot(360, 190, 8)}
    ${contour("M338 120 Q332 190 338 250", TEAL)}
    ${dot(275, 200, 9)}
    ${contour("M338 175 Q300 165 275 200", TEAL, 5)}
  `;
    case "shoulder-up":
      return `
    ${spineProfile({ ys: [110, 135, 160, 182, 200, 218, 235, 250, 265, 278, 290], sizes: [5, 6, 8, 9, 10, 10, 9, 8, 7, 6, 5], curve: "M348 110 Q358 170 348 230 Q355 280 348 292" })}
    ${dot(248, 118, 6)}${dot(232, 95, 7)}${dot(252, 78, 6)}
    ${contour("M268 155 Q245 125 252 78", TEAL, 5)}
  `;
    case "shoulder-rot":
      return `
    ${dot(318, 128, 9)}${dot(298, 148, 7)}${dot(338, 148, 7)}
    ${contour("M318 110 Q298 148 318 168 Q338 148 318 110", TEAL, 5)}
    ${spineProfile({ ys: [175, 198, 220, 242, 262, 280, 295, 305, 312, 318, 322], sizes: [6, 7, 8, 9, 10, 10, 9, 8, 7, 6, 5], curve: "M348 175 Q358 240 348 300" })}
    ${dot(248, 228, 6)}${dot(235, 258, 6)}
    ${contour("M318 195 Q260 220 235 258", TEAL, 5)}
  `;
    default:
      return spineProfile();
  }
}

export function buildThumbnailSvg(stem, hue) {
  const meta = THUMBNAIL_BY_STEM[stem] || { variant: "standard" };
  const icon = renderIcon(meta.variant);
  const tint = `hsl(${hue} 40% 97%)`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" role="img" aria-hidden="true">
  <rect width="640" height="360" fill="${BG}"/>
  <rect width="320" height="360" fill="${tint}"/>
  <rect x="320" width="320" height="360" fill="${TEAL_SOFT}"/>
  <g transform="translate(0, 8)">${icon}</g>
</svg>
`;
}

/** @deprecated — kept for imports that read ICON_PATHS */
export const ICON_PATHS = {};
