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

  categories.forEach(function (category) {
    var trigger = category.querySelector(".articles-category-trigger");
    if (!trigger) {
      return;
    }

    trigger.addEventListener("click", function () {
      var willOpen = !category.classList.contains("is-open");
      if (willOpen) {
        closeOthers(category);
      }
      setOpen(category, willOpen);

      if (willOpen && !reduceMotion) {
        window.requestAnimationFrame(function () {
          var firstCard = category.querySelector(".articles-index-card");
          if (firstCard) {
            firstCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        });
      }
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
