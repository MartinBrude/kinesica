export const MAX_RESULTS = 8;

export const PUBLIC_BOOKING_API_URL =
  "https://script.google.com/macros/s/AKfycbziFcZejUUlY8cdOTCyENzACIu27soawUul0Ti1lKjpIDg9CuqEB31wwDI6WpZjTmAEpQ/exec";

let modal = null;
let widget = null;
let patients = [];
let patientsLoaded = false;
let picker = null;
let activeIndex = -1;
let currentResults = [];

export function getModal() { return modal; }
export function setModal(el) { modal = el; }

export function getWidget() { return widget; }
export function setWidget(w) { widget = w; }

export function getPatients() { return patients; }
export function setPatients(list) { patients = Array.isArray(list) ? list : []; }

export function isPatientsLoaded() { return patientsLoaded; }
export function setPatientsLoaded(value) { patientsLoaded = Boolean(value); }

export function getPicker() { return picker; }
export function setPicker(el) { picker = el; }

export function getActiveIndex() { return activeIndex; }
export function setActiveIndex(idx) { activeIndex = idx; }

export function getCurrentResults() { return currentResults; }
export function setCurrentResults(list) { currentResults = Array.isArray(list) ? list : []; }
