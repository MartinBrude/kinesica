/**
 * Kinésica - Componente Interactivo de Reservas Web
 * ===================================================
 * Gestiona el flujo paso a paso con validaciones en tiempo real:
 * - Paso 1: ¿Ya te has atendido con nosotros? → profesional o técnica
 * - Paso 2: Calendario y Horarios disponibles
 * - Paso 3: Formulario de datos clínicos y contacto
 * - Paso 4: Confirmación oficial con normas del consultorio
 */

(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    define(["./booking-engine", "./booking-api-client"], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./booking-engine"), require("./booking-api-client"));
  } else {
    root.KinesicaBookingWidget = factory(root.KinesicaBookingEngine, root.KinesicaBookingClient);
  }
})(typeof self !== "undefined" ? self : this, function (engine, clientModule) {
  "use strict";

  function pageLang(explicit) {
    const raw = String(explicit || (typeof document !== "undefined" && document.documentElement.lang) || "es").toLowerCase();
    if (raw.indexOf("en") === 0) return "en";
    if (raw.indexOf("fr") === 0) return "fr";
    if (raw.indexOf("pt") === 0) return "pt";
    return "es";
  }

  const COPY = {
    es: {
      months: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
      dows: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"],
      close: "Cerrar ventana de reservas",
      title: "Agendar",
      subtitle: "Consultorio de Kinesiología, Osteopatía, RPG y ATM en Palermo, CABA",
      step1: "Inicio", step2: "Día y Horario", step3: "Tus Datos", step4: "Confirmación",
      qPatient: "¿Ya te has atendido con nosotros?",
      qWho: "¿Quién te atiende?",
      qTechnique: "¿Buscás alguna técnica en particular?",
      qPrefer: "¿Con quién preferís atenderte?",
      yes: "Sí", no: "No",
      seeSlots: "Ver horarios disponibles →",
      pickDay: "Elige el día y horario",
      daysLabel: "Días disponibles:",
      slotsLabel: "Horarios disponibles:",
      loading: "Consultando disponibilidad...",
      emptyDay: "No hay horarios disponibles para esta fecha.<br>Por favor selecciona otro día en el calendario superior.",
      retry: "↺ Reintentar",
      back: "← Volver",
      toData: "Continuar a tus Datos →",
      dataTitle: "Completa tus datos de contacto",
      dataDesc: "Esta información nos permite asentar tu reserva y contactarte puntualmente.",
      name: "Nombre y Apellido Completo *",
      namePh: "Ej: Juan Pérez",
      phone: "Teléfono / WhatsApp *",
      phonePh: "Ej: +54 9 11 0000-0000",
      dni: "DNI / Documento *",
      dniPh: "Ej: 00.000.000",
      confirm: "Confirmar Reserva 🌿",
      saving: "Registrando...",
      success: "¡Turno Presencial Confirmado!",
      saved: "Tu cita ya quedó registrada oficialmente en Google Calendar.",
      saveCal: "¿Querés guardar el turno en tu agenda?",
      saveCalSub: "Agregalo con un clic a tu calendario para tener el recordatorio en tu celular:",
      downloaded: "✓ Descargado",
      rulesTitle: "📍 Información importante para tu asistencia al consultorio:",
      rulesAddr: "<strong>Dirección:</strong> Charcas 3889, Piso 5º, Depto B, Palermo (entre Scalabrini Ortiz y Aráoz).",
      rulesTime: "Te pedimos que llegues a la hora de la sesión, ni antes ni después, por características del espacio y la organización.",
      rulesCompany: "<strong>Sin acompañantes:</strong> La sesión es personalizada. Rogamos no asistir con acompañantes (salvo menores de edad o personas que requieran asistencia directa).",
      rulesStudies: "<strong>Estudios previos:</strong> Si contás con radiografías, resonancias o informes médicos, por favor traelos a la sesión.",
      maps: "🗺️ Abrir en Google Maps",
      done: "✓ Listo, finalizar y cerrar",
      errWho: "Elegí quién te atiende para ver los horarios.",
      errTechnique: "Elegí la técnica para ver los horarios.",
      errSlot: "Por favor selecciona un día y horario antes de continuar.",
      bySchedule: "Según el horario de atención",
      sessionHour: "Sesión presencial de una hora",
      sessionPro: "Sesión presencial de 1 hora, en los días en que atiende ese profesional.",
      noDays: "No hay días con horarios disponibles en las próximas semanas.",
      slotTitle: "Elegí el horario de la sesión",
      slotError: "Error al consultar disponibilidad:",
      summaryKind: "🩺 Turno presencial de 1 hora",
      technique: "Técnica",
      practitioner: "Profesional",
      patient: "Paciente",
      when: "Fecha y Hora",
      contact: "WhatsApp / Contacto",
      bySchedulePro: "Según el horario de atención",
      bookedFor: "Tu cita quedó reservada para el",
      at: "a las",
      hs: "hs",
      eventId: "Identificador de cita:",
      techniques: {
        osteopatia: "Osteopatía",
        acupuntura: "Acupuntura",
        rpg: "RPG",
        neurodinamia: "Neurodinamia",
        posturologia: "Posturología",
        viscerales: "Manipulaciones viscerales (Barral)",
        "no-se": "No sé",
      },
    },
    en: {
      months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      dows: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      close: "Close booking window",
      title: "Book",
      subtitle: "Physiotherapy, osteopathy, RPG and TMJ clinic in Palermo, Buenos Aires",
      step1: "Start", step2: "Day & time", step3: "Your details", step4: "Confirmation",
      qPatient: "Have you been treated with us before?",
      qWho: "Who is your practitioner?",
      qTechnique: "Are you looking for a particular technique?",
      qPrefer: "Who would you prefer to see?",
      yes: "Yes", no: "No",
      seeSlots: "See available times →",
      pickDay: "Choose a day and time",
      daysLabel: "Available days:",
      slotsLabel: "Available times:",
      loading: "Checking availability...",
      emptyDay: "No times available on this date.<br>Please choose another day above.",
      retry: "↺ Retry",
      back: "← Back",
      toData: "Continue to your details →",
      dataTitle: "Your contact details",
      dataDesc: "We use this to register your booking and reach you if needed.",
      name: "Full name *",
      namePh: "e.g. Jane Smith",
      phone: "Phone / WhatsApp *",
      phonePh: "e.g. +54 9 11 0000-0000",
      dni: "ID document *",
      dniPh: "e.g. 00.000.000",
      confirm: "Confirm booking 🌿",
      saving: "Saving...",
      success: "In-person appointment confirmed",
      saved: "Your appointment is now on the clinic calendar.",
      saveCal: "Save this appointment to your calendar?",
      saveCalSub: "Add it in one tap so you have the reminder on your phone:",
      downloaded: "✓ Downloaded",
      rulesTitle: "📍 Before you come to the clinic:",
      rulesAddr: "<strong>Address:</strong> Charcas 3889, 5th floor, Apt B, Palermo (between Scalabrini Ortiz and Aráoz).",
      rulesTime: "Please arrive at the session time, neither early nor late, because of how the space is organized.",
      rulesCompany: "<strong>No companions:</strong> The session is one-to-one. Please do not bring companions (except minors or people who need direct assistance).",
      rulesStudies: "<strong>Previous studies:</strong> If you have X-rays, MRI scans or medical reports, please bring them.",
      maps: "🗺️ Open in Google Maps",
      done: "✓ Done, close",
      errWho: "Choose who treats you to see available times.",
      errTechnique: "Choose a technique to see available times.",
      errSlot: "Please choose a day and time before continuing.",
      bySchedule: "Depends on the available time",
      sessionHour: "One-hour in-person session",
      sessionPro: "One-hour in-person session, on the days that practitioner works.",
      noDays: "No days with available times in the coming weeks.",
      slotTitle: "Choose a session time",
      slotError: "Could not check availability:",
      summaryKind: "🩺 One-hour in-person session",
      technique: "Technique",
      practitioner: "Practitioner",
      patient: "Patient",
      when: "Date and time",
      contact: "WhatsApp / contact",
      bySchedulePro: "Depends on the available time",
      bookedFor: "Your appointment is booked for",
      at: "at",
      hs: "",
      eventId: "Booking reference:",
      techniques: {
        osteopatia: "Osteopathy",
        acupuntura: "Acupuncture",
        rpg: "RPG",
        neurodinamia: "Neurodynamics",
        posturologia: "Clinical posturology",
        viscerales: "Visceral manipulation (Barral)",
        "no-se": "I'm not sure",
      },
    },
    fr: {
      months: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"],
      dows: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
      close: "Fermer la fenêtre de réservation",
      title: "Réserver",
      subtitle: "Cabinet de kinésithérapie, ostéopathie, RPG et ATM à Palermo, Buenos Aires",
      step1: "Début", step2: "Jour et horaire", step3: "Vos données", step4: "Confirmation",
      qPatient: "Avez-vous déjà été suivi chez nous ?",
      qWho: "Qui vous reçoit ?",
      qTechnique: "Cherchez-vous une technique en particulier ?",
      qPrefer: "Avec qui préférez-vous être suivi ?",
      yes: "Oui", no: "Non",
      seeSlots: "Voir les horaires disponibles →",
      pickDay: "Choisissez le jour et l'horaire",
      daysLabel: "Jours disponibles :",
      slotsLabel: "Horaires disponibles :",
      loading: "Vérification des disponibilités...",
      emptyDay: "Aucun horaire pour cette date.<br>Veuillez choisir un autre jour ci-dessus.",
      retry: "↺ Réessayer",
      back: "← Retour",
      toData: "Continuer vers vos données →",
      dataTitle: "Vos coordonnées",
      dataDesc: "Ces informations permettent d'enregistrer votre réservation et de vous contacter.",
      name: "Nom et prénom *",
      namePh: "Ex. : Jeanne Dupont",
      phone: "Téléphone / WhatsApp *",
      phonePh: "Ex. : +54 9 11 0000-0000",
      dni: "Pièce d'identité *",
      dniPh: "Ex. : 00.000.000",
      confirm: "Confirmer la réservation 🌿",
      saving: "Enregistrement...",
      success: "Rendez-vous en cabinet confirmé",
      saved: "Votre rendez-vous est enregistré dans l'agenda du cabinet.",
      saveCal: "Enregistrer le rendez-vous dans votre agenda ?",
      saveCalSub: "Ajoutez-le en un clic pour avoir le rappel sur votre téléphone :",
      downloaded: "✓ Téléchargé",
      rulesTitle: "📍 Informations importantes pour votre venue au cabinet :",
      rulesAddr: "<strong>Adresse :</strong> Charcas 3889, 5e étage, app. B, Palermo (entre Scalabrini Ortiz et Aráoz).",
      rulesTime: "Merci d'arriver à l'heure de la séance, ni avant ni après, en raison de l'organisation de l'espace.",
      rulesCompany: "<strong>Sans accompagnant :</strong> la séance est individuelle. Merci de ne pas venir accompagné (sauf mineurs ou personnes nécessitant une assistance directe).",
      rulesStudies: "<strong>Examens antérieurs :</strong> si vous avez des radiographies, IRM ou comptes rendus, merci de les apporter.",
      maps: "🗺️ Ouvrir dans Google Maps",
      done: "✓ Terminé, fermer",
      errWho: "Choisissez qui vous reçoit pour voir les horaires.",
      errTechnique: "Choisissez une technique pour voir les horaires.",
      errSlot: "Veuillez choisir un jour et un horaire avant de continuer.",
      bySchedule: "Selon l'horaire disponible",
      sessionHour: "Séance en cabinet d'une heure",
      sessionPro: "Séance d'une heure, les jours où ce praticien reçoit.",
      noDays: "Aucun jour avec des horaires disponibles dans les prochaines semaines.",
      slotTitle: "Choisissez l'horaire de la séance",
      slotError: "Erreur lors de la consultation des disponibilités :",
      summaryKind: "🩺 Séance en cabinet d'une heure",
      technique: "Technique",
      practitioner: "Praticien",
      patient: "Patient",
      when: "Date et heure",
      contact: "WhatsApp / contact",
      bySchedulePro: "Selon l'horaire disponible",
      bookedFor: "Votre rendez-vous est réservé pour le",
      at: "à",
      hs: "",
      eventId: "Référence :",
      techniques: {
        osteopatia: "Ostéopathie",
        acupuntura: "Acupuncture",
        rpg: "RPG",
        neurodinamia: "Neurodynamique",
        posturologia: "Posturologie clinique",
        viscerales: "Manipulations viscérales (Barral)",
        "no-se": "Je ne sais pas",
      },
    },
    pt: {
      months: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      dows: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      close: "Fechar a janela de reservas",
      title: "Agendar",
      subtitle: "Consultório de fisioterapia, osteopatia, RPG e ATM em Palermo, Buenos Aires",
      step1: "Início", step2: "Dia e horário", step3: "Seus dados", step4: "Confirmação",
      qPatient: "Você já se atendeu conosco?",
      qWho: "Quem te atende?",
      qTechnique: "Procura alguma técnica em particular?",
      qPrefer: "Com quem prefere se atender?",
      yes: "Sim", no: "Não",
      seeSlots: "Ver horários disponíveis →",
      pickDay: "Escolha o dia e o horário",
      daysLabel: "Dias disponíveis:",
      slotsLabel: "Horários disponíveis:",
      loading: "Consultando disponibilidade...",
      emptyDay: "Não há horários disponíveis nesta data.<br>Escolha outro dia acima.",
      retry: "↺ Tentar de novo",
      back: "← Voltar",
      toData: "Continuar para seus dados →",
      dataTitle: "Complete seus dados de contato",
      dataDesc: "Usamos estes dados para registrar a reserva e entrar em contato se for preciso.",
      name: "Nome e sobrenome *",
      namePh: "Ex.: João Silva",
      phone: "Telefone / WhatsApp *",
      phonePh: "Ex.: +54 9 11 0000-0000",
      dni: "Documento *",
      dniPh: "Ex.: 00.000.000",
      confirm: "Confirmar reserva 🌿",
      saving: "Registrando...",
      success: "Consulta presencial confirmada",
      saved: "Sua consulta já ficou registrada na agenda do consultório.",
      saveCal: "Quer salvar o horário na sua agenda?",
      saveCalSub: "Adicione com um toque para ter o lembrete no celular:",
      downloaded: "✓ Baixado",
      rulesTitle: "📍 Informações importantes para a sua ida ao consultório:",
      rulesAddr: "<strong>Endereço:</strong> Charcas 3889, 5º andar, apto B, Palermo (entre Scalabrini Ortiz e Aráoz).",
      rulesTime: "Pedimos que chegue no horário da sessão, nem antes nem depois, pelas características do espaço.",
      rulesCompany: "<strong>Sem acompanhantes:</strong> a sessão é individual. Pedimos não vir com acompanhantes (exceto menores ou quem precise de assistência direta).",
      rulesStudies: "<strong>Exames anteriores:</strong> se tiver radiografias, ressonâncias ou laudos, traga-os para a sessão.",
      maps: "🗺️ Abrir no Google Maps",
      done: "✓ Pronto, fechar",
      errWho: "Escolha quem te atende para ver os horários.",
      errTechnique: "Escolha a técnica para ver os horários.",
      errSlot: "Escolha um dia e um horário antes de continuar.",
      bySchedule: "Conforme o horário de atendimento",
      sessionHour: "Sessão presencial de uma hora",
      sessionPro: "Sessão presencial de 1 hora, nos dias em que esse profissional atende.",
      noDays: "Não há dias com horários disponíveis nas próximas semanas.",
      slotTitle: "Escolha o horário da sessão",
      slotError: "Erro ao consultar a disponibilidade:",
      summaryKind: "🩺 Sessão presencial de 1 hora",
      technique: "Técnica",
      practitioner: "Profissional",
      patient: "Paciente",
      when: "Data e hora",
      contact: "WhatsApp / contato",
      bySchedulePro: "Conforme o horário de atendimento",
      bookedFor: "Sua consulta ficou reservada para",
      at: "às",
      hs: "h",
      eventId: "Identificador:",
      techniques: {
        osteopatia: "Osteopatia",
        acupuntura: "Acupuntura",
        rpg: "RPG",
        neurodinamia: "Neurodinâmica",
        posturologia: "Posturologia clínica",
        viscerales: "Manipulações viscerais (Barral)",
        "no-se": "Não sei",
      },
    },
  };

  class BookingWidget {
    constructor(containerId, options) {
      this.container = typeof containerId === "string" ? document.getElementById(containerId) : containerId;
      if (!this.container) {
        throw new Error(`Contenedor no encontrado: ${containerId}`);
      }

      this.options = options || {};
      this.lang = pageLang(this.options.lang);
      this.copy = COPY[this.lang] || COPY.es;
      this.client = new clientModule.BookingClient(options);

      // Estado del flujo
      this.state = {
        step: 1,
        tipo: "session",
        appointmentType: "session",
        existingPatient: null,
        techniqueId: null,
        practitionerId: null,
        selectedDate: null,
        selectedTime: null,
        availableSlots: [],
        isLoadingSlots: false,
        formData: {
          nombre: "",
          telefono: "",
          dni: "",
        },
        confirmedBooking: null,
      };

      this.init();
    }

    t(key) {
      const value = this.copy[key];
      if (value != null) return value;
      return COPY.es[key] != null ? COPY.es[key] : key;
    }

    techniqueLabel(technique) {
      if (!technique) return "";
      const labels = this.copy.techniques || {};
      return labels[technique.id] || technique.label;
    }

    init() {
      this.renderSkeleton();
      this.bindEvents();
      if (this.client && typeof this.client.prewarm === "function") {
        this.client.prewarm();
      }

      this.setStep(1);
    }

    renderSkeleton() {
      this.container.innerHTML = `
        <div class="kinesica-booking-container">
          <div class="kb-header">
            ${this.options.isModal ? `<button type="button" class="kb-close-btn" aria-label="${this.t("close")}" data-action="close-modal">&times;</button>` : ''}
            <h2>${this.t("title")}</h2>
            <p>${this.t("subtitle")}</p>
          </div>

          <div class="kb-stepper">
            <div class="kb-step-item active" data-step-indicator="1">
              <span class="kb-step-num">1</span> ${this.t("step1")}
            </div>
            <div class="kb-step-item" data-step-indicator="2">
              <span class="kb-step-num">2</span> ${this.t("step2")}
            </div>
            <div class="kb-step-item" data-step-indicator="3">
              <span class="kb-step-num">3</span> ${this.t("step3")}
            </div>
            <div class="kb-step-item" data-step-indicator="4">
              <span class="kb-step-num">4</span> ${this.t("step4")}
            </div>
          </div>

          <div class="kb-body">
            <div id="kb-error-banner" class="kb-error-banner"></div>

            <!-- PASO 1: PACIENTE → PROFESIONAL O TÉCNICA -->
            <div class="kb-step-panel active" id="kb-step-1">
              <div class="kb-section-title">${this.t("qPatient")}</div>
              <div class="kb-choice-grid" id="kb-patient-grid"></div>

              <div id="kb-existing-box" style="display: none; margin-top: 18px;">
                <div class="kb-section-title" style="font-size: 1.05rem;">${this.t("qWho")}</div>
                <div class="kb-choice-grid" id="kb-existing-practitioner-grid"></div>
              </div>

              <div id="kb-new-box" style="display: none; margin-top: 18px;">
                <div class="kb-section-title" style="font-size: 1.05rem;">${this.t("qTechnique")}</div>
                <div class="kb-choice-grid" id="kb-technique-grid"></div>
                <div id="kb-practitioner-box" style="display: none; margin-top: 18px;">
                  <div class="kb-section-title" style="font-size: 1.05rem;">${this.t("qPrefer")}</div>
                  <div class="kb-choice-grid" id="kb-practitioner-grid"></div>
                </div>
              </div>

              <div style="margin-top: 16px; text-align: right;">
                <button class="kb-btn kb-btn-primary" id="kb-btn-next-1" disabled>
                  ${this.t("seeSlots")}
                </button>
              </div>
            </div>

            <!-- PASO 2: DÍA Y HORA -->
            <div class="kb-step-panel" id="kb-step-2">
              <div class="kb-section-title">${this.t("pickDay")}</div>
              <div class="kb-section-desc" id="kb-slots-subtitle" style="display: none;"></div>

              <label class="kb-slots-label">${this.t("daysLabel")}</label>
              <div class="kb-date-scroll" id="kb-date-carousel"></div>

              <label class="kb-slots-label" id="kb-slots-grid-title">${this.t("slotsLabel")}</label>
              <div id="kb-slots-container">
                <div id="kb-slots-loading" class="kb-state-box" style="display: none;">
                  <div class="kb-spinner"></div>
                  <span>${this.t("loading")}</span>
                </div>
                <div id="kb-slots-empty" class="kb-state-box" style="display: none;">
                  <span>${this.t("emptyDay")}</span>
                </div>
                <div id="kb-slots-error" class="kb-state-box" style="display: none; border-color: var(--kin-danger); color: var(--kin-danger);">
                  <span id="kb-slots-error-text"></span>
                  <button class="kb-btn kb-btn-secondary" id="kb-btn-retry-slots" style="margin-top: 6px; font-size: 13px; padding: 6px 14px;">${this.t("retry")}</button>
                </div>
                <div class="kb-slots-grid" id="kb-slots-grid"></div>
              </div>

              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-2">${this.t("back")}</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-next-2" disabled>
                  ${this.t("toData")}
                </button>
              </div>
            </div>

            <!-- PASO 3: FORMULARIO -->
            <div class="kb-step-panel" id="kb-step-3">
              <div class="kb-section-title">${this.t("dataTitle")}</div>
              <div class="kb-section-desc">${this.t("dataDesc")}</div>

              <div class="kb-form-group">
                <label for="kb-input-nombre">${this.t("name")}</label>
                <input type="text" id="kb-input-nombre" placeholder="${this.t("namePh")}" required>
              </div>

              <div class="kb-form-row">
                <div class="kb-form-group">
                  <label for="kb-input-telefono">${this.t("phone")}</label>
                  <input type="tel" id="kb-input-telefono" placeholder="${this.t("phonePh")}" required>
                </div>
                <div class="kb-form-group">
                  <label for="kb-input-dni" id="kb-label-dni">${this.t("dni")}</label>
                  <input type="text" id="kb-input-dni" placeholder="${this.t("dniPh")}">
                </div>
              </div>


              <div class="kb-actions">
                <button class="kb-btn kb-btn-secondary" id="kb-btn-prev-3">${this.t("back")}</button>
                <button class="kb-btn kb-btn-primary" id="kb-btn-submit">
                  ${this.t("confirm")}
                </button>
              </div>
            </div>

            <!-- PASO 4: CONFIRMACIÓN -->
            <div class="kb-step-panel" id="kb-step-4">
              <div class="kb-success-card">
                <div class="kb-success-icon">✓</div>
                <div class="kb-success-title" id="kb-success-title">${this.t("success")}</div>
                <p id="kb-success-subtitle" style="color: var(--kin-text-muted);">
                  ${this.t("saved")}
                </p>

                <div class="kb-summary-box" id="kb-success-summary"></div>

                <!-- Opciones para agregar a la agenda / calendario personal -->
                <div class="kb-calendar-sync-box" id="kb-calendar-sync-box">
                  <div class="kb-calendar-sync-header">
                    <span class="kb-calendar-sync-icon" aria-hidden="true">📅</span>
                    <div>
                      <div class="kb-calendar-sync-title">${this.t("saveCal")}</div>
                      <div class="kb-calendar-sync-subtitle">${this.t("saveCalSub")}</div>
                    </div>
                  </div>
                  <div class="kb-calendar-sync-actions">
                    <a href="#" target="_blank" rel="noopener noreferrer" class="kb-btn-cal kb-btn-cal-google" id="kb-btn-cal-google">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6c0-1.11-.89-2-2-2zm0 16H5V9h14v11z" fill="#4285F4"/>
                        <rect x="7" y="11" width="3" height="3" fill="#EA4335"/>
                        <rect x="11" y="11" width="3" height="3" fill="#FBBC05"/>
                        <rect x="15" y="11" width="3" height="3" fill="#34A853"/>
                      </svg>
                      <span>Google Calendar</span>
                    </a>
                    <button type="button" class="kb-btn-cal kb-btn-cal-ics" id="kb-btn-cal-ics">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                      <span id="kb-btn-cal-ics-text">Apple / Outlook (.ics)</span>
                    </button>
                  </div>
                </div>

                <!-- Normas del consultorio para turnos presenciales -->
                <div class="kb-clinic-rules" id="kb-success-clinic-rules" style="display: none;">
                  <h4>${this.t("rulesTitle")}</h4>
                  <ul>
                    <li>${this.t("rulesAddr")}</li>
                    <li>${this.t("rulesTime")}</li>
                    <li>${this.t("rulesCompany")}</li>
                    <li>${this.t("rulesStudies")}</li>
                  </ul>
                  <div style="margin-top: 14px; text-align: center;">
                    <a href="https://maps.app.goo.gl/urpkh4HYe7dSdjPS9" target="_blank" rel="noopener" class="kb-btn kb-btn-primary" style="display: inline-flex; text-decoration: none;">
                      ${this.t("maps")}
                    </a>
                  </div>
                </div>

                ${this.options.isModal ? `
                  <div style="margin-top: 22px; text-align: center;">
                    <button type="button" class="kb-btn kb-btn-secondary" data-action="close-modal" style="width: auto; padding: 10px 28px; font-weight: 600;">
                      ${this.t("done")}
                    </button>
                  </div>
                ` : ""}

              </div>
            </div>

          </div>
        </div>
      `;
    }

    bindEvents() {
      const q = (sel) => this.container.querySelector(sel);

      // Eventos de cierre de modal si aplica
      if (this.options.onClose) {
        this.container.querySelectorAll('[data-action="close-modal"]').forEach((btn) => {
          btn.addEventListener("click", () => this.options.onClose());
        });
      }

      this.renderPatientChoices();
      this.renderTechniqueChoices();

      q("#kb-btn-next-1").addEventListener("click", () => {
        const technique = engine.getTechnique(this.state.techniqueId);
        if (this.state.existingPatient === true && !this.state.practitionerId) {
          this.showError(this.t("errWho"));
          return;
        }
        if (this.state.existingPatient !== true && (!technique || (!technique.bySchedule && !this.state.practitionerId))) {
          this.showError(this.t("errTechnique"));
          return;
        }
        this.clearError();
        this.state.selectedDate = null;
        this.state.selectedTime = null;
        this.renderDateCarousel();
        this.setStep(2);
      });

      q("#kb-btn-prev-2").addEventListener("click", () => {
        this.clearError();
        this.setStep(1);
      });

      q("#kb-btn-next-2").addEventListener("click", () => {
        if (!this.state.selectedDate || !this.state.selectedTime) {
          this.showError(this.t("errSlot"));
          return;
        }
        this.clearError();
        this.setStep(3);
      });

      q("#kb-btn-prev-3").addEventListener("click", () => {
        this.clearError();
        this.setStep(2);
      });

      // Envío final
      q("#kb-btn-submit").addEventListener("click", () => this.handleBookingSubmit());


    }

    renderPatientChoices() {
      const grid = this.container.querySelector("#kb-patient-grid");
      grid.innerHTML = "";
      [
        { value: true, label: this.t("yes") },
        { value: false, label: this.t("no") },
      ].forEach((option) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.patient = option.value ? "yes" : "no";
        card.innerHTML = `<h3>${option.label}</h3>`;
        card.addEventListener("click", () => this.selectExistingPatient(option.value));
        grid.appendChild(card);
      });
      this.renderExistingPractitionerChoices();
    }

    selectExistingPatient(isExisting) {
      this.state.existingPatient = isExisting;
      this.state.techniqueId = null;
      this.state.practitionerId = null;
      this.container.querySelectorAll("#kb-patient-grid .kb-choice-card").forEach((card) => {
        const yes = card.dataset.patient === "yes";
        card.classList.toggle("selected", yes === isExisting);
      });
      const existingBox = this.container.querySelector("#kb-existing-box");
      const newBox = this.container.querySelector("#kb-new-box");
      existingBox.style.display = isExisting ? "block" : "none";
      newBox.style.display = isExisting ? "none" : "block";
      this.container.querySelectorAll("#kb-existing-practitioner-grid .kb-choice-card, #kb-technique-grid .kb-choice-card").forEach((card) => {
        card.classList.remove("selected");
      });
      const practitionerBox = this.container.querySelector("#kb-practitioner-box");
      if (practitionerBox) practitionerBox.style.display = "none";
      this.syncStep1Continue();
    }

    renderExistingPractitionerChoices() {
      const grid = this.container.querySelector("#kb-existing-practitioner-grid");
      grid.innerHTML = "";
      Object.keys(engine.PRACTITIONERS).forEach((id) => {
        const person = engine.PRACTITIONERS[id];
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.practitioner = id;
        card.innerHTML = `<h3>${person.name}</h3>`;
        card.addEventListener("click", () => {
          this.state.practitionerId = id;
          this.state.techniqueId = "paciente";
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === id);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
    }

    renderTechniqueChoices() {
      const grid = this.container.querySelector("#kb-technique-grid");
      grid.innerHTML = "";
      engine.TECHNIQUES.filter((technique) => !technique.internal).forEach((technique) => {
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.technique = technique.id;
        const names = technique.bySchedule
          ? this.t("bySchedule")
          : technique.practitioners.map((id) => engine.PRACTITIONERS[id].name).join(" · ");
        card.innerHTML = `<h3>${this.techniqueLabel(technique)}</h3><p>${names}</p>`;
        card.addEventListener("click", () => this.selectTechnique(technique.id));
        grid.appendChild(card);
      });
    }

    selectTechnique(techniqueId) {
      const technique = engine.getTechnique(techniqueId);
      this.state.techniqueId = techniqueId;
      this.state.practitionerId = technique.bySchedule
        ? null
        : technique.practitioners.length === 1
          ? technique.practitioners[0]
          : null;
      this.container.querySelectorAll("#kb-technique-grid .kb-choice-card").forEach((card) => {
        card.classList.toggle("selected", card.dataset.technique === techniqueId);
      });
      this.renderPractitionerChoices(technique);
      this.syncStep1Continue();
    }

    renderPractitionerChoices(technique) {
      const box = this.container.querySelector("#kb-practitioner-box");
      const grid = this.container.querySelector("#kb-practitioner-grid");
      grid.innerHTML = "";
      if (technique.bySchedule || technique.practitioners.length < 2) {
        box.style.display = "none";
        return;
      }
      box.style.display = "block";
      technique.practitioners.forEach((id) => {
        const person = engine.PRACTITIONERS[id];
        const card = document.createElement("div");
        card.className = "kb-choice-card";
        card.dataset.practitioner = id;
        card.innerHTML = `<h3>${person.name}</h3>`;
        card.addEventListener("click", () => {
          this.state.practitionerId = id;
          grid.querySelectorAll(".kb-choice-card").forEach((c) => {
            c.classList.toggle("selected", c.dataset.practitioner === id);
          });
          this.syncStep1Continue();
        });
        grid.appendChild(card);
      });
    }

    syncStep1Continue() {
      const btn = this.container.querySelector("#kb-btn-next-1");
      const technique = engine.getTechnique(this.state.techniqueId);
      const ready = this.state.existingPatient === true
        ? Boolean(this.state.practitionerId)
        : technique && (technique.bySchedule || this.state.practitionerId);
      if (btn) btn.disabled = !ready;
      if (ready) this.prefetchAgenda();
    }

    collectAttendanceDays(limit) {
      const today = new Date();
      let checkDate = new Date(today);
      let scanned = 0;
      const days = [];
      while (days.length < limit && scanned < 45) {
        scanned += 1;
        const iso = engine.formatDateIso(checkDate);
        const current = new Date(checkDate);
        checkDate.setDate(checkDate.getDate() + 1);
        if (!this.dayHasAttendance(current)) continue;
        days.push({ iso, current });
      }
      return days;
    }

    prefetchAgenda() {
      const key = `${this.state.practitionerId || ""}|${this.state.techniqueId || ""}`;
      if (this._prefetchKey === key) return;
      this._prefetchKey = key;
      this._prefetchedSlots = {};
      const days = this.collectAttendanceDays(3);
      days.forEach((day, index) => {
        setTimeout(() => {
          if (this._prefetchKey !== key) return;
          this.fetchFilteredSlots(day.iso).then((slots) => {
            if (this._prefetchKey !== key) return;
            this._prefetchedSlots[day.iso] = slots;
          }).catch(() => {});
        }, index * 120);
      });
    }

    updateDniRequirement() {
      const label = this.container.querySelector("#kb-label-dni");
      if (label) label.innerHTML = this.t("dni");
    }

    setStep(stepNumber) {
      this.state.step = stepNumber;
      const panels = this.container.querySelectorAll(".kb-step-panel");
      panels.forEach((p, idx) => {
        p.classList.toggle("active", idx + 1 === stepNumber);
      });

      const indicators = this.container.querySelectorAll(".kb-step-item");
      indicators.forEach((ind, idx) => {
        const itemStep = idx + 1;
        ind.classList.remove("active", "completed");
        if (itemStep === stepNumber) {
          ind.classList.add("active");
        } else if (itemStep < stepNumber) {
          ind.classList.add("completed");
        }
      });

      // Título y subtítulo paso 2
      const step2Title = this.container.querySelector("#kb-step-2 .kb-section-title");
      if (step2Title) {
        step2Title.textContent = this.t("slotTitle");
      }

      const subtitle = this.container.querySelector("#kb-slots-subtitle");
      if (subtitle) {
        const techniqueForSub = engine.getTechnique(this.state.techniqueId);
        subtitle.textContent = techniqueForSub && techniqueForSub.bySchedule
          ? this.t("sessionHour")
          : this.t("sessionPro");
        subtitle.style.display = "block";
      }
    }

    dayHasAttendance(date) {
      const technique = engine.getTechnique(this.state.techniqueId);
      const works = technique && technique.bySchedule
        ? Object.keys(engine.PRACTITIONERS).some((id) => engine.getWorkingWindows(id, date).length > 0)
        : engine.getWorkingWindows(this.state.practitionerId, date).length > 0;
      return engine.isBusinessDay(date) && works;
    }

    async renderDateCarousel() {
      this._carouselSeq = (this._carouselSeq || 0) + 1;
      const seq = this._carouselSeq;
      const carousel = this.container.querySelector("#kb-date-carousel");
      carousel.innerHTML = "";

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const grid = this.container.querySelector("#kb-slots-grid");
      if (loading) loading.style.display = "flex";
      if (empty) empty.style.display = "none";
      if (grid) grid.style.display = "none";

      this._prefetchedSlots = this._prefetchedSlots || {};
      const days = this.collectAttendanceDays(10);

      let firstAvailable = null;
      days.forEach((day) => {
        const card = document.createElement("div");
        card.className = "kb-date-card";
        card.dataset.date = day.iso;
        card.innerHTML = `
          <div class="kb-date-dow">${this.copy.dows[day.current.getDay()]}</div>
          <div class="kb-date-day">${day.current.getDate()}</div>
          <div class="kb-date-month">${this.copy.months[day.current.getMonth()]}</div>
        `;
        card.addEventListener("click", () => {
          this.selectDate(day.iso);
        });
        carousel.appendChild(card);
        if (!firstAvailable) firstAvailable = day.iso;
      });

      if (seq !== this._carouselSeq) return;
      if (!firstAvailable) {
        if (loading) loading.style.display = "none";
        if (empty) {
          empty.style.display = "flex";
          empty.querySelector("span").textContent = this.t("noDays");
        }
        return;
      }
      const selected = this.state.selectedDate && carousel.querySelector(`[data-date="${this.state.selectedDate}"]`)
        ? this.state.selectedDate
        : firstAvailable;
      this.selectDate(selected);
      this.pruneEmptyDays(days.filter((day) => day.iso !== selected), seq);
    }

    async pruneEmptyDays(days, seq) {
      for (let i = 0; i < days.length; i += 3) {
        if (seq !== this._carouselSeq) return;
        const batch = days.slice(i, i + 3);
        await Promise.all(batch.map(async (day) => {
          try {
            const slots = await this.fetchFilteredSlots(day.iso);
            if (seq !== this._carouselSeq) return;
            this._prefetchedSlots[day.iso] = slots;
            if (!slots.length) {
              const card = this.container.querySelector(`.kb-date-card[data-date="${day.iso}"]`);
              if (card && !card.classList.contains("selected")) card.remove();
            }
          } catch (err) {}
        }));
      }
    }

    async fetchFilteredSlots(dateIso, forceRefresh = false) {
      const res = await this.client.getAvailableSlots(dateIso, "session", {
        forceRefresh,
        practitionerId: this.state.practitionerId,
        techniqueId: this.state.techniqueId,
      });
      let slots = this.filterSlotsWithBuffer(res.availableSlots || [], dateIso, this.state.appointmentType);
      const chosen = engine.getTechnique(this.state.techniqueId);
      if (chosen && chosen.bySchedule) {
        slots = slots.filter((slot) => engine.practitionersAt(dateIso, slot.time).length > 0);
      }
      return slots;
    }

    async selectDate(dateIso) {
      this.state.selectedDate = dateIso;
      this.state.selectedTime = null;
      this.container.querySelector("#kb-btn-next-2").disabled = true;

      const cards = this.container.querySelectorAll(".kb-date-card");
      cards.forEach((c) => {
        c.classList.toggle("selected", c.dataset.date === dateIso);
      });

      await this.loadSlotsForDate(dateIso);
    }

    async loadSlotsForDate(dateIso, forceRefresh = false) {
      this._slotReqSeq = (this._slotReqSeq || 0) + 1;
      const currentReq = this._slotReqSeq;

      const loading = this.container.querySelector("#kb-slots-loading");
      const empty = this.container.querySelector("#kb-slots-empty");
      const errorBox = this.container.querySelector("#kb-slots-error");
      const grid = this.container.querySelector("#kb-slots-grid");

      const cached = !forceRefresh && this._prefetchedSlots && this._prefetchedSlots[dateIso];
      loading.style.display = cached ? "none" : "flex";
      empty.style.display = "none";
      errorBox.style.display = "none";
      grid.style.display = "none";
      grid.innerHTML = "";

      try {
        const slots = cached ? this._prefetchedSlots[dateIso] : await this.fetchFilteredSlots(dateIso, forceRefresh);
        if (currentReq !== this._slotReqSeq) return;

        loading.style.display = "none";
        this.state.availableSlots = slots;

        if (slots.length === 0) {
          const card = this.container.querySelector(`.kb-date-card[data-date="${dateIso}"]`);
          const next = card && card.nextElementSibling;
          if (card) card.remove();
          if (next && next.dataset.date) {
            this.selectDate(next.dataset.date);
            return;
          }
          empty.style.display = "flex";
          return;
        }

        grid.style.display = "grid";
        grid.innerHTML = "";
        slots.forEach((slot) => {
          const chip = document.createElement("div");
          chip.className = "kb-slot-chip";
          const onDuty = engine.getTechnique(this.state.techniqueId) && engine.getTechnique(this.state.techniqueId).bySchedule
            ? engine.practitionersAt(dateIso, slot.time)
            : [];
          const dutyLabel = onDuty.length === 1 ? ` · ${engine.PRACTITIONERS[onDuty[0]].name}` : "";
          const hs = this.t("hs");
          chip.textContent = `${slot.time}${hs ? " " + hs : ""}${dutyLabel}`;
          chip.dataset.time = slot.time;

          chip.addEventListener("click", () => {
            this.state.selectedTime = slot.time;
            if (onDuty.length === 1) this.state.practitionerId = onDuty[0];
            else if (onDuty.length > 1) this.state.practitionerId = null;
            const chips = grid.querySelectorAll(".kb-slot-chip");
            chips.forEach((ch) => ch.classList.remove("selected"));
            chip.classList.add("selected");
            this.container.querySelector("#kb-btn-next-2").disabled = false;
          });

          grid.appendChild(chip);
        });
      } catch (err) {
        if (currentReq !== this._slotReqSeq) return;
        loading.style.display = "none";
        errorBox.style.display = "flex";
        this.container.querySelector("#kb-slots-error-text").textContent = `${this.t("slotError")} ${err.message}`;
        const retryBtn = this.container.querySelector("#kb-btn-retry-slots");
        if (retryBtn) {
          retryBtn.onclick = () => this.loadSlotsForDate(dateIso, true);
        }
      }
    }

    /**
     * Filtra los turnos garantizando el margen de anticipación cuando la consulta es para hoy:
     * Turnos presenciales (60 min): mínimo 2 horas de margen de traslado al consultorio.
     */
    filterSlotsWithBuffer(slots, dateIso, appointmentType) {
      if (!Array.isArray(slots) || slots.length === 0) return [];

      let todayArg = "";
      try {
        todayArg = new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Argentina/Buenos_Aires",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch (e) {
        const d = new Date(Date.now() - 3 * 3600 * 1000);
        todayArg = d.toISOString().slice(0, 10);
      }

      // Si no es para la fecha de hoy en Argentina, no se aplica buffer relativo a now
      if (dateIso !== todayArg) {
        return slots;
      }

      const bufferHours = engine.SESSION_BUFFER_HOURS || 2;
      const minAllowedTimestamp = Date.now() + bufferHours * 3600 * 1000;

      return slots.filter((slot) => {
        let slotTimestamp = 0;
        if (slot.startIso) {
          slotTimestamp = new Date(slot.startIso).getTime();
        } else if (slot.time) {
          // Buenos Aires siempre es UTC-3
          slotTimestamp = new Date(`${dateIso}T${slot.time}:00-03:00`).getTime();
        }
        return slotTimestamp >= minAllowedTimestamp;
      });
    }

    async handleBookingSubmit() {
      this.clearError();
      const q = (sel) => this.container.querySelector(sel);

      if (!this.state.selectedDate || !this.state.selectedTime) {
        this.showError(this.t("errSlot"));
        this.setStep(2);
        return;
      }

      const nombre = q("#kb-input-nombre").value.trim();
      const telefono = q("#kb-input-telefono").value.trim();
      const dni = q("#kb-input-dni").value.trim();

      const payload = {
        tipo: "session",
        appointmentType: "session",
        techniqueId: this.state.techniqueId,
        practitionerId: this.state.practitionerId,
        date: this.state.selectedDate,
        time: this.state.selectedTime,
        nombre: nombre,
        telefono: telefono,
        dni: dni,
        motivo: "",
        isMenor: false,
        nombreFamiliar: "",
        notas: "",
      };

      const btnSubmit = q("#kb-btn-submit");
      btnSubmit.disabled = true;
      btnSubmit.textContent = this.t("saving");

      try {
        const result = await this.client.bookAppointment(payload);
        this.state.confirmedBooking = result;
        this.renderConfirmation(payload, result);
        this.setStep(4);
      } catch (err) {
        this.showError(err.message);
      } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = this.t("confirm");
      }
    }

    renderConfirmation(payload, result) {
      const q = (sel) => this.container.querySelector(sel);

      const technique = engine.getTechnique(payload.techniqueId);
      const person = engine.PRACTITIONERS[payload.practitionerId];
      q("#kb-success-title").textContent = this.t("success");

      const summaryBox = q("#kb-success-summary");
      summaryBox.innerHTML = `
        <div style="font-weight: 700; color: var(--kin-green-deep); margin-bottom: 8px;">
          ${this.t("summaryKind")}
        </div>
        ${technique && !technique.bySchedule && !technique.internal ? `<div><strong>${this.t("technique")}:</strong> ${this.techniqueLabel(technique)}</div>` : ""}
        <div><strong>${this.t("practitioner")}:</strong> ${person ? person.name : this.t("bySchedulePro")}</div>
        <div><strong>${this.t("patient")}:</strong> ${payload.nombre}</div>
        <div><strong>${this.t("when")}:</strong> ${payload.date} ${this.t("at")} ${payload.time}${this.t("hs") ? " " + this.t("hs") : ""}</div>
        <div><strong>${this.t("contact")}:</strong> ${payload.telefono}</div>
        <div style="margin-top: 6px; font-size: 12px; color: var(--kin-text-muted);">
          ${this.t("eventId")} <code>${result.eventId || "OK"}</code>
        </div>
      `;

      // Reglas del consultorio sólo si es presencial
      const clinicRules = q("#kb-success-clinic-rules");
      clinicRules.style.display = "block";

      const subtitle = q("#kb-success-subtitle");
      subtitle.innerHTML = `${this.t("bookedFor")} <strong>${payload.date} ${this.t("at")} ${payload.time}${this.t("hs") ? " " + this.t("hs") : ""}</strong>.`;

      this.setupCalendarButtons(payload, result);
    }

    setupCalendarButtons(payload, result) {
      const q = (sel) => this.container.querySelector(sel);
      const data = engine && engine.generateCalendarExportData
        ? engine.generateCalendarExportData(payload, result && result.eventId)
        : null;

      if (!data) return;

      const gcalBtn = q("#kb-btn-cal-google");
      if (gcalBtn) {
        gcalBtn.href = data.googleCalendarUrl;
      }

      const icsBtn = q("#kb-btn-cal-ics");
      if (icsBtn) {
        icsBtn.onclick = (e) => {
          e.preventDefault();
          try {
            const blob = new Blob([data.icsContent], { type: "text/calendar;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = data.filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);

            const txt = q("#kb-btn-cal-ics-text");
            if (txt) {
              const orig = txt.textContent;
              txt.textContent = this.t("downloaded");
              setTimeout(() => {
                txt.textContent = orig;
              }, 2500);
            }
          } catch (err) {
            console.error("Error al generar archivo .ics:", err);
          }
        };
      }
    }

    showError(msg) {
      const banner = this.container.querySelector("#kb-error-banner");
      banner.textContent = msg;
      banner.classList.add("visible");
      banner.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    clearError() {
      const banner = this.container.querySelector("#kb-error-banner");
      banner.textContent = "";
      banner.classList.remove("visible");
    }
  }

  return BookingWidget;
});
