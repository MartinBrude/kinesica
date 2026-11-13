export const form = typeof document !== "undefined" ? document.querySelector("#ficha") : null;

let identityKey = "";
let identityEdited = false;
let directoryPacientesCache = [];
let directoryLoaded = false;

export function getIdentityKey() { return identityKey; }
export function setIdentityKey(key) { identityKey = key || ""; }

export function isIdentityEdited() { return identityEdited; }
export function setIdentityEdited(edited) { identityEdited = Boolean(edited); }

export function getDirectoryPacientesCache() { return directoryPacientesCache; }
export function setDirectoryPacientesCache(list) { directoryPacientesCache = Array.isArray(list) ? list : []; }

export function isDirectoryLoaded() { return directoryLoaded; }
export function setDirectoryLoaded(loaded) { directoryLoaded = Boolean(loaded); }
