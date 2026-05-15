(function () {
  var html = window.__KINESICA_GTM_BODY_SNIPPET;
  if (!html) {
    console.error("[gtm-body-include] Missing snippet: load partials/gtm-body.js first");
    return;
  }
  var root = document.getElementById("site-gtm-body-root");
  if (!root) {
    console.error("[gtm-body-include] Missing #site-gtm-body-root");
    return;
  }
  root.outerHTML = html;
})();
