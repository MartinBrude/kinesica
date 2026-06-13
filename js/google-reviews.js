/**
 * Google review cards — static partial (by language) or live Places API REST.
 */
(function () {
  "use strict";

  var MAX_REVIEWS = 5;
  var DISPLAY_REVIEWS = 3;
  var FETCH_TIMEOUT_MS = 15000;

  var COPY = {
    es: {
      countOne: " reseña",
      countMany: " reseñas",
    },
    en: {
      countOne: " review",
      countMany: " reviews",
    },
    fr: {
      countOne: " avis",
      countMany: " avis",
    },
    pt: {
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

  function placesLanguageCode(lang) {
    if (lang === "es") return "es";
    if (lang === "fr") return "fr";
    if (lang === "pt") return "pt";
    return "en";
  }

  function reviewsForLang(data, lang) {
    if (!data) return [];
    if (data.byLang && data.byLang[lang] && data.byLang[lang].length) {
      return data.byLang[lang];
    }
    if (data.reviews && data.reviews.length) {
      return data.reviews;
    }
    return [];
  }

  function staticPayload(lang) {
    var data = window.KINESICA_GOOGLE_REVIEWS;
    var reviews = reviewsForLang(data, lang);
    if (!reviews.length) return null;
    return {
      placeId: data.placeId,
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      reviews: reviews,
    };
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
        author.photoURI ||
        author.photoUri ||
        review.authorPhoto ||
        review.profile_photo_url ||
        null,
      rating: review.rating ?? null,
      text: String(text).trim(),
      relativeTime:
        review.relativePublishTimeDescription ||
        review.relative_time_description ||
        review.relativeTime ||
        "",
    };
  }

  /** Keep in sync with scripts/google-reviews-pick.mjs */
  var BALANCE_PERM = {
    1: [0],
    2: [0, 1],
    3: [0, 2, 1],
    4: [0, 2, 3, 1],
    5: [0, 2, 4, 3, 1],
  };

  function balanceReviewOrder(picked) {
    var perm = BALANCE_PERM[picked.length];
    if (!perm) return picked;
    return perm.map(function (i) {
      return picked[i];
    });
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

  function fetchLiveReviews(lang) {
    var key = mapsApiKey();
    if (!key) return Promise.reject(new Error("missing googlePlacesApiKey"));

    var code = placesLanguageCode(lang);
    return fetch(
      "https://places.googleapis.com/v1/places/" +
        encodeURIComponent(placeId()) +
        "?languageCode=" +
        encodeURIComponent(code),
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "reviews,rating,userRatingCount,displayName",
        },
      },
    ).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) {
          throw new Error(body.error?.message || res.statusText || "places error");
        }
        return {
          placeId: placeId(),
          rating: body.rating ?? null,
          userRatingCount: body.userRatingCount ?? null,
          reviews: pickReviews((body.reviews || []).map(normalizeReview)),
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

  function showLoading(grid) {
    grid.innerHTML = "";
    grid.classList.add("google-reviews-grid--loading");
    var count = window.matchMedia("(min-width: 992px)").matches
      ? DISPLAY_REVIEWS
      : 1;
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

  function renderReviews(section, grid, data, copy) {
    section.setAttribute("lang", copy.langAttr);
    showSection(section);

    var summarySlot = section.querySelector(".google-reviews-summary-slot");
    if (summarySlot) {
      summarySlot.innerHTML = "";
      renderSummary(summarySlot, data, copy);
    }

    clearLoading(grid);
    balanceReviewOrder(data.reviews)
      .slice(0, DISPLAY_REVIEWS)
      .forEach(function (review) {
        grid.appendChild(renderCard(review));
      });
  }

  function resolveData(lang) {
    var staticData = staticPayload(lang);
    if (staticData) return Promise.resolve(staticData);
    if (!mapsApiKey()) return Promise.resolve(null);
    return withTimeout(fetchLiveReviews(lang), FETCH_TIMEOUT_MS).catch(function () {
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

    var hasStatic = !!staticPayload(lang);
    if (!hasStatic && mapsApiKey()) {
      showLoading(grid);
      showSection(section);
    }

    resolveData(lang).then(function (data) {
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
