(function () {
  var BREAKPOINT = 768;
  var TITLES = { es: "Menú", en: "Menu", fr: "Menu", pt: "Menu" };
  var SUBMENU_LABELS = {
    es: "Mostrar submenú",
    en: "Show submenu",
    fr: "Afficher le sous-menu",
    pt: "Mostrar submenu",
  };

  function pageLang() {
    var lang = document.documentElement.getAttribute("lang") || "es";
    if (lang.indexOf("es") === 0) return "es";
    if (lang.indexOf("en") === 0) return "en";
    if (lang.indexOf("fr") === 0) return "fr";
    if (lang.indexOf("pt") === 0) return "pt";
    return "es";
  }

  function initNavigation() {
    var nav = document.getElementById("navigation");
    if (!nav || nav.getAttribute("data-mobile-nav") === "true") {
      return;
    }

    var menuList = nav.querySelector("ul");
    if (!menuList) {
      return;
    }

    nav.setAttribute("data-mobile-nav", "true");

    nav.querySelectorAll("li ul").forEach(function (sub) {
      var parent = sub.parentElement;
      if (parent && parent.tagName === "LI") {
        parent.classList.add("has-sub");
      }
    });

    var lang = pageLang();
    var title = TITLES[lang] || TITLES.es;
    var submenuLabel = SUBMENU_LABELS[lang] || SUBMENU_LABELS.es;

    var button = document.createElement("button");
    button.type = "button";
    button.id = "menu-button";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "navigation-menu");
    button.setAttribute("aria-label", title);
    button.textContent = title;

    menuList.id = "navigation-menu";
    nav.insertBefore(button, menuList);

    nav.querySelectorAll(".has-sub").forEach(function (li) {
      var subBtn = document.createElement("button");
      subBtn.type = "button";
      subBtn.className = "submenu-button";
      subBtn.setAttribute("aria-expanded", "false");
      subBtn.setAttribute("aria-label", submenuLabel);
      li.insertBefore(subBtn, li.firstChild);

      subBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var sub = li.querySelector(":scope > ul");
        if (!sub) {
          return;
        }
        var open = sub.classList.toggle("open");
        subBtn.classList.toggle("submenu-opened", open);
        subBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    function closeSubmenus() {
      nav.querySelectorAll(".has-sub > ul").forEach(function (ul) {
        ul.classList.remove("open");
      });
      nav.querySelectorAll(".submenu-button").forEach(function (b) {
        b.classList.remove("submenu-opened");
        b.setAttribute("aria-expanded", "false");
      });
    }

    function setMainOpen(open) {
      menuList.classList.toggle("open", open);
      button.classList.toggle("menu-opened", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      if (!open) {
        closeSubmenus();
      }
    }

    function toggleMainMenu() {
      setMainOpen(!menuList.classList.contains("open"));
    }

    button.addEventListener("click", toggleMainMenu);

    function applyLayout() {
      var small = window.innerWidth <= BREAKPOINT;
      if (small) {
        nav.classList.add("small-screen");
        if (!menuList.classList.contains("open")) {
          menuList.classList.remove("open");
          button.classList.remove("menu-opened");
          button.setAttribute("aria-expanded", "false");
        }
      } else {
        nav.classList.remove("small-screen");
        setMainOpen(false);
      }
    }

    applyLayout();
    window.addEventListener("resize", applyLayout);
  }

  function boot() {
    initNavigation();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  document.addEventListener("kinesica:nav-ready", boot);
})();
