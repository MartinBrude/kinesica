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
