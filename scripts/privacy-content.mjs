/**
 * Multilingual copy for Privacy Policy and Personal Data Deletion pages.
 * Languages: ES / EN / FR / PT.
 *
 * Contact details and site URLs are imported from single-source modules
 * (site-contact.mjs, i18n-urls.mjs) to satisfy DRY audits.
 */
import { CONTACT, FOUNDER, waMeUrl, mailtoUrl } from "./site-contact.mjs";
import { SITE, absoluteUrl } from "./i18n-urls.mjs";

export const PRIVACY = {
  es: {
    title: "Política de Privacidad y Eliminación de Datos | Kinésica",
    description:
      "Política de privacidad de Kinésica. Información sobre el tratamiento de datos personales (Ley 25.326, RGPD, LGPD) y procedimiento para solicitar la eliminación de datos.",
    breadcrumb: "Política de privacidad",
    h1: "Política de Privacidad y Protección de Datos",
    subtitle: "Compromiso con la privacidad, el secreto médico y la transparencia",
    lastUpdated: "Última actualización: Septiembre 2026",
    lead:
      "En Kinésica valoramos la confianza de nuestros pacientes y visitantes. Esta política explica de forma clara cómo recopilamos, utilizamos y resguardamos la información personal, así como el procedimiento inmediato y gratuito para que cualquier persona pueda solicitar la eliminación definitiva de cualquier dato personal referido a ella.",
    sections: [
      {
        id: "responsable",
        title: "1. Responsable del tratamiento de datos",
        paragraphs: [
          `El responsable del tratamiento de los datos personales recopilados a través de este sitio web es **Kinésica**, centro de kinesiología y osteopatía, a cargo del profesional **${FOUNDER.name}** (Kinesiólogo, Fisioterapeuta y Osteópata).`,
          `Domicilio del consultorio: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          `Para consultas sobre privacidad o ejercicio de derechos, puedes escribir a **${CONTACT.email}** o utilizar el formulario de solicitud dispuesto a continuación.`,
        ],
      },
      {
        id: "datos-recopilados",
        title: "2. Información que recopilamos y finalidades",
        paragraphs: [
          "Recopilamos únicamente la información necesaria para brindar una atención profesional de calidad y responder a consultas sobre nuestros tratamientos kinesiológicos y osteopáticos:",
        ],
        bullets: [
          "**Datos de contacto y coordinación:** Nombre, apellido, número de teléfono/WhatsApp y correo electrónico facilitados voluntariamente al solicitar un turno o realizar una consulta previa a la sesión.",
          "**Historial de comunicaciones:** Mensajes intercambiados por WhatsApp o correo electrónico para resolver dudas sobre síntomas, disponibilidad horaria o indicaciones terapéuticas.",
          "**Documentación clínica y asistencial:** Motivo de consulta, antecedentes de salud relevantes, estudios médicos aportados por el paciente y registro de evolución de las sesiones terapéuticas, resguardados bajo estricto secreto profesional.",
        ],
        note:
          "Kinésica no comercializa, no vende, no alquila ni cede datos personales a empresas de publicidad ni a ningún tercero con fines comerciales.",
      },
      {
        id: "base-legal",
        title: "3. Marco normativo y base jurídica",
        paragraphs: [
          "El tratamiento de datos personales se fundamenta en las siguientes bases legales y normativas aplicables:",
        ],
        bullets: [
          "**República Argentina:** Ley Nacional Nº 25.326 de Protección de los Datos Personales (Habeas Data) y su Decreto Reglamentario Nº 1558/2001.",
          "**Unión Europea:** Reglamento General de Protección de Datos (RGPD / GDPR - Reglamento UE 2016/679).",
          "**Brasil:** Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).",
          "**Consentimiento libre e informado:** El usuario o paciente presta su consentimiento voluntario al contactarse o solicitar un turno asistencial.",
        ],
      },
      {
        id: "conservacion",
        title: "4. Conservación de datos y secreto profesional",
        paragraphs: [
          "Distinguimos de forma estricta entre dos categorías de información:",
        ],
        bullets: [
          "**Datos de contacto, consultas generales y mensajería:** Se conservan únicamente durante el tiempo indispensable para coordinar la atención o hasta que la persona solicite expresamente su eliminación.",
          "**Documentación clínica y asistencial:** La confección y archivo de historias clínicas de pacientes atendidos se rige por la **Ley Nacional Nº 26.529** de Derechos del Paciente en la República Argentina. Dicha normativa establece un deber legal de guarda y custodia por un plazo de diez (10) años, bajo el más estricto **secreto profesional médico y kinesiológico**. Esta documentación nunca se utiliza para fines no asistenciales.",
        ],
      },
      {
        id: "derechos",
        title: "5. Derechos de los titulares (Acceso, Rectificación y Supresión)",
        paragraphs: [
          "Cualquier persona física tiene derecho a ejercer sus derechos reconocidos por la Ley 25.326, el RGPD y la LGPD:",
        ],
        bullets: [
          "**Derecho de Acceso:** Conocer qué datos personales propios obran en nuestro poder y obtener confirmación sobre su tratamiento.",
          "**Derecho de Rectificación y Actualización:** Solicitar la corrección de datos inexactos, erróneos o desactualizados.",
          "**Derecho de Supresión / Eliminación (\"Derecho al Olvido\"):** Exigir la eliminación definitiva de cualquier información referida a su persona de nuestras bases de contacto, agendas y registros de mensajería.",
          "**Derecho de Oposición y Limitación:** Oponerse al tratamiento o solicitar su limitación.",
          "**Revocación del consentimiento:** Retirar el consentimiento otorgado en cualquier momento, sin efectos retroactivos.",
        ],
      },
      {
        id: "eliminacion",
        title: "6. Solicitud de eliminación de cualquier información de una persona",
        highlight: true,
        paragraphs: [
          "**Cualquier persona puede solicitar la eliminación de toda información referida a ella.**",
          "El trámite es **totalmente gratuito**, no requiere intermediarios ni formalismos complejos. Para ejercer este derecho de supresión, ponemos a tu disposición el siguiente formulario interactivo que genera de forma automática una solicitud formal por correo electrónico o WhatsApp, o puedes contactarnos directamente.",
        ],
      },
      {
        id: "seguridad",
        title: "7. Seguridad y confidencialidad",
        paragraphs: [
          "Implementamos medidas de seguridad técnicas, físicas y organizativas adecuadas para proteger los datos personales contra accesos no autorizados, pérdida accidental, alteración o divulgación indebida. Todos los miembros del equipo que intervienen en la atención están sujetos al deber de confidencialidad y secreto profesional.",
        ],
      },
      {
        id: "autoridad",
        title: "8. Autoridad de control",
        paragraphs: [
          `En la República Argentina, el órgano de control de la Ley Nº 25.326 es la **Agencia de Acceso a la Información Pública (AAIP)**. Los titulares de datos tienen la atribución de ejercer el derecho de acceso en forma gratuita a intervalos no inferiores a seis meses, salvo que se acredite un interés legítimo al efecto (artículo 14, inciso 3 de la Ley Nº 25.326).`,
          "Para usuarios residentes en la Unión Europea o Brasil, se reconoce el derecho a presentar una reclamación ante la autoridad de control local competente (CNIL, AEPD, ANPD u organismo homólogo).",
        ],
      },
    ],
    form: {
      title: "Solicitud interactiva de eliminación de datos",
      instructions:
        "Completa los datos a continuación para generar tu solicitud de supresión de datos personales. Puedes enviarla por correo con un clic, por WhatsApp, o copiar el texto para remitirlo como prefieras.",
      nameLabel: "Nombre y apellido completo",
      namePlaceholder: "Ej. Juan Pérez",
      emailLabel: "Correo electrónico asociado",
      emailPlaceholder: "Ej. juanperez@ejemplo.com",
      phoneLabel: "Teléfono / WhatsApp utilizado (opcional)",
      phonePlaceholder: "Ej. +54 9 11 1234-5678",
      scopeLabel: "Alcance de la eliminación",
      scopeOptions: [
        { value: "all", label: "Eliminación total: datos de contacto, consultas e historial de mensajes" },
        { value: "messages", label: "Eliminación de historial de mensajes y consultas enviadas" },
        { value: "consent", label: "Revocación de consentimiento y baja de comunicaciones futuras" },
        { value: "other", label: "Otra solicitud específica (detallar en el campo siguiente)" },
      ],
      detailsLabel: "Detalles adicionales o aclaraciones (opcional)",
      detailsPlaceholder:
        "Indica cualquier dato adicional que nos permita identificar con precisión la información a eliminar...",
      btnEmail: "Enviar solicitud por correo",
      btnWhatsapp: "Enviar solicitud por WhatsApp",
      btnCopy: "Copiar texto de solicitud",
      feedbackCopied: "¡Texto de la solicitud copiado al portapapeles con éxito!",
      feedbackSent: "Se ha abierto tu cliente de mensajería con la solicitud pre-redactada.",
      feedbackError: "Por favor, completa al menos tu nombre y un correo electrónico o teléfono de contacto.",
      legalNotice:
        "Plazo de respuesta: responderemos a tu solicitud en un plazo máximo de 5 días hábiles conforme al Art. 16 de la Ley 25.326 (o hasta 30 días para solicitudes bajo el RGPD/LGPD).",
    },
  },

  en: {
    title: "Privacy Policy & Personal Data Deletion | Kinésica",
    description:
      "Kinésica's privacy policy. Personal data processing details (Ley 25.326, GDPR, LGPD) and interactive procedure to request personal information deletion.",
    breadcrumb: "Privacy Policy",
    h1: "Privacy Policy & Personal Data Protection",
    subtitle: "Commitment to privacy, medical confidentiality, and transparency",
    lastUpdated: "Last updated: September 2026",
    lead:
      "At Kinésica, we hold our patients' and visitors' trust in high regard. This policy clearly explains how we collect, use, and protect personal information, as well as the immediate, free-of-charge procedure for any individual to request the complete deletion of any personal data relating to them.",
    sections: [
      {
        id: "responsable",
        title: "1. Data Controller",
        paragraphs: [
          `The data controller for personal data collected through this website is **Kinésica**, a physical therapy and osteopathy clinic directed by **${FOUNDER.name}** (Licensed Physical Therapist and Osteopath).`,
          `Clinic address: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          `For privacy-related inquiries or requests, you may contact us by email at **${CONTACT.email}** or use the request form below.`,
        ],
      },
      {
        id: "datos-recopilados",
        title: "2. Information We Collect and Purposes",
        paragraphs: [
          "We collect only the information strictly necessary to deliver quality professional care and respond to inquiries regarding our physiotherapy and osteopathic treatments:",
        ],
        bullets: [
          "**Contact and appointment coordination details:** Full name, phone/WhatsApp number, and email address provided voluntarily when scheduling a session or asking questions beforehand.",
          "**Communication history:** Messages sent via WhatsApp or email to clarify symptoms, schedule availability, or therapeutic guidance.",
          "**Clinical and healthcare documentation:** Reason for consultation, relevant health history, medical reports or imaging provided by the patient, and progress notes from therapeutic sessions, protected under professional medical confidentiality.",
        ],
        note:
          "Kinésica never sells, rents, leases, or transfers personal data to marketing companies or third parties for commercial gain.",
      },
      {
        id: "base-legal",
        title: "3. Legal Framework and Lawful Basis",
        paragraphs: [
          "Processing of personal data is carried out pursuant to the following legal frameworks and lawful bases:",
        ],
        bullets: [
          "**Argentine Republic:** National Law No. 25,326 on the Protection of Personal Data (Habeas Data) and Regulatory Decree No. 1558/2001.",
          "**European Union:** General Data Protection Regulation (GDPR - Regulation EU 2016/679).",
          "**Brazil:** General Personal Data Protection Act (LGPD - Law No. 13,709/2018).",
          "**Freely given consent:** Granted voluntarily when getting in touch or scheduling a physical therapy appointment.",
        ],
      },
      {
        id: "conservacion",
        title: "4. Data Retention and Healthcare Professional Secrecy",
        paragraphs: [
          "We draw a clear distinction between two categories of information:",
        ],
        bullets: [
          "**Contact details, general inquiries, and messages:** Stored only for as long as needed to coordinate care, or until the individual explicitly requests erasure.",
          "**Clinical and healthcare documentation:** Medical records of treated patients are governed by Argentine National Law No. 26,529 (Patient Rights). This statute mandates retention for ten (10) years under strict **medical professional secrecy**. Clinical documentation is never used for commercial or non-healthcare purposes.",
        ],
      },
      {
        id: "derechos",
        title: "5. Individual Rights (Access, Rectification, and Erasure)",
        paragraphs: [
          "Under applicable legislation (Law 25,326, GDPR, and LGPD), any person has the right to:",
        ],
        bullets: [
          "**Right of Access:** Obtain confirmation on whether personal data concerning them is held and access such data.",
          "**Right to Rectification:** Request correction of inaccurate, incomplete, or outdated data.",
          "**Right to Erasure / Deletion (\"Right to be Forgotten\"):** Request the permanent deletion of any personal information referring to them from contact databases, appointment logs, and messaging channels.",
          "**Right to Restriction and Objection:** Restrict or object to data processing where applicable.",
          "**Withdrawal of Consent:** Withdraw previously granted consent at any time without retroactive effects.",
        ],
      },
      {
        id: "eliminacion",
        title: "6. Requesting the Erasure of Personal Information",
        highlight: true,
        paragraphs: [
          "**Any individual may request the deletion of all personal information referring to them.**",
          "The process is **completely free of charge**, requires no legal formalities, and is straightforward. You may use our interactive form below to generate a formal request via email or WhatsApp, or reach out to us directly through our official channels.",
        ],
      },
      {
        id: "seguridad",
        title: "7. Security and Confidentiality",
        paragraphs: [
          "We maintain technical, organizational, and physical security measures to protect personal data from unauthorized access, accidental loss, alteration, or disclosure. All clinic personnel are bound by medical confidentiality and professional ethics.",
        ],
      },
      {
        id: "autoridad",
        title: "8. Supervisory Authorities",
        paragraphs: [
          `In Argentina, the enforcement agency for Law No. 25,326 is the **Agencia de Acceso a la Información Pública (AAIP)**. For individuals residing in the European Union or Brazil, complaints may also be lodged with the relevant national supervisory authority (e.g., CNIL, ICO, ANPD).`,
        ],
      },
    ],
    form: {
      title: "Interactive Data Deletion Request Form",
      instructions:
        "Fill out the details below to generate your formal data erasure request. You can send it via email with one click, send it via WhatsApp, or copy the formatted text.",
      nameLabel: "Full Name",
      namePlaceholder: "e.g., John Smith",
      emailLabel: "Associated Email Address",
      emailPlaceholder: "e.g., johnsmith@example.com",
      phoneLabel: "Phone / WhatsApp Number (optional)",
      phonePlaceholder: "e.g., +1 555 123 4567",
      scopeLabel: "Scope of Data Deletion",
      scopeOptions: [
        { value: "all", label: "Complete erasure: all contact info, inquiries, and message history" },
        { value: "messages", label: "Deletion of message exchanges and consultation inquiries" },
        { value: "consent", label: "Revocation of consent and withdrawal from future communications" },
        { value: "other", label: "Other specific request (provide details below)" },
      ],
      detailsLabel: "Additional Details or Clarifications (optional)",
      detailsPlaceholder:
        "Please provide any additional details that will help us locate and delete your records...",
      btnEmail: "Send Request via Email",
      btnWhatsapp: "Send Request via WhatsApp",
      btnCopy: "Copy Request Text",
      feedbackCopied: "Request text copied to clipboard successfully!",
      feedbackSent: "Your messaging application opened with the pre-formatted request.",
      feedbackError: "Please provide at least your full name and an email address or phone number.",
      legalNotice:
        "Response timeframe: we will reply within the legal period of 5 business days under Law 25,326 (or up to 30 calendar days under GDPR/LGPD).",
    },
  },

  fr: {
    title: "Politique de confidentialité et suppression des données | Kinésica",
    description:
      "Politique de confidentialité de Kinésica. Traitement des données personnelles (Loi 25.326, RGPD, LGPD) et procédure pour demander la suppression des données.",
    breadcrumb: "Confidentialité",
    h1: "Politique de confidentialité et protection des données",
    subtitle: "Engagement envers la vie privée, le secret médical et la transparence",
    lastUpdated: "Dernière mise à jour : Septembre 2026",
    lead:
      "Chez Kinésica, nous accordons une importance primordiale à la confiance de nos patients et visiteurs. Cette politique explique de manière claire comment nous collectons, utilisons et protégeons vos informations personnelles, ainsi que la procédure gratuite et immédiate permettant à toute personne de demander la suppression définitive de toute information la concernant.",
    sections: [
      {
        id: "responsable",
        title: "1. Responsable du traitement",
        paragraphs: [
          `Le responsable du traitement des données collectées sur ce site est **Kinésica**, cabinet de kinésithérapie et d'ostéopathie dirigé par **${FOUNDER.name}** (Kinésithérapeute et Ostéopathe).`,
          `Adresse du cabinet : **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          `Pour toute question relative à la vie privée ou à l'exercice de vos droits, vous pouvez nous écrire à **${CONTACT.email}** ou utiliser le formulaire de demande ci-dessous.`,
        ],
      },
      {
        id: "datos-recopilados",
        title: "2. Données collectées et finalités",
        paragraphs: [
          "Nous ne collectons que les données strictement nécessaires au bon déroulement des soins et aux échanges préalables aux consultations :",
        ],
        bullets: [
          "**Coordonnées et prise de rendez-vous :** Nom, prénom, numéro de téléphone/WhatsApp et adresse e-mail transmis volontairement pour convenir d'un rendez-vous ou poser une question.",
          "**Historique des échanges :** Messages transmis par WhatsApp ou e-mail pour clarifier des symptômes, convenir d'horaires ou obtenir des conseils thérapeutiques.",
          "**Dossier clinique et suivi des soins :** Motif de consultation, antécédents médicaux pertinents, examens complémentaires apportés par le patient et notes d'évolution des séances thérapeutiques, protégés par le secret professionnel.",
        ],
        note:
          "Kinésica ne vend, ne loue, ne cède et ne transmet aucune donnée personnelle à des fins commerciales ou publicitaires.",
      },
      {
        id: "base-legal",
        title: "3. Cadre juridique",
        paragraphs: [
          "Le traitement des données personnelles repose sur les bases légales suivantes :",
        ],
        bullets: [
          "**République argentine :** Loi nationale n° 25.326 sur la protection des données personnelles (Habeas Data) et Décret n° 1558/2001.",
          "**Union européenne :** Règlement Général sur la Protection des Données (RGPD - Règlement UE 2016/679).",
          "**Brésil :** Lei Geral de Proteção de Dados (LGPD - Loi n° 13.709/2018).",
          "**Consentement libre et éclairé :** Accord donné lors de la prise de contact ou de la demande de soins.",
        ],
      },
      {
        id: "conservacion",
        title: "4. Conservation des données et secret professionnel",
        paragraphs: [
          "Nous distinguons rigoureusement deux catégories d'informations :",
        ],
        bullets: [
          "**Coordonnées et échanges de correspondance :** Conservées uniquement pendant la durée nécessaire à la gestion de la prise en charge, ou jusqu'à demande d'effacement.",
          "**Dossiers médicaux et cliniques :** Les dossiers des patients sont soumis à la législation sanitaire argentine (Loi n° 26.529 sur les droits des patients), imposant une durée légale de conservation de dix (10) ans sous le couvert du **secret professionnel**. Ces éléments ne sont jamais utilisés à d'autres fins.",
        ],
      },
      {
        id: "derechos",
        title: "5. Vos droits (Accès, Rectification et Effacement)",
        paragraphs: [
          "Conformément à la législation en vigueur, chaque personne dispose des droits suivants :",
        ],
        bullets: [
          "**Droit d'accès :** Savoir si des données vous concernant sont détenues et en obtenir copie.",
          "**Droit de rectification :** Corriger des données inexactes ou incomplètes.",
          "**Droit à l'effacement (\"Droit à l'oubli\") :** Exiger la suppression définitive de toute information vous concernant de nos bases de contact, carnets d'adresses et messageries.",
          "**Droit d'opposition et de limitation :** Vous opposer à un traitement ou en demander la limitation.",
          "**Retrait du consentement :** Retirer à tout moment un consentement préalablement donné.",
        ],
      },
      {
        id: "eliminacion",
        title: "6. Demande de suppression des données personnelles",
        highlight: true,
        paragraphs: [
          "**Toute personne peut demander la suppression de l'ensemble des informations la concernant.**",
          "Cette démarche est **entièrement gratuite** et ne requiert aucun formalisme particulier. Utilisez notre formulaire ci-dessous pour composer votre demande par e-mail ou WhatsApp, ou écrivez-nous directement.",
        ],
      },
      {
        id: "seguridad",
        title: "7. Sécurité et confidentialité",
        paragraphs: [
          "Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données contre tout accès non autorisé, perte ou altération.",
        ],
      },
      {
        id: "autoridad",
        title: "8. Autorités de contrôle",
        paragraphs: [
          `En Argentine, l'autorité de contrôle est l'**Agencia de Acceso a la Información Pública (AAIP)**. Pour les résidents de l'Union européenne, vous pouvez également vous adresser à la CNIL (France) ou à l'autorité compétente de votre pays.`,
        ],
      },
    ],
    form: {
      title: "Formulaire interactif de suppression des données",
      instructions:
        "Renseignez les champs ci-dessous pour préparer votre demande d'effacement. Vous pourrez la transmettre par e-mail en un clic, par WhatsApp, ou copier le texte.",
      nameLabel: "Nom et prénom",
      namePlaceholder: "Ex. Pierre Dupont",
      emailLabel: "Adresse e-mail associée",
      emailPlaceholder: "Ex. pierre.dupont@exemple.fr",
      phoneLabel: "Numéro de téléphone / WhatsApp (optionnel)",
      phonePlaceholder: "Ex. +33 6 12 34 56 78",
      scopeLabel: "Portée de la suppression",
      scopeOptions: [
        { value: "all", label: "Suppression totale : coordonnées, demandes et messages" },
        { value: "messages", label: "Suppression de l'historique des échanges et messages" },
        { value: "consent", label: "Retrait du consentement et désinscription des échanges" },
        { value: "other", label: "Autre demande spécifique (préciser ci-dessous)" },
      ],
      detailsLabel: "Détails complémentaires (optionnel)",
      detailsPlaceholder:
        "Indiquez toute précision utile pour nous aider à identifier vos données...",
      btnEmail: "Envoyer la demande par e-mail",
      btnWhatsapp: "Envoyer la demande par WhatsApp",
      btnCopy: "Copier le texte de la demande",
      feedbackCopied: "Texte de la demande copié dans le presse-papiers !",
      feedbackSent: "Votre messagerie s'est ouverte avec la demande pré-remplie.",
      feedbackError: "Veuillez renseigner au minimum votre nom et un e-mail ou numéro de téléphone.",
      legalNotice:
        "Délai de réponse : nous répondrons sous 5 jours ouvrés selon la Loi 25.326 (ou 30 jours au titre du RGPD).",
    },
  },

  pt: {
    title: "Política de Privacidade e Exclusão de Dados | Kinésica",
    description:
      "Política de privacidade da Kinésica. Tratamento de dados pessoais (Lei 25.326, RGPD, LGPD) e procedimento para solicitar a eliminação de dados.",
    breadcrumb: "Privacidade",
    h1: "Política de Privacidade e Proteção de Dados",
    subtitle: "Compromisso com privacidade, sigilo profissional e transparência",
    lastUpdated: "Última atualização: Setembro de 2026",
    lead:
      "Na Kinésica valorizamos a confiança de nossos pacientes e visitantes. Esta política explica de forma clara como tratamos e protegemos as informações pessoais, bem como o procedimento gratuito e imediato para que qualquer pessoa solicite a eliminação definitiva de qualquer dado pessoal referente a si.",
    sections: [
      {
        id: "responsable",
        title: "1. Controlador dos dados",
        paragraphs: [
          `O responsável pelo tratamento dos dados pessoais coletados por este site é a **Kinésica**, consultório de fisioterapia e osteopatia, sob responsabilidade do profissional **${FOUNDER.name}** (Fisioterapeuta e Osteopata).`,
          `Endereço do consultório: **${CONTACT.address.streetAddress}**, ${CONTACT.address.addressNeighborhood}, ${CONTACT.address.addressLocality}, ${CONTACT.address.addressCountry}.`,
          `Para dúvidas sobre privacidade ou exercício de direitos, entre em contato pelo e-mail **${CONTACT.email}** ou utilize o formulário de solicitação abaixo.`,
        ],
      },
      {
        id: "datos-recopilados",
        title: "2. Dados coletados e finalidades",
        paragraphs: [
          "Coletamos apenas as informações indispensáveis para a assistência fisioterapêutica e o esclarecimento de dúvidas prévias:",
        ],
        bullets: [
          "**Dados de contato e agendamento:** Nome completo, telefone/WhatsApp e endereço eletrônico fornecidos voluntariamente para agendamento de consultas ou esclarecimento de dúvidas.",
          "**Histórico de mensagens:** Troca de mensagens por WhatsApp ou correio eletrônico sobre sintomas, disponibilidade e recomendações terapêuticas.",
          "**Documentação clínica e assistencial:** Motivo da consulta, histórico de saúde relevante, exames complementares trazidos pelo paciente e registro de evolução das sessões terapêuticas, protegidos por rigoroso sigilo profissional.",
        ],
        note:
          "A Kinésica não comercializa, não aluga e não compartilha dados pessoais com terceiros para fins de publicidade.",
      },
      {
        id: "base-legal",
        title: "3. Base jurídica e legislação",
        paragraphs: [
          "O tratamento de dados pessoais fundamenta-se nas seguintes normas legais:",
        ],
        bullets: [
          "**República Argentina:** Lei Nacional nº 25.326 de Proteção de Dados Pessoais (Habeas Data) e Decreto Regulamentar nº 1558/2001.",
          "**Brasil:** Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018).",
          "**União Europeia:** Regulamento Geral sobre a Proteção de Dados (RGPD - Regulamento UE 2016/679).",
          "**Consentimento livre e expresso:** Fornecido voluntariamente ao entrar em contato ou agendar sessões.",
        ],
      },
      {
        id: "conservacion",
        title: "4. Armazenamento de dados e sigilo profissional",
        paragraphs: [
          "Diferenciamos com rigor duas categorias de informação:",
        ],
        bullets: [
          "**Dados de contato e mensagens administrativas:** Mantidos apenas enquanto necessários para o atendimento ou até que o titular solicite sua exclusão definitiva.",
          "**Prontuários clínicos e documentação assistencial:** Os prontuários de pacientes atendidos seguem as exigências da legislação sanitária argentina (Lei nº 26.529 de Direitos do Paciente), exigindo guarda obrigatória por dez (10) anos sob estrito **sigilo profissional**. Esses documentos nunca são utilizados para finalidades comerciais.",
        ],
      },
      {
        id: "derechos",
        title: "5. Direitos dos titulares (Acesso, Retificação e Exclusão)",
        paragraphs: [
          "Nos termos da legislação cabível (Lei 25.326, LGPD e RGPD), qualquer pessoa tem direito a:",
        ],
        bullets: [
          "**Direito de Acesso:** Confirmar a existência de tratamento e consultar os dados arquivados.",
          "**Direito de Retificação:** Corrigir dados incompletos, inexatos ou desatualizados.",
          "**Direito de Eliminação / Exclusão (\"Direito ao Esquecimento\"):** Exigir a exclusão definitiva de qualquer dado pessoal de nossos cadastros de contato e mensagens.",
          "**Direito de Oposição e Limitação:** Opor-se a tratamentos ou solicitar restrição do uso de dados.",
          "**Revogação do consentimento:** Revogar autorizações concedidas anteriormente a qualquer momento.",
        ],
      },
      {
        id: "eliminacion",
        title: "6. Solicitação para exclusão de qualquer informação pessoal",
        highlight: true,
        paragraphs: [
          "**Qualquer pessoa pode solicitar a eliminação de qualquer informação referida a si.**",
          "O procedimento é **completamente gratuito**, sem burocracia ou intermediários. Você pode preencher o formulário abaixo para gerar o pedido formal por correio eletrônico ou WhatsApp, ou falar conosco diretamente pelos canais informados.",
        ],
      },
      {
        id: "seguridad",
        title: "7. Segurança e confidencialidade",
        paragraphs: [
          "Adotamos medidas técnicas e organizacionais adequadas para resguardar a integridade dos dados e impedir acessos não autorizados. Todos os colaboradores seguem o sigilo profissional de saúde.",
        ],
      },
      {
        id: "autoridad",
        title: "8. Autoridades de controle",
        paragraphs: [
          `Na Argentina, a autoridade fiscalizadora é a **Agencia de Acceso a la Información Pública (AAIP)**. No Brasil, o titular pode contatar a **Autoridade Nacional de Proteção de Dados (ANPD)**. Na União Europeia, aplica-se a autoridade de proteção de dados competente.`,
        ],
      },
    ],
    form: {
      title: "Formulário interativo para exclusão de dados",
      instructions:
        "Preencha as informações a seguir para formalizar seu pedido de exclusão de dados pessoais. É possível enviar por e-mail com um clique, enviar pelo WhatsApp ou copiar o texto.",
      nameLabel: "Nome completo",
      namePlaceholder: "Ex. João Silva",
      emailLabel: "E-mail associado",
      emailPlaceholder: "Ex. joaosilva@exemplo.com.br",
      phoneLabel: "Telefone / WhatsApp utilizado (opcional)",
      phonePlaceholder: "Ex. +55 11 98765-4321",
      scopeLabel: "Escopo da exclusão",
      scopeOptions: [
        { value: "all", label: "Eliminação total: dados de contato, mensagens e histórico de consultas" },
        { value: "messages", label: "Exclusão do histórico de mensagens e esclarecimentos enviados" },
        { value: "consent", label: "Revogação do consentimento e cancelamento de futuras mensagens" },
        { value: "other", label: "Outro pedido específico (detalhar no campo abaixo)" },
      ],
      detailsLabel: "Detalhes adicionais ou observações (opcional)",
      detailsPlaceholder:
        "Informe qualquer dado que nos ajude a identificar e excluir seus registros...",
      btnEmail: "Enviar solicitação por e-mail",
      btnWhatsapp: "Enviar solicitação pelo WhatsApp",
      btnCopy: "Copiar texto da solicitação",
      feedbackCopied: "Texto da solicitação copiado com sucesso!",
      feedbackSent: "O aplicativo de mensagens foi aberto com o pedido preenchido.",
      feedbackError: "Por favor, informe ao menos seu nome e um e-mail ou telefone para contato.",
      legalNotice:
        "Prazo de resposta: responderemos no prazo legal de 5 dias úteis pela Lei 25.326 (ou até 30 dias sob a LGPD/RGPD).",
    },
  },
};
