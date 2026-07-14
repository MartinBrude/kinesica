(function () {
  "use strict";

  var root = document.getElementById("articles-categories");
  if (!root) {
    return;
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var categories = Array.prototype.slice.call(
    root.querySelectorAll(".articles-category"),
  );

  function getStickyHeaderOffset() {
    var headerRoot = document.getElementById("site-header-root");
    return headerRoot ? headerRoot.getBoundingClientRect().height : 0;
  }

  function setOpen(category, open) {
    var trigger = category.querySelector(".articles-category-trigger");
    var panel = category.querySelector(".articles-category-panel");
    if (!trigger || !panel) {
      return;
    }

    category.classList.toggle("is-open", open);
    trigger.setAttribute("aria-expanded", open ? "true" : "false");
    panel.setAttribute("aria-hidden", open ? "false" : "true");
  }

  function closeOthers(except) {
    categories.forEach(function (category) {
      if (category !== except && category.classList.contains("is-open")) {
        setOpen(category, false);
      }
    });
  }

  function isAnyOtherOpen(except) {
    return categories.some(function (category) {
      return category !== except && category.classList.contains("is-open");
    });
  }

  function scrollCategoryHeader(category) {
    var trigger = category.querySelector(".articles-category-trigger");
    if (!trigger) {
      return;
    }

    var offset = getStickyHeaderOffset() + 16;
    var rect = trigger.getBoundingClientRect();
    var margin = 24;
    var tooHigh = rect.top < offset;
    var tooLow = rect.bottom > window.innerHeight - margin;

    if (!tooHigh && !tooLow) {
      return;
    }

    var top = window.scrollY + rect.top - offset;
    window.scrollTo({
      top: Math.max(0, top),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  function whenCategoryOpened(category, callback) {
    var panel = category.querySelector(".articles-category-panel");
    if (!panel || reduceMotion) {
      callback();
      return;
    }

    var done = false;

    function finish() {
      if (done) {
        return;
      }
      done = true;
      panel.removeEventListener("transitionend", onEnd);
      callback();
    }

    function onEnd(event) {
      if (
        event.propertyName === "grid-template-rows" &&
        category.classList.contains("is-open")
      ) {
        finish();
      }
    }

    panel.addEventListener("transitionend", onEnd);
    window.setTimeout(finish, 720);
  }

  categories.forEach(function (category) {
    var trigger = category.querySelector(".articles-category-trigger");
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", function () {
      var willOpen = !category.classList.contains("is-open");
      if (!willOpen) {
        setOpen(category, false);
        return;
      }

      var switching = isAnyOtherOpen(category);
      closeOthers(category);
      setOpen(category, true);

      if (switching) {
        whenCategoryOpened(category, function () {
          scrollCategoryHeader(category);
        });
        return;
      }

      whenCategoryOpened(category, function () {
        scrollCategoryHeader(category);
      });
    });
  });

  root.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") {
      return;
    }
    categories.forEach(function (category) {
      if (category.classList.contains("is-open")) {
        setOpen(category, false);
        var trigger = category.querySelector(".articles-category-trigger");
        if (trigger) {
          trigger.focus();
        }
      }
    });
  });
})();
