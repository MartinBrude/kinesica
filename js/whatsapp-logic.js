function kinesicaApplyWhatsAppContact() {
  var contactData = {
    whatsapp: "5491161564311",
    whatsappText: "+54 (11) 6156-4311",
  };

  function setupLinks(selector, urlBase, phone) {
    var sanitized = String(phone).replace(/\D/g, "");
    document.querySelectorAll(selector).forEach(function (el) {
      el.href = urlBase + sanitized;
    });
  }

  setupLinks(
    ".dynamic-whatsapp-link, .dynamic-whatsapp-url, #whatsapp-link",
    "https://wa.me/",
    contactData.whatsapp
  );
  setupLinks(".dynamic-telegram-link", "https://t.me/+", contactData.whatsapp);

  document.querySelectorAll(".dynamic-tel-link").forEach(function (el) {
    el.href = "tel:+" + String(contactData.whatsapp).replace(/\D/g, "");
  });

  document.querySelectorAll(".dynamic-whatsapp-text, .dynamic-phone-text").forEach(function (el) {
    el.textContent = contactData.whatsappText;
  });
}

window.kinesicaApplyWhatsAppContact = kinesicaApplyWhatsAppContact;
document.addEventListener("DOMContentLoaded", kinesicaApplyWhatsAppContact);
