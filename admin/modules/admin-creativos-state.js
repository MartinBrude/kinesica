/** Estado compartido de la galería de creativos Instagram. */

let activeFormat = "feed"; // 'feed' | 'story'
let activeFilter = "todos"; // 'todos' | 'columna' | 'articulaciones' | 'filosofia' | 'papelera'
let searchQuery = "";
let selectedItem = null;

export function getActiveFormat() {
  return activeFormat;
}

export function setActiveFormat(value) {
  activeFormat = value;
}

export function getActiveFilter() {
  return activeFilter;
}

export function setActiveFilter(value) {
  activeFilter = value;
}

export function getSearchQuery() {
  return searchQuery;
}

export function setSearchQuery(value) {
  searchQuery = value;
}

export function getSelectedItem() {
  return selectedItem;
}

export function setSelectedItem(item) {
  selectedItem = item;
}
