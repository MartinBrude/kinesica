/**
 * Interactive Personal Data Deletion Request handler.
 * Handles client-side validation and automated delivery via Web3Forms API.
 */
(function () {
  "use strict";

  function initPrivacyForm() {
    var form = document.querySelector(".privacy-request-form");
    if (!form) return;

    var submitBtn =
      form.querySelector('[data-action="submit-form"]') ||
      form.querySelector('button[type="submit"]') ||
      form.querySelector(".privacy-btn-primary");
    var alertBox = form.querySelector(".privacy-form-alert");

    var accessKey =
      form.getAttribute("data-access-key") ||
      (form.querySelector('[name="access_key"]')
        ? form.querySelector('[name="access_key"]').value
        : "6f3383f7-9d3c-4b37-88eb-b029427a6540");

    var pageLang = form.getAttribute("data-lang") || "es";

    var LABELS = {
      es: {
        subject: "[Kinésica] Solicitud de eliminación de datos personales",
        title: "SOLICITUD DE ELIMINACIÓN DE DATOS PERSONALES (Ley 25.326 / RGPD / LGPD)",
        name: "Nombre y apellido",
        email: "Correo electrónico",
        phone: "Teléfono / WhatsApp",
        scope: "Alcance de la eliminación solicitada",
        details: "Detalles adicionales",
        notProvided: "No especificado",
        statement:
          "Por la presente solicito formalmente la eliminación y supresión definitiva de cualquier dato personal referido a mi persona en sus bases de contacto, agendas y registros de mensajería.",
        validationErr:
          "Por favor, ingresa al menos tu nombre y un correo electrónico o teléfono para procesar la solicitud.",
        sending: "Enviando solicitud...",
        success:
          "¡Solicitud enviada con éxito! Nos pondremos en contacto a la brevedad dentro del plazo legal.",
        error:
          "Ocurrió un error al enviar la solicitud. Por favor intenta nuevamente o contáctanos por correo.",
      },
      en: {
        subject: "[Kinésica] Personal Data Deletion Request",
        title: "PERSONAL DATA DELETION REQUEST (GDPR / LGPD / Law 25,326)",
        name: "Full Name",
        email: "Email address",
        phone: "Phone / WhatsApp",
        scope: "Scope of requested deletion",
        details: "Additional details",
        notProvided: "Not specified",
        statement:
          "I hereby formally request the permanent erasure and deletion of any personal data relating to me from your contact databases, appointment logs, and messaging channels.",
        validationErr:
          "Please enter at least your name and an email address or phone number to process the request.",
        sending: "Sending request...",
        success:
          "Request submitted successfully! We will get in touch with you within the legal timeframe.",
        error:
          "An error occurred while sending the request. Please try again or contact us directly.",
      },
      fr: {
        subject: "[Kinésica] Demande de suppression des données personnelles",
        title: "DEMANDE DE SUPPRESSION DE DONNÉES PERSONNELLES (RGPD / Loi 25.326 / LGPD)",
        name: "Nom et prénom",
        email: "Courrier électronique",
        phone: "Téléphone / WhatsApp",
        scope: "Portée de la suppression demandée",
        details: "Détails complémentaires",
        notProvided: "Non précisé",
        statement:
          "Par la presente, je demande formellement l'effacement définitif de toute donnée personnelle me concernant de vos bases de contact, carnets d'adresses et messageries.",
        validationErr:
          "Veuillez renseigner au minimum votre nom et une adresse e-mail ou un numéro de téléphone.",
        sending: "Envoi en cours...",
        success:
          "Votre demande a été envoyée avec succès ! Nous vous répondrons dans le délai légal.",
        error:
          "Une erreur est survenue lors de l'envoi. Veuillez réessayer ou nous contacter directement.",
      },
      pt: {
        subject: "[Kinésica] Solicitação de exclusão de dados pessoais",
        title: "SOLICITAÇÃO DE EXCLUSÃO DE DADOS PESSOAIS (LGPD / RGPD / Lei 25.326)",
        name: "Nome completo",
        email: "Correio eletrônico",
        phone: "Telefone / WhatsApp",
        scope: "Escopo da exclusão solicitada",
        details: "Detalhes adicionais",
        notProvided: "Não informado",
        statement:
          "Venho por meio desta solicitar formalmente a eliminação definitiva de qualquer dado pessoal referente à minha pessoa de suas bases de contato, agendas e registros de mensagens.",
        validationErr:
          "Por favor, preencha ao menos seu nome e um e-mail ou telefone para processar a solicitação.",
        sending: "Enviando solicitação...",
        success:
          "Solicitação enviada com sucesso! Entraremos em contato dentro do prazo legal.",
        error:
          "Ocorreu um erro ao enviar a solicitação. Por favor tente novamente ou entre em contato diretamente.",
      },
    };

    var t = LABELS[pageLang] || LABELS.es;
    var initialBtnHtml = submitBtn ? submitBtn.innerHTML : "";

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className =
        "privacy-form-alert alert " + (isError ? "alert-danger" : "alert-success");
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
      var nameInput = form.querySelector('[name="name"]');
      var emailInput = form.querySelector('[name="email"]');
      var phoneInput = form.querySelector('[name="phone"]');
      var scopeSelect = form.querySelector('[name="scope"]');
      var detailsInput = form.querySelector('[name="details"]');

      var nameVal = nameInput ? nameInput.value.trim() : "";
      var emailVal = emailInput ? emailInput.value.trim() : "";
      var phoneVal = phoneInput ? phoneInput.value.trim() : "";
      var scopeVal = "";
      if (scopeSelect && scopeSelect.selectedIndex >= 0) {
        scopeVal = scopeSelect.options[scopeSelect.selectedIndex].text;
      }
      var detailsVal = detailsInput ? detailsInput.value.trim() : "";

      return {
        name: nameVal,
        email: emailVal,
        phone: phoneVal,
        scope: scopeVal,
        details: detailsVal,
      };
    }

    function validate(data) {
      if (!data.name || (!data.email && !data.phone)) {
        showAlert(t.validationErr, true);
        return false;
      }
      return true;
    }

    function buildFormattedText(data) {
      var lines = [
        t.title,
        "--------------------------------------------------",
        t.name + ": " + (data.name || t.notProvided),
        t.email + ": " + (data.email || t.notProvided),
        t.phone + ": " + (data.phone || t.notProvided),
        t.scope + ": " + (data.scope || t.notProvided),
        "",
        t.details + ":",
        data.details || t.notProvided,
        "",
        t.statement,
        "--------------------------------------------------",
        "Fecha / Date: " + new Date().toLocaleDateString(),
      ];
      return lines.join("\n");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideAlert();

      var data = getFormData();
      if (!validate(data)) return;

      var botcheck = form.querySelector('[name="botcheck"]');
      if (botcheck && botcheck.checked) return;

      setLoading(true);

      var formattedMessage = buildFormattedText(data);
      var payload = {
        access_key: accessKey,
        subject: t.subject + " - " + data.name,
        from_name: "Kinésica Web",
        name: data.name,
        email: data.email || "no-reply@kinesica.com.ar",
        phone: data.phone || t.notProvided,
        scope: data.scope || t.notProvided,
        details: data.details || t.notProvided,
        message: formattedMessage,
      };

      fetch("https://api.web3forms.com/submit", {
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
            showAlert(t.success, false);
            form.reset();
          } else {
            var errMsg =
              (result.data && result.data.message) || t.error;
            showAlert(errMsg, true);
          }
        })
        .catch(function () {
          setLoading(false);
          showAlert(t.error, true);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrivacyForm);
  } else {
    initPrivacyForm();
  }
})();
