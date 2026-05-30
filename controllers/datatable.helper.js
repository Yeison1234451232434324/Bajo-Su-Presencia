/**
 * ============================================================
 * HELPER: datatable.helper.js
 * ============================================================
 * Motor de DataTable reutilizable para todos los historiales
 * del panel. Sin dependencias externas.
 *
 * Uso:
 *   const dt = new BSPDataTable({
 *     containerId: 'lista-noticias',   // ID del contenedor
 *     data: [],                         // array de objetos
 *     pageSize: 8,                      // registros por página
 *     searchFields: ['titulo','autor'], // campos para buscar
 *     renderRow: (item) => '<div>...</div>', // función de render
 *     emptyHTML: '<div>Sin datos</div>'
 *   });
 *   dt.init();
 *   dt.refresh(nuevoArray); // actualizar datos
 * ============================================================
 */

class BSPDataTable {
  constructor(opts) {
    this.containerId   = opts.containerId;
    this.allData       = opts.data || [];
    this.filteredData  = [...this.allData];
    this.pageSize      = opts.pageSize || 8;
    this.currentPage   = 1;
    this.searchFields  = opts.searchFields || [];
    this.renderRow     = opts.renderRow;
    this.emptyHTML     = opts.emptyHTML || '<div class="dt-empty"><i class="bx bx-search-alt"></i><p>No se encontraron registros.</p></div>';
    this.searchQuery   = '';
    this._wrapId       = this.containerId + '-dt-wrap';
  }

  // ── Inicializar ──────────────────────────────────────────────────────────
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    // Crear wrapper con barra de herramientas
    const wrap = document.createElement('div');
    wrap.id        = this._wrapId;
    wrap.className = 'dt-wrapper';
    wrap.innerHTML = `
      <div class="dt-toolbar">
        <div class="dt-search-wrap">
          <i class="bx bx-search dt-search-icon"></i>
          <input
            type="text"
            class="dt-search-input"
            id="${this.containerId}-dt-search"
            placeholder="Buscar en el historial…"
            autocomplete="off"
          />
          <button class="dt-clear-btn" id="${this.containerId}-dt-clear" title="Limpiar búsqueda" style="display:none;">
            <i class="bx bx-x"></i>
          </button>
        </div>
        <div class="dt-info" id="${this.containerId}-dt-info">
          Cargando…
        </div>
      </div>
      <div class="dt-body" id="${this.containerId}-dt-body"></div>
      <div class="dt-pagination" id="${this.containerId}-dt-pag"></div>
    `;

    // Reemplazar el contenedor original con el wrapper
    container.parentNode.insertBefore(wrap, container);
    container.remove();

    // Eventos de búsqueda
    const searchInput = document.getElementById(`${this.containerId}-dt-search`);
    const clearBtn    = document.getElementById(`${this.containerId}-dt-clear`);

    searchInput.addEventListener('input', () => {
      this.searchQuery  = searchInput.value.trim().toLowerCase();
      clearBtn.style.display = this.searchQuery ? 'flex' : 'none';
      this.currentPage  = 1;
      this._applyFilter();
      this._render();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value      = '';
      this.searchQuery       = '';
      clearBtn.style.display = 'none';
      this.currentPage       = 1;
      this._applyFilter();
      this._render();
      searchInput.focus();
    });

    this._applyFilter();
    this._render();
  }

  // ── Filtrar datos ────────────────────────────────────────────────────────
  _applyFilter() {
    if (!this.searchQuery) {
      this.filteredData = [...this.allData];
      return;
    }
    this.filteredData = this.allData.filter(item =>
      this.searchFields.some(field => {
        const val = item[field];
        return val && String(val).toLowerCase().includes(this.searchQuery);
      })
    );
  }

  // ── Renderizar página actual ─────────────────────────────────────────────
  _render() {
    const body    = document.getElementById(`${this.containerId}-dt-body`);
    const pagWrap = document.getElementById(`${this.containerId}-dt-pag`);
    const info    = document.getElementById(`${this.containerId}-dt-info`);
    if (!body) return;

    const total      = this.filteredData.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(this.currentPage, totalPages);

    const start = (this.currentPage - 1) * this.pageSize;
    const end   = Math.min(start + this.pageSize, total);
    const page  = this.filteredData.slice(start, end);

    // Info de registros
    if (total === 0) {
      info.textContent = 'Sin resultados';
    } else {
      info.textContent = `Mostrando ${start + 1}–${end} de ${total} registro${total !== 1 ? 's' : ''}`;
    }

    // Cuerpo
    if (total === 0) {
      body.innerHTML = this.emptyHTML;
    } else {
      body.innerHTML = page.map(item => this.renderRow(item)).join('');
    }

    // Paginación
    this._renderPagination(pagWrap, totalPages);
  }

  // ── Renderizar paginación ────────────────────────────────────────────────
  _renderPagination(wrap, totalPages) {
    if (totalPages <= 1) { wrap.innerHTML = ''; return; }

    let html = '<div class="dt-pag-inner">';

    // Botón anterior
    html += `<button class="dt-pag-btn dt-pag-prev" ${this.currentPage === 1 ? 'disabled' : ''}
      onclick="window.__dtInstances['${this.containerId}'].goPage(${this.currentPage - 1})">
      <i class="bx bx-chevron-left"></i>
    </button>`;

    // Páginas
    const range = this._pageRange(this.currentPage, totalPages);
    range.forEach(p => {
      if (p === '…') {
        html += `<span class="dt-pag-ellipsis">…</span>`;
      } else {
        html += `<button class="dt-pag-btn ${p === this.currentPage ? 'dt-pag-btn--active' : ''}"
          onclick="window.__dtInstances['${this.containerId}'].goPage(${p})">${p}</button>`;
      }
    });

    // Botón siguiente
    html += `<button class="dt-pag-btn dt-pag-next" ${this.currentPage === totalPages ? 'disabled' : ''}
      onclick="window.__dtInstances['${this.containerId}'].goPage(${this.currentPage + 1})">
      <i class="bx bx-chevron-right"></i>
    </button>`;

    html += '</div>';
    wrap.innerHTML = html;
  }

  // ── Rango de páginas con elipsis ─────────────────────────────────────────
  _pageRange(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  // ── Ir a página ──────────────────────────────────────────────────────────
  goPage(n) {
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    this.currentPage = Math.max(1, Math.min(n, totalPages));
    this._render();
    // Scroll suave al inicio del DataTable
    const wrap = document.getElementById(this._wrapId);
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Actualizar datos (llamar cuando cambia el modelo) ────────────────────
  refresh(newData) {
    this.allData     = newData || [];
    this.currentPage = 1;
    this._applyFilter();
    this._render();
  }
}

// Registro global de instancias para que los botones de paginación funcionen
window.__dtInstances = window.__dtInstances || {};
