/**
 * Interactive Personal Data Deletion Request handler.
 * Handles client-side validation and mailto generation
 * for privacy/data deletion requests.
 */
(function () {
  "use strict";

  function initPrivacyForm() {
    var form = document.querySelector(".privacy-request-form");
    if (!form) return;

    var emailBtn = form.querySelector('[data-action="send-email"]');
    var alertBox = form.querySelector(".privacy-form-alert");

    var recipientEmail =
      form.getAttribute("data-email") ||
      (window.KINESICA_SITE &&
        window.KINESICA_SITE.contact &&
        window.KINESICA_SITE.contact.email) ||
      "";
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
        mailSuccess: "Se ha abierto tu cliente de correo con la solicitud pre-redactada.",
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
        mailSuccess: "Your email client has opened with the pre-formatted request.",
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
        mailSuccess: "Votre messagerie s'est ouverte avec la demande pré-remplie.",
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
        mailSuccess: "Seu aplicativo de e-mail foi aberto com a solicitação preenchida.",
      },
    };

    var t = LABELS[pageLang] || LABELS.es;

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className =
        "privacy-form-alert alert " + (isError ? "alert-danger" : "alert-success");
      alertBox.style.display = "block";
      alertBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

    if (emailBtn) {
      emailBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var data = getFormData();
        if (!validate(data)) return;

        var fullSubject = t.subject + " - " + data.name;
        var fullBody = buildFormattedText(data);
        var mailtoUri =
          "mailto:" +
          encodeURIComponent(recipientEmail) +
          "?subject=" +
          encodeURIComponent(fullSubject) +
          "&body=" +
          encodeURIComponent(fullBody);

        window.location.href = mailtoUri;
        showAlert(t.mailSuccess, false);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (emailBtn) {
        emailBtn.click();
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPrivacyForm);
  } else {
    initPrivacyForm();
  }
})();
