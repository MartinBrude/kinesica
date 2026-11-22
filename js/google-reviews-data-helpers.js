/**
 * Google review data helpers — static payload, live Places API fetch,
 * normalization, relative-time formatting, localization and sorting.
 */
(function () {
  "use strict";

  var MAX_REVIEWS = 5;
  var MIN_REVIEW_RATING = 4;
  var FETCH_TIMEOUT_MS = 15000;

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
    if (lang === "es" || lang === "fr" || lang === "pt") return lang;
    return "en";
  }

  function reviewsForLang(data, lang) {
    if (!data) return [];
    if (data.byLang && data.byLang[lang] && data.byLang[lang].length) return data.byLang[lang];
    if (lang === "es" && data.reviews && data.reviews.length) return data.reviews;
    return [];
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
    var text = typeof review.text === "string"
      ? review.text
      : (review.text && review.text.text ? review.text.text : "");
    var author = review.authorAttribution || review.author_name || {};
    return {
      author: author.displayName || review.author || author.author_name || "Google user",
      authorPhoto: author.photoURI || author.photoUri || review.authorPhoto || review.profile_photo_url || null,
      rating: review.rating ?? null,
      text: String(text).trim(),
      language:
        review.language ||
        (review.text && review.text.languageCode) ||
        (review.originalText && review.originalText.languageCode) ||
        null,
      publishTime: review.publishTime || null,
      relativeTime:
        review.relativePublishTimeDescription ||
        review.relative_time_description ||
        review.relativeTime ||
        "",
    };
  }

  function formatRelativeTime(publishTime, lang) {
    var then = Date.parse(publishTime);
    if (!Number.isFinite(then)) return "";
    var diffMs = then - Date.now();
    var abs = Math.abs(diffMs);
    var divisions = [
      { amount: 31536000000, unit: "year" },
      { amount: 2629800000, unit: "month" },
      { amount: 604800000, unit: "week" },
      { amount: 86400000, unit: "day" },
      { amount: 3600000, unit: "hour" },
      { amount: 60000, unit: "minute" },
      { amount: 1000, unit: "second" },
    ];
    var unit = "second";
    var value = 0;
    for (var i = 0; i < divisions.length; i++) {
      var d = divisions[i];
      if (abs >= d.amount || d.unit === "second") {
        unit = d.unit;
        value = Math.round(diffMs / d.amount);
        break;
      }
    }
    try {
      return new Intl.RelativeTimeFormat(placesLanguageCode(lang), { numeric: "always" }).format(value, unit);
    } catch {
      return "";
    }
  }

  function reviewTimeLabel(review, lang) {
    return formatRelativeTime(review.publishTime, lang) || review.relativeTime || "";
  }

  function reviewLanguage(review) {
    return String((review && review.language) || "").trim().toLowerCase().split("-")[0];
  }

  function reviewMatchesLang(review, lang) {
    if (!lang) return true;
    var code = reviewLanguage(review);
    return !code || code === lang;
  }

  function normalizeAuthorKey(name) {
    return String(name || "").trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  }

  function localizeReviews(reviews, lang, bodiesByAuthor) {
    var map = bodiesByAuthor || {};
    return (reviews || []).map(function (review) {
      if (!review || !lang || reviewMatchesLang(review, lang)) return review;
      var texts = map[normalizeAuthorKey(review.author)];
      var body = texts && texts[lang];
      return body ? Object.assign({}, review, { text: body, language: lang }) : review;
    });
  }

  function pickReviews(reviews) {
    return reviews
      .filter(function (r) { return r.text && Number(r.rating) >= MIN_REVIEW_RATING; })
      .sort(function (a, b) {
        var ratingA = Number(a.rating) || 0;
        var ratingB = Number(b.rating) || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        var timeA = a.publishTime ? Date.parse(a.publishTime) : 0;
        var timeB = b.publishTime ? Date.parse(b.publishTime) : 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.text.length - a.text.length;
      })
      .slice(0, MAX_REVIEWS);
  }

  function staticPayload(lang) {
    var data = window.KINESICA_GOOGLE_REVIEWS;
    var reviews = pickReviews(localizeReviews(reviewsForLang(data, lang), lang, data && data.translations));
    if (!reviews.length) return null;
    return {
      placeId: data.placeId,
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      reviews: reviews,
    };
  }

  function fetchLiveReviews(lang) {
    var key = mapsApiKey();
    if (!key) return Promise.reject(new Error("missing googlePlacesApiKey"));

    var code = placesLanguageCode(lang);
    return fetch(
      "https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId()) + "?languageCode=" + encodeURIComponent(code),
      { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "reviews,rating,userRatingCount,displayName" } },
    ).then(function (res) {
      return res.json().then(function (body) {
        if (!res.ok) throw new Error((body.error && body.error.message) || res.statusText || "places error");
        return {
          placeId: placeId(),
          rating: body.rating ?? null,
          userRatingCount: body.userRatingCount ?? null,
          reviews: pickReviews(
            localizeReviews((body.reviews || []).map(normalizeReview), lang, (window.KINESICA_GOOGLE_REVIEWS || {}).translations),
          ),
        };
      });
    });
  }

  function resolveData(lang) {
    var staticData = staticPayload(lang);
    if (staticData) return Promise.resolve(staticData);
    if (!mapsApiKey()) return Promise.resolve(null);
    return withTimeout(fetchLiveReviews(lang), FETCH_TIMEOUT_MS).catch(function () { return null; });
  }

  window.KinesicaGoogleReviewsData = {
    mapsApiKey: mapsApiKey,
    staticPayload: staticPayload,
    reviewTimeLabel: reviewTimeLabel,
    resolveData: resolveData,
  };
})();
