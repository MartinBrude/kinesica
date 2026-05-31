(function () {
  var BREAKPOINT = 768;
  var TITLES = { es: "Menú", en: "Menu", fr: "Menu", pt: "Menu" };

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

    var lang = document.documentElement.getAttribute("lang") || "es";
    var title = TITLES[lang] || TITLES.es;

    var button = document.createElement("div");
    button.id = "menu-button";
    button.setAttribute("role", "button");
    button.setAttribute("tabindex", "0");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "navigation-menu");
    button.textContent = title;

    menuList.id = "navigation-menu";
    nav.insertBefore(button, menuList);

    nav.querySelectorAll(".has-sub").forEach(function (li) {
      var subBtn = document.createElement("span");
      subBtn.className = "submenu-button";
      subBtn.setAttribute("role", "button");
      subBtn.setAttribute("tabindex", "0");
      subBtn.setAttribute("aria-expanded", "false");
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
    button.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleMainMenu();
      }
    });

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
