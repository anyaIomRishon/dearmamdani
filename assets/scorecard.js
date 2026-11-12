// Loads data/scorecard.json and grades each measure. Used by the home page and the scorecard page.
(function () {
  const root = document.documentElement.dataset.root || '';
  const fmt = (v, unit) => {
    if (v === null || v === undefined || v === '') return '';
    v = Number(v);
    if (unit === 'pct') return v.toFixed(1) + '%';
    if (unit === 'usd') {
      if (Math.abs(v) >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
      if (Math.abs(v) >= 1e6) return '$' + Math.round(v / 1e6).toLocaleString('en-US') + 'M';
      return '$' + Math.round(v).toLocaleString('en-US');
    }
    if (Math.abs(v) >= 1e7) return (v / 1e6).toFixed(1) + 'M';
    return Math.round(v).toLocaleString('en-US');
  };
  const grade = (r) => {
    const prev = Number(r.prev), curr = Number(r.curr), thr = Number(r.threshold);
    const change = r.unit === 'pct' ? curr - prev : (prev === 0 ? 0 : (curr - prev) / prev * 100);
    const sign = change > 0 ? '+' : change < 0 ? '−' : '';
    const changeText = sign + Math.abs(change).toFixed(1) + (r.unit === 'pct' ? ' pts' : '%');
    let verdict = 'Context';
    if (r.better !== 'none') verdict = Math.abs(change) < thr ? 'About the same' : ((change > 0) === (r.better === 'up') ? 'Better' : 'Worse');
    return Object.assign({}, r, { change, changeText, verdict, prevText: fmt(prev, r.unit), currText: fmt(curr, r.unit) });
  };
  const cls = (v) => ({ 'Better': 'better', 'Worse': 'worse', 'About the same': 'same' }[v] || 'context');
  const el = (tag, attrs, text) => { const e = document.createElement(tag); for (const k in attrs || {}) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const slug = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function moves(rows, dir, target, n) {
    if (!target) return;
    target.replaceChildren();
    rows.filter((r) => r.verdict === dir && r.unit !== 'pct' && r.home !== 'no')
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, n)
      .forEach((r) => {
        const li = el('li');
        li.append(el('span', {}, r.metric), el('span', { class: 'num ' + cls(r.verdict) }, r.changeText + ' (' + r.prevText + ' → ' + r.currText + ')'));
        target.appendChild(li);
      });
  }

  function tally(rows, target) {
    if (!target) return;
    const n = (v) => rows.filter((r) => r.verdict === v).length;
    const items = [['Worse', n('Worse'), 'worse'], ['Better', n('Better'), 'better'], ['About the same', n('About the same'), 'same']];
    target.replaceChildren();
    for (const [label, count, c] of items) {
      const card = el('div', { class: 'card' });
      card.append(el('span', { class: 'big ' + c }, String(count)), el('span', { class: 'lbl' }, label));
      target.appendChild(card);
    }
  }

  function bars(rows, target) {
    if (!target) return;
    const cats = [...new Set(rows.map((r) => r.category))];
    const max = Math.max(...cats.map((c) => rows.filter((r) => r.category === c).length));
    target.replaceChildren();
    for (const c of cats) {
      const rs = rows.filter((r) => r.category === c);
      const row = el('div', { class: 'bar-row' });
      const link = el('a', { href: '#' + slug(c) }, c);
      const bar = el('div', { class: 'bar', role: 'img' });
      const parts = [['Worse', 'b-worse'], ['About the same', 'b-same'], ['Better', 'b-better'], ['Context', 'b-context']];
      const desc = [];
      for (const [v, k] of parts) {
        const cnt = rs.filter((r) => r.verdict === v).length;
        if (!cnt) continue;
        desc.push(cnt + ' ' + v.toLowerCase());
        bar.appendChild(el('span', { class: k, style: 'width:' + (cnt / max * 100) + '%' }, String(cnt)));
      }
      bar.setAttribute('aria-label', c + ': ' + desc.join(', '));
      row.append(link, bar);
      target.appendChild(row);
    }
  }

  function tables(rows, target) {
    if (!target) return;
    target.replaceChildren();
    for (const c of [...new Set(rows.map((r) => r.category))]) {
      const sec = el('section', { class: 'section', id: slug(c) });
      sec.appendChild(el('h2', {}, c));
      const wrap = el('div', { class: 'table-wrap' });
      const t = el('table');
      const head = el('tr');
      [['Measure', ''], ['Compared', ''], ['Year earlier', 'num'], ['Latest', 'num'], ['Change', 'num'], ['Verdict', ''], ['Note and source', 'note']]
        .forEach(([h, k]) => head.appendChild(el('th', k ? { class: k } : {}, h)));
      const thead = el('thead'); thead.appendChild(head); t.appendChild(thead);
      const tb = el('tbody');
      for (const r of rows.filter((x) => x.category === c)) {
        const tr = el('tr');
        tr.append(el('td', { class: 'metric' }, r.metric), el('td', { class: 'when' }, r.period + ' vs ' + r.prev_period),
          el('td', { class: 'num' }, r.prevText), el('td', { class: 'num' }, r.currText),
          el('td', { class: 'num ' + cls(r.verdict) }, r.changeText));
        const v = el('td'); v.appendChild(el('span', { class: 'chip ' + cls(r.verdict) }, r.verdict)); tr.appendChild(v);
        const note = el('td', { class: 'note' });
        if (r.note) note.appendChild(document.createTextNode(r.note + ' '));
        note.appendChild(el('a', { href: r.source_url, rel: 'noopener' }, r.source));
        tr.appendChild(note);
        tb.appendChild(tr);
      }
      t.appendChild(tb); wrap.appendChild(t); sec.appendChild(wrap);
      if (c === 'Housing') { const extra = document.getElementById('housing-extra'); if (extra) { extra.hidden = false; sec.appendChild(extra); } }
      target.appendChild(sec);
    }
  }

  function simpleTable(rows, cols, target) {
    if (!target) return;
    target.replaceChildren();
    for (const r of rows) {
      const tr = el('tr');
      for (const [fn, k] of cols) tr.appendChild(el('td', k ? { class: k } : {}, fn(r)));
      target.appendChild(tr);
    }
  }

  const fill = (sel, text) => document.querySelectorAll(sel).forEach((e) => { e.textContent = text; });

  fetch(root + 'data/scorecard.json').then((r) => r.json()).then((d) => {
    const rows = d.rows.map(grade);
    fill('[data-sc="window"]', d.meta.window);
    fill('[data-sc="updated"]', new Date(d.meta.updated + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
    const n = (v) => rows.filter((r) => r.verdict === v).length;
    fill('[data-sc="graded"]', String(rows.length - n('Context')));
    fill('[data-sc="worse"]', String(n('Worse')));
    fill('[data-sc="better"]', String(n('Better')));
    fill('[data-sc="same"]', String(n('About the same')));
    moves(rows, 'Worse', document.getElementById('moves-worse'), 5);
    moves(rows, 'Better', document.getElementById('moves-better'), 5);
    tally(rows, document.getElementById('tally'));
    bars(rows, document.getElementById('bars'));
    tables(rows, document.getElementById('tables'));
    if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
  }).catch(() => fill('[data-sc-error]', 'The scorecard data did not load. Refresh the page to try again.'));

  if (document.getElementById('nycha-body')) {
    fetch(root + 'data/nycha_private.json').then((r) => r.json()).then((d) => {
      simpleTable(d, [[(r) => r.measure, 'metric'], [(r) => r.group, ''], [(r) => Number(r.units).toLocaleString('en-US'), 'num'],
        [(r) => Number(r.total).toLocaleString('en-US'), 'num'], [(r) => (r.total / r.units * 1000).toFixed(1), 'num'],
        [(r) => (r.class_c / r.units * 1000).toFixed(1), 'num']], document.getElementById('nycha-body'));
      const n0 = d[0];
      if (n0 && n0.sepoct_prev) { fill('[data-sc="sepoct-prev"]', n0.sepoct_prev.toLocaleString('en-US')); fill('[data-sc="sepoct-curr"]', n0.sepoct_curr.toLocaleString('en-US')); }
    });
    fetch(root + 'data/sales_q3.json').then((r) => r.json()).then((d) => {
      simpleTable(d, [[(r) => r.type, 'metric'], [(r) => r.borough, ''], [(r) => Number(r.sales).toLocaleString('en-US'), 'num'],
        [(r) => '$' + Math.round(r.median_price).toLocaleString('en-US'), 'num']], document.getElementById('sales-body'));
    });
  }
})();
