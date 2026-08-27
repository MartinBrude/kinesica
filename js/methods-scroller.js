(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mqLoop = window.matchMedia("(min-width: 768px)");

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
      if (src) {
        img.src = src;
      }
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

  function cycleWidth(track) {
    var first = track.querySelector(".methods-card:not(.is-clone)");
    if (!first) {
      return 0;
    }
    var cycle = first.offsetLeft;
    return cycle > 8 ? cycle : 0;
  }

  function pageSize(track) {
    var card = track.querySelector(".methods-card");
    if (!card) {
      return 0;
    }
    var gap = parseFloat(window.getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  }

  function initMethodsScroller(root) {
    var scroller = root.querySelector(".methods-scroller");
    var track = root.querySelector(".methods-track");
    var btn = root.querySelector(".methods-scroll-btn");
    if (!scroller || !track || !btn) {
      return;
    }

    var offset = 0;
    var animating = false;
    var animFrame = 0;

    function canLoop() {
      return mqLoop.matches && originals(track).length > 0;
    }

    function sizeColumns() {
      var styles = window.getComputedStyle(root);
      var visible = parseFloat(styles.getPropertyValue("--methods-visible")) || 2;
      var gap = parseFloat(styles.getPropertyValue("--methods-gap")) || 32;
      var col = (scroller.clientWidth - (visible - 1) * gap) / visible;
      if (col > 0) {
        track.style.setProperty("--methods-col", col + "px");
      }
    }

    function wrapOffset() {
      var cycle = cycleWidth(track);
      if (cycle <= 8) {
        return;
      }
      while (offset >= cycle * 2) {
        offset -= cycle;
      }
      while (offset < 0) {
        offset += cycle;
      }
    }

    function paint() {
      wrapOffset();
      track.style.transform = "translate3d(" + -offset + "px,0,0)";
    }

    function park() {
      sizeColumns();
      var cycle = cycleWidth(track);
      offset = cycle > 8 ? cycle : 0;
      paint();
    }

    function sync() {
      var overflow = canLoop() && cycleWidth(track) > 8;
      btn.hidden = !overflow;
      scroller.tabIndex = overflow ? 0 : -1;
      var nextLabel = btn.getAttribute("data-label-next");
      if (nextLabel) {
        btn.setAttribute("aria-label", nextLabel);
      }
      btn.setAttribute("aria-expanded", "false");
    }

    function animateTo(dest) {
      window.cancelAnimationFrame(animFrame);
      wrapOffset();
      if (reduceMotion) {
        offset = dest;
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
        var ease = 1 - Math.pow(1 - t, 3);
        offset = start + delta * ease;
        paint();
        if (t < 1) {
          animFrame = window.requestAnimationFrame(frame);
        } else {
          offset = dest;
          paint();
          animating = false;
        }
      }
      animFrame = window.requestAnimationFrame(frame);
    }

    function advance(direction) {
      if (!canLoop() || animating) {
        return;
      }
      var cycle = cycleWidth(track);
      var page = pageSize(track);
      if (cycle <= 8 || page <= 8) {
        return;
      }
      wrapOffset();
      var dest = offset + direction * page;
      if (direction > 0 && dest > cycle * 2) {
        dest = cycle * 2;
      }
      if (direction < 0 && dest < 0) {
        dest = 0;
      }
      animateTo(dest);
    }

    btn.addEventListener("click", function () {
      if (btn.hidden) {
        return;
      }
      advance(1);
    });

    scroller.addEventListener("keydown", function (event) {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
        return;
      }
      if (btn.hidden) {
        return;
      }
      event.preventDefault();
      advance(event.key === "ArrowRight" ? 1 : -1);
    });

    enableDrag(scroller, function () {
      return offset;
    }, function (value) {
      offset = value;
      paint();
    }, canLoop);

    window.addEventListener("resize", function () {
      if (canLoop()) {
        ensureClones(track);
        park();
      } else {
        offset = 0;
        track.style.transform = "";
      }
      sync();
    });

    if (canLoop()) {
      ensureClones(track);
      park();
    }
    sync();
  }

  function enableDrag(scroller, getOffset, setOffset, canLoop) {
    var startX = 0;
    var startOffset = 0;
    var pointerId = null;
    var tracking = false;
    var dragging = false;
    var didDrag = false;
    var threshold = 8;

    scroller.addEventListener("pointerdown", function (event) {
      if (event.button !== 0) {
        return;
      }
      if (!canLoop()) {
        return;
      }
      tracking = true;
      dragging = false;
      didDrag = false;
      pointerId = event.pointerId;
      startX = event.clientX;
      startOffset = getOffset();
    });

    scroller.addEventListener("pointermove", function (event) {
      if (!tracking || event.pointerId !== pointerId) {
        return;
      }
      var dx = event.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < threshold) {
          return;
        }
        dragging = true;
        didDrag = true;
        scroller.classList.add("is-dragging");
        try {
          scroller.setPointerCapture(event.pointerId);
        } catch (err) {
          /* ignore */
        }
      }
      setOffset(startOffset - dx);
    });

    function stopDrag(event) {
      if (!tracking || (event && event.pointerId !== pointerId)) {
        return;
      }
      tracking = false;
      dragging = false;
      pointerId = null;
      scroller.classList.remove("is-dragging");
    }

    scroller.addEventListener("pointerup", stopDrag);
    scroller.addEventListener("pointercancel", stopDrag);
    scroller.addEventListener("lostpointercapture", stopDrag);

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
