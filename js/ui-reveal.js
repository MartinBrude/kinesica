(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var nodes = document.querySelectorAll(
    ".service-block, .section-title, .feature, .team-img, .articles-category, .articles-index-quote",
  );
  var targets = Array.prototype.filter.call(nodes, function (el) {
    return !(el.classList.contains("section-title") && el.closest(".articles-index-intro"));
  });
  if (!targets.length) {
    return;
  }

  targets.forEach(function (el) {
    el.classList.add("ui-reveal");
  });

  function reveal(el) {
    el.classList.add("is-visible");
  }

  function isInViewport(el) {
    var rect = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var vw = window.innerWidth || document.documentElement.clientWidth;
    return rect.bottom > 0 && rect.right > 0 && rect.top < vh && rect.left < vw;
  }

  if (!("IntersectionObserver" in window)) {
    targets.forEach(reveal);
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        reveal(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });

  // Above-the-fold blocks (e.g. home therapies) often sit just inside the
  // observer's shrunk root and never fire until the user scrolls. Reveal any
  // still-hidden in-viewport targets shortly after load.
  window.setTimeout(function () {
    targets.forEach(function (el) {
      if (el.classList.contains("is-visible") || !isInViewport(el)) {
        return;
      }
      reveal(el);
      observer.unobserve(el);
    });
  }, 1000);
})();
