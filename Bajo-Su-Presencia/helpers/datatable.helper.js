/**
 * ============================================================
 * BSP DataTable v3.0 — 2026
 * ============================================================
 * Motor de tabla de datos profesional sin dependencias externas.
 *
 * Características:
 *   ✦ Búsqueda en tiempo real con debounce (220ms)
 *   ✦ Filtros dinámicos por campo (select, date-range, stars)
 *   ✦ Paginación inteligente con elipsis + botones primera/última
 *   ✦ Selector de registros por página (5/10/25/50)
 *   ✦ Exportación CSV y Excel (.xlsx con SheetJS CDN)
 *   ✦ Contador de registros animado
 *   ✦ Estado vacío personalizable con SVG
 *   ✦ Animación de entrada escalonada en tarjetas
 *   ✦ Modo tarjetas (cards) para historiales
 *   ✦ Resumen estadístico automático (total, filtrados)
 *
 * Uso:
 *   const dt = new BSPDataTable({
 *     containerId:  'lista-noticias',
 *     data:         [],
 *     pageSize:     10,
 *     searchFields: ['titulo','autor'],
 *     filters: [
 *       { key:'autor', label:'Autor', type:'select', options:['Pastor Carlos','Hna. María'] },
 *       { key:'fechaISO', label:'Desde', type:'date-from' },
 *       { key:'fechaISO', label:'Hasta', type:'date-to' },
 *     ],
 *     renderRow:    (item) => '<div>...</div>',
 *     emptyHTML:    '<div>Sin datos</div>',
 *     exportable:   true,
 *     exportName:   'noticias',
 *     exportFields: ['titulo','autor','fecha','resumen'],
 *     exportLabels: ['Título','Autor','Fecha','Resumen'],
 *   });
 *   dt.init();
 *   dt.refresh(nuevoArray);
 * ============================================================
 */

class BSPDataTable {
  constructor(opts = {}) {
    this.containerId   = opts.containerId;
    this.allData       = opts.data || [];
    this.filteredData  = [...this.allData];
    this.pageSize      = opts.pageSize || 10;
    this.currentPage   = 1;
    this.searchFields  = opts.searchFields || [];
    this.filters       = opts.filters || [];          // filtros dinámicos
    this.renderRow     = opts.renderRow || (() => '');
    this.emptyHTML     = opts.emptyHTML || this._defaultEmpty();
    this.exportable    = opts.exportable !== false;
    this.exportName    = opts.exportName || 'datos';
    this.exportFields  = opts.exportFields || this.searchFields;
    this.exportLabels  = opts.exportLabels || this.exportFields;
    this.searchQuery   = '';
    this.activeFilters = {};                          // { key: value }
    this._wrapId       = this.containerId + '-bsp-dt';
    this._debounce     = null;
    this._xlsxLoaded   = false;
    this.tableMode     = opts.tableMode || false;     // true = renderRow devuelve <tr>
    this.tableClass    = opts.tableClass || '';       // clase CSS de la tabla
    this.headerHTML    = opts.headerHTML || '';       // fila de títulos de columna, opcional
  }

  // ── Inicializar ──────────────────────────────────────────────────────────
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    if (document.getElementById(this._wrapId)) return;

    const wrap = document.createElement('div');
    wrap.id        = this._wrapId;
    wrap.className = 'bsp-dt';

    // Construir HTML de filtros dinámicos
    const filtersHTML = this.filters.length ? `
      <div class="bsp-dt-filters" id="${this.containerId}-filters">
        ${this.filters.map((f, i) => this._buildFilterHTML(f, i)).join('')}
        <button class="bsp-dt-filter-clear" id="${this.containerId}-fclear" title="Limpiar filtros">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
          Limpiar
        </button>
      </div>` : '';

    wrap.innerHTML = `
      <!-- Barra superior -->
      <div class="bsp-dt-topbar">
        <div class="bsp-dt-topbar-left">
          <div class="bsp-dt-page-size-wrap">
            <span class="bsp-dt-label">Mostrar</span>
            <select class="bsp-dt-page-select" id="${this.containerId}-ps">
              <option value="5">5</option>
              <option value="10" ${this.pageSize===10?'selected':''}>10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
            <span class="bsp-dt-label">registros</span>
          </div>
        </div>
        <div class="bsp-dt-topbar-right">
          ${this.exportable ? `
          <div class="bsp-dt-export-group">
            <button class="bsp-dt-export-btn bsp-dt-export-csv" id="${this.containerId}-csv" title="Exportar CSV">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              CSV
            </button>
            <button class="bsp-dt-export-btn bsp-dt-export-xlsx" id="${this.containerId}-xlsx" title="Exportar Excel">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
              Excel
            </button>
          </div>` : ''}
          <div class="bsp-dt-search-wrap">
            <svg class="bsp-dt-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" class="bsp-dt-search" id="${this.containerId}-search"
              placeholder="Buscar registros…" autocomplete="off"/>
            <button class="bsp-dt-search-clear" id="${this.containerId}-clear" style="display:none;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Filtros dinámicos -->
      ${filtersHTML}

      <!-- Resumen de filtros activos -->
      <div class="bsp-dt-active-filters" id="${this.containerId}-af" style="display:none;"></div>

      <!-- Fila de títulos de columna, opcional -->
      ${this.headerHTML ? `<div class="bsp-dt-header-row" id="${this.containerId}-header">${this.headerHTML}</div>` : ''}

      <!-- Cuerpo -->
      <div class="bsp-dt-body" id="${this.containerId}-body"></div>

      <!-- Barra inferior -->
      <div class="bsp-dt-bottombar">
        <div class="bsp-dt-info" id="${this.containerId}-info">—</div>
        <div class="bsp-dt-pag" id="${this.containerId}-pag"></div>
      </div>
    `;

    container.parentNode.insertBefore(wrap, container);
    container.remove();

    this._bindEvents();
    this._applyFilter();
    this._render();

    window.__bspDT = window.__bspDT || {};
    window.__bspDT[this.containerId] = this;
  }

  // ── Construir HTML de un filtro ──────────────────────────────────────────
  _buildFilterHTML(f, i) {
    const id = `${this.containerId}-f${i}`;
    if (f.type === 'select') {
      const opts = (f.options || []).map(o =>
        `<option value="${o}">${o}</option>`
      ).join('');
      return `
        <div class="bsp-dt-filter-item">
          <label class="bsp-dt-filter-label">${f.label}</label>
          <select class="bsp-dt-filter-select" id="${id}" data-key="${f.key}" data-type="select">
            <option value="">Todos</option>${opts}
          </select>
        </div>`;
    }
    if (f.type === 'date-from') {
      return `
        <div class="bsp-dt-filter-item">
          <label class="bsp-dt-filter-label">${f.label}</label>
          <input type="date" class="bsp-dt-filter-date" id="${id}" data-key="${f.key}" data-type="date-from"/>
        </div>`;
    }
    if (f.type === 'date-to') {
      return `
        <div class="bsp-dt-filter-item">
          <label class="bsp-dt-filter-label">${f.label}</label>
          <input type="date" class="bsp-dt-filter-date" id="${id}" data-key="${f.key}" data-type="date-to"/>
        </div>`;
    }
    if (f.type === 'stars') {
      const opts = ['', '1', '2', '3', '4', '5'].map((v, i) =>
        `<option value="${v}">${v ? '★'.repeat(Number(v)) + ' (' + v + ')' : 'Todas'}</option>`
      ).join('');
      return `
        <div class="bsp-dt-filter-item">
          <label class="bsp-dt-filter-label">${f.label}</label>
          <select class="bsp-dt-filter-select" id="${id}" data-key="${f.key}" data-type="stars">
            ${opts}
          </select>
        </div>`;
    }
    return '';
  }

  // ── Eventos ──────────────────────────────────────────────────────────────
  _bindEvents() {
    const searchEl = document.getElementById(`${this.containerId}-search`);
    const clearEl  = document.getElementById(`${this.containerId}-clear`);
    const psEl     = document.getElementById(`${this.containerId}-ps`);
    const csvEl    = document.getElementById(`${this.containerId}-csv`);
    const xlsxEl   = document.getElementById(`${this.containerId}-xlsx`);
    const fclearEl = document.getElementById(`${this.containerId}-fclear`);

    searchEl?.addEventListener('input', () => {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => {
        this.searchQuery = searchEl.value.trim().toLowerCase();
        clearEl.style.display = this.searchQuery ? 'flex' : 'none';
        this.currentPage = 1;
        this._applyFilter();
        this._render();
      }, 220);
    });

    clearEl?.addEventListener('click', () => {
      searchEl.value = '';
      this.searchQuery = '';
      clearEl.style.display = 'none';
      this.currentPage = 1;
      this._applyFilter();
      this._render();
      searchEl.focus();
    });

    psEl?.addEventListener('change', () => {
      this.pageSize = parseInt(psEl.value);
      this.currentPage = 1;
      this._render();
    });

    csvEl?.addEventListener('click', () => this._exportCSV());
    xlsxEl?.addEventListener('click', () => this._exportXLSX());

    // Filtros dinámicos
    this.filters.forEach((f, i) => {
      const el = document.getElementById(`${this.containerId}-f${i}`);
      if (!el) return;
      el.addEventListener('change', () => {
        const key  = el.dataset.key;
        const type = el.dataset.type;
        const val  = el.value;
        if (!val) {
          delete this.activeFilters[`${key}_${type}`];
        } else {
          this.activeFilters[`${key}_${type}`] = { key, type, val };
        }
        this.currentPage = 1;
        this._applyFilter();
        this._render();
        this._renderActiveFilters();
      });
    });

    fclearEl?.addEventListener('click', () => this._clearAllFilters());
  }

  // ── Limpiar todos los filtros ────────────────────────────────────────────
  _clearAllFilters() {
    this.activeFilters = {};
    this.filters.forEach((f, i) => {
      const el = document.getElementById(`${this.containerId}-f${i}`);
      if (el) el.value = '';
    });
    const searchEl = document.getElementById(`${this.containerId}-search`);
    const clearEl  = document.getElementById(`${this.containerId}-clear`);
    if (searchEl) { searchEl.value = ''; }
    if (clearEl)  { clearEl.style.display = 'none'; }
    this.searchQuery = '';
    this.currentPage = 1;
    this._applyFilter();
    this._render();
    this._renderActiveFilters();
  }

  // ── Mostrar chips de filtros activos ─────────────────────────────────────
  _renderActiveFilters() {
    const wrap = document.getElementById(`${this.containerId}-af`);
    if (!wrap) return;
    const activos = Object.values(this.activeFilters);
    if (!activos.length && !this.searchQuery) {
      wrap.style.display = 'none';
      wrap.innerHTML = '';
      return;
    }
    wrap.style.display = 'flex';
    const chips = [];
    if (this.searchQuery) {
      chips.push(`<span class="bsp-dt-chip">🔍 "${this.searchQuery}"</span>`);
    }
    activos.forEach(f => {
      const label = this.filters.find(fi => fi.key === f.key)?.label || f.key;
      chips.push(`<span class="bsp-dt-chip">${label}: <strong>${f.val}</strong></span>`);
    });
    wrap.innerHTML = chips.join('') +
      `<button class="bsp-dt-chip-clear" onclick="window.__bspDT['${this.containerId}']._clearAllFilters()">
        Limpiar todo ×
      </button>`;
  }

  // ── Filtrar datos ────────────────────────────────────────────────────────
  _applyFilter() {
    let data = [...this.allData];

    // Búsqueda de texto
    if (this.searchQuery) {
      data = data.filter(item =>
        this.searchFields.some(f => {
          const v = item[f];
          return v && String(v).toLowerCase().includes(this.searchQuery);
        })
      );
    }

    // Filtros dinámicos
    Object.values(this.activeFilters).forEach(({ key, type, val }) => {
      if (!val) return;
      if (type === 'select') {
        data = data.filter(item => String(item[key] || '') === val);
      } else if (type === 'date-from') {
        data = data.filter(item => {
          const d = item[key] || item['fechaISO'] || item['fecha'];
          return d && d >= val;
        });
      } else if (type === 'date-to') {
        data = data.filter(item => {
          const d = item[key] || item['fechaISO'] || item['fecha'];
          return d && d <= val;
        });
      } else if (type === 'stars') {
        data = data.filter(item => String(item[key]) === val);
      }
    });

    this.filteredData = data;
  }

  // ── Renderizar ───────────────────────────────────────────────────────────
  _render() {
    const body    = document.getElementById(`${this.containerId}-body`);
    const pagWrap = document.getElementById(`${this.containerId}-pag`);
    const info    = document.getElementById(`${this.containerId}-info`);
    if (!body) return;

    const total      = this.filteredData.length;
    const totalAll   = this.allData.length;
    const totalPages = Math.max(1, Math.ceil(total / this.pageSize));
    this.currentPage = Math.min(this.currentPage, totalPages);

    const start = (this.currentPage - 1) * this.pageSize;
    const end   = Math.min(start + this.pageSize, total);
    const page  = this.filteredData.slice(start, end);

    // Info
    if (total === 0) {
      info.innerHTML = `<span class="bsp-dt-info-zero">Sin resultados para los filtros aplicados</span>`;
    } else if (total < totalAll) {
      info.innerHTML = `Mostrando <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> filtrados <span class="bsp-dt-info-total">(${totalAll} total)</span>`;
    } else {
      info.innerHTML = `Mostrando <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> registro${total !== 1 ? 's' : ''}`;
    }

    // Cuerpo — modo tabla o modo tarjetas
    if (total === 0) {
      body.innerHTML = this.emptyHTML;
    } else if (this.tableMode) {
      // Modo tabla: renderRow devuelve <tr>...</tr>
      body.innerHTML = `<table class="${this.tableClass}" style="width:100%;border-collapse:collapse;">
        <tbody>${page.map((item, i) =>
          `<tr style="animation:bspDtFadeIn 0.25s ease ${i*25}ms both;">${
            this.renderRow(item).replace(/^\s*<tr[^>]*>|<\/tr>\s*$/gi, '')
          }</tr>`
        ).join('')}</tbody>
      </table>`;
    } else {
      // Modo tarjetas (default)
      body.innerHTML = page.map((item, i) =>
        `<div class="bsp-dt-row-wrap" style="animation-delay:${i * 25}ms">${this.renderRow(item)}</div>`
      ).join('');
    }

    this._renderPag(pagWrap, totalPages);
  }

  // ── Paginación ───────────────────────────────────────────────────────────
  _renderPag(wrap, total) {
    if (total <= 1) { wrap.innerHTML = ''; return; }
    const cur = this.currentPage;
    const id  = this.containerId;
    let html  = '<div class="bsp-dt-pag-inner">';

    html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${cur===1?'disabled':''} onclick="window.__bspDT['${id}'].goPage(1)" title="Primera">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
    </button>`;
    html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${cur===1?'disabled':''} onclick="window.__bspDT['${id}'].goPage(${cur-1})" title="Anterior">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="15 18 9 12 15 6"/></svg>
    </button>`;

    this._pageRange(cur, total).forEach(p => {
      if (p === '…') {
        html += `<span class="bsp-dt-pag-ellipsis">…</span>`;
      } else {
        html += `<button class="bsp-dt-pag-btn ${p===cur?'bsp-dt-pag-active':''}"
          onclick="window.__bspDT['${id}'].goPage(${p})">${p}</button>`;
      }
    });

    html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${cur===total?'disabled':''} onclick="window.__bspDT['${id}'].goPage(${cur+1})" title="Siguiente">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="9 18 15 12 9 6"/></svg>
    </button>`;
    html += `<button class="bsp-dt-pag-btn bsp-dt-pag-nav" ${cur===total?'disabled':''} onclick="window.__bspDT['${id}'].goPage(${total})" title="Última">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
    </button>`;

    html += '</div>';
    wrap.innerHTML = html;
  }

  _pageRange(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [1];
    if (cur > 3) pages.push('…');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('…');
    pages.push(total);
    return pages;
  }

  goPage(n) {
    const max = Math.ceil(this.filteredData.length / this.pageSize);
    this.currentPage = Math.max(1, Math.min(n, max));
    this._render();
    const wrap = document.getElementById(this._wrapId);
    if (wrap) wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Exportar CSV ─────────────────────────────────────────────────────────
  _exportCSV() {
    const data   = this.filteredData;
    if (!data.length) return;
    const fields = this.exportFields.length ? this.exportFields : Object.keys(data[0]);
    const labels = this.exportLabels.length ? this.exportLabels : fields;
    const header = labels.join(',');
    const rows   = data.map(item =>
      fields.map(f => `"${String(item[f] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv  = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${this.exportName}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Exportar Excel con SheetJS ───────────────────────────────────────────
  _exportXLSX() {
    const data = this.filteredData;
    if (!data.length) { showToast && showToast('Sin datos', 'No hay registros para exportar.'); return; }

    // Cargar SheetJS desde CDN si no está disponible
    if (typeof XLSX === 'undefined') {
      const script = document.createElement('script');
      script.src   = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.onload = () => this._doExportXLSX(data);
      document.head.appendChild(script);
    } else {
      this._doExportXLSX(data);
    }
  }

  _doExportXLSX(data) {
    const fields = this.exportFields.length ? this.exportFields : Object.keys(data[0]);
    const labels = this.exportLabels.length ? this.exportLabels : fields;
    const nombre = this.exportName;
    const fecha  = new Date().toLocaleDateString('es-CO');

    // ── Hoja 1: Datos ──────────────────────────────────────────────────────
    const wsData = [
      labels,
      ...data.map(item => fields.map(f => item[f] ?? ''))
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Estilo de encabezado (ancho de columnas automático)
    const colWidths = labels.map((l, i) => {
      const maxLen = Math.max(
        l.length,
        ...data.map(item => String(item[fields[i]] ?? '').length)
      );
      return { wch: Math.min(maxLen + 4, 40) };
    });
    ws['!cols'] = colWidths;

    // ── Hoja 2: Resumen estadístico ────────────────────────────────────────
    const stats = this._calcStats(data, fields);
    const wsStats = XLSX.utils.aoa_to_sheet([
      [`Reporte: ${nombre.toUpperCase()}`],
      [`Generado: ${fecha}`],
      [`Total registros: ${data.length}`],
      [],
      ['Campo', 'Valores únicos', 'Más frecuente'],
      ...stats
    ]);
    wsStats['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 30 }];

    // ── Workbook ───────────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.utils.book_append_sheet(wb, wsStats, 'Resumen');

    XLSX.writeFile(wb, `${nombre}_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // Calcula estadísticas básicas por campo para la hoja de resumen
  _calcStats(data, fields) {
    return fields.map(f => {
      const vals = data.map(item => String(item[f] ?? '')).filter(Boolean);
      const freq = {};
      vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      const masFrec = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      const unicos  = Object.keys(freq).length;
      return [f, unicos, masFrec ? `${masFrec[0]} (${masFrec[1]}x)` : '—'];
    });
  }

  // ── Actualizar datos ─────────────────────────────────────────────────────
  refresh(newData) {
    this.allData     = newData || [];
    this.currentPage = 1;
    this._applyFilter();
    this._render();
    this._renderActiveFilters();
  }

  // ── Estado vacío ─────────────────────────────────────────────────────────
  _defaultEmpty() {
    return `<div class="bsp-dt-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="52" height="52">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
      <p>No se encontraron registros</p>
      <small>Intenta con otros términos o limpia los filtros</small>
    </div>`;
  }
}

window.__bspDT = window.__bspDT || {};
