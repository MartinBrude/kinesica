document.addEventListener("DOMContentLoaded", function () {
  const now = new Date();
  const year = now.getFullYear();

  // Rango: 5 de Abril al 4 de Mayo
  const startDate = new Date(year, 3, 5);
  const endDate = new Date(year, 4, 4, 23, 59, 59);

  const isMariaPeriod = now >= startDate && now <= endDate;

  // Configuración de datos según el periodo
  const contactData = {
    whatsapp: {
      num: isMariaPeriod ? "5492236807252" : "5491161564311",
      numShort: isMariaPeriod ? "542236807252" : "541161564311", // Sin el 9 adicional para algunos enlaces
      text: isMariaPeriod ? "+54 (223) 680-7252" : "+54 (11) 6156-4311",
      textShort: isMariaPeriod ? "+54 (223) 680-7252" : "+54 (11) 61564311", // Formato corto sin guiones
    },
    phone: {
      text: isMariaPeriod ? "+54 (223) 680-7252" : "+54 (11) 6156-4311",
      textShort: isMariaPeriod ? "+54 (223) 680-7252" : "+54 (11) 61564311",
      jsonLd: isMariaPeriod ? "+54 223 680 7252" : "+54 11 6156 4311",
    },
    telegram: {
      // Asumiendo que el Telegram de María es el mismo número
      // Si el de ella es distinto, cámbialo aquí:
      num: isMariaPeriod ? "5492236807252" : "541131814589",
      text: isMariaPeriod ? "+54 (223) 680-7252" : "+54 (11) 3181-4589",
    },
  };

  // --- Lógica de actualización ---

  // 1. Botón flotante de WhatsApp
  // Usamos querySelector para seleccionar el botón flotante (puede ser por ID o por clase)
  // Esto es más seguro que getElementById si hay algún duplicado accidental
  const floatLink = document.querySelector(
    "#whatsapp-link, .whatsapp-float:not(.dynamic-whatsapp-link):not(.dynamic-whatsapp-url)",
  );
  if (floatLink) floatLink.href = "https://wa.me/" + contactData.whatsapp.num;

  // 2. Enlaces de WhatsApp (por Clase)
  document.querySelectorAll(".dynamic-whatsapp-link").forEach((el) => {
    el.href = "https://wa.me/" + contactData.whatsapp.num;
  });
  document.querySelectorAll(".dynamic-whatsapp-text").forEach((el) => {
    el.textContent = contactData.whatsapp.text;
  });

  // 2b. Enlaces de WhatsApp con URL hardcodeada (usando numShort para compatibilidad)
  document.querySelectorAll(".dynamic-whatsapp-url").forEach((el) => {
    el.href = "https://wa.me/" + contactData.whatsapp.numShort;
  });

  // 3. Números de teléfono en texto
  document.querySelectorAll(".dynamic-phone-text").forEach((el) => {
    el.textContent = contactData.phone.text;
  });
  document.querySelectorAll(".dynamic-phone-text-short").forEach((el) => {
    el.textContent = contactData.phone.textShort;
  });

  // 4. Actualizar JSON-LD (schema.org) para teléfono
  const jsonLdScripts = document.querySelectorAll(
    'script[type="application/ld+json"]',
  );
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent);
      if (data["@type"] === "MedicalClinic" && data.telephone) {
        data.telephone = contactData.phone.jsonLd;
        script.textContent = JSON.stringify(data);
      }
    } catch (e) {
      // Si no es JSON válido, ignorar
    }
  });

  // 5. Enlaces de Telegram (por Clase)
  document.querySelectorAll(".dynamic-telegram-link").forEach((el) => {
    // Telegram usa t.me/ seguido del número con código de país
    el.href = "https://t.me/+" + contactData.telegram.num;
  });
  document.querySelectorAll(".dynamic-telegram-text").forEach((el) => {
    el.textContent = contactData.telegram.text;
  });
});
