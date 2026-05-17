(function () {
  if (!window.KINESICA_SITE || !window.KINESICA_SITE.features) {
    return;
  }

  var atmVisible = window.KINESICA_SITE.features.atm === true;

  document.querySelectorAll('[data-feature="atm"]').forEach(function (el) {
    if (atmVisible) {
      el.removeAttribute("hidden");
    } else {
      el.setAttribute("hidden", "hidden");
    }
  });

  if (!atmVisible && /\/atm\.html$/i.test(window.location.pathname)) {
    var robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.name = "robots";
      document.head.appendChild(robots);
    }
    robots.content = "noindex, nofollow";
  }
})();
