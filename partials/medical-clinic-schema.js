(function () {
  var htmlLang = document.documentElement.getAttribute("lang") || "es";
  var isEn = htmlLang === "en";
  var isFr = htmlLang === "fr";
  var pageUrl = isFr
    ? "https://www.kinesica.com.ar/fr/"
    : isEn
      ? "https://www.kinesica.com.ar/en/"
      : "https://www.kinesica.com.ar/";
  var schema = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: "Kinésica",
    "@id": pageUrl,
    url: pageUrl,
    inLanguage: isFr ? "fr" : isEn ? "en" : "es",
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
    description: isFr
      ? "Kinésica est un centre de kinésithérapie, ostéopathie et thérapie manuelle à Palermo, avec des traitements personnalisés."
      : isEn
        ? "Kinésica is a center for kinesiology, osteopathy, and manual therapy in Palermo offering personalized treatments."
        : "Kinésica es un centro de kinesiología, osteopatía y terapias manuales en Palermo que ofrece tratamientos personalizados.",
    medicalSpecialty: isFr
      ? ["Kinésithérapie", "Ostéopathie", "Thérapie manuelle"]
      : isEn
        ? ["Kinesiology", "Osteopathy", "Manual Therapy"]
        : ["Kinesiología", "Osteopatía", "Terapia Manual"],
    founder: [
      {
        "@type": "Person",
        name: "Norberto Silvio Brude",
      },
    ],
    sameAs: [
      "https://www.facebook.com/kinesicabrude",
      "https://www.instagram.com/kinesicabrude/",
      (window.KINESICA_SITE && window.KINESICA_SITE.googleMapsUrl) ||
        "https://maps.app.goo.gl/urpkh4HYe7dSdjPS9",
    ],
  };
  var script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(schema);
  document.head.appendChild(script);
})();
