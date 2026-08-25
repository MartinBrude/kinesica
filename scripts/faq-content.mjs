/**
 * Home FAQ copy: accordion HTML + FAQPage JSON-LD (ES / EN / FR / PT).
 * Schema answers stay concise; accordion FAQ 4 and 6 keep richer HTML.
 */
import { escHtml } from "./html-utils.mjs";
import { pathologyForStem } from "./pathology-content.mjs";

export const FAQ_UI = {
  es: { eyebrow: "Consultas", heading: "Preguntas Frecuentes" },
  en: { eyebrow: "Help", heading: "Frequently Asked Questions" },
  fr: { eyebrow: "Aide", heading: "Questions fréquentes" },
  pt: { eyebrow: "Ajuda", heading: "Perguntas frequentes" },
};

const CLOTHING = {
  es: {
    concerns: "Tus inquietudes y estudios complementarios si los tuvieses.",
    clothing: "Indumentaria:",
    men: "Ropa interior o pantalón corto para los varones.",
    women: "Ropa interior, malla de 2 piezas o calza corta para las mujeres.",
    minor: "Si sos menor, vení acompañado/a por un mayor.",
  },
  en: {
    concerns: "Your concerns and any complementary studies if you have them.",
    clothing: "Clothing:",
    men: "Underwear or shorts for men.",
    women: "Underwear, a two-piece swimsuit, or short leggings for women.",
    minor: "If you are a minor, come with an adult.",
  },
  fr: {
    concerns: "Vos questions et, si vous en avez, vos examens complémentaires.",
    clothing: "Tenue :",
    men: "Sous-vêtements ou short pour les hommes.",
    women:
      "Sous-vêtements, maillot de bain deux pièces ou legging court pour les femmes.",
    minor: "Si vous êtes mineur·e, venez accompagné·e d'un adulte.",
  },
  pt: {
    concerns: "Suas dúvidas e exames complementares, se tiver.",
    clothing: "Roupa:",
    men: "Roupa íntima ou shorts para homens.",
    women: "Roupa íntima, biquíni ou legging curto para mulheres.",
    minor: "Se for menor de idade, venha acompanhado de um adulto.",
  },
};

const EXAMPLE_LEAD = {
  es: "Aquí hay algunos ejemplos.",
  en: "Here you have some examples.",
  fr: "Voici quelques exemples.",
  pt: "Veja alguns exemplos.",
};

const EXAMPLE_GROUPS = [
  {
    title: {
      es: "Dolores",
      en: "Pain",
      fr: "Douleur",
      pt: "Dor",
    },
    stems: [
      "cefalea",
      "dorsalgia",
      "lumbalgia",
      "ciatalgia",
      "cervicobraquialgia",
      "pubalgia",
      "gonalgia",
      "talalgia",
      "dolor-sacroiliaco",
      "hernia-disco",
      "protrusion-discal",
    ],
  },
  {
    title: {
      es: "Alteraciones posturales",
      en: "Postural issues",
      fr: "Problèmes posturaux",
      pt: "Problemas posturais",
    },
    stems: [
      "hipercifosis",
      "hiperlordosis",
      "dorso-plano",
      "genu-valgo",
      "genu-varo",
      "pies-planos",
      "escoliosis",
    ],
  },
  {
    title: {
      es: "Lesiones deportivas",
      en: "Sports injuries",
      fr: "Blessures sportives",
      pt: "Lesões esportivas",
    },
    stems: [
      "epicondilitis-lateral",
      "epicondilitis-medial",
      "talalgia",
      "impingement-subacromial",
      "manguito-rotador",
      "pubalgia",
      "radiculopatia",
      "meniscopatia",
      "fascitis-plantar",
    ],
  },
];

/** Colloquial labels used in the home accordion (fallback: pathology breadcrumb). */
const FAQ_LINK_LABELS = {
  "epicondilitis-lateral": {
    es: "Codo de tenista",
    en: "Tennis elbow",
    fr: "Épicondylite latérale",
    pt: "Epicondilite lateral",
  },
  "epicondilitis-medial": {
    es: "Codo de golfista",
    en: "Golfer’s elbow",
    fr: "Épicondylite médiale",
    pt: "Epicondilite medial",
  },
  "pies-planos": {
    es: "Pies cavos o planos",
    en: "High or flat arches (cavus/planus feet)",
    fr: "Pieds creux ou plats",
    pt: "Pés cavos ou planos",
  },
  meniscopatia: {
    es: "Meniscopatías no quirúrgicas",
    en: "Non-surgical meniscus injuries",
    fr: "Lésions méniscales non chirurgicales",
    pt: "Meniscopatias não cirúrgicas",
  },
};

function faqLinkLabel(stem, lang) {
  const override = FAQ_LINK_LABELS[stem]?.[lang];
  if (override) return override;
  const pathology = pathologyForStem(stem);
  return pathology?.[lang]?.breadcrumb ?? stem;
}

function clothingHtml(lang) {
  const t = CLOTHING[lang];
  return `<ul>
                      <li>
                        ${escHtml(t.concerns)}
                      </li>
                      <li>
                        ${escHtml(t.clothing)}
                        <ul>
                          <li>${escHtml(t.men)}</li>
                          <li>
                            ${escHtml(t.women)}
                          </li>
                        </ul>
                      </li>
                      <li>${escHtml(t.minor)}</li>
                    </ul>`;
}

function examplesHtml(lang) {
  const groups = EXAMPLE_GROUPS.map((group) => {
    const items = group.stems
      .map(
        (stem) =>
          `<li><a href="${stem}.html">${escHtml(faqLinkLabel(stem, lang))}</a></li>`,
      )
      .join("\n                      ");
    return `<div class="faq-example-group">
                    <strong>${escHtml(group.title[lang])}:</strong>
                    <ul>
                      ${items}
                    </ul>
                    </div>`;
  }).join("\n                    ");
  return `<p class="faq-examples-lead">${escHtml(FAQS[5].a[lang])}
                    ${escHtml(EXAMPLE_LEAD[lang])}</p>
                    ${groups}`;
}

export const FAQS = [
  {
    q: {
      es: "¿Cuál es la duración del tratamiento?",
      en: "What is the duration of the treatment?",
      fr: "Quelle est la durée du traitement ?",
      pt: "Qual é a duração do tratamento?",
    },
    a: {
      es: "Dependerá del objetivo, la situación del paciente y la evolución del tratamiento.",
      en: "It depends on the objective, the patient's condition, and the evolution of the treatment.",
      fr: "Cela dépend de l'objectif, de l'état du patient et de l'évolution du traitement.",
      pt: "Depende do objetivo, da condição do paciente e da evolução do tratamento.",
    },
  },
  {
    q: {
      es: "¿Cuánto dura la sesión?",
      en: "How long does a session last?",
      fr: "Combien de temps dure une séance ?",
      pt: "Quanto tempo dura cada sessão?",
    },
    a: {
      es: "El tiempo de duración de una sesión es variable según el caso y la metodología que se necesite. Tomamos como un tiempo estándar 1 hora por sesión.",
      en: "The duration of a session varies depending on the case and the methodology required. As a standard time, we consider 1 hour per session.",
      fr: "La durée varie selon le cas et la méthode utilisée. En règle générale, nous prévoyons environ une heure par séance.",
      pt: "A duração varia conforme o caso e a metodologia. Como referência, reservamos cerca de 1 hora por sessão.",
    },
  },
  {
    q: {
      es: "¿Frecuencia de las sesiones?",
      en: "How often are sessions scheduled?",
      fr: "À quelle fréquence ont lieu les séances ?",
      pt: "Com que frequência são as sessões?",
    },
    a: {
      es: "Varía según los casos y los métodos a emplear. En algunas modalidades las sesiones son semanales y en otras pueden espaciarse cada 2 o 3 semanas.",
      en: "It varies by case and methods. Some modalities are weekly; others may be spaced every 2 or 3 weeks.",
      fr: "Cela varie selon le cas et les méthodes. Certaines modalités sont hebdomadaires ; d'autres, espacées de 2 ou 3 semaines.",
      pt: "Varia conforme o caso e os métodos. Algumas modalidades são semanais; outras, a cada 2 ou 3 semanas.",
    },
  },
  {
    q: {
      es: "¿Qué necesito llevar a la primera sesión?",
      en: "What should I bring to the first session?",
      fr: "Que dois-je apporter à la première séance ?",
      pt: "O que devo levar na primeira sessão?",
    },
    a: {
      es: "Tus inquietudes y estudios complementarios si los tuvieses; ropa cómoda. Si sos menor, vení acompañado/a por un mayor.",
      en: "Your questions and any complementary studies; comfortable clothing. Minors should come with an adult.",
      fr: "Vos questions et examens complémentaires si vous en avez ; tenue confortable. Les mineurs doivent être accompagnés d'un adulte.",
      pt: "Suas dúvidas e exames complementares, se tiver; roupa confortável. Menores devem vir acompanhados de um adulto.",
    },
    html: clothingHtml,
  },
  {
    q: {
      es: "¿Atienden a través de Prepagas u Obras Sociales?",
      en: "Do you accept prepaid health plans or insurance?",
      fr: "Acceptez-vous les mutuelles ou assurances ?",
      pt: "Vocês aceitam planos de saúde ou reembolso?",
    },
    a: {
      es: "Podés solicitar reintegros a tu obra social o prepaga.",
      en: "You can request reimbursements from your health insurance provider.",
      fr: "Vous pouvez demander un remboursement auprès de votre assurance ou mutuelle.",
      pt: "Você pode solicitar reembolso junto ao seu plano ou seguro de saúde.",
    },
  },
  {
    q: {
      es: "¿A quiénes sirven estos tratamientos?",
      en: "Who can benefit from these treatments?",
      fr: "Qui peut bénéficier de ces traitements ?",
      pt: "Quem pode se beneficiar desses tratamentos?",
    },
    a: {
      es: "A personas con dolores, alteraciones de la sensibilidad, mareos, cambios posturales, lesiones traumáticas o deportivas, entre otros.",
      en: "People with pain, sensitivity disorders, dizziness, posture issues, traumatic or sports injuries, among others.",
      fr: "Les personnes souffrant de douleur, troubles de sensibilité, vertiges, troubles posturaux, blessures traumatiques ou sportives, entre autres.",
      pt: "Pessoas com dor, alterações de sensibilidade, tontura, distúrbios posturais, lesões traumáticas ou esportivas, entre outras.",
    },
    html: examplesHtml,
  },
];

/** Concise Q/A for FAQPage JSON-LD. */
export function faqsForSchema(lang) {
  return FAQS.map((item) => ({
    q: item.q[lang],
    a: item.a[lang],
  }));
}

function faqPanel(index, item, lang) {
  const id = `faq${index}`;
  const open = index === 1;
  const collapse = open ? "panel-collapse collapse in" : "panel-collapse collapse";
  const body = item.html ? item.html(lang) : escHtml(item.a[lang]);
  return `              <div class="panel panel-default">
                <div class="panel-heading">
                  <h3 class="panel-title">
                    <a data-toggle="collapse" data-parent="#faqAccordion" href="#${id}">
                      ${escHtml(item.q[lang])}
                    </a>
                  </h3>
                </div>
                <div id="${id}" class="${collapse}">
                  <div class="panel-body">
                    ${body}
                  </div>
                </div>
              </div>`;
}

/** Full home FAQ <section> (headings + Bootstrap accordion). */
export function renderFaqSection(lang) {
  const ui = FAQ_UI[lang];
  const panels = FAQS.map((item, i) => faqPanel(i + 1, item, lang)).join("\n");
  return `    <section class="space-medium section-intro section-intro--compact">
      <div class="container">
        <div class="row">
          <div class="col-md-offset-2 col-md-8">
            <div class="section-title mb60 text-center">
              <p class="section-eyebrow">${escHtml(ui.eyebrow)}</p>
              <h2 class="heading-line-center">${escHtml(ui.heading)}</h2>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-md-offset-2 col-md-8">
            <div class="panel-group" id="faqAccordion">
${panels}
            </div>
          </div>
        </div>
      </div>
    </section>`;
}
