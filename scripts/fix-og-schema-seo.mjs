#!/usr/bin/env node
/**
 * Limpieza OG en páginas secundarias.
 * Schema local (fisioterapia): usar npm run seo:schema
 * Run: node scripts/fix-og-schema-seo.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SCHEMA = {
  es: {
    medical: {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      name: "Kinésica",
      "@id": "https://www.kinesica.com.ar/",
      url: "https://www.kinesica.com.ar/",
      inLanguage: "es",
      image: "https://www.kinesica.com.ar/images/logo.svg",
      telephone: "+54 11 6156 4311",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Charcas 3889 5ª B",
        addressLocality: "Ciudad Autónoma de Buenos Aires",
        addressRegion: "CABA",
        postalCode: "C1425",
        addressCountry: "AR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -34.587025,
        longitude: -58.421046,
      },
      hasMap: "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      areaServed: [
        { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
        { "@type": "Place", name: "Palermo" },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ],
          opens: "10:00",
          closes: "20:00",
        },
      ],
      description:
        "Centro de kinesiología, osteopatía y RPG en Palermo, Buenos Aires. Terapias manuales personalizadas.",
      medicalSpecialty: ["Kinesiología", "Osteopatía", "Terapia Manual", "RPG"],
      founder: [{ "@type": "Person", name: "Norberto Silvio Brude" }],
      sameAs: [
        "https://www.facebook.com/kinesicabrude",
        "https://www.instagram.com/kinesicabrude/",
        "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      ],
    },
    faq: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Cuál es la duración del tratamiento?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Dependerá del objetivo, la situación del paciente y la evolución del tratamiento.",
          },
        },
        {
          "@type": "Question",
          name: "¿Cuánto dura la sesión?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "El tiempo de duración de una sesión es variable según el caso y la metodología que se necesite. Tomamos como un tiempo estándar 1 hora por sesión.",
          },
        },
        {
          "@type": "Question",
          name: "¿Frecuencia de las sesiones?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Varía según los casos y los métodos a emplear. En algunas modalidades las sesiones son semanales y en otras pueden espaciarse cada 2 o 3 semanas.",
          },
        },
        {
          "@type": "Question",
          name: "¿Qué necesito llevar a la primera sesión?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Tus inquietudes y estudios complementarios si los tuvieses; ropa cómoda. Si sos menor, vení acompañado/a por un mayor.",
          },
        },
        {
          "@type": "Question",
          name: "¿Atienden a través de Prepagas u Obras Sociales?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Podés solicitar reintegros a tu obra social o prepaga.",
          },
        },
        {
          "@type": "Question",
          name: "¿A quiénes sirven estos tratamientos?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A personas con dolores, alteraciones de la sensibilidad, mareos, cambios posturales, lesiones traumáticas o deportivas, entre otros.",
          },
        },
      ],
    },
  },
  en: {
    medical: {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      name: "Kinésica",
      "@id": "https://www.kinesica.com.ar/en/",
      url: "https://www.kinesica.com.ar/en/",
      inLanguage: "en",
      image: "https://www.kinesica.com.ar/images/logo.svg",
      telephone: "+54 11 6156 4311",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Charcas 3889 5ª B",
        addressLocality: "Ciudad Autónoma de Buenos Aires",
        addressRegion: "CABA",
        postalCode: "C1425",
        addressCountry: "AR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -34.587025,
        longitude: -58.421046,
      },
      hasMap: "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      areaServed: [
        { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
        { "@type": "Place", name: "Palermo" },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ],
          opens: "10:00",
          closes: "20:00",
        },
      ],
      description:
        "Kinesiology, osteopathy and RPG clinic in Palermo, Buenos Aires. Personalized manual therapy.",
      medicalSpecialty: ["Kinesiology", "Osteopathy", "Manual Therapy", "RPG"],
      founder: [{ "@type": "Person", name: "Norberto Silvio Brude" }],
      sameAs: [
        "https://www.facebook.com/kinesicabrude",
        "https://www.instagram.com/kinesicabrude/",
        "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      ],
    },
    faq: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the duration of the treatment?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It depends on the objective, the patient's condition, and the evolution of the treatment.",
          },
        },
        {
          "@type": "Question",
          name: "How long does a session last?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The duration of a session varies depending on the case and the methodology required. As a standard time, we consider 1 hour per session.",
          },
        },
        {
          "@type": "Question",
          name: "How often are sessions scheduled?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It varies by case and methods. Some modalities are weekly; others may be spaced every 2 or 3 weeks.",
          },
        },
        {
          "@type": "Question",
          name: "What should I bring to the first session?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your questions and any complementary studies; comfortable clothing. Minors should come with an adult.",
          },
        },
        {
          "@type": "Question",
          name: "Do you accept prepaid health plans or insurance?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can request reimbursements from your health insurance provider.",
          },
        },
        {
          "@type": "Question",
          name: "Who can benefit from these treatments?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "People with pain, sensitivity disorders, dizziness, posture issues, traumatic or sports injuries, among others.",
          },
        },
      ],
    },
  },
  fr: {
    medical: {
      "@context": "https://schema.org",
      "@type": "MedicalClinic",
      name: "Kinésica",
      "@id": "https://www.kinesica.com.ar/fr/",
      url: "https://www.kinesica.com.ar/fr/",
      inLanguage: "fr",
      image: "https://www.kinesica.com.ar/images/logo.svg",
      telephone: "+54 11 6156 4311",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Charcas 3889 5ª B",
        addressLocality: "Ciudad Autónoma de Buenos Aires",
        addressRegion: "CABA",
        postalCode: "C1425",
        addressCountry: "AR",
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: -34.587025,
        longitude: -58.421046,
      },
      hasMap: "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      areaServed: [
        { "@type": "City", name: "Ciudad Autónoma de Buenos Aires" },
        { "@type": "Place", name: "Palermo" },
      ],
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
          ],
          opens: "10:00",
          closes: "20:00",
        },
      ],
      description:
        "Centre de kinésithérapie, ostéopathie et RPG à Palermo, Buenos Aires. Thérapies manuelles personnalisées.",
      medicalSpecialty: [
        "Kinésithérapie",
        "Ostéopathie",
        "Thérapie manuelle",
        "RPG",
      ],
      founder: [{ "@type": "Person", name: "Norberto Silvio Brude" }],
      sameAs: [
        "https://www.facebook.com/kinesicabrude",
        "https://www.instagram.com/kinesicabrude/",
        "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
      ],
    },
    faq: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Quelle est la durée du traitement ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cela dépend de l'objectif, de l'état du patient et de l'évolution du traitement.",
          },
        },
        {
          "@type": "Question",
          name: "Combien de temps dure une séance ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "La durée varie selon le cas et la méthode utilisée. En règle générale, nous prévoyons environ une heure par séance.",
          },
        },
        {
          "@type": "Question",
          name: "À quelle fréquence ont lieu les séances ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Cela varie selon le cas et les méthodes. Certaines modalités sont hebdomadaires ; d'autres, espacées de 2 ou 3 semaines.",
          },
        },
        {
          "@type": "Question",
          name: "Que dois-je apporter à la première séance ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Vos questions et examens complémentaires si vous en avez ; tenue confortable. Les mineurs doivent être accompagnés d'un adulte.",
          },
        },
        {
          "@type": "Question",
          name: "Acceptez-vous les mutuelles ou assurances ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Vous pouvez demander un remboursement auprès de votre assurance ou mutuelle.",
          },
        },
        {
          "@type": "Question",
          name: "Qui peut bénéficier de ces traitements ?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Les personnes souffrant de douleur, troubles de sensibilité, vertiges, troubles posturaux, blessures traumatiques ou sportives, entre autres.",
          },
        },
      ],
    },
  },
};

function ldJson(obj) {
  return `  <script type="application/ld+json">\n${JSON.stringify(obj, null, 2)}\n  </script>`;
}

function removeOgLocaleAlternate(html) {
  return html.replace(
    /\s*<meta property="og:locale:alternate" content="[^"]+" \/>\n/g,
    "",
  );
}

function removeOgImageExtras(html) {
  return html
    .replace(/\s*<meta property="og:image:width"[^/]*\/>\n/g, "")
    .replace(/\s*<meta property="og:image:height"[^/]*\/>\n/g, "")
    .replace(/\s*<meta property="og:image:alt"[^/]*\/>\n/g, "");
}

function fixIndexSchema(html, lang) {
  const blocks =
    ldJson(SCHEMA[lang].medical) + "\n" + ldJson(SCHEMA[lang].faq);
  html = html.replace(
    /\s*<script src="[^"]*medical-clinic-schema\.js"><\/script>\s*\n\s*<script src="[^"]*faq-schema\.js"><\/script>/,
    "\n" + blocks + "\n",
  );
  return html;
}

function fixFrOg(html) {
  return html
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      '<meta property="og:title" content="Kinésica | Kinésithérapie, ostéopathie et RPG à Palermo" />',
    )
    .replace(
      /<meta property="og:description" content="[^"]*" \/>/,
      '<meta property="og:description" content="Centre de kinésithérapie, ostéopathie et RPG à Palermo. Thérapies manuelles et rendez-vous par WhatsApp." />',
    );
}

const indexFiles = [
  { file: "index.html", lang: "es" },
  { file: "en/index.html", lang: "en" },
  { file: "fr/index.html", lang: "fr" },
];

let changed = 0;
for (const { file, lang } of indexFiles) {
  const full = path.join(ROOT, file);
  let html = fs.readFileSync(full, "utf8");
  const original = html;
  html = removeOgLocaleAlternate(html);
  html = removeOgImageExtras(html);
  html = fixIndexSchema(html, lang);
  if (lang === "fr") html = fixFrOg(html);
  if (html !== original) {
    fs.writeFileSync(full, html);
    changed++;
    console.log("updated:", file);
  }
}

function walkHtml(dir, base = "") {
  for (const name of fs.readdirSync(dir)) {
    const rel = base ? `${base}/${name}` : name;
    const full = path.join(dir, name);
    if (name.endsWith(".html") && !name.startsWith("cv-")) {
      if (!rel.includes("index.html") && !/404/.test(rel)) {
        let html = fs.readFileSync(full, "utf8");
        const next = removeOgLocaleAlternate(html);
        if (next !== html) {
          fs.writeFileSync(full, next);
          changed++;
          console.log("og cleanup:", rel);
        }
      }
    } else if (fs.statSync(full).isDirectory() && !name.startsWith(".")) {
      walkHtml(full, rel);
    }
  }
}
walkHtml(ROOT);

console.log(`Done. ${changed} file(s) modified.`);
