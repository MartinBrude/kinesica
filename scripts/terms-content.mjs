/**
 * Multilingual copy for Terms of Service / Conditions of Service pages.
 * Languages: ES / EN / FR / PT.
 *
 * Contact details and site URLs are imported from single-source modules
 * (site-contact.mjs, i18n-urls.mjs) to satisfy DRY audits.
 */
import { CONTACT, FOUNDER, waMeUrl, mailtoUrl } from "./site-contact.mjs";
import { SITE, absoluteUrl, sitePath } from "./i18n-urls.mjs";

export const TERMS = {
  es: {
    title: "Condiciones del Servicio | Kinésica",
    description:
      "Condiciones del servicio de Kinésica. Información sobre el uso del sitio web, pautas de atención kinesiológica presencial, aviso médico y marco legal.",
    breadcrumb: "Condiciones del servicio",
    h1: "Condiciones del Servicio",
    subtitle: "Pautas de uso del sitio web y atención profesional en Kinésica",
    lastUpdated: "Última actualización: Septiembre 2026",
    lead:
      "Bienvenido a Kinésica. Las presentes Condiciones del Servicio regulan el acceso y navegación en nuestro sitio web, así como los términos y pautas generales aplicables a la coordinación de turnos y la atención profesional kinesiológica y osteopática en nuestro consultorio.",
    disclaimer: {
      title: "Aviso importante de salud",
      text:
        "La información publicada en este sitio web tiene carácter divulgativo y educativo sobre métodos kinésicos y dolencias comunes. **En ningún caso reemplaza la consulta clínica presencial, diagnóstico médico o indicación terapéutica personalizada.** Ante dolor agudo o emergencias, consulta inmediatamente a un médico o centro de urgencias.",
    },
    sections: [
      {
        id: "titularidad",
        title: "1. Titularidad y finalidad del sitio web",
        paragraphs: [
          `El presente sitio web es titularidad de **Kinésica**, centro de kinesiología y osteopatía dirigido por el **${FOUNDER.name}** (Kinesiólogo, Fisioterapeuta y Osteópata).`,
          `Ubicación del consultorio: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          "El objetivo del sitio web es brindar información clara y rigurosa sobre los métodos de tratamiento kinésico y osteopático que aplicamos (como RPG, osteopatía, terapia de ATM, neurodinamia, cadenas musculares), así como facilitar un canal directo de contacto y solicitud de turnos.",
        ],
      },
      {
        id: "naturaleza-informativa",
        title: "2. Naturaleza informativa y descargo médico",
        paragraphs: [
          "Todos los artículos, descripciones de patologías y explicaciones sobre técnicas terapéuticas compartidos en el sitio tienen un propósito exclusivamente orientativo.",
          "Cada persona presenta una biomecánica, historia clínica y sintomatología singular. Por ello, la evaluación precisa de cualquier molestia, dolor de columna, disfunción de ATM o alteración postural requiere siempre un examen presencial individual realizado por un profesional de la salud habilitado.",
        ],
      },
      {
        id: "coordinacion-turnos",
        title: "3. Coordinación de turnos y pautas de atención",
        paragraphs: [
          "Para brindar una atención personalizada y de calidad, aplicamos las siguientes pautas de funcionamiento:",
        ],
        bullets: [
          "**Contacto previo:** Antes de la primera sesión realizamos un intercambio o llamada telefónica para conocer el motivo de consulta, responder dudas iniciales y evaluar la indicación del tratamiento.",
          "**Sesiones individuales:** Cada sesión se desarrolla de forma individual y personalizada, con dedicación exclusiva del profesional durante el tiempo asignado.",
          "**Puntualidad:** Agradecemos concurrir en el horario pautado para aprovechar el tiempo completo de tratamiento y respetar los turnos de los demás pacientes.",
          "**Cancelación y reprogramación:** En caso de necesitar modificar o cancelar un turno, solicitamos avisar con al menos 24 horas de antelación para poder disponer del espacio para otra persona que lo necesite.",
        ],
      },
      {
        id: "secreto-profesional",
        title: "4. Marco legal sanitario y secreto profesional",
        paragraphs: [
          "La actividad profesional en Kinésica se rige por las normativas vigentes para el ejercicio de la kinesiología y la fisioterapia en la República Argentina:",
        ],
        bullets: [
          "**Ley 26.529 de Derechos del Paciente:** Garantiza el trato digno, la autonomía de la voluntad, la información sanitaria clara y la confección de historias clínicas con guarda obligatoria.",
          "**Secreto médico y profesional:** Toda información brindada por el paciente durante las consultas y sesiones está amparada por el deber estricto de confidencialidad y secreto profesional.",
          "**Consentimiento informado:** Los procedimientos kinésicos y osteopáticos se explican previamente y se realizan siempre con el consentimiento del paciente.",
        ],
      },
      {
        id: "honorarios",
        title: "5. Honorarios y medios de pago",
        paragraphs: [
          "Los aranceles de las sesiones se comunican con total claridad al momento del contacto inicial o consulta previa.",
          "El pago de las sesiones se realiza en moneda de curso legal (pesos argentinos) conforme a los medios acordados (efectivo, transferencias u otros medios habilitados en el consultorio).",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "6. Propiedad intelectual",
        paragraphs: [
          "Todos los contenidos de este sitio web —incluyendo textos originales, estructura editorial, artículos de patologías, imágenes, isotipo y diseño general— son propiedad de Kinésica o cuentan con licencias de uso legítimas.",
          "Queda prohibida su copia, distribución, reproducción total o parcial o explotación comercial no autorizada sin el consentimiento expreso y por escrito del titular.",
        ],
      },
      {
        id: "privacidad-datos",
        title: "7. Privacidad y eliminación de datos",
        paragraphs: [
          `El tratamiento de datos personales y la privacidad de nuestros pacientes se encuentra detallado en nuestra **[Política de Privacidad](${sitePath("es", "privacidad")})**.`,
          "Recordamos que cualquier persona tiene derecho a solicitar de forma gratuita e inmediata la eliminación de cualquier dato personal referido a ella, a través de nuestro formulario interactivo o mediante comunicación directa.",
        ],
      },
      {
        id: "modificaciones",
        title: "8. Modificaciones de las condiciones",
        paragraphs: [
          "Kinésica se reserva el derecho de actualizar o modificar estas Condiciones del Servicio cuando resulte necesario para reflejar cambios normativos, técnicos u operativos del consultorio. Las modificaciones entrarán en vigencia desde su publicación en este sitio web.",
        ],
      },
      {
        id: "jurisdiccion",
        title: "9. Ley aplicable y jurisdicción",
        paragraphs: [
          "Las presentes condiciones se interpretan y rigen conforme a las leyes de la República Argentina.",
          "Para cualquier controversia que pudiera derivarse del uso de este sitio web o de la relación informativa, las partes acuerdan someterse a la jurisdicción de los Tribunales Ordinarios de la Ciudad Autónoma de Buenos Aires (CABA), renunciando a cualquier otro fuero que pudiera corresponder.",
        ],
      },
    ],
  },

  en: {
    title: "Terms of Service | Kinésica",
    description:
      "Kinésica's terms of service. Details on website use, clinic guidelines, healthcare disclaimer, and professional physical therapy standards.",
    breadcrumb: "Terms of Service",
    h1: "Terms of Service",
    subtitle: "Website terms of use and professional care standards at Kinésica",
    lastUpdated: "Last updated: September 2026",
    lead:
      "Welcome to Kinésica. These Terms of Service govern access to and browsing on our website, as well as general standards applicable to appointment coordination and physical therapy and osteopathic care at our clinic.",
    disclaimer: {
      title: "Important health disclaimer",
      text:
        "The information published on this website is for educational and general informational purposes regarding physical therapy methods and common conditions. **It does not substitute an in-person clinical consultation, medical diagnosis, or personalized therapeutic plan.** In case of acute pain or medical emergencies, consult a physician or emergency center immediately.",
    },
    sections: [
      {
        id: "titularidad",
        title: "1. Ownership and Purpose of the Website",
        paragraphs: [
          `This website is operated by **Kinésica**, a physical therapy and osteopathy clinic founded and directed by **${FOUNDER.name}** (Licensed Physical Therapist and Osteopath).`,
          `Clinic location: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          "The purpose of this website is to provide clear, reliable information regarding the therapeutic methods we apply (including RPG, osteopathy, TMJ therapy, neurodynamics, and muscle chains), as well as to offer a direct communication channel for booking appointments.",
        ],
      },
      {
        id: "naturaleza-informativa",
        title: "2. Informational Nature and Medical Disclaimer",
        paragraphs: [
          "All articles, condition overviews, and method descriptions provided on this website are intended solely for educational guidance.",
          "Every individual has a unique biomechanical profile, medical history, and clinical presentation. Therefore, thorough evaluation of spinal pain, TMJ issues, or postural conditions requires an individual in-person assessment by a licensed healthcare professional.",
        ],
      },
      {
        id: "coordinacion-turnos",
        title: "3. Appointment Scheduling and Clinic Guidelines",
        paragraphs: [
          "To provide high-quality, dedicated professional care, we observe the following clinic guidelines:",
        ],
        bullets: [
          "**Initial chat:** Before scheduling the first session, we hold a brief phone conversation or chat to understand your consultation reason, address questions, and verify treatment suitability.",
          "**One-on-one sessions:** Each session is conducted individually with dedicated therapist attention throughout the reserved time slot.",
          "**Punctuality:** We kindly request arriving on time to maximize your therapeutic time and respect subsequent patient appointments.",
          "**Rescheduling and cancellations:** If you need to alter or cancel an appointment, please notify us at least 24 hours in advance so the time slot may be offered to someone in need.",
        ],
      },
      {
        id: "secreto-profesional",
        title: "4. Healthcare Standards and Medical Confidentiality",
        paragraphs: [
          "Professional activities at Kinésica comply with healthcare laws governing physical therapy and osteopathy in the Argentine Republic:",
        ],
        bullets: [
          "**Patient Rights (Law 26,529):** Safeguarding dignity, patient autonomy, clear health information, and required clinical recordkeeping.",
          "**Medical confidentiality:** All details shared during consultations and therapy sessions are protected by medical professional secrecy.",
          "**Informed consent:** Therapeutic methods are explained beforehand and practiced with the patient's full understanding and consent.",
        ],
      },
      {
        id: "honorarios",
        title: "5. Fees and Payment Methods",
        paragraphs: [
          "Session fees are clearly communicated upon initial inquiry or before appointment confirmation.",
          "Payments are made in legal tender according to agreed payment channels (cash, bank transfers, or accepted electronic payment options).",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "6. Intellectual Property",
        paragraphs: [
          "All website content — including original texts, condition articles, graphics, brand logos, and structural layout — is the property of Kinésica or used under appropriate authorization.",
          "Unauthorized commercial reproduction, distribution, or copying in whole or in part without prior written permission is prohibited.",
        ],
      },
      {
        id: "privacidad-datos",
        title: "7. Privacy and Personal Data Deletion",
        paragraphs: [
          `Personal data handling and privacy commitments are detailed in our **[Privacy Policy](${sitePath("en", "privacidad")})**.`,
          "Any individual has the right to request the prompt, free-of-charge deletion of any personal data relating to them via our interactive deletion form or direct communication.",
        ],
      },
      {
        id: "modificaciones",
        title: "8. Amendments to Terms",
        paragraphs: [
          "Kinésica reserves the right to modify these Terms of Service to reflect statutory, technical, or clinic operational updates. Updated terms become effective upon publication on this website.",
        ],
      },
      {
        id: "jurisdiccion",
        title: "9. Governing Law and Jurisdiction",
        paragraphs: [
          "These terms are governed by and construed in accordance with the laws of the Argentine Republic.",
          "Any dispute arising in connection with website use or services shall be subject to the jurisdiction of the ordinary courts of the Autonomous City of Buenos Aires (CABA).",
        ],
      },
    ],
  },

  fr: {
    title: "Conditions générales de service | Kinésica",
    description:
      "Conditions de service de Kinésica. Utilisation du site web, modalités des soins kinésithérapeutiques, avertissement médical et cadre légal.",
    breadcrumb: "Conditions de service",
    h1: "Conditions Générales de Service",
    subtitle: "Règles d'utilisation du site et modalités de prise en charge au cabinet",
    lastUpdated: "Dernière mise à jour : Septembre 2026",
    lead:
      "Bienvenue chez Kinésica. Les présentes Conditions de Service définissent les règles d'accès au site web ainsi que les modalités générales régissant la prise de rendez-vous et la prise en charge kinésithérapeutique et ostéopathique au cabinet.",
    disclaimer: {
      title: "Avertissement médical important",
      text:
        "Les contenus publiés sur ce site ont une vocation strictement informative et pédagogique concernant les méthodes thérapeutiques et les pathologies courantes. **Ils ne remplacent en aucun cas une consultation médicale personnalisée, un diagnostic clinique ou une prescription.** En cas de douleur aiguë ou d'urgence, veuillez contacter immédiatement un médecin ou un service d'urgence médicale.",
    },
    sections: [
      {
        id: "titularidad",
        title: "1. Titularité et objet du site web",
        paragraphs: [
          `Ce site web est édité par **Kinésica**, cabinet de kinésithérapie et d'ostéopathie dirigé par **${FOUNDER.name}** (Kinésithérapeute et Ostéopathe diplômé).`,
          `Adresse du cabinet : **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          "Le site a pour but d'informer avec précision sur les thérapies appliquées (telles que la RPG, l'ostéopathie, le traitement de l'ATM, la neurodynamique et les chaînes musculaires) et de faciliter la prise de contact pour convenir de séances.",
        ],
      },
      {
        id: "naturaleza-informativa",
        title: "2. Portée informative et exclusion de responsabilité médicale",
        paragraphs: [
          "Tous les articles et présentations de méthodes thérapeutiques sont fournis à titre de repère informatif.",
          "Chaque patient possède des particularités biomécaniques et des antécédents spécifiques. L'examen des douleurs cervicales, lombaires ou des dysfonctionnements de la mâchoire requiert impérativement un bilan individuel en cabinet par un professionnel de santé qualifié.",
        ],
      },
      {
        id: "coordinacion-turnos",
        title: "3. Prise de rendez-vous et organisation des soins",
        paragraphs: [
          "Afin d'assurer un suivi attentif et individualisé, nous appliquons les principes suivants :",
        ],
        bullets: [
          "**Échange préalable :** Avant toute première consultation, nous effectuons un échange pour cerner le motif de consultation et confirmer la pertinence du traitement.",
          "**Séances individuelles :** Chaque séance est effectuée en prise en charge individuelle avec l'attention continue du praticien.",
          "**Ponctualité :** Nous vous invitons à respecter les horaires convenus afin de profiter de l'intégralité du temps de soin.",
          "**Annulation et modification :** En cas d'empêchement, merci de nous prévenir au moins 24 heures à l'avance pour permettre à un autre patient de bénéficier du créneau.",
        ],
      },
      {
        id: "secreto-profesional",
        title: "4. Secret professionnel et réglementation sanitaire",
        paragraphs: [
          "L'exercice professionnel au cabinet Kinésica s'inscrit dans le cadre légal et déontologique de la santé en République argentine :",
        ],
        bullets: [
          "**Droits des patients (Loi 26.529) :** Respect de la dignité, de l'autonomie et de la bonne tenue des dossiers médicaux.",
          "**Secret professionnel médical :** Toutes les informations partagées lors des séances sont protégées par le secret professionnel le plus strict.",
          "**Consentement éclairé :** Les manœuvres thérapeutiques sont systématiquement expliquées et réalisées avec l'accord du patient.",
        ],
      },
      {
        id: "honorarios",
        title: "5. Honoraires et modalités de règlement",
        paragraphs: [
          "Le tarif des séances est précisé en toute transparence dès le premier contact.",
          "Le règlement s'effectue en monnaie légale selon les modalités convenues lors de la prise de rendez-vous.",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "6. Propriété intellectuelle",
        paragraphs: [
          "L'ensemble des contenus de ce site (textes, explications de pathologies, photographies, éléments visuels et logo) est la propriété exclusive de Kinésica ou fait l'objet d'autorisations d'utilisation.",
          "Toute reproduction commerciale non autorisée est expressément interdite.",
        ],
      },
      {
        id: "privacidad-datos",
        title: "7. Protection des données personnelles",
        paragraphs: [
          `Les modalités de traitement des données personnelles sont consultables dans notre **[Politique de confidentialité](${sitePath("fr", "privacidad")})**.`,
          "Chaque personne peut demander sans frais la suppression définitive de toute information la concernant.",
        ],
      },
      {
        id: "modificaciones",
        title: "8. Modifications des conditions",
        paragraphs: [
          "Kinésica se réserve la possibilité d'adapter ces conditions pour tenir compte de l'évolution des réglementations ou des pratiques du cabinet.",
        ],
      },
      {
        id: "jurisdiccion",
        title: "9. Droit applicable et juridiction",
        paragraphs: [
          "Les présentes conditions sont soumises aux lois de la République argentine. Tout litige relatif à leur application relève de la compétence des juridictions de la Ville Autonome de Buenos Aires (CABA).",
        ],
      },
    ],
  },

  pt: {
    title: "Condições do Serviço | Kinésica",
    description:
      "Condições do serviço da Kinésica. Regras de uso do site, diretrizes de atendimento fisioterapêutico presencial, aviso médico e marco legal.",
    breadcrumb: "Condições do serviço",
    h1: "Condições do Serviço",
    subtitle: "Diretrizes de uso do site e atendimento profissional na Kinésica",
    lastUpdated: "Última atualização: Setembro de 2026",
    lead:
      "Bem-vindo à Kinésica. Estas Condições do Serviço definem as regras de acesso e navegação em nosso site, bem como as diretrizes gerais para agendamento de consultas e atendimento fisioterapêutico e osteopático em nosso consultório.",
    disclaimer: {
      title: "Aviso importante de saúde",
      text:
        "As informações disponibilizadas neste site têm caráter exclusivamente informativo sobre métodos fisioterapêuticos e queixas frequentes. **Elas não substituem a consulta clínica presencial, diagnóstico médico ou orientação terapêutica individualizada.** Em situações de dor intensa ou emergência, procure assistência médica imediata.",
    },
    sections: [
      {
        id: "titularidad",
        title: "1. Titularidade e objetivo do site",
        paragraphs: [
          `Este site pertence à **Kinésica**, consultório de fisioterapia e osteopatia sob responsabilidade de **${FOUNDER.name}** (Fisioterapeuta e Osteopata).`,
          `Localização do consultório: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          "O objetivo deste espaço é apresentar informações claras sobre abordagens terapêuticas (como RPG, osteopatia, tratamento de ATM, neurodinâmica e cadeias musculares), além de disponibilizar um canal direto para tirar dúvidas e agendar sessões.",
        ],
      },
      {
        id: "naturaleza-informativa",
        title: "2. Caráter informativo e aviso de saúde",
        paragraphs: [
          "Todos os artigos e descrições de técnicas terapêuticas compartilhados no site têm caráter educativo e orientativo.",
          "Cada indivíduo apresenta particularidades anatômicas, histórico clínico e sintomas específicos. Por essa razão, a avaliação precisa de dores articulares, desvios posturais ou alterações de ATM demanda exame presencial detalhado por profissional de saúde qualificado.",
        ],
      },
      {
        id: "coordinacion-turnos",
        title: "3. Agendamento de consultas e diretrizes de atendimento",
        paragraphs: [
          "Para proporcionar atendimento atencioso e de qualidade, seguimos as seguintes diretrizes:",
        ],
        bullets: [
          "**Conversa inicial:** Antes da primeira sessão realizamos uma conversa telefônica ou por mensagem para entender o motivo da consulta e esclarecer dúvidas.",
          "**Atendimento individualizado:** Cada sessão é conduzida de forma exclusiva, com total atenção do profissional ao paciente durante todo o período reservado.",
          "**Pontualidade:** Solicitamos pontualidade para o melhor aproveitamento do tempo de tratamento e respeito aos horários seguintes.",
          "**Remarcações e cancelamentos:** Caso precise alterar ou desmarcar um horário, solicitamos aviso prévio de ao menos 24 horas de antecedência.",
        ],
      },
      {
        id: "secreto-profesional",
        title: "4. Diretrizes sanitárias e sigilo profissional",
        paragraphs: [
          "A atuação clínica na Kinésica cumpre as normas de saúde vigentes na República Argentina:",
        ],
        bullets: [
          "**Direitos do Paciente (Lei 26.529):** Garantia de tratamento digno, autonomia e guarda adequada de prontuários clínicos.",
          "**Sigilo profissional:** Todas as informações clínicas e relatos compartilhados nas sessões são estritamente protegidos por sigilo de saúde.",
          "**Consentimento informado:** As manobras fisioterapêuticas são previamente explicadas e realizadas com a concordância do paciente.",
        ],
      },
      {
        id: "honorarios",
        title: "5. Valores e formas de pagamento",
        paragraphs: [
          "Os valores das sessões são informados de forma transparente no contato inicial antes da confirmação do agendamento.",
          "O pagamento é realizado em moeda corrente de acordo com os meios disponibilizados no consultório.",
        ],
      },
      {
        id: "propiedad-intelectual",
        title: "6. Propriedade intelectual",
        paragraphs: [
          "Todos os textos originais, descrições clínicas, identidade visual e logotipos deste site são protegidos por direitos autorais de titularidade da Kinésica.",
          "É vedada qualquer reprodução comercial sem autorização prévia por escrito.",
        ],
      },
      {
        id: "privacidad-datos",
        title: "7. Proteção de dados e privacidade",
        paragraphs: [
          `As regras completas sobre privacidade estão descritas em nossa **[Política de Privacidade](${sitePath("pt", "privacidad")})**.`,
          "Qualquer pessoa pode solicitar a eliminação gratuita de qualquer dado pessoal de forma rápida por nossos canais de atendimento.",
        ],
      },
      {
        id: "modificaciones",
        title: "8. Atualizações destas condições",
        paragraphs: [
          "A Kinésica reserva-se o direito de atualizar estas condições para refletir mudanças regulamentares ou operacionais do consultório.",
        ],
      },
      {
        id: "jurisdiccion",
        title: "9. Legislação aplicável e foro",
        paragraphs: [
          "Estas condições são regidas pelas leis da República Argentina. Fica eleito o foro da Cidade Autônoma de Buenos Aires (CABA) para dirimir eventuais controvérsias decorrentes deste site.",
        ],
      },
    ],
  },
};
