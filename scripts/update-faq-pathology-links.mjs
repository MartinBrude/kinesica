#!/usr/bin/env node
/**
 * Link FAQ pathology lists to detail pages.
 * Run: node scripts/update-faq-pathology-links.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PATHOLOGIES } from "./pathology-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** FAQ list item text (substring match) → stem */
const FAQ_LINKS_ES = [
  ["Cefalea", "cefalea"],
  ["Dorsalgia", "dorsalgia"],
  ["Lumbalgia", "lumbalgia"],
  ["Ciatalgia", "ciatalgia"],
  ["Cervicobraquialgia", "cervicobraquialgia"],
  ["Pubalgia", "pubalgia"],
  ["Gonalgia", "gonalgia"],
  ["Talalgia", "talalgia"],
  ["Dolor sacroilíaco", "dolor-sacroiliaco"],
  ["Hernias de disco", "hernia-disco"],
  ["Protrusiones discales", "protrusion-discal"],
  ["Hipercifosis", "hipercifosis"],
  ["Hiperlordosis", "hiperlordosis"],
  ["Dorso plano", "dorso-plano"],
  ["Genu valgo", "genu-valgo"],
  ["Genu varo", "genu-varo"],
  ["Pies cavos o planos", "pies-planos"],
  ["Escoliosis", "escoliosis"],
  ["Codo de tenista", "epicondilitis-lateral"],
  ["Codo de golfista", "epicondilitis-medial"],
  ["Talalgias", "talalgia"],
  ["Impingement subacromial", "impingement-subacromial"],
  ["Lesiones del manguito rotador", "manguito-rotador"],
  ["Pubalgias", "pubalgia"],
  ["Radiculopatías", "radiculopatia"],
  ["Meniscopatías", "meniscopatia"],
  ["Fascitis plantar", "fascitis-plantar"],
];

const FAQ_LINKS_EN = [
  ["Headache", "cefalea"],
  ["Thoracic back pain", "dorsalgia"],
  ["Dorsalgia", "dorsalgia"],
  ["Lumbalgia", "lumbalgia"],
  ["Sciatica", "ciatalgia"],
  ["Cervicobrachialgia", "cervicobraquialgia"],
  ["Groin pain", "pubalgia"],
  ["Pubalgia", "pubalgia"],
  ["Knee pain", "gonalgia"],
  ["Gonalgia", "gonalgia"],
  ["Heel pain", "talalgia"],
  ["Talalgia", "talalgia"],
  ["Sacroiliac pain", "dolor-sacroiliaco"],
  ["Disc herniation", "hernia-disco"],
  ["Disc protrusion", "protrusion-discal"],
  ["Hyperkyphosis", "hipercifosis"],
  ["Hyperlordosis", "hiperlordosis"],
  ["hyperlordosis", "hiperlordosis"],
  ["Cervical/lumbar hyperlordosis", "hiperlordosis"],
  ["Flat back", "dorso-plano"],
  ["Genu valgum", "genu-valgo"],
  ["Genu varum", "genu-varo"],
  ["Flat or high-arched feet", "pies-planos"],
  ["Scoliosis", "escoliosis"],
  ["Tennis elbow", "epicondilitis-lateral"],
  ["Golfer's elbow", "epicondilitis-medial"],
  ["Subacromial impingement", "impingement-subacromial"],
  ["Rotator cuff", "manguito-rotador"],
  ["Radiculopath", "radiculopatia"],
  ["Meniscal", "meniscopatia"],
  ["Plantar fasciitis", "fascitis-plantar"],
];

const FAQ_LINKS_FR = [
  ["Céphalée", "cefalea"],
  ["Dorsalgie", "dorsalgia"],
  ["Lombalgie", "lumbalgia"],
  ["Sciatique", "ciatalgia"],
  ["Cervicobrachialgie", "cervicobraquialgia"],
  ["Pubalgie", "pubalgia"],
  ["Gonalgie", "gonalgia"],
  ["Talalgie", "talalgia"],
  ["Douleur sacro-iliaque", "dolor-sacroiliaco"],
  ["Hernie discale", "hernia-disco"],
  ["Protrusion discale", "protrusion-discal"],
  ["Hypercyphose", "hipercifosis"],
  ["Hyperlordose", "hiperlordosis"],
  ["Dos plat", "dorso-plano"],
  ["Genu valgum", "genu-valgo"],
  ["Genu varum", "genu-varo"],
  ["Pieds", "pies-planos"],
  ["Scoliose", "escoliosis"],
  ["épicondylite latérale", "epicondilitis-lateral"],
  ["Épicondylite latérale", "epicondilitis-lateral"],
  ["épicondylite médiale", "epicondilitis-medial"],
  ["Épicondylite médiale", "epicondilitis-medial"],
  ["Douleur au talon", "talalgia"],
  ["Conflit sous-acromial", "impingement-subacromial"],
  ["coiffe des rotateurs", "manguito-rotador"],
  ["Radiculopathies", "radiculopatia"],
  ["méniscales", "meniscopatia"],
  ["Fasciite plantaire", "fascitis-plantar"],
];

function hrefFor(lang, stem) {
  if (lang === "es") return `${stem}.html`;
  return `/${lang}/${stem}.html`;
}

function linkifyFaqBlock(block, lang, mappings) {
  const sorted = [...mappings].sort((a, b) => b[0].length - a[0].length);
  return block.replace(/<li>([\s\S]*?)<\/li>/g, (match, inner) => {
    if (inner.includes('href="')) return match;
    const plain = inner.replace(/\s+/g, " ").trim();
    for (const [needle, stem] of sorted) {
      if (plain.includes(needle)) {
        const href = hrefFor(lang, stem);
        return `<li><a href="${href}">${plain}</a></li>`;
      }
    }
    return match;
  });
}

function processFile(rel, lang, mappings) {
  const full = path.join(ROOT, rel);
  let html = fs.readFileSync(full, "utf8");
  const start = html.indexOf('id="faq6"');
  if (start === -1) {
    console.warn("faq6 not found:", rel);
    return;
  }
  const end = html.indexOf("</section>", start);
  const block = html.slice(start, end);
  const updated = linkifyFaqBlock(block, lang, mappings);
  if (updated === block) {
    console.log("no changes:", rel);
    return;
  }
  html = html.slice(0, start) + updated + html.slice(end);
  fs.writeFileSync(full, html);
  console.log("updated FAQ links:", rel);
}

processFile("index.html", "es", FAQ_LINKS_ES);
processFile("en/index.html", "en", FAQ_LINKS_EN);
processFile("fr/index.html", "fr", FAQ_LINKS_FR);
