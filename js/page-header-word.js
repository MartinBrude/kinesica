(function () {
  "use strict";

  var header = document.querySelector(".page-header");
  var caption = header && header.querySelector(".page-caption");
  if (!caption || caption.querySelector(".page-header-word")) {
    return;
  }

  var existingTitle = caption.querySelector(".page-title");
  if (existingTitle) {
    existingTitle.classList.add("page-header-word");
    if ((existingTitle.textContent || "").trim().length > 11) {
      existingTitle.classList.add("page-header-word--long");
    }
    return;
  }

  var path = window.location.pathname || "";
  var parts = path.split("/").filter(Boolean);
  var file = (parts[parts.length - 1] || "").replace(/\.html$/i, "");
  var lang = "es";
  if (parts.indexOf("en") !== -1) {
    lang = "en";
  } else if (parts.indexOf("fr") !== -1) {
    lang = "fr";
  }

  var labels = {
    rpg: { es: "RPG", en: "RPG", fr: "RPG" },
    atm: { es: "ATM", en: "ATM", fr: "ATM" },
    osteopatia: { es: "Osteopatía", en: "Osteopathy", fr: "Ostéopathie" },
    neurodinamia: { es: "Neurodinamia", en: "Neurodynamics", fr: "Neurodynamique" },
    manipulaciones: { es: "Manipulaciones", en: "Manipulations", fr: "Manipulations" },
    lumbalgia: { es: "Lumbalgia", en: "Lumbalgia", fr: "Lombalgie" },
    cervicalgia: { es: "Cervicalgia", en: "Cervicalgia", fr: "Cervicalgie" },
    cadenas: { es: "Cadenas", en: "Chains", fr: "Chaînes" },
    acupuntura: { es: "Acupuntura", en: "Acupuncture", fr: "Acupuncture" },
    "posturologia-clinica": {
      es: "Posturología",
      en: "Posturology",
      fr: "Posturologie",
    },
    articulos: { es: "Artículos", en: "Articles", fr: "Articles" },
    cefalea: { es: "Cefalea", en: "Headache", fr: "Céphalée" },
    dorsalgia: { es: "Dorsalgia", en: "Dorsalgia", fr: "Dorsalgie" },
    ciatalgia: { es: "Ciatalgia", en: "Sciatica", fr: "Ciatalgie" },
    cervicobraquialgia: {
      es: "Cervicobraquialgia",
      en: "Cervicobrachialgia",
      fr: "Cervicobrachialgie",
    },
    pubalgia: { es: "Pubalgia", en: "Pubalgia", fr: "Pubalgie" },
    gonalgia: { es: "Gonalgia", en: "Knee pain", fr: "Gonalgie" },
    talalgia: { es: "Talalgia", en: "Heel pain", fr: "Talalgie" },
    "dolor-sacriiliaco": {
      es: "Sacroilíaco",
      en: "Sacroiliac",
      fr: "Sacro-iliaque",
    },
    "hernia-disco": { es: "Hernia disco", en: "Disc hernia", fr: "Hernie" },
    "protrusion-discal": {
      es: "Protrusión",
      en: "Protrusion",
      fr: "Protrusion",
    },
    hipercifosis: { es: "Hipercifosis", en: "Hyperkyphosis", fr: "Hypercyphose" },
    hiperlordosis: { es: "Hiperlordosis", en: "Hyperlordosis", fr: "Hyperlordose" },
    "dorso-plano": { es: "Dorso plano", en: "Flat back", fr: "Dos plat" },
    "genu-valgo": { es: "Genu valgo", en: "Genu valgum", fr: "Genu valgum" },
    "genu-varo": { es: "Genu varo", en: "Genu varum", fr: "Genu varum" },
    "pies-planos": { es: "Pies planos", en: "Flat feet", fr: "Pieds plats" },
    escoliosis: { es: "Escoliosis", en: "Scoliosis", fr: "Scoliose" },
    "epicondilitis-lateral": {
      es: "Codo tenista",
      en: "Tennis elbow",
      fr: "Épicondylite",
    },
    "epicondilitis-medial": {
      es: "Codo golfista",
      en: "Golfer's elbow",
      fr: "Épicondylite",
    },
    "impingement-subacromial": {
      es: "Impingement",
      en: "Impingement",
      fr: "Conflit",
    },
    "manguito-rotador": {
      es: "Manguito",
      en: "Rotator cuff",
      fr: "Coiffe",
    },
    radiculopatia: { es: "Radiculopatía", en: "Radiculopathy", fr: "Radiculopathie" },
    meniscopatia: { es: "Meniscopatía", en: "Meniscopathy", fr: "Méniscopathie" },
    "fascitis-plantar": {
      es: "Fascitis",
      en: "Plantar fascia",
      fr: "Fasciite",
    },
  };

  var entry = labels[file];
  if (!entry) {
    return;
  }

  var label = entry[lang] || entry.es;
  var word = document.createElement("span");
  word.className = "page-header-word";
  if (label.length > 11) {
    word.classList.add("page-header-word--long");
  }
  word.setAttribute("aria-hidden", "true");
  word.textContent = label;
  caption.appendChild(word);
})();
