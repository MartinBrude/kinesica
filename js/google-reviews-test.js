/**
 * Standalone prod test for Google Places reviews (test.html).
 * Logs each step to #test-log and renders cards in #test-cards on success.
 */
(function () {
  "use strict";

  var PLACE_ID = "ChIJZ2mPW9K1vJUR3J5kGRi5gws";
  var TIMEOUT_MS = 20000;

  function log(msg, kind) {
    var el = document.getElementById("test-log");
    if (!el) return;
    var line = document.createElement("div");
    line.className = "test-log-line" + (kind ? " test-log-line--" + kind : "");
    line.textContent = new Date().toISOString().slice(11, 19) + " — " + msg;
    el.appendChild(line);
    el.scrollTop = el.scrollHeight;
  }

  function setStatus(text, kind) {
    var el = document.getElementById("test-status");
    if (!el) return;
    el.textContent = text;
    el.className = "test-status" + (kind ? " test-status--" + kind : "");
  }

  function apiKey() {
    var secrets = window.KINESICA_SITE_SECRETS || {};
    var cfg = window.KINESICA_SITE || {};
    return secrets.googlePlacesApiKey || cfg.googlePlacesApiKey || null;
  }

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
        '"><i class="fa fa-star"></i></span>';
    }
    return html;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        reject(new Error("timeout after " + ms + "ms"));
      }, ms);
      promise.then(
        function (v) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(v);
        },
        function (e) {
          if (done) return;
          done = true;
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  function loadMaps(key) {
    return new Promise(function (resolve, reject) {
      if (window.google && window.google.maps && window.google.maps.importLibrary) {
        window.google.maps.importLibrary("places").then(resolve).catch(reject);
        return;
      }
      var script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(key) +
        "&libraries=places&loading=async";
      script.async = true;
      script.onload = function () {
        if (!window.google || !window.google.maps) {
          reject(new Error("Maps JS loaded but google.maps missing"));
          return;
        }
        window.google.maps.importLibrary("places").then(resolve).catch(reject);
      };
      script.onerror = function () {
        reject(new Error("Failed to load Maps JS script"));
      };
      document.head.appendChild(script);
    });
  }

  function fetchLive(key) {
    return loadMaps(key).then(function (lib) {
      if (!lib.Place) throw new Error("places.Place not available");
      var place = new lib.Place({ id: PLACE_ID });
      return place
        .fetchFields({
          fields: ["reviews", "rating", "userRatingCount", "displayName"],
        })
        .then(function () {
          return {
            source: "live",
            displayName: place.displayName,
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            reviews: (place.reviews || []).map(function (r) {
              return {
                author: r.authorAttribution?.displayName || "Google user",
                authorPhoto: r.authorAttribution?.photoURI || null,
                rating: r.rating,
                text: r.text?.text || "",
                relativeTime: r.relativePublishTimeDescription || "",
              };
            }),
          };
        });
    });
  }

  function renderCards(data) {
    var grid = document.getElementById("test-cards");
    if (!grid) return;
    grid.innerHTML = "";

    var summary = document.createElement("p");
    summary.className = "test-cards-summary";
    summary.innerHTML =
      "<strong>" +
      esc(data.displayName || "Kinésica") +
      "</strong> · " +
      esc(String(data.rating ?? "?")) +
      " ★ · " +
      esc(String(data.userRatingCount ?? "?")) +
      " reseñas · fuente: " +
      esc(data.source);
    grid.appendChild(summary);

    (data.reviews || [])
      .filter(function (r) {
        return r.text;
      })
      .slice(0, 5)
      .forEach(function (review) {
        var card = document.createElement("article");
        card.className = "google-review-card";
        card.innerHTML =
          '<header class="google-review-card-head">' +
          (review.authorPhoto
            ? '<img class="google-review-avatar" src="' +
              esc(review.authorPhoto) +
              '" alt="" width="40" height="40" referrerpolicy="no-referrer">'
            : "") +
          '<div class="google-review-meta">' +
          '<p class="google-review-author">' +
          esc(review.author) +
          "</p>" +
          '<p class="google-review-rating">' +
          stars(review.rating) +
          (review.relativeTime
            ? '<span class="google-review-time">' +
              esc(review.relativeTime) +
              "</span>"
            : "") +
          "</p></div></header>" +
          '<p class="google-review-text">' +
          esc(review.text) +
          "</p>";
        grid.appendChild(card);
      });
  }

  function run() {
    log("Origin: " + location.origin);
    log("URL: " + location.href);
    log("Referrer enviado al cargar Maps: " + location.origin + "/");

    var staticData = window.KINESICA_GOOGLE_REVIEWS;
    if (staticData && staticData.reviews && staticData.reviews.length) {
      log(
        "Partial estático: " +
          staticData.reviews.length +
          " reseña(s), fetchedAt=" +
          (staticData.fetchedAt || "null"),
        "ok",
      );
      renderCards({
        source: "static partial",
        displayName: staticData.displayName,
        rating: staticData.rating,
        userRatingCount: staticData.userRatingCount,
        reviews: staticData.reviews,
      });
    } else {
      log("Partial estático vacío o sin reseñas.", "warn");
    }

    var key = apiKey();
    if (!key) {
      log("Sin googlePlacesApiKey en site-secrets.js — solo prueba estática.", "err");
      setStatus("Falta API key (js/site-secrets.js)", "err");
      return;
    }

    log("API key presente (" + key.slice(0, 8) + "…)", "ok");
    setStatus("Cargando Maps JS + Places API…", "pending");
    log("Iniciando fetch live (Places API New)…");

    withTimeout(fetchLive(key), TIMEOUT_MS)
      .then(function (data) {
        var withText = (data.reviews || []).filter(function (r) {
          return r.text;
        });
        log(
          "Live OK: " +
            withText.length +
            " reseña(s) con texto, rating=" +
            data.rating,
          "ok",
        );
        setStatus("OK — " + withText.length + " reseñas live", "ok");
        renderCards(data);
      })
      .catch(function (err) {
        var msg = err && err.message ? err.message : String(err);
        log("Live FALLÓ: " + msg, "err");
        setStatus("Bloqueado o error — ver log", "err");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
