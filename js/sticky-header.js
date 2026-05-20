(function () {
  "use strict";

  var header = document.querySelector(".header");
  if (!header) {
    return;
  }

  var desktop = window.matchMedia("(min-width: 768px)");

  function updateScrollState() {
    if (!desktop.matches) {
      header.classList.remove("is-scrolled");
      return;
    }
    header.classList.toggle("is-scrolled", window.scrollY > 0);
  }

  window.addEventListener("scroll", updateScrollState, { passive: true });
  if (desktop.addEventListener) {
    desktop.addEventListener("change", updateScrollState);
  } else if (desktop.addListener) {
    desktop.addListener(updateScrollState);
  }
  updateScrollState();
})();
