/**
 * Home FAQ copy: accordion HTML + FAQPage JSON-LD (ES / EN / FR / PT).
 * Schema answers stay concise; accordion FAQ 4, mi-turno and examples keep richer HTML.
 */
import { escHtml } from "./html-utils.mjs";
import { absoluteUrl } from "./i18n-urls.mjs";
import { pathologyForStem } from "./pathology-content.mjs";
import { waMeUrl } from "./site-contact.mjs";
import {
  formatFeeAmount,
  formatPaymentMethods,
  getSiteFees,
} from "./site-fees.mjs";

const SITE_FEES = getSiteFees();

/** @param {"es"|"en"|"fr"|"pt"} lang */
function honorariosAnswer(lang) {
  const atm = formatFeeAmount(SITE_FEES.atm, lang);
  const general = formatFeeAmount(SITE_FEES.general, lang);
  const pay = formatPaymentMethods(SITE_FEES.payment_methods, lang);
  return {
    es: `La sesión es individual y dura 60 minutos. ATM (bruxismo / dolor mandibular): ${atm}. Resto de las consultas (kinesiología, osteopatía, RPG, etc.): ${general}. Se abona en ${pay}.`,
    en: `Sessions are one-on-one and last 60 minutes. TMJ / ATM (bruxism / jaw pain): ${atm}. All other consultations (physiotherapy, osteopathy, RPG, etc.): ${general}. Payment in ${pay}.`,
    fr: `La séance est individuelle et dure 60 minutes. ATM (bruxisme / douleur mandibulaire) : ${atm}. Autres consultations (kinésithérapie, ostéopathie, RPG, etc.) : ${general}. Paiement en ${pay}.`,
    pt: `A sessão é individual e dura 60 minutos. ATM (bruxismo / dor mandibular): ${atm}. Demais consultas (cinesiologia, osteopatia, RPG, etc.): ${general}. Pagamento em ${pay}.`,
  }[lang];
}

/** @param {"es"|"en"|"fr"|"pt"} lang */
function obrasSocialesAnswer(lang) {
  return {
    es: "No atendemos por cartilla de prepagas ni obras sociales: la atención es particular. Al finalizar la sesión entregamos factura oficial para que gestiones el reintegro en tu prepaga u obra social, según tu plan.",
    en: "We do not work in-network with health plans or insurance: care is private (out-of-pocket). After the session we issue an official invoice so you can request reimbursement from your plan or insurer, according to your coverage.",
    fr: "Nous ne travaillons pas en tiers payant avec mutuelles ou assurances : la consultation est en privé. À la fin de la séance, nous délivrons une facture officielle pour demander le remboursement auprès de votre mutuelle ou assurance, selon votre contrat.",
    pt: "Não atendemos por convênio/cartilha de planos ou obras sociais: o atendimento é particular. Ao final da sessão emitimos nota/fatura oficial para você solicitar o reembolso no seu plano ou obra social, conforme sua cobertura.",
  }[lang];
}

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

const MI_TURNO_LINK = {
  es: "Consultar o cancelar mi turno (web)",
  en: "Check or cancel my appointment (web)",
  fr: "Consulter ou annuler mon rendez-vous (web)",
  pt: "Consultar ou cancelar meu horário (web)",
};

const MI_TURNO_WA_LINK = {
  es: "Consultar por WhatsApp",
  en: "Check via WhatsApp",
  fr: "Consulter sur WhatsApp",
  pt: "Consultar pelo WhatsApp",
};

const MI_TURNO_WA_MSG = {
  es: "Hola, quiero consultar mis turnos",
  en: "Hi, I'd like to check my appointments",
  fr: "Bonjour, je voudrais consulter mes rendez-vous",
  pt: "Olá, quero consultar meus horários",
};

function miTurnoHtml(lang) {
  const item = FAQS.find((f) => f.html === miTurnoHtml);
  const href = absoluteUrl(lang, "mi-turno");
  const waHref = `${waMeUrl()}?text=${encodeURIComponent(MI_TURNO_WA_MSG[lang] || MI_TURNO_WA_MSG.es)}`;
  return `<p>${escHtml(item.a[lang])}</p>
                    <ul>
                      <li><a href="${escHtml(href)}">${escHtml(MI_TURNO_LINK[lang])}</a></li>
                      <li><a href="${escHtml(waHref)}" target="_blank" rel="noopener">${escHtml(MI_TURNO_WA_LINK[lang])}</a></li>
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
  const examplesFaq = FAQS.find((item) => item.html === examplesHtml);
  return `<p class="faq-examples-lead">${escHtml(examplesFaq.a[lang])}
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
      es: "¿Es importante llegar a horario?",
      en: "Is it important to arrive on time?",
      fr: "Est-il important d'arriver à l'heure ?",
      pt: "É importante chegar no horário?",
    },
    a: {
      es: "Pedimos puntualidad estricta. Como no contamos con secretaria, llegar a horario evita esperas en la entrada y permite que te atiendan sin demoras.",
      en: "We ask for strict punctuality. As we do not have a receptionist, arriving on time avoids waiting at the entrance and lets us see you without delay.",
      fr: "Nous demandons une ponctualité stricte. Sans secrétaire à l'accueil, arriver à l'heure évite d'attendre à l'entrée et permet de vous recevoir sans retard.",
      pt: "Pedimos pontualidade rigorosa. Como não temos secretária, chegar no horário evita esperas na entrada e permite o atendimento sem atrasos.",
    },
  },
  {
    q: {
      es: "¿Atienden a través de Prepagas u Obras Sociales?",
      en: "Do you accept prepaid health plans or insurance?",
      fr: "Acceptez-vous les mutuelles ou assurances ?",
      pt: "Vocês aceitam planos de saúde ou reembolso?",
    },
    a: {
      es: obrasSocialesAnswer("es"),
      en: obrasSocialesAnswer("en"),
      fr: obrasSocialesAnswer("fr"),
      pt: obrasSocialesAnswer("pt"),
    },
  },
  {
    q: {
      es: "¿Cuáles son los honorarios?",
      en: "What are the fees?",
      fr: "Quels sont les honoraires ?",
      pt: "Quais são os honorários?",
    },
    a: {
      es: honorariosAnswer("es"),
      en: honorariosAnswer("en"),
      fr: honorariosAnswer("fr"),
      pt: honorariosAnswer("pt"),
    },
  },
  {
    q: {
      es: "¿Dónde puedo consultar mis turnos?",
      en: "Where can I check my appointments?",
      fr: "Où puis-je consulter mes rendez-vous ?",
      pt: "Onde posso consultar meus horários?",
    },
    a: {
      es: "Podés hacerlo por WhatsApp escribiéndonos, o en la web de autogestión con el apellido, el email de la reserva y el código de gestión del mail de confirmación.",
      en: "You can check via WhatsApp by messaging us, or on the self-service page with the last name, booking email, and management code from the confirmation email.",
      fr: "Vous pouvez le faire sur WhatsApp en nous écrivant, ou sur la page en libre-service avec le nom, l'e-mail de réservation et le code de gestion du mail de confirmation.",
      pt: "Você pode consultar pelo WhatsApp escrevendo para nós, ou na página de autogestão com o sobrenome, o e-mail da reserva e o código de gestão do e-mail de confirmação.",
    },
    html: miTurnoHtml,
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
