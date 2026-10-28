/* CareGo – หน้าทีมงาน (สาธิต): จัดการสถานะ/ผู้ให้บริการ และดู KPIs ตามรายงานบทที่ 4.4 */
(function () {
  const C = window.CareGo, D = C.data, E = C.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const rows = $('#rows');

  /* ---------- KPI ---------- */
  function kpis(all) {
    const total = all.length;
    const done = all.filter(b => b.status === 'done');
    const cancelled = all.filter(b => b.status === 'cancelled').length;
    const open = all.filter(b => b.status !== 'done' && b.status !== 'cancelled').length;
    const rated = all.filter(b => b.rating);
    const avg = rated.length ? (rated.reduce((a, b) => a + b.rating.stars, 0) / rated.length) : null;

    const byPhone = {};
    all.filter(b => b.status !== 'cancelled').forEach(b => { byPhone[b.contact.phone] = (byPhone[b.contact.phone] || 0) + 1; });
    const customers = Object.keys(byPhone).length;
    const repeat = Object.values(byPhone).filter(n => n >= 2).length;

    const revenue = done.reduce((a, b) => a + b.price.total, 0);
    const pct = (a, b) => b ? Math.round((a / b) * 100) + '%' : '–';

    const cards = [
      ['จำนวนการจองทั้งหมด', total],
      ['กำลังดำเนินการ', open],
      ['เสร็จสิ้นแล้ว', done.length],
      ['อัตรากลับมาใช้ซ้ำ', pct(repeat, customers)],
      ['อัตราการยกเลิก', pct(cancelled, total)],
      ['ความพึงพอใจเฉลี่ย', avg === null ? '–' : avg.toFixed(1) + ' / 5'],
      ['รายได้ (เสร็จสิ้น)', C.baht(revenue)],
      ['รายได้ต่อการจอง', done.length ? C.baht(Math.round(revenue / done.length)) : '–']
    ];
    $('#kpis').innerHTML = cards.map(c => `<div class="card kpi"><b>${c[1]}</b><span>${c[0]}</span></div>`).join('');
  }

  /* ---------- ตาราง ---------- */
  function render() {
    const all = C.all();
    kpis(all);
    const q = $('#q').value.trim().toLowerCase();
    const f = $('#fs').value;
    let items = all;
    if (f === 'open') items = items.filter(b => b.status !== 'done' && b.status !== 'cancelled');
    else if (f !== 'all') items = items.filter(b => b.status === f);
    if (q) items = items.filter(b => [b.id, b.contact.name, b.contact.phone, b.patient.name].join(' ').toLowerCase().includes(q));

    rows.innerHTML = items.length ? items.map(b => {
      const flow = C.flowFor(b);
      const opts = flow.concat(['cancelled']).map(s => `<option value="${s}"${s === b.status ? ' selected' : ''}>${D.statusInfo[s].label}</option>`).join('');
      const provs = ['<option value="">— ยังไม่จับคู่ —</option>'].concat(D.demoProviders[b.type].map(p => `<option${p === b.provider ? ' selected' : ''}>${p}</option>`)).join('');
      const finished = b.status === 'done' || b.status === 'cancelled';
      return `<tr data-id="${b.id}">
        <td><b>${b.id}</b><br><span class="hint">${C.fmtDateTime(b.createdAt)}</span></td>
        <td>${E(C.serviceTitle(b))}<br><span class="hint">${E(C.placeText(b))}</span></td>
        <td>${C.fmtDate(b.date)}<br>${b.time} น.</td>
        <td>${E(b.contact.name)}<br><a href="tel:${E(b.contact.phone)}">${C.fmtPhone(b.contact.phone)}</a><br><span class="hint">ผู้ป่วย: ${E(b.patient.name)} (${C.byId(D.mobility, b.patient.mobility).name})</span></td>
        <td>${C.baht(b.price.total)}${b.rating ? `<br><span class="stars-ro">${'★'.repeat(b.rating.stars)}</span>` : ''}</td>
        <td><select data-act="status" aria-label="สถานะของ ${b.id}">${opts}</select></td>
        <td><select data-act="provider" aria-label="ผู้ให้บริการของ ${b.id}"${b.status === 'cancelled' ? ' disabled' : ''}>${provs}</select></td>
        <td><button class="btn btn-primary btn-sm" data-act="next" type="button"${finished ? ' disabled' : ''}>ขั้นถัดไป</button></td>
      </tr>`;
    }).join('') : '<tr><td colspan="8" style="text-align:center;padding:2rem" class="hint">ยังไม่มีรายการ — ลองจองจากหน้า “จองบริการ” หรือกด “เพิ่มข้อมูลตัวอย่าง”</td></tr>';
    $('#count').textContent = `แสดง ${items.length} จาก ${all.length} รายการ`;
  }

  /* ---------- events ---------- */
  rows.addEventListener('change', e => {
    const tr = e.target.closest('tr'); if (!tr) return;
    const id = tr.dataset.id, act = e.target.dataset.act;
    if (act === 'status') {
      C.setStatus(id, e.target.value);
      // เมื่อยืนยันแล้วแต่ยังไม่มีผู้ให้บริการ ให้เตือน
      const b = C.get(id);
      if (b.status !== 'pending' && b.status !== 'cancelled' && !b.provider) C.toast('อย่าลืมจับคู่ผู้ให้บริการ');
    } else if (act === 'provider') {
      C.assign(id, e.target.value);
    }
    render();
  });
  rows.addEventListener('click', e => {
    const btn = e.target.closest('[data-act="next"]'); if (!btn) return;
    C.advance(btn.closest('tr').dataset.id);
    render();
  });
  $('#q').addEventListener('input', render);
  $('#fs').addEventListener('change', render);
  $('#bSeed').onclick = () => { C.seedDemo(); render(); C.toast('เพิ่มข้อมูลตัวอย่างแล้ว'); };

  $('#bCsv').onclick = () => {
    const all = C.all();
    if (!all.length) { C.toast('ยังไม่มีข้อมูลให้ส่งออก'); return; }
    const head = ['รหัส', 'สร้างเมื่อ', 'บริการ', 'วันที่', 'เวลา', 'สถานที่', 'ผู้ป่วย', 'ผู้ติดต่อ', 'โทร', 'ราคาประเมิน', 'สถานะ', 'ผู้ให้บริการ', 'คะแนน'];
    const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = all.map(b => [b.id, new Date(b.createdAt).toISOString(), C.serviceTitle(b), b.date, b.time, C.placeText(b),
      b.patient.name, b.contact.name, "'" + b.contact.phone, b.price.total, D.statusInfo[b.status].label, b.provider || '', b.rating ? b.rating.stars : ''].map(cell).join(','));
    C.download('carego-bookings.csv', '﻿' + head.map(cell).join(',') + '\r\n' + lines.join('\r\n'), 'text/csv;charset=utf-8');
  };

  const cf = $('#confirmDlg');
  $('#bClear').onclick = () => cf.showModal();
  $('#cfNo').onclick = () => cf.close();
  $('#cfYes').onclick = () => { C.clearAll(); cf.close(); render(); C.toast('ล้างข้อมูลแล้ว'); };

  // อัปเดตอัตโนมัติเมื่อลูกค้าจองใหม่จากแท็บอื่น
  C.onChange(render);
  render();
})();
