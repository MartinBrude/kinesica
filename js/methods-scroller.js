(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function maxScroll(scroller) {
    return Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  }

  function isAtEnd(scroller) {
    return scroller.scrollLeft >= maxScroll(scroller) - 8;
  }

  function scrollBehavior() {
    return reduceMotion ? "auto" : "smooth";
  }

  function initMethodsScroller(wrap) {
    var scroller = wrap.querySelector(".methods-scroller");
    var btn = wrap.querySelector(".methods-scroll-btn");
    if (!scroller || !btn) {
      return;
    }

    function sync() {
      var overflow = maxScroll(scroller) > 8;
      var end = overflow && isAtEnd(scroller);
      wrap.classList.toggle("is-end", end);
      btn.classList.toggle("is-end", end);
      btn.hidden = !overflow;
      scroller.tabIndex = overflow ? 0 : -1;
      btn.setAttribute(
        "aria-label",
        end ? btn.getAttribute("data-label-prev") : btn.getAttribute("data-label-next"),
      );
      btn.setAttribute("aria-expanded", end ? "true" : "false");
    }

    btn.addEventListener("click", function () {
      var max = maxScroll(scroller);
      if (max <= 8) {
        return;
      }
      scroller.scrollTo({
        left: isAtEnd(scroller) ? 0 : max,
        behavior: scrollBehavior(),
      });
    });

    scroller.addEventListener(
      "keydown",
      function (event) {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        var max = maxScroll(scroller);
        if (max <= 8) {
          return;
        }
        event.preventDefault();
        var goEnd = event.key === "ArrowRight";
        scroller.scrollTo({
          left: goEnd ? max : 0,
          behavior: scrollBehavior(),
        });
      },
    );

    scroller.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    enableMouseDrag(scroller);
    sync();
  }

  function enableMouseDrag(scroller) {
    var startX = 0;
    var startLeft = 0;
    var pointerId = null;
    var dragging = false;
    var didDrag = false;
    var threshold = 6;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.pointerType !== "mouse" || event.button !== 0) {
        return;
      }
      if (maxScroll(scroller) <= 8) {
        return;
      }
      dragging = true;
      didDrag = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startLeft = scroller.scrollLeft;
      scroller.classList.add("is-dragging");
      try {
        scroller.setPointerCapture(event.pointerId);
      } catch (err) {
        /* synthetic or inactive pointers */
      }
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!dragging || event.pointerId !== pointerId) {
        return;
      }
      var dx = event.clientX - startX;
      if (!didDrag && Math.abs(dx) < threshold) {
        return;
      }
      didDrag = true;
      scroller.scrollLeft = startLeft - dx;
    });

    function stopDrag(event) {
      if (!dragging || (event && event.pointerId !== pointerId)) {
        return;
      }
      dragging = false;
      pointerId = null;
      scroller.classList.remove("is-dragging");
    }

    scroller.addEventListener("pointerup", stopDrag);
    scroller.addEventListener("pointercancel", stopDrag);

    scroller.addEventListener(
      "click",
      function (event) {
        if (!didDrag) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        didDrag = false;
      },
      true,
    );
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
