/**
 * Copy for the dedicated online booking page (/agendar, /agendar.html) in ES / EN / FR / PT.
 */
import { CONTACT, OPENING_HOURS } from "./site-contact.mjs";

export const AGENDAR = {
  es: {
    title: "Agendar Turno Online | Kinésica — Kinesiología y Osteopatía en Palermo",
    description:
      "Reservá tu turno presencial de kinesiología, osteopatía, RPG, ATM o acupuntura en Kinésica (Palermo, Buenos Aires). Sesiones individuales de 1 hora.",
    breadcrumb: "Agendar",
    eyebrow: "Reserva de turnos online",
    h1: "Agendá tu turno en Kinésica",
    lead:
      "Seleccioná si ya te atendiste con nosotros o si es tu primera consulta para ver los días y horarios disponibles en tiempo real.",
    highlights: [
      {
        icon: "fa-clock-o",
        title: "Atención individual de 1 hora",
        text: "Cada sesión es personalizada y de dedicación exclusiva con el profesional en consultorio privado.",
      },
      {
        icon: "fa-map-marker",
        title: "Consultorio en Palermo",
        text: `${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood} (${CONTACT.address.addressRegion}). Lunes a viernes de ${OPENING_HOURS.opens} a ${OPENING_HOURS.closes} hs.`,
      },
      {
        icon: "fa-file-text-o",
        title: "Modalidad y reintegros",
        text: "Atención particular. Emitimos factura oficial para que gestiones el reintegro en tu obra social o prepaga.",
      },
    ],
  },
  en: {
    title: "Book an Appointment Online | Kinésica — Physiotherapy & Osteopathy in Palermo",
    description:
      "Book your in-person physiotherapy, osteopathy, RPG, TMJ or acupuncture session at Kinésica (Palermo, Buenos Aires). One-hour individual appointments.",
    breadcrumb: "Book",
    eyebrow: "Online appointment booking",
    h1: "Book your appointment at Kinésica",
    lead:
      "Select whether you have been treated with us before or if this is your first visit to check available days and times in real time.",
    highlights: [
      {
        icon: "fa-clock-o",
        title: "1-hour individual session",
        text: "Every appointment is one-to-one with dedicated time from your practitioner in a private room.",
      },
      {
        icon: "fa-map-marker",
        title: "Clinic in Palermo",
        text: `${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood} (${CONTACT.address.addressRegion}). Monday to Friday, ${OPENING_HOURS.opens} to ${OPENING_HOURS.closes}.`,
      },
      {
        icon: "fa-file-text-o",
        title: "Billing & reimbursement",
        text: "Private practice. We provide official invoices so you can request reimbursement from your health insurance.",
      },
    ],
  },
  fr: {
    title: "Prendre Rendez-vous en Ligne | Kinésica — Kinésithérapie et Ostéopathie à Palermo",
    description:
      "Réservez votre séance en cabinet de kinésithérapie, ostéopathie, RPG, ATM ou acupuncture chez Kinésica (Palermo, Buenos Aires). Séances individuelles d'une heure.",
    breadcrumb: "Réserver",
    eyebrow: "Réservation en ligne",
    h1: "Prenez rendez-vous chez Kinésica",
    lead:
      "Indiquez si vous avez déjà été suivi au cabinet ou s'il s'agit d'une première consultation pour consulter les créneaux disponibles en temps réel.",
    highlights: [
      {
        icon: "fa-clock-o",
        title: "Séance individuelle d'une heure",
        text: "Chaque rendez-vous est personnalisé et individuel avec le praticien en salle privée.",
      },
      {
        icon: "fa-map-marker",
        title: "Cabinet à Palermo",
        text: `${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood} (${CONTACT.address.addressRegion}). Du lundi au vendredi de ${OPENING_HOURS.opens} à ${OPENING_HOURS.closes}.`,
      },
      {
        icon: "fa-file-text-o",
        title: "Facturation et remboursement",
        text: "Consultations privées. Nous délivrons une facture officielle pour votre demande de remboursement.",
      },
    ],
  },
  pt: {
    title: "Agendar Consulta Online | Kinésica — Fisioterapia e Osteopatia em Palermo",
    description:
      "Reserve sua sessão presencial de fisioterapia, osteopatia, RPG, ATM ou acupuntura na Kinésica (Palermo, Buenos Aires). Consultas individuais de 1 hora.",
    breadcrumb: "Agendar",
    eyebrow: "Agendamento online",
    h1: "Agende sua consulta na Kinésica",
    lead:
      "Selecione se você já se atendeu conosco ou se é sua primeira consulta para ver os dias e horários disponíveis em tempo real.",
    highlights: [
      {
        icon: "fa-clock-o",
        title: "Atendimento individual de 1 hora",
        text: "Cada sessão é personalizada e exclusiva com o profissional em consultório privado.",
      },
      {
        icon: "fa-map-marker",
        title: "Consultório em Palermo",
        text: `${CONTACT.address.streetAddress}, ${CONTACT.address.addressNeighborhood} (${CONTACT.address.addressRegion}). Segunda a sexta das ${OPENING_HOURS.opens} às ${OPENING_HOURS.closes}.`,
      },
      {
        icon: "fa-file-text-o",
        title: "Modalidade e reembolso",
        text: "Atendimento particular. Emitimos comprovante oficial para solicitação de reembolso no seu plano de saúde.",
      },
    ],
  },
};
