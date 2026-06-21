(function () {
  "use strict";

  function panelForTrigger(trigger) {
    var href = trigger.getAttribute("href");
    if (!href || href.charAt(0) !== "#") {
      return null;
    }
    return document.querySelector(href);
  }

  function panelIsOpen(panel) {
    return panel && panel.classList.contains("in");
  }

  function syncTrigger(trigger) {
    var panel = panelForTrigger(trigger);
    var panelId = panel ? panel.id : "";
    if (panelId) {
      trigger.setAttribute("aria-controls", panelId);
    }
    trigger.setAttribute("aria-expanded", panelIsOpen(panel) ? "true" : "false");
  }

  function syncAccordion(group) {
    if (!group) {
      return;
    }
    group.querySelectorAll('[data-toggle="collapse"]').forEach(syncTrigger);
  }

  function initFaqAccordions() {
    document.querySelectorAll('[data-toggle="collapse"]').forEach(syncTrigger);
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest('[data-toggle="collapse"]');
    if (!trigger) {
      return;
    }

    var panel = panelForTrigger(trigger);
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
      group.querySelectorAll('[data-toggle="collapse"]').forEach(function (item) {
        if (item !== trigger) {
          syncTrigger(item);
        }
      });
    }

    panel.classList.toggle("in");
    syncTrigger(trigger);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFaqAccordions);
  } else {
    initFaqAccordions();
  }
})();
