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

function isDesktopBrowser() {
  if (typeof navigator === "undefined") return false;
  var ua = navigator.userAgent || "";
  var isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  var isTouchMac = Boolean(
    navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      /Macintosh/.test(ua)
  );
  return !isMobileUA && !isTouchMac;
}

var desktopClickBound = false;

function initDesktopWhatsAppClickHandler() {
  if (desktopClickBound || !isDesktopBrowser()) return;
  desktopClickBound = true;

  document.addEventListener("click", function (e) {
    var link =
      e.target && e.target.closest
        ? e.target.closest(
            ".dynamic-whatsapp-link, .dynamic-whatsapp-url, #whatsapp-link, a[href*='wa.me/'], a[href*='whatsapp://']"
          )
        : null;
    if (!link) return;

    var href = link.getAttribute("href") || "";
    var digitsMatch = href.match(/(?:phone=|wa\.me\/)(\d+)/);
    var site = window.KINESICA_SITE || {};
    var cfg = site.contact || {};
    var digits =
      cfg.activeWhatsappDigits || (digitsMatch && digitsMatch[1]) || cfg.whatsappDigits || "";
    if (!digits) return;

    var sanitized = String(digits).replace(/\D/g, "");

    // Evita abrir una pestaña web adicional o la página intermedia api.whatsapp.com
    e.preventDefault();
    window.location.href = "whatsapp://send?phone=" + sanitized;
  });
}

var CLARA_WHATSAPP_DIGITS = "5491131781733";
var CLARA_PHONE_DISPLAY = "+54 (11) 3178-1733";

function syncPublicSettings() {
  function applySettings(settings) {
    if (!settings) return;
    var claraActive = Boolean(settings.clara_active);
    var bookingActive = Boolean(settings.booking_active);

    var site = window.KINESICA_SITE || {};
    var cfg = site.contact || {};

    if (claraActive) {
      cfg.activeWhatsappDigits = CLARA_WHATSAPP_DIGITS;
      cfg.activePhoneDisplay = CLARA_PHONE_DISPLAY;
    } else {
      cfg.activeWhatsappDigits = cfg.whatsappDigits;
      cfg.activePhoneDisplay = cfg.phoneDisplay;
    }

    if (typeof kinesicaApplyWhatsAppContact === "function") {
      kinesicaApplyWhatsAppContact();
    }

    var heroBookingBtn = document.getElementById("hero-btn-booking");
    if (heroBookingBtn) {
      if (bookingActive) {
        heroBookingBtn.hidden = false;
        heroBookingBtn.style.display = "";
      } else {
        heroBookingBtn.hidden = true;
        heroBookingBtn.style.display = "none";
      }
    }

    if (
      settings.practitioner_hours &&
      window.KinesicaBookingEngine &&
      typeof window.KinesicaBookingEngine.setPractitionerHours === "function"
    ) {
      window.KinesicaBookingEngine.setPractitionerHours(settings.practitioner_hours);
    }

    if (settings.header_schedule && settings.header_schedule.opens && settings.header_schedule.closes) {
      updateHeaderSchedule(settings.header_schedule.opens, settings.header_schedule.closes);
    }
  }

  function updateHeaderSchedule(opens, closes) {
    function parseHm(hm) {
      var parts = String(hm || "00:00").split(":");
      return { hour: parseInt(parts[0], 10) || 0, minute: parseInt(parts[1], 10) || 0 };
    }
    function hour24(hm) {
      var t = parseHm(hm);
      return t.minute === 0 ? String(t.hour) : t.hour + ":" + (t.minute < 10 ? "0" : "") + t.minute;
    }
    function hourEn12(hm) {
      var t = parseHm(hm);
      var suffix = t.hour < 12 || t.hour === 24 ? "a.m." : "p.m.";
      var h12 = t.hour % 12;
      if (h12 === 0) h12 = 12;
      var time = t.minute === 0 ? String(h12) : h12 + ":" + (t.minute < 10 ? "0" : "") + t.minute;
      return time + " " + suffix;
    }

    var root = document.getElementById("site-header-root");
    var lang = (root && root.getAttribute("data-header-lang")) || document.documentElement.lang || "es";
    lang = String(lang).toLowerCase().slice(0, 2);

    var o24 = hour24(opens);
    var c24 = hour24(closes);
    var html = "";
    switch (lang) {
      case "en":
        html = "Monday to Friday: <strong>" + hourEn12(opens) + " to " + hourEn12(closes) + "</strong>";
        break;
      case "fr":
        html = "Lundi au vendredi : <strong>" + o24 + " h \u00E0 " + c24 + " h</strong>";
        break;
      case "pt":
        html = "Segunda a sexta: <strong>" + o24 + " h \u00E0s " + c24 + " h</strong>";
        break;
      case "es":
      default:
        html = "Lunes a viernes: <strong>" + o24 + " a " + c24 + " h</strong>";
        break;
    }

    document.querySelectorAll(".time-text").forEach(function (el) {
      el.innerHTML = html;
    });
  }

  try {
    var cached = JSON.parse(localStorage.getItem("kinesica_public_settings") || "null");
    if (cached) applySettings(cached);
  } catch (_) {}

  if (typeof fetch === "function") {
    fetch("/admin/api/settings.php", { cache: "no-cache" })
      .then(function (res) {
        return res.ok ? res.json() : null;
      })
      .then(function (data) {
        if (data && typeof data === "object") {
          try {
            localStorage.setItem("kinesica_public_settings", JSON.stringify(data));
          } catch (_) {}
          applySettings(data);
        }
      })
      .catch(function () {});
  }
}

function kinesicaApplyWhatsAppContact() {
  initWhatsAppMobileScroll();
  initDesktopWhatsAppClickHandler();

  var site = window.KINESICA_SITE || {};
  var cfg = site.contact || {};
  var currentWhatsapp = cfg.activeWhatsappDigits || cfg.whatsappDigits;
  var currentDisplay = cfg.activePhoneDisplay || cfg.phoneDisplay;
  if (!currentWhatsapp || !currentDisplay) return;

  var contactData = {
    whatsapp: currentWhatsapp,
    whatsappText: currentDisplay,
  };

  var isDesktop = isDesktopBrowser();
  var whatsappBase = isDesktop ? "whatsapp://send?phone=" : "https://wa.me/";

  function setupWhatsAppLinks(selector, phone) {
    var sanitized = String(phone).replace(/\D/g, "");
    document.querySelectorAll(selector).forEach(function (el) {
      el.href = whatsappBase + sanitized;
      if (isDesktop) {
        el.removeAttribute("target");
      } else {
        el.setAttribute("target", "_blank");
      }
    });
  }

  setupWhatsAppLinks(
    ".dynamic-whatsapp-link, .dynamic-whatsapp-url, #whatsapp-link, a[href*='wa.me/'], a[href*='whatsapp://']",
    contactData.whatsapp
  );

  function setupLinks(selector, urlBase, phone) {
    var sanitized = String(phone).replace(/\D/g, "");
    document.querySelectorAll(selector).forEach(function (el) {
      el.href = urlBase + sanitized;
    });
  }

  setupLinks(".dynamic-telegram-link", "https://t.me/+", contactData.whatsapp);

  document.querySelectorAll(".dynamic-tel-link").forEach(function (el) {
    el.href = "tel:+" + String(contactData.whatsapp).replace(/\D/g, "");
  });

  document.querySelectorAll(".dynamic-whatsapp-text, .dynamic-phone-text").forEach(function (el) {
    el.textContent = contactData.whatsappText;
  });
}

window.kinesicaApplyWhatsAppContact = kinesicaApplyWhatsAppContact;
window.kinesicaSyncPublicSettings = syncPublicSettings;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () {
    kinesicaApplyWhatsAppContact();
    syncPublicSettings();
  });
} else {
  kinesicaApplyWhatsAppContact();
  syncPublicSettings();
}


