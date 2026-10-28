/**
 * Kinésica Admin - Paginador de la Biblioteca
 * Controla el cálculo de ventanas de paginación y renderiza controles ← Anterior / Siguiente →.
 */

let currentPage = 0;

export function getLibraryPage() {
  return currentPage;
}

export function setLibraryPage(p) {
  currentPage = Math.max(0, p);
}

/**
 * Aplica el corte de paginación para una lista de elementos.
 * @param {Array<any>} rows Lista de filas a paginar
 * @param {HTMLSelectElement} pageSizeSelect
 * @param {HTMLElement} libraryPager
 * @param {() => void} onPageChange
 * @returns {Array<any>} Subconjunto de filas según la página actual
 */
export function pageWindow(rows, pageSizeSelect, libraryPager, onPageChange) {
  const size = pageSizeSelect && pageSizeSelect.value === "all"
    ? rows.length
    : Number(pageSizeSelect?.value || 25);
  const totalPages = Math.max(1, Math.ceil(rows.length / (size || 1)));
  currentPage = Math.max(0, Math.min(currentPage, totalPages - 1));

  if (libraryPager) {
    libraryPager.innerHTML = "";
    if (rows.length > 0 && size < rows.length) {
      const prev = document.createElement("button");
      prev.type = "button";
      prev.className = "btn ghost";
      prev.textContent = "← Anterior";
      prev.disabled = currentPage === 0;
      prev.addEventListener("click", () => {
        currentPage -= 1;
        if (typeof onPageChange === "function") onPageChange();
      });

      const span = document.createElement("span");
      const unit = rows.length === 1 ? "paciente" : "pacientes";
      span.textContent = `Página ${currentPage + 1} de ${totalPages} (${rows.length} ${unit})`;

      const next = document.createElement("button");
      next.type = "button";
      next.className = "btn ghost";
      next.textContent = "Siguiente →";
      next.disabled = currentPage >= totalPages - 1;
      next.addEventListener("click", () => {
        currentPage += 1;
        if (typeof onPageChange === "function") onPageChange();
      });

      libraryPager.append(prev, span, next);
    }
  }

  const start = currentPage * size;
  return rows.slice(start, start + size);
}
