/**
 * AUTO-GENERATED — no editar. Fuente: scripts/schema-local-business.mjs
 * Regenerar: npm run schema:partials
 */
(function () {
  var htmlLang = document.documentElement.getAttribute("lang") || "es-AR";
  var lang = ({"es-AR":"es","en":"en","fr":"fr","pt":"pt"})[htmlLang]||"es";
  var schemas = {
  "es": {
    "@context": "https://schema.org",
    "@type": [
      "Physiotherapy",
      "MedicalClinic"
    ],
    "@id": "https://www.kinesica.com.ar/#kinesica",
    "name": "Kinésica",
    "alternateName": "Kinésica — Centro de kinesiología y fisioterapia",
    "url": "https://www.kinesica.com.ar/",
    "mainEntityOfPage": "https://www.kinesica.com.ar/",
    "inLanguage": "es-AR",
    "description": "Centro de fisioterapia y kinesiología en Palermo, Buenos Aires: osteopatía, RPG, neurodinámia y terapias manuales personalizadas.",
    "image": [
      "https://www.kinesica.com.ar/images/logo.svg",
      "https://www.kinesica.com.ar/images/hero-img.jpg"
    ],
    "logo": "https://www.kinesica.com.ar/images/logo.svg",
    "telephone": "+54-11-6156-4311",
    "email": "norberto1712@gmail.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Charcas 3889 5ª B",
      "addressLocality": "Ciudad Autónoma de Buenos Aires",
      "addressRegion": "CABA",
      "postalCode": "C1425",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -34.587025,
      "longitude": -58.421046
    },
    "hasMap": "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
    "areaServed": [
      {
        "@type": "City",
        "name": "Ciudad Autónoma de Buenos Aires"
      },
      {
        "@type": "AdministrativeArea",
        "name": "CABA"
      },
      {
        "@type": "Place",
        "name": "Palermo, Buenos Aires"
      }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "10:00",
        "closes": "20:00"
      }
    ],
    "medicalSpecialty": [
      {
        "@type": "MedicalSpecialty",
        "name": "Fisioterapia"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Kinesiología"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Osteopatía"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Terapia manual"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "RPG"
      }
    ],
    "additionalType": "https://schema.org/Physiotherapy",
    "availableLanguage": [
      "es",
      "en",
      "fr",
      "pt"
    ],
    "currenciesAccepted": "ARS",
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Debit Card"
    ],
    "priceRange": "$$",
    "founder": {
      "@type": "Person",
      "name": "Norberto Silvio Brude",
      "jobTitle": "Kinesiólogo y osteópata",
      "url": "https://www.kinesica.com.ar/cv.html"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+54-11-6156-4311",
      "email": "norberto1712@gmail.com",
      "contactType": "customer service",
      "areaServed": "AR",
      "availableLanguage": [
        "Spanish",
        "English",
        "French",
        "Portuguese"
      ]
    },
    "potentialAction": {
      "@type": "ReserveAction",
      "name": "Reservar turno por WhatsApp",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://wa.me/5491161564311",
        "inLanguage": "es-AR",
        "actionPlatform": [
          "https://schema.org/WhatsApp",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Tratamientos Kinésica",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/atm.html#service",
            "name": "Tratamiento de ATM",
            "description": "Terapia para articulación temporomandibular y bruxismo.",
            "url": "https://www.kinesica.com.ar/atm.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/acupuntura.html#service",
            "name": "Acupuntura",
            "description": "Acupuntura como complemento en el abordaje del dolor y el estrés.",
            "url": "https://www.kinesica.com.ar/acupuntura.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/cadenas.html#service",
            "name": "Cadenas musculares",
            "description": "Tratamiento según cadenas musculares y fasciales.",
            "url": "https://www.kinesica.com.ar/cadenas.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/manipulaciones.html#service",
            "name": "Manipulaciones viscerales",
            "description": "Terapia manual visceral para mejorar la función de órganos.",
            "url": "https://www.kinesica.com.ar/manipulaciones.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/neurodinamia.html#service",
            "name": "Neurodinámia",
            "description": "Tratamiento de tensiones nerviosas y movilización neural.",
            "url": "https://www.kinesica.com.ar/neurodinamia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/osteopatia.html#service",
            "name": "Osteopatía",
            "description": "Tratamiento osteopático para restaurar el equilibrio del cuerpo.",
            "url": "https://www.kinesica.com.ar/osteopatia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/posturologia-clinica.html#service",
            "name": "Posturología clínica",
            "description": "Evaluación y tratamiento postural personalizado.",
            "url": "https://www.kinesica.com.ar/posturologia-clinica.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/rpg.html#service",
            "name": "RPG — Reeducación Postural Global",
            "description": "Método de RPG para flexibilizar musculatura estática y reeducar la postura.",
            "url": "https://www.kinesica.com.ar/rpg.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/lumbalgia.html#service",
            "name": "Tratamiento de lumbalgia",
            "description": "Tratamiento de dolor lumbar y ciática.",
            "url": "https://www.kinesica.com.ar/lumbalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/cervicalgia.html#service",
            "name": "Tratamiento de cervicalgia",
            "description": "Abordaje de dolor y rigidez cervical en Palermo.",
            "url": "https://www.kinesica.com.ar/cervicalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        }
      ]
    },
    "sameAs": [
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9"
    ]
  },
  "en": {
    "@context": "https://schema.org",
    "@type": [
      "Physiotherapy",
      "MedicalClinic"
    ],
    "@id": "https://www.kinesica.com.ar/#kinesica",
    "name": "Kinésica",
    "alternateName": "Kinésica — Physiotherapy and osteopathy clinic",
    "url": "https://www.kinesica.com.ar/en/",
    "mainEntityOfPage": "https://www.kinesica.com.ar/en/",
    "inLanguage": "en",
    "description": "Physiotherapy and kinesiology clinic in Palermo, Buenos Aires: osteopathy, RPG, neurodynamics, and personalized manual therapy.",
    "image": [
      "https://www.kinesica.com.ar/images/logo.svg",
      "https://www.kinesica.com.ar/images/hero-img.jpg"
    ],
    "logo": "https://www.kinesica.com.ar/images/logo.svg",
    "telephone": "+54-11-6156-4311",
    "email": "norberto1712@gmail.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Charcas 3889 5ª B",
      "addressLocality": "Ciudad Autónoma de Buenos Aires",
      "addressRegion": "CABA",
      "postalCode": "C1425",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -34.587025,
      "longitude": -58.421046
    },
    "hasMap": "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
    "areaServed": [
      {
        "@type": "City",
        "name": "Ciudad Autónoma de Buenos Aires"
      },
      {
        "@type": "AdministrativeArea",
        "name": "CABA"
      },
      {
        "@type": "Place",
        "name": "Palermo, Buenos Aires"
      }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "10:00",
        "closes": "20:00"
      }
    ],
    "medicalSpecialty": [
      {
        "@type": "MedicalSpecialty",
        "name": "Physiotherapy"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Kinesiology"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Osteopathy"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Manual therapy"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "RPG"
      }
    ],
    "additionalType": "https://schema.org/Physiotherapy",
    "availableLanguage": [
      "es",
      "en",
      "fr",
      "pt"
    ],
    "currenciesAccepted": "ARS",
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Debit Card"
    ],
    "priceRange": "$$",
    "founder": {
      "@type": "Person",
      "name": "Norberto Silvio Brude",
      "jobTitle": "Physiotherapist and osteopath",
      "url": "https://www.kinesica.com.ar/en/cv.html"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+54-11-6156-4311",
      "email": "norberto1712@gmail.com",
      "contactType": "customer service",
      "areaServed": "AR",
      "availableLanguage": [
        "English",
        "Spanish",
        "French",
        "Portuguese"
      ]
    },
    "potentialAction": {
      "@type": "ReserveAction",
      "name": "Book via WhatsApp",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://wa.me/5491161564311",
        "inLanguage": "en",
        "actionPlatform": [
          "https://schema.org/WhatsApp",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Kinésica treatments",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/atm.html#service",
            "name": "TMJ treatment",
            "description": "Therapy for temporomandibular joint disorders and bruxism.",
            "url": "https://www.kinesica.com.ar/en/atm.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/acupuntura.html#service",
            "name": "Acupuncture",
            "description": "Acupuncture as a complement for pain and stress management.",
            "url": "https://www.kinesica.com.ar/en/acupuntura.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/cadenas.html#service",
            "name": "Muscle chains therapy",
            "description": "Treatment based on muscular and fascial chains.",
            "url": "https://www.kinesica.com.ar/en/cadenas.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/manipulaciones.html#service",
            "name": "Visceral manipulation",
            "description": "Visceral manual therapy to improve organ function.",
            "url": "https://www.kinesica.com.ar/en/manipulaciones.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/neurodinamia.html#service",
            "name": "Neurodynamics",
            "description": "Treatment for nerve tension and neural mobilization.",
            "url": "https://www.kinesica.com.ar/en/neurodinamia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/osteopatia.html#service",
            "name": "Osteopathy",
            "description": "Osteopathic treatment to restore body balance.",
            "url": "https://www.kinesica.com.ar/en/osteopatia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/posturologia-clinica.html#service",
            "name": "Clinical posturology",
            "description": "Personalized postural assessment and treatment.",
            "url": "https://www.kinesica.com.ar/en/posturologia-clinica.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/rpg.html#service",
            "name": "RPG — Global Postural Reeducation",
            "description": "RPG method to release static muscle chains and re-educate posture.",
            "url": "https://www.kinesica.com.ar/en/rpg.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/lumbalgia.html#service",
            "name": "Low back pain treatment",
            "description": "Treatment for lumbar pain and sciatica.",
            "url": "https://www.kinesica.com.ar/en/lumbalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/en/cervicalgia.html#service",
            "name": "Cervical pain treatment",
            "description": "Care for neck pain and stiffness in Palermo.",
            "url": "https://www.kinesica.com.ar/en/cervicalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        }
      ]
    },
    "sameAs": [
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9"
    ]
  },
  "fr": {
    "@context": "https://schema.org",
    "@type": [
      "Physiotherapy",
      "MedicalClinic"
    ],
    "@id": "https://www.kinesica.com.ar/#kinesica",
    "name": "Kinésica",
    "alternateName": "Kinésica — Cabinet de kinésithérapie et ostéopathie",
    "url": "https://www.kinesica.com.ar/fr/",
    "mainEntityOfPage": "https://www.kinesica.com.ar/fr/",
    "inLanguage": "fr",
    "description": "Centre de kinésithérapie et physiothérapie à Palermo, Buenos Aires : ostéopathie, RPG, neurodynamique et thérapies manuelles personnalisées.",
    "image": [
      "https://www.kinesica.com.ar/images/logo.svg",
      "https://www.kinesica.com.ar/images/hero-img.jpg"
    ],
    "logo": "https://www.kinesica.com.ar/images/logo.svg",
    "telephone": "+54-11-6156-4311",
    "email": "norberto1712@gmail.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Charcas 3889 5ª B",
      "addressLocality": "Ciudad Autónoma de Buenos Aires",
      "addressRegion": "CABA",
      "postalCode": "C1425",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -34.587025,
      "longitude": -58.421046
    },
    "hasMap": "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
    "areaServed": [
      {
        "@type": "City",
        "name": "Ciudad Autónoma de Buenos Aires"
      },
      {
        "@type": "AdministrativeArea",
        "name": "CABA"
      },
      {
        "@type": "Place",
        "name": "Palermo, Buenos Aires"
      }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "10:00",
        "closes": "20:00"
      }
    ],
    "medicalSpecialty": [
      {
        "@type": "MedicalSpecialty",
        "name": "Kinésithérapie"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Physiothérapie"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Ostéopathie"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Thérapie manuelle"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "RPG"
      }
    ],
    "additionalType": "https://schema.org/Physiotherapy",
    "availableLanguage": [
      "es",
      "en",
      "fr",
      "pt"
    ],
    "currenciesAccepted": "ARS",
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Debit Card"
    ],
    "priceRange": "$$",
    "founder": {
      "@type": "Person",
      "name": "Norberto Silvio Brude",
      "jobTitle": "Kinésithérapeute et ostéopathe",
      "url": "https://www.kinesica.com.ar/fr/cv.html"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+54-11-6156-4311",
      "email": "norberto1712@gmail.com",
      "contactType": "customer service",
      "areaServed": "AR",
      "availableLanguage": [
        "French",
        "Spanish",
        "English",
        "Portuguese"
      ]
    },
    "potentialAction": {
      "@type": "ReserveAction",
      "name": "Prendre rendez-vous via WhatsApp",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://wa.me/5491161564311",
        "inLanguage": "fr",
        "actionPlatform": [
          "https://schema.org/WhatsApp",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Traitements Kinésica",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/atm.html#service",
            "name": "Traitement de l'ATM",
            "description": "Thérapie pour l'articulation temporo-mandibulaire et le bruxisme.",
            "url": "https://www.kinesica.com.ar/fr/atm.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/acupuntura.html#service",
            "name": "Acupuncture",
            "description": "Acupuncture en complément pour la douleur et le stress.",
            "url": "https://www.kinesica.com.ar/fr/acupuntura.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/cadenas.html#service",
            "name": "Chaînes musculaires",
            "description": "Traitement selon les chaînes musculaires et fasciales.",
            "url": "https://www.kinesica.com.ar/fr/cadenas.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/manipulaciones.html#service",
            "name": "Manipulations viscérales",
            "description": "Thérapie manuelle viscérale pour améliorer la fonction des organes.",
            "url": "https://www.kinesica.com.ar/fr/manipulaciones.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/neurodinamia.html#service",
            "name": "Neurodynamique",
            "description": "Traitement des tensions nerveuses et mobilisation neurale.",
            "url": "https://www.kinesica.com.ar/fr/neurodinamia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/osteopatia.html#service",
            "name": "Ostéopathie",
            "description": "Traitement ostéopathique pour rétablir l'équilibre du corps.",
            "url": "https://www.kinesica.com.ar/fr/osteopatia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/posturologia-clinica.html#service",
            "name": "Posturologie clinique",
            "description": "Évaluation et traitement postural personnalisé.",
            "url": "https://www.kinesica.com.ar/fr/posturologia-clinica.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/rpg.html#service",
            "name": "RPG — Rééducation Posturale Globale",
            "description": "Méthode RPG pour assouplir les chaînes musculaires statiques.",
            "url": "https://www.kinesica.com.ar/fr/rpg.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/lumbalgia.html#service",
            "name": "Traitement de la lombalgie",
            "description": "Traitement des douleurs lombaires et sciatique.",
            "url": "https://www.kinesica.com.ar/fr/lumbalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/fr/cervicalgia.html#service",
            "name": "Traitement de la cervicalgie",
            "description": "Prise en charge des douleurs cervicales à Palermo.",
            "url": "https://www.kinesica.com.ar/fr/cervicalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        }
      ]
    },
    "sameAs": [
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9"
    ]
  },
  "pt": {
    "@context": "https://schema.org",
    "@type": [
      "Physiotherapy",
      "MedicalClinic"
    ],
    "@id": "https://www.kinesica.com.ar/#kinesica",
    "name": "Kinésica",
    "alternateName": "Kinésica — Centro de fisioterapia e kinesiologia",
    "url": "https://www.kinesica.com.ar/pt/",
    "mainEntityOfPage": "https://www.kinesica.com.ar/pt/",
    "inLanguage": "pt",
    "description": "Clínica de fisioterapia em Palermo, Buenos Aires: osteopatia, RPG, neurodinâmica e terapia manual personalizada.",
    "image": [
      "https://www.kinesica.com.ar/images/logo.svg",
      "https://www.kinesica.com.ar/images/hero-img.jpg"
    ],
    "logo": "https://www.kinesica.com.ar/images/logo.svg",
    "telephone": "+54-11-6156-4311",
    "email": "norberto1712@gmail.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Charcas 3889 5ª B",
      "addressLocality": "Ciudad Autónoma de Buenos Aires",
      "addressRegion": "CABA",
      "postalCode": "C1425",
      "addressCountry": "AR"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -34.587025,
      "longitude": -58.421046
    },
    "hasMap": "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
    "areaServed": [
      {
        "@type": "City",
        "name": "Ciudad Autónoma de Buenos Aires"
      },
      {
        "@type": "AdministrativeArea",
        "name": "CABA"
      },
      {
        "@type": "Place",
        "name": "Palermo, Buenos Aires"
      }
    ],
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "10:00",
        "closes": "20:00"
      }
    ],
    "medicalSpecialty": [
      {
        "@type": "MedicalSpecialty",
        "name": "Fisioterapia"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Kinesiologia"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Osteopatia"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "Terapia manual"
      },
      {
        "@type": "MedicalSpecialty",
        "name": "RPG"
      }
    ],
    "additionalType": "https://schema.org/Physiotherapy",
    "availableLanguage": [
      "es",
      "en",
      "fr",
      "pt"
    ],
    "currenciesAccepted": "ARS",
    "paymentAccepted": [
      "Cash",
      "Credit Card",
      "Debit Card"
    ],
    "priceRange": "$$",
    "founder": {
      "@type": "Person",
      "name": "Norberto Silvio Brude",
      "jobTitle": "Fisioterapeuta e osteopata",
      "url": "https://www.kinesica.com.ar/pt/cv.html"
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+54-11-6156-4311",
      "email": "norberto1712@gmail.com",
      "contactType": "customer service",
      "areaServed": "AR",
      "availableLanguage": [
        "Portuguese",
        "Spanish",
        "English",
        "French"
      ]
    },
    "potentialAction": {
      "@type": "ReserveAction",
      "name": "Agendar pelo WhatsApp",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://wa.me/5491161564311",
        "inLanguage": "pt",
        "actionPlatform": [
          "https://schema.org/WhatsApp",
          "https://schema.org/MobileWebPlatform"
        ]
      }
    },
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Tratamentos Kinésica",
      "itemListElement": [
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/atm.html#service",
            "name": "Tratamento de ATM",
            "description": "Terapia para disfunções da articulação temporomandibular e bruxismo.",
            "url": "https://www.kinesica.com.ar/pt/atm.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/acupuntura.html#service",
            "name": "Acupuntura",
            "description": "Acupuntura como complemento para dor e gestão do estresse.",
            "url": "https://www.kinesica.com.ar/pt/acupuntura.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/cadenas.html#service",
            "name": "Cadeias musculares",
            "description": "Tratamento baseado em cadeias musculares e fasciais.",
            "url": "https://www.kinesica.com.ar/pt/cadenas.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/manipulaciones.html#service",
            "name": "Manipulação visceral",
            "description": "Terapia manual visceral para melhorar a função dos órgãos.",
            "url": "https://www.kinesica.com.ar/pt/manipulaciones.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/neurodinamia.html#service",
            "name": "Neurodinâmica",
            "description": "Tratamento de tensão neural e mobilização do sistema nervoso.",
            "url": "https://www.kinesica.com.ar/pt/neurodinamia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/osteopatia.html#service",
            "name": "Osteopatia",
            "description": "Tratamento osteopático para restaurar o equilíbrio corporal.",
            "url": "https://www.kinesica.com.ar/pt/osteopatia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/posturologia-clinica.html#service",
            "name": "Posturologia clínica",
            "description": "Avaliação e tratamento postural personalizado.",
            "url": "https://www.kinesica.com.ar/pt/posturologia-clinica.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/rpg.html#service",
            "name": "RPG — Reeducação Postural Global",
            "description": "Método RPG para liberar cadeias musculares estáticas e reeducar a postura.",
            "url": "https://www.kinesica.com.ar/pt/rpg.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/lumbalgia.html#service",
            "name": "Tratamento de lombalgia",
            "description": "Tratamento para dor lombar e ciática.",
            "url": "https://www.kinesica.com.ar/pt/lumbalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        },
        {
          "@type": "Offer",
          "itemOffered": {
            "@type": "Service",
            "@id": "https://www.kinesica.com.ar/pt/cervicalgia.html#service",
            "name": "Tratamento de cervicalgia",
            "description": "Cuidado para dor e rigidez cervical em Palermo.",
            "url": "https://www.kinesica.com.ar/pt/cervicalgia.html",
            "provider": {
              "@id": "https://www.kinesica.com.ar/#kinesica"
            },
            "areaServed": {
              "@type": "Place",
              "name": "Palermo, Buenos Aires"
            }
          }
        }
      ]
    },
    "sameAs": [
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9"
    ]
  }
};
  var schema = schemas[lang] || schemas.es;
  if (document.getElementById("kinesica-local-schema")) return;
  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.id = "kinesica-local-schema";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
