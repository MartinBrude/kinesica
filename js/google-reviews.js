/**
 * Google review cards — static partial (build) or live Places API (browser + site-secrets.js).
 */
(function () {
  "use strict";

  var MAX_REVIEWS = 5;
  var FETCH_TIMEOUT_MS = 15000;

  var COPY = {
    es: {
      eyebrow: "Opiniones",
      title: "Lo que dicen nuestros pacientes",
      seeAll: "Ver más reseñas en Google",
      writeReview: "Dejar una reseña",
      attribution: "Reseñas de Google",
      countOne: " reseña",
      countMany: " reseñas",
    },
    en: {
      eyebrow: "Reviews",
      title: "What our patients say",
      seeAll: "See more Google reviews",
      writeReview: "Leave a review",
      attribution: "Reviews from Google",
      countOne: " review",
      countMany: " reviews",
    },
    fr: {
      eyebrow: "Avis",
      title: "Ce que disent nos patients",
      seeAll: "Voir plus d'avis Google",
      writeReview: "Laisser un avis",
      attribution: "Avis Google",
      countOne: " avis",
      countMany: " avis",
    },
    pt: {
      eyebrow: "Avaliações",
      title: "O que dizem nossos pacientes",
      seeAll: "Ver mais avaliações no Google",
      writeReview: "Deixar uma avaliação",
      attribution: "Avaliações do Google",
      countOne: " avaliação",
      countMany: " avaliações",
    },
  };

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

  function siteConfig() {
    return window.KINESICA_SITE || {};
  }

  function mapsApiKey() {
    var secrets = window.KINESICA_SITE_SECRETS || {};
    var cfg = siteConfig();
    return secrets.googlePlacesApiKey || cfg.googlePlacesApiKey || null;
  }

  function placeId() {
    var cfg = siteConfig();
    var data = window.KINESICA_GOOGLE_REVIEWS || {};
    return cfg.googlePlaceId || data.placeId || "ChIJZ2mPW9K1vJUR3J5kGRi5gws";
  }

  function staticPayload() {
    var data = window.KINESICA_GOOGLE_REVIEWS;
    if (!data || !data.reviews || !data.reviews.length) return null;
    return data;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        reject(new Error("timeout"));
      }, ms);
      promise.then(
        function (value) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        },
        function (err) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  function loadPlacesLibrary() {
    return new Promise(function (resolve, reject) {
      function importPlaces() {
        window.google.maps.importLibrary("places").then(resolve).catch(reject);
      }

      if (window.google && window.google.maps && window.google.maps.importLibrary) {
        importPlaces();
        return;
      }

      var key = mapsApiKey();
      if (!key) {
        reject(new Error("missing googlePlacesApiKey"));
        return;
      }

      var script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(key) +
        "&libraries=places&loading=async";
      script.async = true;
      script.onerror = function () {
        reject(new Error("maps js load error"));
      };
      document.head.appendChild(script);

      var start = Date.now();
      (function poll() {
        if (window.google && window.google.maps && window.google.maps.importLibrary) {
          importPlaces();
          return;
        }
        if (Date.now() - start > FETCH_TIMEOUT_MS) {
          reject(new Error("maps importLibrary timeout"));
          return;
        }
        setTimeout(poll, 80);
      })();
    });
  }

  function normalizeReview(review) {
    var text =
      typeof review.text === "string"
        ? review.text
        : review.text && review.text.text
          ? review.text.text
          : "";
    var author = review.authorAttribution || review.author_name || {};
    return {
      author: author.displayName || review.author || author.author_name || "Google user",
      authorPhoto:
        author.photoURI || author.photoUri || review.authorPhoto || review.profile_photo_url || null,
      rating: review.rating ?? null,
      text: String(text).trim(),
      relativeTime:
        review.relativePublishTimeDescription ||
        review.relative_time_description ||
        review.relativeTime ||
        "",
    };
  }

  function pickReviews(reviews) {
    return reviews
      .filter(function (r) {
        return r.text;
      })
      .sort(function (a, b) {
        var ratingA = Number(a.rating) || 0;
        var ratingB = Number(b.rating) || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return b.text.length - a.text.length;
      })
      .slice(0, MAX_REVIEWS);
  }

  function fetchLiveReviews() {
    return loadPlacesLibrary().then(function (places) {
      var Place = places.Place;
      if (!Place) {
        throw new Error("places library missing Place");
      }
      var place = new Place({ id: placeId() });
      return place
        .fetchFields({
          fields: ["reviews", "rating", "userRatingCount", "displayName"],
        })
        .then(function () {
          var reviews = pickReviews(
            (place.reviews || []).map(normalizeReview),
          );
          return {
            placeId: placeId(),
            rating: place.rating ?? null,
            userRatingCount: place.userRatingCount ?? null,
            reviews: reviews,
          };
        });
    });
  }

  function renderSummary(container, data, copy) {
    if (data.rating == null) return;
    var count = data.userRatingCount;
    var countLabel = "";
    if (count != null) {
      countLabel =
        " · " + count + (count === 1 ? copy.countOne : copy.countMany);
    }

    var summary = document.createElement("p");
    summary.className = "google-reviews-summary";
    summary.innerHTML =
      '<span class="google-reviews-summary-score">' +
      esc(String(data.rating)) +
      "</span>" +
      stars(data.rating) +
      '<span class="google-reviews-summary-count">' +
      esc(countLabel) +
      "</span>";
    container.appendChild(summary);
  }

  function renderCard(review) {
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
    if (review.relativeTime) {
      ratingRow.innerHTML +=
        '<span class="google-review-time">' +
        esc(review.relativeTime) +
        "</span>";
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

  function fillActions(section, copy) {
    var cfg = siteConfig();
    var seeAllUrl = cfg.googleReviewsListUrl || "#";
    var writeUrl = cfg.googleReviewUrl || seeAllUrl;

    var seeAll = section.querySelector(".google-reviews-see-all");
    if (seeAll) {
      seeAll.textContent = copy.seeAll;
      seeAll.href = seeAllUrl;
    }

    var write = section.querySelector(".google-reviews-write");
    if (write) {
      write.textContent = copy.writeReview;
      write.href = writeUrl;
    }

    var attr = section.querySelector(".google-reviews-attribution");
    if (attr) attr.textContent = copy.attribution;
  }

  function showLoading(grid) {
    grid.innerHTML = "";
    grid.classList.add("google-reviews-grid--loading");
    for (var i = 0; i < 3; i++) {
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
    var wrap = section.closest(".google-reviews-wrap");
    if (wrap) wrap.hidden = true;
    else section.hidden = true;
  }

  function renderReviews(section, grid, data, copy) {
    section.setAttribute("lang", copy.langAttr);
    section.hidden = false;
    var wrap = section.closest(".google-reviews-wrap");
    if (wrap) wrap.hidden = false;

    var titleEl = section.querySelector(".google-reviews-title");
    var eyebrowEl = section.querySelector(".google-reviews-eyebrow");
    if (titleEl) titleEl.textContent = copy.title;
    if (eyebrowEl) eyebrowEl.textContent = copy.eyebrow;

    var header = section.querySelector(".google-reviews-header");
    if (header) {
      var oldSummary = header.querySelector(".google-reviews-summary");
      if (oldSummary) oldSummary.remove();
      renderSummary(header, data, copy);
    }

    clearLoading(grid);
    data.reviews.forEach(function (review) {
      grid.appendChild(renderCard(review));
    });

    fillActions(section, copy);
  }

  function resolveData() {
    var staticData = staticPayload();
    if (staticData) return Promise.resolve(staticData);
    if (!mapsApiKey()) return Promise.resolve(null);
    return withTimeout(fetchLiveReviews(), FETCH_TIMEOUT_MS).catch(function () {
      return null;
    });
  }

  function init() {
    var section = document.getElementById("google-reviews-section");
    var grid = document.getElementById("google-reviews-grid");
    if (!section || !grid) return;

    var lang = section.getAttribute("data-reviews-lang") || "es";
    var copy = COPY[lang] || COPY.es;
    copy.langAttr = lang === "es" ? "es-AR" : lang;

    var hasStatic = !!staticPayload();
    if (!hasStatic && mapsApiKey()) {
      showLoading(grid);
      section.hidden = false;
      var wrap = section.closest(".google-reviews-wrap");
      if (wrap) wrap.hidden = false;
    }

    resolveData().then(function (data) {
      if (data && data.reviews && data.reviews.length) {
        renderReviews(section, grid, data, copy);
        return;
      }
      hideSection(section);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
