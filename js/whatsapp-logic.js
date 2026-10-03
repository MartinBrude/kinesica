var mobileScrollBound = false;

function initWhatsAppMobileScroll() {
  var whatsappBtn = document.getElementById("whatsapp-link");
  if (!whatsappBtn) return;

  var isHome =
    (document.body && document.body.classList.contains("page-home")) ||
    Boolean(document.querySelector(".hero-actions"));
  if (!isHome) return;

  whatsappBtn.classList.add("whatsapp-float--hero-hide");

  if (mobileScrollBound) return;
  mobileScrollBound = true;

  var mobile = window.matchMedia("(max-width: 767px)");
  var SCROLL_THRESHOLD = 80;
  var isVisible = false;

  function updateScrollState() {
    if (!mobile.matches) {
      if (isVisible) {
        isVisible = false;
        whatsappBtn.classList.remove("is-visible");
      }
      return;
    }
    var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    var shouldBeVisible = scrollY > SCROLL_THRESHOLD;
    if (shouldBeVisible !== isVisible) {
      isVisible = shouldBeVisible;
      whatsappBtn.classList.toggle("is-visible", isVisible);
    }
  }

  window.addEventListener("scroll", updateScrollState, { passive: true });
  if (mobile.addEventListener) {
    mobile.addEventListener("change", updateScrollState);
  } else if (mobile.addListener) {
    mobile.addListener(updateScrollState);
  }
  updateScrollState();
}

function kinesicaApplyWhatsAppContact() {
  initWhatsAppMobileScroll();

  var site = window.KINESICA_SITE || {};
  var cfg = site.contact || {};
  if (!cfg.whatsappDigits || !cfg.phoneDisplay) return;

  var contactData = {
    whatsapp: cfg.whatsappDigits,
    whatsappText: cfg.phoneDisplay,
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
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", kinesicaApplyWhatsAppContact);
} else {
  kinesicaApplyWhatsAppContact();
}

