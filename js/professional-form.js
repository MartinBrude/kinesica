/**
 * Manejo interactivo del formulario de Red Profesional y Contacto Interdisciplinario.
 * Envía la consulta directamente a Norberto Brude vía la API de Web3Forms.
 */
(function () {
  "use strict";

  function initProfessionalForm() {
    var form = document.querySelector(".professional-contact-form");
    if (!form) return;

    var submitBtn =
      form.querySelector('[data-action="submit-form"]') ||
      form.querySelector('button[type="submit"]') ||
      form.querySelector(".btn-submit-professional");
    var alertBox = form.querySelector(".professional-form-alert");

    var accessKey =
      form.getAttribute("data-access-key") ||
      (form.querySelector('[name="access_key"]')
        ? form.querySelector('[name="access_key"]').value
        : "6f3383f7-9d3c-4b37-88eb-b029427a6540");

    var initialBtnHtml = submitBtn ? submitBtn.innerHTML : "";

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className =
        "professional-form-alert alert " + (isError ? "alert-danger" : "alert-success");
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
          '<i class="fa fa-spinner fa-spin" aria-hidden="true"></i> Enviando mensaje...';
      } else {
        submitBtn.disabled = false;
        submitBtn.innerHTML = initialBtnHtml;
      }
    }

    function getFormData() {
      var nameInput = form.querySelector('[name="name"]');
      var specialtyInput = form.querySelector('[name="specialty"]');
      var emailInput = form.querySelector('[name="email"]');
      var phoneInput = form.querySelector('[name="phone"]');
      var motiveSelect = form.querySelector('[name="motive"]');
      var messageInput = form.querySelector('[name="message"]');

      var motiveVal = "";
      if (motiveSelect && motiveSelect.selectedIndex >= 0) {
        motiveVal = motiveSelect.options[motiveSelect.selectedIndex].text;
      }

      return {
        name: nameInput ? nameInput.value.trim() : "",
        specialty: specialtyInput ? specialtyInput.value.trim() : "",
        email: emailInput ? emailInput.value.trim() : "",
        phone: phoneInput ? phoneInput.value.trim() : "",
        motive: motiveVal,
        message: messageInput ? messageInput.value.trim() : "",
      };
    }

    function validate(data) {
      if (!data.name || (!data.email && !data.phone)) {
        showAlert(
          "Por favor, ingresá al menos tu nombre y un correo electrónico o teléfono para ponernos en contacto.",
          true
        );
        return false;
      }
      return true;
    }

    function buildFormattedMessage(data) {
      var lines = [
        "CONTACTO DESDE LA RED PROFESIONAL DE KINÉSICA",
        "Destinatario: Norberto Silvio Brude <norberto1712@gmail.com>",
        "==================================================",
        "Profesional: " + data.name,
        "Especialidad / Rol: " + (data.specialty || "No especificada"),
        "Email: " + (data.email || "No especificado"),
        "Teléfono / WhatsApp: " + (data.phone || "No especificado"),
        "Motivo principal: " + (data.motive || "Consulta general"),
        "",
        "Mensaje o propuesta:",
        data.message || "(Sin mensaje adicional)",
        "==================================================",
        "Fecha: " + new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
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

      var formattedText = buildFormattedMessage(data);
      var payload = {
        access_key: accessKey,
        subject:
          "[Kinésica - Red Profesional] Contacto de: " +
          data.name +
          (data.specialty ? " (" + data.specialty + ")" : ""),
        from_name: "Kinésica Web (Red Profesional)",
        to_email: "norberto1712@gmail.com",
        to_name: "Norberto Silvio Brude",
        name: data.name,
        email: data.email || "no-reply@kinesica.com.ar",
        phone: data.phone || "No especificado",
        specialty: data.specialty || "No especificada",
        motive: data.motive || "Consulta",
        message: formattedText,
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
            showAlert(
              "¡Muchas gracias por comunicarte! El mensaje fue enviado con éxito a Norberto Silvio Brude (norberto1712@gmail.com). Nos pondremos en contacto a la brevedad.",
              false
            );
            form.reset();
          } else {
            var errMsg =
              (result.data && result.data.message) ||
              "Ocurrió un error al enviar el mensaje. Por favor intentá nuevamente o escribinos directamente por WhatsApp.";
            showAlert(errMsg, true);
          }
        })
        .catch(function () {
          setLoading(false);
          showAlert(
            "No se pudo conectar con el servidor. Por favor verificá tu conexión o contactanos directamente por WhatsApp.",
            true
          );
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initProfessionalForm);
  } else {
    initProfessionalForm();
  }
})();
