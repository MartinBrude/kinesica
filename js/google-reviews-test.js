/**
 * Standalone prod test for Google Places reviews (test.html).
 */
(function () {
  "use strict";

  var PLACE_ID = "ChIJZ2mPW9K1vJUR3J5kGRi5gws";
  var STEP_TIMEOUT_MS = 12000;

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

  function withTimeout(promise, ms, label) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) {
        setTimeout(function () {
          reject(new Error((label || "operación") + " — timeout " + ms + "ms"));
        }, ms);
      }),
    ]);
  }

  function probeRestApi(key) {
    return fetch(
      "https://places.googleapis.com/v1/places/" + encodeURIComponent(PLACE_ID),
      {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "reviews,rating,userRatingCount,displayName",
        },
      },
    ).then(function (res) {
      return res.json().then(function (body) {
        return { status: res.status, body: body };
      });
    });
  }

  function waitForImportLibrary() {
    return new Promise(function (resolve, reject) {
      var start = Date.now();
      (function poll() {
        if (window.google && window.google.maps && window.google.maps.importLibrary) {
          resolve();
          return;
        }
        if (Date.now() - start > STEP_TIMEOUT_MS) {
          reject(new Error("google.maps.importLibrary no disponible"));
          return;
        }
        setTimeout(poll, 80);
      })();
    });
  }

  function loadMaps(key) {
    if (window.google && window.google.maps && window.google.maps.importLibrary) {
      log("Maps JS ya cargado.", "ok");
      return waitForImportLibrary().then(function () {
        return google.maps.importLibrary("places");
      });
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        encodeURIComponent(key) +
        "&libraries=places&loading=async";
      script.async = true;
      script.onerror = function () {
        reject(new Error("No se pudo cargar el script de Maps JS"));
      };
      document.head.appendChild(script);

      waitForImportLibrary()
        .then(function () {
          return google.maps.importLibrary("places");
        })
        .then(resolve)
        .catch(reject);
    });
  }

  function fetchLiveJs(key) {
    return loadMaps(key).then(function (lib) {
      if (!lib.Place) throw new Error("places.Place no disponible");
      log("Places library OK — fetchFields…", "ok");
      var place = new lib.Place({ id: PLACE_ID });
      return place
        .fetchFields({
          fields: ["reviews", "rating", "userRatingCount", "displayName"],
        })
        .then(function () {
          return {
            source: "Maps JS (Place)",
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

  function explainReferrerBlock(body) {
    var msg = body && body.error && body.error.message ? body.error.message : "";
    log("REST Places API: " + msg, "err");
    log(
      "Fix en Google Cloud → Credentials → tu key → HTTP referrers. Agregá EXACTO:",
      "warn",
    );
    log("  https://www.kinesica.com.ar/", "warn");
    log("  https://www.kinesica.com.ar/*", "warn");
    log("  https://kinesica.com.ar/*", "warn");
    log("APIs habilitadas: Places API (New) + Maps JavaScript API", "warn");
  }

  function run() {
    log("Origin: " + location.origin);
    log("URL: " + location.href);

    var staticData = window.KINESICA_GOOGLE_REVIEWS;
    if (staticData && staticData.reviews && staticData.reviews.length) {
      log("Partial estático: " + staticData.reviews.length + " reseña(s)", "ok");
      renderCards({
        source: "static partial",
        displayName: staticData.displayName,
        rating: staticData.rating,
        userRatingCount: staticData.userRatingCount,
        reviews: staticData.reviews,
      });
    } else {
      log("Partial estático vacío.", "warn");
    }

    var key = apiKey();
    if (!key) {
      log("Sin googlePlacesApiKey.", "err");
      setStatus("Falta API key", "err");
      return;
    }

    log("API key presente (" + key.slice(0, 8) + "…)", "ok");
    setStatus("Probando Places API…", "pending");

    withTimeout(probeRestApi(key), 8000, "REST probe")
      .then(function (rest) {
        if (rest.status === 200 && rest.body.reviews) {
          log("REST OK — " + rest.body.reviews.length + " reseña(s)", "ok");
          return {
            source: "REST Places API (New)",
            displayName: rest.body.displayName?.text,
            rating: rest.body.rating,
            userRatingCount: rest.body.userRatingCount,
            reviews: (rest.body.reviews || []).map(function (r) {
              return {
                author: r.authorAttribution?.displayName || "Google user",
                authorPhoto: r.authorAttribution?.photoUri || null,
                rating: r.rating,
                text: r.text?.text || "",
                relativeTime: r.relativePublishTimeDescription || "",
              };
            }),
          };
        }
        if (rest.status === 403) {
          explainReferrerBlock(rest.body);
        } else {
          log("REST HTTP " + rest.status, "warn");
        }
        log("Probando Maps JS Place.fetchFields…", "ok");
        return withTimeout(fetchLiveJs(key), STEP_TIMEOUT_MS, "Maps JS");
      })
      .then(function (data) {
        if (!data) return;
        var withText = (data.reviews || []).filter(function (r) {
          return r.text;
        });
        if (!withText.length) {
          log(
            "Respuesta vacía (0 reseñas). Revisá referrers y Places API (New).",
            "err",
          );
          setStatus("0 reseñas — revisar Google Cloud", "err");
          return;
        }
        log("OK — " + withText.length + " reseña(s) con texto", "ok");
        setStatus("OK — " + withText.length + " reseñas", "ok");
        renderCards(data);
      })
      .catch(function (err) {
        log("Error: " + (err.message || err), "err");
        setStatus("Error — ver log", "err");
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
