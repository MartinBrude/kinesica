#!/usr/bin/env node
/**
 * French copy fixes + related internal links on articles and home.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const FR_REPLACEMENTS = [
  [
    "Ostéopathie structurelle et viscérale: evaluation and treatment of somatic dysfunctions. Manual therapy techniques in Palermo, Buenos Aires.",
    "Ostéopathie structurelle et viscérale : évaluation et traitement des dysfonctions somatiques. Techniques de thérapie manuelle à Palermo, Buenos Aires.",
  ],
  [
    "Neurodynamique: study and treatment of nervous system disorders. Pain relief and improved neurological function in Palermo.",
    "Neurodynamique : étude et traitement des troubles du système nerveux. Soulagement de la douleur et amélioration neurologique à Palermo.",
  ],
  [
    "Neurodynamique: study and treatment of nervous system disorders. Pain relief and improved neurological function in Palermo, Buenos Aires.",
    "Neurodynamique : étude et traitement des troubles du système nerveux. Soulagement de la douleur et amélioration neurologique à Palermo, Buenos Aires.",
  ],
  [
    "Manipulations viscérales: treatment of visceral tensions affecting the locomotor system. Manual therapy in Palermo.",
    "Manipulations viscérales : traitement des tensions viscérales affectant l'appareil locomoteur. Thérapie manuelle à Palermo.",
  ],
  [
    "Manipulations viscérales: treatment of visceral tensions affecting the locomotor system. Manual therapy in Palermo, Buenos Aires.",
    "Manipulations viscérales : traitement des tensions viscérales affectant l'appareil locomoteur. Thérapie manuelle à Palermo, Buenos Aires.",
  ],
  [
    "Mechanical low back pain: treatment with integrated manual therapy approach. Lombalgie specialists in Palermo, Buenos Aires.",
    "Lombalgie mécanique : traitement par approche intégrée de thérapie manuelle. Spécialistes à Palermo, Buenos Aires.",
  ],
  [
    "Mechanical low back pain: treatment with integrated manual therapy approach. Lombalgie specialists in Palermo, Buenos Aires. Personalized sessions.",
    "Lombalgie mécanique : traitement par approche intégrée de thérapie manuelle à Palermo. Séances personnalisées.",
  ],
  [
    '"description": "Mechanical low back pain is one of the most common reasons for medical consultation. Learn about integrated manual therapy treatment approaches."',
    '"description": "La lombalgie mécanique est l\'une des principales causes de consultation. Découvrez une approche intégrée de thérapie manuelle."',
  ],
  [
    '"description": "Mechanical neck pain is a common musculoskeletal condition. Learn about integrated manual therapy approaches for douleur cervicale treatment."',
    '"description": "La douleur cervicale mécanique est fréquente. Découvrez des approches intégrées de thérapie manuelle pour la traiter."',
  ],
  [
    `Tension in these tissues restricts the body's range of motion,
              both locally and at a distance. Without proper movement, overall
              health declines, and symptoms arise.`,
    `La tension dans ces tissus limite l'amplitude de mouvement du corps,
              localement et à distance. Sans mouvement adéquat, la santé globale
              se dégrade et des symptômes apparaissent.`,
  ],
  [
    `A lack of mobility, even in internal tissues, can lead to
              dysfunction, causing pain and other symptoms. Restoring movement
              capacity supports the body's natural healing process.`,
    `Un manque de mobilité, même dans les tissus internes, peut entraîner
              une dysfonction, avec douleur et autres symptômes. Restaurer la
              mobilité favorise le processus naturel de guérison du corps.`,
  ],
  [
    `Busquet, complements these treatments by considering the body's
              global organization in relation to visceral, myofascial, and
              articular tensions. The goal is to release blockages and
              restrictions throughout the system, promoting a harmonious
              postural reorganization that has a direct impact on the cervical
              region.`,
    `Busquet complète ces traitements en considérant l'organisation globale
              du corps face aux tensions viscérales, myofasciales et articulaires.
              L'objectif est de libérer les blocages et restrictions dans tout
              le système, pour une réorganisation posturale harmonieuse avec un
              impact direct sur la région cervicale.`,
  ],
  [
    "Chaînes physiologiques: method defining the relationship between body structure and visceral content. Manual therapy in Palermo, Buenos Aires.",
    "Chaînes physiologiques : méthode définissant la relation entre la structure corporelle et le contenu viscéral. Thérapie manuelle à Palermo, Buenos Aires.",
  ],
  [
    `Together, these integrated manual therapies act not only on the
              painful symptom but also on the functional causes that perpetuate
              it. In combination, they promote a more complete and
              longer-lasting recovery, enhances the patient's body awareness,
              and promotes autonomy in caring for their postural health.`,
    `Ensemble, ces thérapies manuelles intégrées agissent sur le symptôme
              douloureux et sur les causes fonctionnelles qui le perpétuent. Elles
              favorisent une récupération plus complète et durable, renforcent la
              conscience corporelle du patient et son autonomie posturale.`,
  ],
  [
    `According to Busquet, the body's organization adapts to internal
              and external tensions—whether mechanical, visceral, scarring,
              emotional, or traumatic. He describes the Container (the body's
              shape) as the result of muscular activity aimed at creating
              comfort and/or alleviating pain and other symptoms.`,
    `Selon Busquet, l'organisation du corps s'adapte aux tensions internes
              et externes — mécaniques, viscérales, cicatricielles, émotionnelles
              ou traumatiques. Il décrit le Contenant (la forme du corps) comme
              le résultat de l'activité musculaire visant le confort et/ou la
              réduction de la douleur et d'autres symptômes.`,
  ],
];

const RELATED = {
  es: {
    cervicalgia: {
      title: "También te puede interesar",
      links: [
        ["articulos.html", "Todos los artículos"],
        ["lumbalgia.html", "Artículo: Lumbalgia"],
        ["osteopatia.html", "Osteopatía"],
        ["neurodinamia.html", "Neurodinamia"],
        ["cadenas.html", "Cadenas fisiológicas"],
        ["rpg.html", "RPG"],
      ],
    },
    lumbalgia: {
      title: "También te puede interesar",
      links: [
        ["articulos.html", "Todos los artículos"],
        ["cervicalgia.html", "Artículo: Cervicalgia"],
        ["osteopatia.html", "Osteopatía"],
        ["manipulaciones.html", "Manipulaciones viscerales"],
        ["rpg.html", "RPG"],
        ["cadenas.html", "Cadenas fisiológicas"],
      ],
    },
    home: {
      title: "Artículos",
      lead: "Información sobre dolencias frecuentes",
      links: [
        ["cervicalgia.html", "Cervicalgia"],
        ["lumbalgia.html", "Lumbalgia"],
        ["articulos.html", "Ver todos los artículos"],
      ],
    },
  },
  en: {
    cervicalgia: {
      title: "You may also like",
      links: [
        ["articulos.html", "All articles"],
        ["lumbalgia.html", "Article: Low back pain"],
        ["osteopatia.html", "Osteopathy"],
        ["neurodinamia.html", "Neurodynamics"],
        ["cadenas.html", "Physiological chains"],
        ["rpg.html", "RPG"],
      ],
    },
    lumbalgia: {
      title: "You may also like",
      links: [
        ["articulos.html", "All articles"],
        ["cervicalgia.html", "Article: Cervical pain"],
        ["osteopatia.html", "Osteopathy"],
        ["manipulaciones.html", "Visceral manipulations"],
        ["rpg.html", "RPG"],
        ["cadenas.html", "Physiological chains"],
      ],
    },
    home: {
      title: "Articles",
      lead: "Information about common conditions",
      links: [
        ["cervicalgia.html", "Cervical pain"],
        ["lumbalgia.html", "Low back pain"],
        ["articulos.html", "View all articles"],
      ],
    },
  },
  fr: {
    cervicalgia: {
      title: "À découvrir aussi",
      links: [
        ["articulos.html", "Tous les articles"],
        ["lumbalgia.html", "Article : Lombalgie"],
        ["osteopatia.html", "Ostéopathie"],
        ["neurodinamia.html", "Neurodynamique"],
        ["cadenas.html", "Chaînes physiologiques"],
        ["rpg.html", "RPG"],
      ],
    },
    lumbalgia: {
      title: "À découvrir aussi",
      links: [
        ["articulos.html", "Tous les articles"],
        ["cervicalgia.html", "Article : Douleur cervicale"],
        ["osteopatia.html", "Ostéopathie"],
        ["manipulaciones.html", "Manipulations viscérales"],
        ["rpg.html", "RPG"],
        ["cadenas.html", "Chaînes physiologiques"],
      ],
    },
    home: {
      title: "Articles",
      lead: "Informations sur des affections fréquentes",
      links: [
        ["cervicalgia.html", "Douleur cervicale"],
        ["lumbalgia.html", "Lombalgie"],
        ["articulos.html", "Voir tous les articles"],
      ],
    },
  },
};

function relatedArticleBlock(cfg) {
  const items = cfg.links
    .map(([href, label]) => `<li><a href="${href}">${label}</a></li>`)
    .join("\n              ");
  return `
    <section class="space-medium bg-light related-links-section">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 col-md-8 col-sm-12 col-xs-12">
            <h2>${cfg.title}</h2>
            <ul class="listnone">
              ${items}
            </ul>
          </div>
        </div>
      </div>
    </section>`;
}

function relatedHomeBlock(cfg) {
  const btns = cfg.links
    .map(([href, label], i) => {
      const cls = i < 2 ? "btn btn-default" : "btn btn-link";
      return `<a href="${href}" class="${cls}">${label}</a>`;
    })
    .join("\n            ");
  return `
    <section class="space-small related-links-section">
      <div class="container text-center">
        <h2>${cfg.title}</h2>
        <p class="lead">${cfg.lead}</p>
        <p>${btns}</p>
      </div>
    </section>`;
}

function fixDivs(html) {
  return html;
}

function patchFr(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".html")) continue;
    const p = path.join(dir, f);
    let html = fs.readFileSync(p, "utf8");
    let changed = false;
    for (const [from, to] of FR_REPLACEMENTS) {
      if (html.includes(from)) {
        html = html.split(from).join(to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(p, html);
      console.log("fr-copy", path.relative(ROOT, p));
    }
  }
}

function injectRelated(file, block) {
  const p = path.join(ROOT, file);
  let html = fs.readFileSync(p, "utf8");
  if (html.includes("related-links-section")) return;
  const marker = '<section class="space-small bg-primary">';
  if (!html.includes(marker)) return;
  html = html.replace(marker, block + "\n    " + marker);
  fs.writeFileSync(p, html);
  console.log("links", file);
}

patchFr(path.join(ROOT, "fr"));

for (const lang of ["es", "en", "fr"]) {
  const prefix = lang === "es" ? "" : `${lang}/`;
  injectRelated(
    `${prefix}cervicalgia.html`,
    fixDivs(relatedArticleBlock(RELATED[lang].cervicalgia))
  );
  injectRelated(
    `${prefix}lumbalgia.html`,
    fixDivs(relatedArticleBlock(RELATED[lang].lumbalgia))
  );
  const homeFile = lang === "es" ? "index.html" : `${lang}/index.html`;
  const homePath = path.join(ROOT, homeFile);
  let home = fs.readFileSync(homePath, "utf8");
  if (!home.includes("related-links-section")) {
    const marker = '<section class="space-small bg-primary">';
    const idx = home.indexOf(marker);
    if (idx !== -1) {
      home =
        home.slice(0, idx) +
        fixDivs(relatedHomeBlock(RELATED[lang].home)) +
        "\n    " +
        home.slice(idx);
      fs.writeFileSync(homePath, home);
      console.log("links", homeFile);
    }
  }
}

console.log("Done.");
