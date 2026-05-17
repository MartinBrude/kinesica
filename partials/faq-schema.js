(function () {
  if (!document.getElementById("faqAccordion")) {
    return;
  }

  var lang = document.documentElement.getAttribute("lang") || "es";
  var faqsByLang = {
    es: [
      {
        q: "¿Cuál es la duración del tratamiento?",
        a: "Dependerá del objetivo, la situación del paciente y la evolución del tratamiento.",
      },
      {
        q: "¿Cuánto dura la sesión?",
        a: "El tiempo de duración de una sesión es variable según el caso y la metodología que se necesite. Tomamos como un tiempo estándar 1 hora por sesión.",
      },
      {
        q: "¿Frecuencia de las sesiones?",
        a: "Varía según los casos y los métodos a emplear. En algunas modalidades las sesiones son semanales y en otras pueden espaciarse cada 2 o 3 semanas.",
      },
      {
        q: "¿Qué necesito llevar a la primera sesión?",
        a: "Tus inquietudes y estudios complementarios si los tuvieses; ropa cómoda (ropa interior o pantalón corto para varones; ropa interior, malla de dos piezas o calza corta para mujeres). Si sos menor, vení acompañado/a por un mayor.",
      },
      {
        q: "¿Atienden a través de Prepagas u Obras Sociales?",
        a: "Podés solicitar reintegros a tu obra social o prepaga.",
      },
      {
        q: "¿A quiénes sirven estos tratamientos?",
        a: "A personas con dolores, alteraciones de la sensibilidad, mareos, cambios posturales, lesiones traumáticas o deportivas, entre otros.",
      },
    ],
    en: [
      {
        q: "What is the duration of the treatment?",
        a: "It depends on the objective, the patient's condition, and the evolution of the treatment.",
      },
      {
        q: "How long does a session last?",
        a: "The duration of a session varies depending on the case and the methodology required. As a standard time, we consider 1 hour per session.",
      },
      {
        q: "How often are sessions scheduled?",
        a: "It varies by case and methods. Some modalities are weekly; others may be spaced every 2 or 3 weeks.",
      },
      {
        q: "What should I bring to the first session?",
        a: "Your questions and any complementary studies; comfortable clothing (underwear or shorts for men; underwear, two-piece swimsuit, or short leggings for women). Minors should come with an adult.",
      },
      {
        q: "Do you accept prepaid health plans or insurance?",
        a: "You can request reimbursements from your health insurance provider.",
      },
      {
        q: "Who can benefit from these treatments?",
        a: "People with pain, sensitivity disorders, dizziness, posture issues, traumatic or sports injuries, among others.",
      },
    ],
    fr: [
      {
        q: "Quelle est la durée du traitement ?",
        a: "Cela dépend de l'objectif, de l'état du patient et de l'évolution du traitement.",
      },
      {
        q: "Combien de temps dure une séance ?",
        a: "La durée varie selon le cas et la méthode utilisée. En règle générale, nous prévoyons environ une heure par séance.",
      },
      {
        q: "À quelle fréquence ont lieu les séances ?",
        a: "Cela varie selon le cas et les méthodes. Certaines modalités sont hebdomadaires ; d'autres, espacées de 2 ou 3 semaines.",
      },
      {
        q: "Que dois-je apporter à la première séance ?",
        a: "Vos questions et examens complémentaires si vous en avez ; tenue confortable (sous-vêtements ou short pour les hommes ; sous-vêtements, maillot deux pièces ou legging court pour les femmes). Les mineurs doivent être accompagnés d'un adulte.",
      },
      {
        q: "Acceptez-vous les mutuelles ou assurances ?",
        a: "Vous pouvez demander un remboursement auprès de votre assurance ou mutuelle.",
      },
      {
        q: "Qui peut bénéficier de ces traitements ?",
        a: "Les personnes souffrant de douleur, troubles de sensibilité, vertiges, troubles posturaux, blessures traumatiques ou sportives, entre autres.",
      },
    ],
  };

  var faqs = faqsByLang[lang] || faqsByLang.es;
  var schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(function (item) {
      return {
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      };
    }),
  };

  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
