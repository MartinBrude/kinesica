/**
 * Home map: load Google Maps embed iframe only after user click (saves ~400KB JS on mobile PSI).
 */
(function () {
  "use strict";

  function loadMap(facade) {
    if (facade.getAttribute("data-map-loaded") === "true") {
      return;
    }
    var src = facade.getAttribute("data-embed-src");
    if (!src) {
      return;
    }

    var btn = facade.querySelector(".map-embed-facade__btn");
    var title =
      (btn && btn.getAttribute("aria-label")) || "Google Maps";
    var frame = facade.closest(".map-embed-frame");
    if (!frame) {
      return;
    }

    facade.setAttribute("data-map-loaded", "true");

    var iframe = document.createElement("iframe");
    iframe.className = "map-embed";
    iframe.src = src;
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    iframe.title = title;

    frame.classList.add("map-embed-frame--loaded");
    frame.appendChild(iframe);
    facade.remove();
  }

  function init() {
    var facades = document.querySelectorAll(".map-embed-facade[data-embed-src]");
    facades.forEach(function (facade) {
      var btn = facade.querySelector(".map-embed-facade__btn");
      if (!btn) {
        return;
      }
      btn.addEventListener("click", function () {
        loadMap(facade);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
