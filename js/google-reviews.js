/**
 * Google review cards — DOM rendering & lifecycle (data helpers in google-reviews-data-helpers.js).
 */
(function () {
  "use strict";

  var DISPLAY_REVIEWS = 3;

  function esc(text) {
    var d = document.createElement("div");
    d.textContent = text == null ? "" : String(text);
    return d.innerHTML;
  }

  function stars(rating) {
    var n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    var html = "";
    for (var i = 1; i <= 5; i++) {
      html +=
        '<span class="google-review-star' +
        (i <= n ? " google-review-star--on" : "") +
        '" aria-hidden="true"><i class="fa fa-star"></i></span>';
    }
    return html;
  }

  function renderCard(review, lang, helpers) {
    var card = document.createElement("article");
    card.className = "google-review-card";

    var head = document.createElement("header");
    head.className = "google-review-card-head";

    if (review.authorPhoto) {
      var img = document.createElement("img");
      img.className = "google-review-avatar";
      img.src = review.authorPhoto;
      img.alt = "";
      img.width = 40;
      img.height = 40;
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      head.appendChild(img);
    }

    var meta = document.createElement("div");
    meta.className = "google-review-meta";
    var author = document.createElement("p");
    author.className = "google-review-author";
    author.textContent = review.author;
    meta.appendChild(author);

    var ratingRow = document.createElement("p");
    ratingRow.className = "google-review-rating";
    ratingRow.innerHTML = stars(review.rating);
    var timeLabel = helpers.reviewTimeLabel(review, lang);
    if (timeLabel) {
      ratingRow.innerHTML += '<span class="google-review-time">' + esc(timeLabel) + "</span>";
    }
    meta.appendChild(ratingRow);
    head.appendChild(meta);
    card.appendChild(head);

    var body = document.createElement("p");
    body.className = "google-review-text";
    body.textContent = review.text;
    card.appendChild(body);

    return card;
  }

  function showLoading(grid) {
    grid.innerHTML = "";
    grid.classList.add("google-reviews-grid--loading");
    var count = window.matchMedia("(min-width: 768px)").matches ? DISPLAY_REVIEWS : 1;
    for (var i = 0; i < count; i++) {
      var sk = document.createElement("div");
      sk.className = "google-review-card google-review-card--skeleton";
      sk.setAttribute("aria-hidden", "true");
      grid.appendChild(sk);
    }
  }

  function clearLoading(grid) {
    grid.classList.remove("google-reviews-grid--loading");
    grid.innerHTML = "";
  }

  function hideSection(section) {
    var aside = section.closest(".map-reviews-aside");
    if (aside) aside.hidden = true;
    else {
      var wrap = section.closest(".google-reviews-wrap");
      if (wrap) wrap.hidden = true;
      else section.hidden = true;
    }
  }

  function showSection(section) {
    var aside = section.closest(".map-reviews-aside");
    if (aside) aside.hidden = false;
    section.hidden = false;
    var wrap = section.closest(".google-reviews-wrap");
    if (wrap) wrap.hidden = false;
  }

  function renderReviews(section, grid, data, copy, helpers) {
    section.setAttribute("lang", copy.langAttr);
    showSection(section);

    var summarySlot = section.querySelector(".google-reviews-summary-slot");
    if (summarySlot) summarySlot.remove();

    clearLoading(grid);
    data.reviews.slice(0, DISPLAY_REVIEWS).forEach(function (review) {
      grid.appendChild(renderCard(review, copy.lang || "es", helpers));
    });
  }

  function init() {
    var helpers = window.KinesicaGoogleReviewsData;
    var section = document.getElementById("google-reviews-section");
    var grid = document.getElementById("google-reviews-grid");
    if (!helpers || !section || !grid) return;

    var lang = section.getAttribute("data-reviews-lang") || "es";
    var copy = { lang: lang, langAttr: lang === "es" ? "es-AR" : lang };

    var hasStatic = !!helpers.staticPayload(lang);
    if (!hasStatic && helpers.mapsApiKey() && grid.children.length === 0) {
      showLoading(grid);
      showSection(section);
    }

    helpers.resolveData(lang).then(function (data) {
      if (data && data.reviews && data.reviews.length) {
        renderReviews(section, grid, data, copy, helpers);
        return;
      }
      if (grid.children.length === 0) hideSection(section);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
