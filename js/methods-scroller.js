/**
 * Methods infinite scroller controller (layout/drag helpers in methods-scroller-layout.js).
 */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqLoop = window.matchMedia("(min-width: 768px)");

  function initMethodsScroller(root) {
    var H = window.KinesicaMethodsScrollerHelpers;
    var scroller = root.querySelector(".methods-scroller");
    var track = root.querySelector(".methods-track");
    var btn = root.querySelector(".methods-scroll-btn");
    if (!H || !scroller || !track || !btn) return;

    track.querySelectorAll(".methods-card .service-block").forEach(function (el) {
      el.classList.add("is-visible");
    });
    track.querySelectorAll(".methods-card img").forEach(function (img) {
      img.removeAttribute("loading");
      img.loading = "eager";
    });

    var offset = 0;
    var animating = false;
    var animFrame = 0;

    function canLoop() {
      return mqLoop.matches && H.originals(track).length > 0;
    }

    function sizeColumns() {
      var styles = window.getComputedStyle(root);
      var visible = parseFloat(styles.getPropertyValue("--methods-visible")) || 2;
      var gap = parseFloat(styles.getPropertyValue("--methods-gap")) || 32;
      var col = (scroller.clientWidth - (visible - 1) * gap) / visible;
      if (col > 0) track.style.setProperty("--methods-col", col + "px");
    }

    function wrapOffset() {
      var cycle = H.cycleWidth(track);
      if (cycle <= 8) return;
      while (offset >= cycle * 2) offset -= cycle;
      while (offset < 0) offset += cycle;
    }

    function snapDest(from) {
      var step = H.pageSize(track);
      var cycle = H.cycleWidth(track);
      if (step <= 8 || cycle <= 8) return from;
      return cycle + Math.round((from - cycle) / step) * step;
    }

    function paint() {
      wrapOffset();
      track.style.transform = "translate3d(" + -offset + "px,0,0)";
    }

    function park() {
      sizeColumns();
      var cycle = H.cycleWidth(track);
      offset = cycle > 8 ? cycle : 0;
      paint();
    }

    function sync() {
      var overflow = canLoop() && H.cycleWidth(track) > 8;
      btn.hidden = !overflow;
      scroller.tabIndex = overflow ? 0 : -1;
      var nextLabel = btn.getAttribute("data-label-next");
      if (nextLabel) btn.setAttribute("aria-label", nextLabel);
      btn.setAttribute("aria-expanded", "false");
    }

    function animateTo(dest) {
      window.cancelAnimationFrame(animFrame);
      wrapOffset();
      if (reduceMotion) {
        offset = snapDest(dest);
        paint();
        animating = false;
        return;
      }
      var start = offset;
      var delta = dest - start;
      if (Math.abs(delta) < 1) {
        animating = false;
        return;
      }
      var t0 = performance.now();
      var dur = 420;
      animating = true;
      function frame(now) {
        var t = Math.min(1, (now - t0) / dur);
        offset = start + delta * (1 - Math.pow(1 - t, 3));
        paint();
        if (t < 1) {
          animFrame = window.requestAnimationFrame(frame);
        } else {
          offset = snapDest(dest);
          paint();
          animating = false;
        }
      }
      animFrame = window.requestAnimationFrame(frame);
    }

    function advance(direction) {
      if (!canLoop() || animating) return;
      var cycle = H.cycleWidth(track);
      var page = H.pageSize(track);
      if (cycle <= 8 || page <= 8) return;
      wrapOffset();
      offset = snapDest(offset);
      var dest = offset + direction * page;
      if (direction > 0 && dest > cycle * 2) dest = cycle * 2;
      if (direction < 0 && dest < 0) dest = 0;
      animateTo(dest);
    }

    function settle() {
      if (!canLoop() || animating) return;
      wrapOffset();
      var dest = snapDest(offset);
      if (Math.abs(dest - offset) < 1) {
        offset = dest;
        paint();
        return;
      }
      animateTo(dest);
    }

    btn.addEventListener("click", function () {
      if (!btn.hidden) advance(1);
    });

    scroller.addEventListener("keydown", function (event) {
      if ((event.key !== "ArrowRight" && event.key !== "ArrowLeft") || btn.hidden) return;
      event.preventDefault();
      advance(event.key === "ArrowRight" ? 1 : -1);
    });

    var wheelTimer = 0;
    scroller.addEventListener(
      "wheel",
      function (event) {
        if (!canLoop() || btn.hidden) return;
        if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        event.preventDefault();
        if (animating) return;
        offset += event.deltaX;
        paint();
        window.clearTimeout(wheelTimer);
        wheelTimer = window.setTimeout(settle, 80);
      },
      { passive: false },
    );

    H.enableDrag(
      scroller,
      function () { return offset; },
      function (value) { offset = value; paint(); },
      canLoop,
      settle,
    );

    function applyMode() {
      if (canLoop()) {
        H.ensureClones(track);
        park();
      } else {
        offset = 0;
        H.clearLoopLayout(track);
      }
      sync();
    }

    window.addEventListener("resize", applyMode);
    if (typeof mqLoop.addEventListener === "function") mqLoop.addEventListener("change", applyMode);
    else if (typeof mqLoop.addListener === "function") mqLoop.addListener(applyMode);

    applyMode();
  }

  function init() {
    document.querySelectorAll(".methods-scroller-wrap").forEach(initMethodsScroller);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
