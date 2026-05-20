/**
 * AUTO-GENERATED — no editar. Fuente: scripts/schema-local-business.mjs
 */
(function () {
  if (!document.getElementById("faqAccordion")) return;
  var htmlLang = document.documentElement.getAttribute("lang") || "es";
  var lang = htmlLang === "en" ? "en" : htmlLang === "fr" ? "fr" : "es";
  var schemas = {
  "es": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://www.kinesica.com.ar/#faq",
    "inLanguage": "es",
    "mainEntityOfPage": "https://www.kinesica.com.ar/",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "¿Cuál es la duración del tratamiento?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Dependerá del objetivo, la situación del paciente y la evolución del tratamiento."
        }
      },
      {
        "@type": "Question",
        "name": "¿Cuánto dura la sesión?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "El tiempo de duración de una sesión es variable según el caso y la metodología que se necesite. Tomamos como un tiempo estándar 1 hora por sesión."
        }
      },
      {
        "@type": "Question",
        "name": "¿Frecuencia de las sesiones?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Varía según los casos y los métodos a emplear. En algunas modalidades las sesiones son semanales y en otras pueden espaciarse cada 2 o 3 semanas."
        }
      },
      {
        "@type": "Question",
        "name": "¿Qué necesito llevar a la primera sesión?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Tus inquietudes y estudios complementarios si los tuvieses; ropa cómoda. Si sos menor, vení acompañado/a por un mayor."
        }
      },
      {
        "@type": "Question",
        "name": "¿Atienden a través de Prepagas u Obras Sociales?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Podés solicitar reintegros a tu obra social o prepaga."
        }
      },
      {
        "@type": "Question",
        "name": "¿A quiénes sirven estos tratamientos?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "A personas con dolores, alteraciones de la sensibilidad, mareos, cambios posturales, lesiones traumáticas o deportivas, entre otros."
        }
      }
    ]
  },
  "en": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://www.kinesica.com.ar/en/#faq",
    "inLanguage": "en",
    "mainEntityOfPage": "https://www.kinesica.com.ar/en/",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "What is the duration of the treatment?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It depends on the objective, the patient's condition, and the evolution of the treatment."
        }
      },
      {
        "@type": "Question",
        "name": "How long does a session last?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The duration of a session varies depending on the case and the methodology required. As a standard time, we consider 1 hour per session."
        }
      },
      {
        "@type": "Question",
        "name": "How often are sessions scheduled?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "It varies by case and methods. Some modalities are weekly; others may be spaced every 2 or 3 weeks."
        }
      },
      {
        "@type": "Question",
        "name": "What should I bring to the first session?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Your questions and any complementary studies; comfortable clothing. Minors should come with an adult."
        }
      },
      {
        "@type": "Question",
        "name": "Do you accept prepaid health plans or insurance?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can request reimbursements from your health insurance provider."
        }
      },
      {
        "@type": "Question",
        "name": "Who can benefit from these treatments?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "People with pain, sensitivity disorders, dizziness, posture issues, traumatic or sports injuries, among others."
        }
      }
    ]
  },
  "fr": {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://www.kinesica.com.ar/fr/#faq",
    "inLanguage": "fr",
    "mainEntityOfPage": "https://www.kinesica.com.ar/fr/",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Quelle est la durée du traitement ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Cela dépend de l'objectif, de l'état du patient et de l'évolution du traitement."
        }
      },
      {
        "@type": "Question",
        "name": "Combien de temps dure une séance ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "La durée varie selon le cas et la méthode utilisée. En règle générale, nous prévoyons environ une heure par séance."
        }
      },
      {
        "@type": "Question",
        "name": "À quelle fréquence ont lieu les séances ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Cela varie selon le cas et les méthodes. Certaines modalités sont hebdomadaires ; d'autres, espacées de 2 ou 3 semaines."
        }
      },
      {
        "@type": "Question",
        "name": "Que dois-je apporter à la première séance ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Vos questions et examens complémentaires si vous en avez ; tenue confortable. Les mineurs doivent être accompagnés d'un adulte."
        }
      },
      {
        "@type": "Question",
        "name": "Acceptez-vous les mutuelles ou assurances ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Vous pouvez demander un remboursement auprès de votre assurance ou mutuelle."
        }
      },
      {
        "@type": "Question",
        "name": "Qui peut bénéficier de ces traitements ?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Les personnes souffrant de douleur, troubles de sensibilité, vertiges, troubles posturaux, blessures traumatiques ou sportives, entre autres."
        }
      }
    ]
  }
};
  var schema = schemas[lang] || schemas.es;
  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
