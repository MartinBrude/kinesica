/**
 * Home map: defer Google Maps iframe until the page is ready and the user interacts.
 */
(function () {
  "use strict";

  var loaded = false;
  var facades = [];

  function loadMap(facade) {
    if (facade.getAttribute("data-map-loaded") === "true") {
      return;
    }
    var src = facade.getAttribute("data-embed-src");
    if (!src) {
      return;
    }

    var title = facade.getAttribute("data-embed-title") || "Google Maps";
    var frame = facade.closest(".map-embed-frame");
    if (!frame) {
      return;
    }

    facade.setAttribute("data-map-loaded", "true");
    facade.removeAttribute("aria-busy");

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

  function loadAll() {
    if (loaded) {
      return;
    }
    loaded = true;
    facades.forEach(loadMap);
  }

  function bindInteraction() {
    var opts = { once: true, passive: true, capture: true };
    window.addEventListener("scroll", loadAll, opts);
    window.addEventListener("touchstart", loadAll, opts);
    window.addEventListener("pointerdown", loadAll, opts);
    window.addEventListener("keydown", loadAll, opts);
  }

  function init() {
    facades = Array.prototype.slice.call(
      document.querySelectorAll(".map-embed-facade[data-embed-src]"),
    );
    if (!facades.length) {
      return;
    }
    bindInteraction();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
