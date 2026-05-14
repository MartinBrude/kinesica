function kinesicaApplyWhatsAppContact() {
  const now = new Date();
  const year = now.getFullYear();

  // 5 de Abril al 4 de Mayo
  const isMariaPeriod = now >= new Date(year, 3, 5) && now <= new Date(year, 4, 4, 23, 59, 59);

  const contactData = {
    whatsapp: isMariaPeriod ? "5491128531224" : "5491161564311",
    whatsappText: isMariaPeriod ? "+54 (911) 2853-1224" : "+54 (11) 6156-4311",
    jsonLd: isMariaPeriod ? "+54 911 2853 1224" : "+54 11 6156 4311"
  };

  // Función simplificada: wa.me ya maneja la apertura de la app en móviles
  function setupLinks(selector, urlBase, phone) {
    const sanitized = String(phone).replace(/\D/g, "");
    document.querySelectorAll(selector).forEach(el => {
      el.href = `${urlBase}${sanitized}`;
      // Si realmente quieres el comportamiento de doble apertura, mantenlo,
      // pero wa.me es el estándar "limpio".
    });
  }

  // Ejecución de cambios
  setupLinks(".dynamic-whatsapp-link, #whatsapp-link", "https://wa.me/", contactData.whatsapp);
  setupLinks(".dynamic-telegram-link", "https://t.me/+", contactData.whatsapp); // Reutiliza número

  document.querySelectorAll(".dynamic-whatsapp-text, .dynamic-phone-text").forEach(el => {
    el.textContent = contactData.whatsappText;
  });

  // Actualizar Schema.org
  document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const data = JSON.parse(script.textContent);
      // Usamos optional chaining para evitar errores si la estructura no es la esperada
      if (data?.["@type"] === "MedicalClinic") {
        data.telephone = contactData.jsonLd;
        script.textContent = JSON.stringify(data);
      }
    } catch (e) { /* Silencioso */ }
  });
}

window.kinesicaApplyWhatsAppContact = kinesicaApplyWhatsAppContact;
document.addEventListener("DOMContentLoaded", kinesicaApplyWhatsAppContact);