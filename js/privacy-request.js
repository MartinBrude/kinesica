/**
 * Interactive Personal Data Deletion Request handler.
 * Handles client-side validation, mailto generation, WhatsApp forwarding,
 * and copy-to-clipboard for privacy/data deletion requests.
 */
(function () {
  "use strict";

  function initPrivacyForm() {
    var form = document.querySelector(".privacy-request-form");
    if (!form) return;

    var emailBtn = form.querySelector('[data-action="send-email"]');
    var waBtn = form.querySelector('[data-action="send-whatsapp"]');
    var copyBtn = form.querySelector('[data-action="copy-text"]');
    var alertBox = form.querySelector(".privacy-form-alert");

    var recipientEmail =
      form.getAttribute("data-email") ||
      (window.KINESICA_SITE &&
        window.KINESICA_SITE.contact &&
        window.KINESICA_SITE.contact.email) ||
      "";
    var whatsappDigits =
      form.getAttribute("data-whatsapp") ||
      (window.KINESICA_SITE &&
        window.KINESICA_SITE.contact &&
        window.KINESICA_SITE.contact.whatsappDigits) ||
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
        copiedSuccess: "¡Texto de la solicitud copiado al portapapeles con éxito!",
        copiedError: "No se pudo copiar automáticamente al portapapeles.",
        mailSuccess: "Se ha abierto tu cliente de correo con la solicitud pre-redactada.",
        waSuccess: "Se ha abierto WhatsApp con la solicitud pre-redactada.",
        waIntro: "Hola Kinésica, deseo solicitar la eliminación de mis datos personales:",
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
        copiedSuccess: "Request text copied to clipboard successfully!",
        copiedError: "Could not copy to clipboard automatically.",
        mailSuccess: "Your email client has opened with the pre-formatted request.",
        waSuccess: "WhatsApp has opened with the pre-formatted request.",
        waIntro: "Hello Kinésica, I would like to formally request the erasure of my personal data:",
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
        copiedSuccess: "Texte de la demande copié dans le presse-papiers !",
        copiedError: "Impossible de copier automatiquement dans le presse-papiers.",
        mailSuccess: "Votre messagerie s'est ouverte avec la demande pré-remplie.",
        waSuccess: "WhatsApp s'est ouvert avec la demande pré-remplie.",
        waIntro: "Bonjour Kinésica, je souhaite demander la suppression de mes données personnelles :",
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
        copiedSuccess: "Texto da solicitação copiado com sucesso!",
        copiedError: "Não foi possível copiar automaticamente para a área de transferência.",
        mailSuccess: "Seu aplicativo de e-mail foi aberto com a solicitação preenchida.",
        waSuccess: "O WhatsApp foi aberto com a solicitação preenchida.",
        waIntro: "Olá Kinésica, gostaria de solicitar a eliminação dos meus dados pessoais:",
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

    function buildWhatsAppText(data) {
      var lines = [
        t.waIntro,
        "• " + t.name + ": " + data.name,
        "• " + t.email + ": " + (data.email || t.notProvided),
        "• " + t.phone + ": " + (data.phone || t.notProvided),
        "• " + t.scope + ": " + data.scope,
      ];
      if (data.details) {
        lines.push("• " + t.details + ": " + data.details);
      }
      lines.push("");
      lines.push(t.statement);
      return lines.join("\n");
    }

    function copyToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      return new Promise(function (resolve, reject) {
        try {
          var textArea = document.createElement("textarea");
          textArea.value = text;
          textArea.style.position = "fixed";
          textArea.style.left = "-9999px";
          textArea.style.top = "-9999px";
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          var ok = document.execCommand("copy");
          document.body.removeChild(textArea);
          if (ok) resolve();
          else reject(new Error("execCommand copy failed"));
        } catch (err) {
          reject(err);
        }
      });
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

    if (waBtn) {
      waBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var data = getFormData();
        if (!validate(data)) return;

        var waText = buildWhatsAppText(data);
        var waUri =
          "https://wa.me/" +
          whatsappDigits.replace(/\D/g, "") +
          "?text=" +
          encodeURIComponent(waText);

        window.open(waUri, "_blank", "noopener,noreferrer");
        showAlert(t.waSuccess, false);
      });
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function (e) {
        e.preventDefault();
        var data = getFormData();
        if (!validate(data)) return;

        var fullText = buildFormattedText(data);
        copyToClipboard(fullText)
          .then(function () {
            showAlert(t.copiedSuccess, false);
          })
          .catch(function () {
            showAlert(t.copiedError || "Error al copiar", true);
          });
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
