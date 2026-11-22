/**
 * Methods scroller layout, cloning and pointer-drag helpers.
 */
(function () {
  "use strict";

  function originals(track) {
    return track.querySelectorAll(".methods-card:not(.is-clone)");
  }

  function decorateClone(card) {
    var clone = card.cloneNode(true);
    clone.classList.add("is-clone");
    clone.setAttribute("aria-hidden", "true");
    clone.querySelectorAll("a").forEach(function (link) {
      link.setAttribute("tabindex", "-1");
    });
    clone.querySelectorAll("img").forEach(function (img) {
      img.removeAttribute("loading");
      img.loading = "eager";
      var src = img.getAttribute("src");
      if (src) img.src = src;
    });
    clone.querySelectorAll(".ui-reveal").forEach(function (el) {
      el.classList.add("is-visible");
    });
    return clone;
  }

  function placeCards(track) {
    var cards = track.querySelectorAll(".methods-card");
    track.style.setProperty("--methods-cols", String(Math.ceil(cards.length / 2)));
    cards.forEach(function (card, i) {
      var idx = i % 8;
      var set = Math.floor(i / 8);
      var colInSet;
      var row;
      if (idx <= 2) {
        colInSet = idx + 1;
        row = 1;
      } else if (idx <= 5) {
        colInSet = idx - 2;
        row = 2;
      } else if (idx === 6) {
        colInSet = 4;
        row = 1;
      } else {
        colInSet = 4;
        row = 2;
      }
      card.style.gridColumn = String(set * 4 + colInSet);
      card.style.gridRow = String(row);
    });
  }

  function clearLoopLayout(track) {
    track.querySelectorAll(".methods-card.is-clone").forEach(function (card) {
      card.remove();
    });
    delete track.dataset.loopReady;
    track.style.removeProperty("--methods-cols");
    track.style.removeProperty("--methods-col");
    track.style.transform = "";
    track.querySelectorAll(".methods-card").forEach(function (card) {
      card.style.gridColumn = "";
      card.style.gridRow = "";
    });
  }

  function ensureClones(track) {
    if (track.dataset.loopReady !== "1") {
      var cards = Array.prototype.slice.call(originals(track));
      var before = document.createDocumentFragment();
      var after = document.createDocumentFragment();
      cards.forEach(function (card) {
        before.appendChild(decorateClone(card));
        after.appendChild(decorateClone(card));
      });
      track.insertBefore(before, track.firstChild);
      track.appendChild(after);
      track.dataset.loopReady = "1";
    }
    placeCards(track);
  }

  function pageSize(track) {
    var col = parseFloat(track.style.getPropertyValue("--methods-col"));
    var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
    if (!(col > 0)) {
      var card = track.querySelector(".methods-card");
      col = card ? card.getBoundingClientRect().width : 0;
    }
    return col + gap;
  }

  function cycleWidth(track) {
    var step = pageSize(track);
    return step > 8 ? step * 4 : 0;
  }

  function enableDrag(scroller, getOffset, setOffset, canLoop, onEnd) {
    var startX = 0;
    var startOffset = 0;
    var pointerId = null;
    var tracking = false;
    var dragging = false;
    var didDrag = false;
    var threshold = 8;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || !canLoop()) return;
      tracking = true;
      dragging = false;
      didDrag = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startOffset = getOffset();
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!tracking || event.pointerId !== pointerId) return;
      var dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < threshold) return;
        dragging = true;
        didDrag = true;
        scroller.classList.add("is-dragging");
        try { scroller.setPointerCapture(event.pointerId); } catch { /* ignore */ }
      }
      setOffset(startOffset - dx);
    });

    function stopDrag(event) {
      if (!tracking || (event && event.pointerId !== pointerId)) return;
      var wasDragging = dragging;
      tracking = false;
      dragging = false;
      pointerId = null;
      scroller.classList.remove("is-dragging");
      if (wasDragging && typeof onEnd === "function") onEnd();
    }

    scroller.addEventListener("pointerup", stopDrag);
    scroller.addEventListener("pointercancel", stopDrag);
    scroller.addEventListener("lostpointercapture", stopDrag);

    scroller.addEventListener(
      "click",
      function (event) {
        if (!didDrag) return;
        event.preventDefault();
        event.stopPropagation();
        didDrag = false;
      },
      true,
    );
  }

  window.KinesicaMethodsScrollerHelpers = {
    originals: originals,
    clearLoopLayout: clearLoopLayout,
    ensureClones: ensureClones,
    pageSize: pageSize,
    cycleWidth: cycleWidth,
    enableDrag: enableDrag,
  };
})();
