/**
 * ============================================================
 * CLIENTE DE DATOS (espejo de Supabase sobre el Data Gateway PHP)
 * ============================================================
 * Expone window.DB con una API encadenable que imita el subconjunto de
 * supabase-js usado por los modelos del panel:
 *
 *   DB.from(tabla).select(cols).order(col,{ascending}).eq().in().ilike().limit()
 *   DB.from(tabla).insert(obj).select(cols).single()
 *   DB.from(tabla).update(obj).eq().select(cols).single()
 *   DB.from(tabla).delete().eq()
 *
 * Cada cadena es "thenable": `await DB.from(...)...` resuelve a { data, error },
 * igual que supabase-js, por lo que los modelos solo cambian `sb` → `DB`.
 *
 * Las peticiones van a {API_BASE}/api/db/{tabla} con el JWT propio (Bearer).
 * Requiere api.config.js (API_BASE, bspAuth, bspRefreshToken).
 * ============================================================
 */
(function () {
  'use strict';

  class Query {
    constructor(table) {
      this.table = table;
      this.op = 'select';
      this.cols = '*';
      this.filters = [];
      this.orderStr = null;
      this.limitN = null;
      this.body = null;
      this.returning = false;
      this.single_ = false;
    }

    select(cols = '*') {
      if (this.op === 'select') this.cols = cols;
      else { this.returning = true; this.cols = cols; }
      return this;
    }
    order(col, opts = {}) {
      const asc = opts.ascending !== false;
      this.orderStr = `${col}.${asc ? 'asc' : 'desc'}`;
      return this;
    }
    eq(col, val)   { this.filters.push(`${encodeURIComponent(col)}=eq.${encodeURIComponent(val)}`); return this; }
    ilike(col, val){ this.filters.push(`${encodeURIComponent(col)}=ilike.${encodeURIComponent(val)}`); return this; }
    in(col, arr)   {
      const vals = (arr || []).map(encodeURIComponent).join(',');
      this.filters.push(`${encodeURIComponent(col)}=in.(${vals})`);
      return this;
    }
    limit(n)       { this.limitN = n; return this; }
    single()       { this.single_ = true; return this; }
    maybeSingle()  { this.single_ = true; return this; }

    insert(body)   { this.op = 'insert'; this.body = body; return this; }
    update(body)   { this.op = 'update'; this.body = body; return this; }
    delete()       { this.op = 'delete'; return this; }

    _queryString() {
      const parts = [...this.filters];
      if (this.cols && (this.op === 'select' || this.returning)) {
        parts.push('select=' + encodeURIComponent(this.cols));
      }
      if (this.orderStr) parts.push('order=' + encodeURIComponent(this.orderStr));
      if (this.limitN != null) parts.push('limit=' + this.limitN);
      return parts.join('&');
    }

    async _run() {
      const method = { select: 'GET', insert: 'POST', update: 'PATCH', delete: 'DELETE' }[this.op];
      const path = `/api/db/${this.table}?${this._queryString()}`;
      try {
        const data = await window.apiFetch(path, {
          method,
          body: (this.op === 'insert' || this.op === 'update') ? this.body : null
        });
        const rows = Array.isArray(data) ? data : (data == null ? [] : [data]);
        return { data: this.single_ ? (rows[0] ?? null) : rows, error: null };
      } catch (e) {
        return { data: null, error: { message: e.message } };
      }
    }

    // Thenable: permite `await DB.from()...`
    then(resolve, reject) { return this._run().then(resolve, reject); }
  }

  window.DB = { from: (table) => new Query(table) };
})();
