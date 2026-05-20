(function () {
  "use strict";

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest('[data-toggle="collapse"]');
    if (!trigger) {
      return;
    }

    var href = trigger.getAttribute("href");
    if (!href || href.charAt(0) !== "#") {
      return;
    }

    var panel = document.querySelector(href);
    if (!panel) {
      return;
    }

    e.preventDefault();

    var parentSel = trigger.getAttribute("data-parent");
    var group = parentSel ? document.querySelector(parentSel) : null;

    if (group) {
      group.querySelectorAll(".panel-collapse.in").forEach(function (open) {
        if (open !== panel) {
          open.classList.remove("in");
        }
      });
    }

    panel.classList.toggle("in");
  });
})();
