(function () {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  var targets = document.querySelectorAll(
    ".service-block, .section-title, .feature, .page-caption, .team-img",
  );
  if (!targets.length) {
    return;
  }

  targets.forEach(function (el) {
    el.classList.add("ui-reveal");
  });

  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) {
      el.classList.add("is-visible");
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );

  targets.forEach(function (el) {
    observer.observe(el);
  });
})();
