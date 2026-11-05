/**
 * Manejo interactivo de la Encuesta de Satisfacción Anónima (/encuesta.html).
 * Envía la respuesta anónima a /api/send-contact.php (guarda en Admin y envía correo a Norberto).
 */
(function () {
  "use strict";

  var COPY = {
    es: {
      sending: "Enviando respuesta...",
      validationErr:
        "Por favor, seleccioná cómo ha sido tu experiencia, cómo te resulta el tratamiento y si nos recomendarías antes de enviar.",
      errorMsg:
        "Ocurrió un error al enviar tu respuesta. Por favor intentá nuevamente en unos instantes.",
    },
    en: {
      sending: "Sending response...",
      validationErr:
        "Please select your overall rating, how your treatment is going, and whether you would recommend us before submitting.",
      errorMsg:
        "An error occurred while sending your feedback. Please try again in a moment.",
    },
    fr: {
      sending: "Envoi en cours...",
      validationErr:
        "Veuillez indiquer votre note globale, l'évolution de votre suivi et si vous nous recommanderiez avant d'envoyer.",
      errorMsg:
        "Une erreur est survenue lors de l'envoi. Veuillez réessayer dans quelques instants.",
    },
    pt: {
      sending: "Enviando resposta...",
      validationErr:
        "Por favor, selecione sua avaliação geral, como está sendo o tratamento e se você nos recomendaria antes de enviar.",
      errorMsg:
        "Ocorreu um erro ao enviar sua resposta. Por favor, tente novamente em alguns instantes.",
    },
  };

  function initEncuestaForm() {
    var form = document.querySelector(".encuesta-form");
    if (!form) return;

    var pageLang = form.getAttribute("data-lang") || "es";
    var t = COPY[pageLang] || COPY.es;

    var submitBtn =
      form.querySelector('[data-action="submit-encuesta"]') ||
      form.querySelector('button[type="submit"]');
    var alertBox = form.querySelector(".encuesta-form-alert");
    var thankYouBox = document.getElementById("encuesta-thankyou");
    var reviewInviteBox = document.getElementById("encuesta-review-invite");
    var resetBtn = document.getElementById("encuesta-reset-btn");
    var initialBtnHtml = submitBtn ? submitBtn.innerHTML : "";

    function syncVisualSelections() {
      var ratingInputs = form.querySelectorAll('input[name="experiencia"]');
      for (var i = 0; i < ratingInputs.length; i++) {
        var r = ratingInputs[i];
        var parent = r.closest(".encuesta-star-option");
        if (parent) {
          parent.classList.toggle("is-selected", r.checked);
        }
      }

      var treatInputs = form.querySelectorAll('input[name="tratamiento_resultado"]');
      for (var j = 0; j < treatInputs.length; j++) {
        var tr = treatInputs[j];
        var trParent = tr.closest(".encuesta-choice-item");
        if (trParent) {
          trParent.classList.toggle("is-selected", tr.checked);
        }
      }

      var recInputs = form.querySelectorAll('input[name="recomendaria"]');
      for (var k = 0; k < recInputs.length; k++) {
        var rc = recInputs[k];
        var rcParent = rc.closest(".encuesta-rec-pill");
        if (rcParent) {
          rcParent.classList.toggle("is-selected", rc.checked);
        }
      }
    }

    form.addEventListener("change", syncVisualSelections);

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className =
        "encuesta-form-alert privacy-form-alert alert " +
        (isError ? "alert-danger" : "alert-success");
      alertBox.style.display = "block";
      alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function hideAlert() {
      if (!alertBox) return;
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }

    function setLoading(isLoading) {
      if (!submitBtn) return;
      if (isLoading) {
        submitBtn.disabled = true;
        submitBtn.innerHTML =
          '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> ' + t.sending;
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = initialBtnHtml;
      }
    }

    function getFormData() {
      var expChecked = form.querySelector('input[name="experiencia"]:checked');
      var treatChecked = form.querySelector('input[name="tratamiento_resultado"]:checked');
      var recChecked = form.querySelector('input[name="recomendaria"]:checked');
      var comInput = form.querySelector('[name="comentarios"]');

      return {
        experiencia: expChecked ? parseInt(expChecked.value, 10) : 0,
        tratamiento_resultado: treatChecked ? treatChecked.value : "",
        tratamiento_label: treatChecked
          ? treatChecked.getAttribute("data-label") || treatChecked.value
          : "",
        recomendaria: recChecked ? recChecked.value : "",
        recomendaria_label: recChecked
          ? recChecked.getAttribute("data-label") || recChecked.value
          : "",
        comentarios: comInput ? comInput.value.trim() : "",
      };
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAlert();

      var data = getFormData();
      if (!data.experiencia || !data.tratamiento_resultado || !data.recomendaria) {
        showAlert(t.validationErr, true);
        return;
      }

      var botcheck = form.querySelector('[name="botcheck"]');
      if (botcheck && botcheck.checked) return;

      setLoading(true);

      var payload = {
        type: "encuesta",
        lang: pageLang,
        experiencia: data.experiencia,
        tratamiento_resultado: data.tratamiento_resultado,
        tratamiento_label: data.tratamiento_label,
        recomendaria: data.recomendaria,
        recomendaria_label: data.recomendaria_label,
        comentarios: data.comentarios,
      };

      fetch("/api/send-contact.php", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          return res.json().then(function (json) {
            return { ok: res.ok, status: res.status, data: json };
          });
        })
        .then(function (result) {
          setLoading(false);
          if (result.ok && result.data && result.data.success) {
            form.reset();
            syncVisualSelections();
            if (thankYouBox) {
              form.hidden = true;
              thankYouBox.hidden = false;
              if (reviewInviteBox) {
                var isPositive =
                  data.experiencia >= 4 || data.recomendaria === "si";
                reviewInviteBox.hidden = !isPositive;
              }
              thankYouBox.scrollIntoView({ behavior: "smooth", block: "center" });
            }
          } else {
            var errMsg =
              (result.status === 429 && result.data && result.data.error) ||
              t.errorMsg;
            showAlert(errMsg, true);
          }
        })
        .catch(function () {
          setLoading(false);
          showAlert(t.errorMsg, true);
        });
    });

    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        if (thankYouBox) thankYouBox.hidden = true;
        if (reviewInviteBox) reviewInviteBox.hidden = true;
        form.hidden = false;
        hideAlert();
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEncuestaForm);
  } else {
    initEncuestaForm();
  }
})();
