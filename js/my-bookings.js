/* CareGo – นัดหมายของฉัน: รายการจอง, ติดตามสถานะ, ยกเลิก, ปฏิทิน (.ics), พิมพ์, ให้คะแนน */
(function () {
  const C = window.CareGo, D = C.data, E = C.esc;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const list = $('#list'), dlg = $('#detail'), cdlg = $('#cancelDlg');
  let typeF = 'all', statusF = 'active', openId = null;

  const isActive = b => b.status !== 'done' && b.status !== 'cancelled';
  const when = b => new Date(b.date + 'T' + b.time + ':00').getTime();

  function filtered() {
    let a = C.all();
    if (typeF !== 'all') a = a.filter(b => b.type === typeF);
    if (statusF === 'active') a = a.filter(isActive);
    else if (statusF !== 'all') a = a.filter(b => b.status === statusF);
    // ที่กำลังดำเนินการ: เรียงตามวันนัดที่ใกล้ที่สุดก่อน / อย่างอื่น: ล่าสุดก่อน
    a.sort((x, y) => statusF === 'active' ? when(x) - when(y) : when(y) - when(x));
    return a;
  }

  /* ---------- รายการ ---------- */
  function render() {
    const all = C.all();
    const items = filtered();
    if (!items.length) {
      const none = !all.length;
      list.innerHTML = `<div class="card empty"><div class="icon-badge"><span data-icon="calendar"></span></div>
        <h3>${none ? 'ยังไม่มีรายการจอง' : 'ไม่พบรายการในหมวดนี้'}</h3>
        <p class="hint">${none ? 'เมื่อคุณจองบริการ รายการจะแสดงที่นี่ พร้อมติดตามสถานะได้ทุกขั้นตอน' : 'ลองเปลี่ยนตัวกรองด้านบน'}</p>
        ${none ? '<a class="btn btn-primary" href="booking.html">จองบริการแรกของคุณ</a>' : ''}</div>`;
      CareGoIcons(list);
      return;
    }
    list.innerHTML = items.map(b => {
      const st = D.statusInfo[b.status];
      const isT = b.type === 'transport';
      return `<article class="card bk" tabindex="0" role="button" data-id="${b.id}" aria-label="ดูรายละเอียด ${E(C.serviceTitle(b))}">
        <div class="icon-badge ${isT ? '' : 'teal'}"><span data-icon="${isT ? 'car' : 'home'}"></span></div>
        <div>
          <h3>${E(C.serviceTitle(b))}</h3>
          <div class="meta">${CareGoIcon('calendar', 16)} ${C.fmtDate(b.date)} · ${b.time} น.</div>
          <div class="meta">${CareGoIcon('pin', 16)} ${E(C.placeText(b))}</div>
          <div class="meta">รหัส ${b.id}</div>
        </div>
        <div class="bk-side"><span class="badge ${st.tone}">${st.label}</span><b>${C.baht(b.price.total)}</b></div>
      </article>`;
    }).join('');
    CareGoIcons(list);
  }

  /* ---------- รายละเอียด ---------- */
  function timeline(b) {
    const flow = C.flowFor(b), txt = D.flowText[b.type];
    const at = {};
    (b.history || []).forEach(h => { if (!at[h.status]) at[h.status] = h.at; });
    const finished = b.status === 'done';
    let html = '<ol class="timeline" aria-label="สถานะการให้บริการ">';
    flow.forEach(s => {
      const reached = !!at[s];
      const current = !finished && b.status === s;
      const cls = (reached && !current) || (finished && reached) ? 'done' : current ? 'current' : '';
      html += `<li class="${cls}"><span class="dot"></span><b>${txt[s][0]}</b><small>${txt[s][1]}</small>${reached ? `<time>${C.fmtDateTime(at[s])}</time>` : ''}</li>`;
    });
    if (b.status === 'cancelled') {
      html += `<li class="current"><span class="dot" style="background:var(--bad);border-color:var(--bad)"></span><b style="color:var(--bad)">ยกเลิกการจอง</b>${b.cancelReason ? `<small>เหตุผล: ${E(b.cancelReason)}</small>` : ''}<time>${C.fmtDateTime(at.cancelled)}</time></li>`;
    }
    return html + '</ol>';
  }

  function stars(n) { return '★'.repeat(n) + '☆'.repeat(5 - n); }

  function ratingBlock(b) {
    if (b.status !== 'done') return '';
    if (b.rating) {
      return `<h3>ความพึงพอใจของคุณ</h3><p><span class="stars-ro" aria-label="${b.rating.stars} จาก 5 ดาว">${stars(b.rating.stars)}</span>${b.rating.comment ? '<br>' + E(b.rating.comment) : ''}</p>`;
    }
    return `<h3>ให้คะแนนบริการนี้</h3>
      <div class="stars" id="stars" role="radiogroup" aria-label="ให้คะแนน">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} ดาว">★</button>`).join('')}</div>
      <div class="field"><label for="rComment">ความคิดเห็นเพิ่มเติม <span class="opt">(ถ้ามี)</span></label><textarea id="rComment" rows="2"></textarea></div>
      <button class="btn btn-teal btn-sm" type="button" id="rSubmit" disabled>ส่งคะแนน</button>`;
  }

  function openDetail(id) {
    const b = C.get(id);
    if (!b) return;
    openId = id;
    const st = D.statusInfo[b.status];
    $('#dTitle').textContent = C.serviceTitle(b);
    $('#dSub').innerHTML = `รหัส <b>${b.id}</b> · <span class="badge ${st.tone}">${st.label}</span>`;

    const rows = [['วัน-เวลา', C.fmtDateLong(b.date) + ' เวลา ' + b.time + ' น.']];
    if (b.type === 'transport') {
      const t = b.transport;
      rows.push(['รูปแบบ', C.byId(D.tripTypes, t.trip).name], ['จุดรับ', t.pickup], ['โรงพยาบาล', C.placeText(b)]);
      if (t.trip !== 'oneway' && t.dropoff) rows.push(['จุดส่งกลับ', t.dropoff]);
      if (t.stops) rows.push(['จุดแวะ', t.stops]);
      if (t.extras.length) rows.push(['บริการเสริม', t.extras.map(i => C.byId(D.extras, i).name).join(', ')]);
      if (t.apptNote) rows.push(['แผนก/เวลานัด', t.apptNote]);
    } else {
      const s = C.byId(D.homeServices, b.homecare.service);
      rows.push(['จำนวน', b.homecare.qty + ' ' + s.unit], ['ที่อยู่', b.homecare.address]);
      if (b.homecare.notes) rows.push(['สิ่งที่ต้องการให้ดูแล', b.homecare.notes]);
    }
    rows.push(['ผู้ป่วย', b.patient.name + (b.patient.age ? ' (' + b.patient.age + ' ปี)' : '') + ' · ' + C.byId(D.mobility, b.patient.mobility).name]);
    if (b.patient.notes) rows.push(['ข้อควรระวัง', b.patient.notes]);
    rows.push(['ผู้ติดต่อ', b.contact.name + ' · ' + C.fmtPhone(b.contact.phone)]);
    rows.push(['ผู้ให้บริการ', b.provider || 'รอจับคู่โดยทีมงาน']);
    rows.push(['การชำระเงิน', C.byId(D.payments, b.payment).name]);

    $('#dBody').innerHTML = `
      <h3>สถานะการให้บริการ</h3>${timeline(b)}
      <h3>รายละเอียด</h3>
      <dl class="kv">${rows.map(r => `<dt>${r[0]}</dt><dd>${E(r[1])}</dd>`).join('')}</dl>
      <h3>ราคาประเมิน</h3>
      <ul class="sum-list">${b.price.items.map(i => `<li><span>${E(i.label)}</span><span>${C.baht(i.amount)}</span></li>`).join('')}</ul>
      <div class="sum-total"><span>รวม</span><b>${C.baht(b.price.total)}</b></div>
      <div style="margin-top:1.2rem">${ratingBlock(b)}</div>`;

    const line = C.lineUrl(b);
    $('#dFoot').innerHTML = `
      <button class="btn btn-ghost btn-sm" type="button" id="aIcs">${CareGoIcon('calendar', 18)} เพิ่มในปฏิทิน</button>
      <button class="btn btn-ghost btn-sm" type="button" id="aPrint">${CareGoIcon('printer', 18)} พิมพ์ใบยืนยัน</button>
      ${line ? `<a class="btn btn-ghost btn-sm" href="${E(line)}" target="_blank" rel="noopener">${CareGoIcon('chat', 18)} ส่งทาง LINE</a>` : ''}
      ${C.canCancel(b) ? `<button class="btn btn-danger btn-sm" type="button" id="aCancel">ยกเลิกการจอง</button>` : ''}
      <button class="btn btn-primary btn-sm" type="button" id="aClose">ปิด</button>`;

    $('#aIcs').onclick = () => C.download(b.id + '.ics', C.toICS(b), 'text/calendar;charset=utf-8');
    $('#aPrint').onclick = () => {
      document.body.classList.add('printing-detail');
      window.print();
      setTimeout(() => document.body.classList.remove('printing-detail'), 500);
    };
    $('#aClose').onclick = closeDetail;
    const ac = $('#aCancel');
    if (ac) ac.onclick = () => { if (!cdlg.open) cdlg.showModal(); };

    // ให้คะแนน
    const starsEl = $('#stars');
    if (starsEl) {
      let n = 0;
      const paint = k => $$('button', starsEl).forEach(x => x.classList.toggle('on', Number(x.dataset.n) <= k));
      starsEl.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        n = Number(btn.dataset.n); paint(n); $('#rSubmit').disabled = false;
      });
      $('#rSubmit').onclick = () => {
        C.rate(b.id, n, $('#rComment').value.trim());
        C.toast('ขอบคุณสำหรับคะแนนของคุณ');
        openDetail(b.id);
      };
    }
    CareGoIcons(dlg);
    if (!dlg.open) dlg.showModal();
  }

  function closeDetail() {
    if (dlg.open) dlg.close();
    openId = null;
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  }

  /* ---------- events ---------- */
  list.addEventListener('click', e => {
    const card = e.target.closest('.bk');
    if (card) openDetail(card.dataset.id);
  });
  list.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('bk')) {
      e.preventDefault(); openDetail(e.target.dataset.id);
    }
  });
  $('#tabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    typeF = t.dataset.f;
    $$('#tabs .tab').forEach(x => x.setAttribute('aria-selected', x === t));
    render();
  });
  $('#statusTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab'); if (!t) return;
    statusF = t.dataset.s;
    $$('#statusTabs .tab').forEach(x => x.setAttribute('aria-selected', x === t));
    render();
  });
  $('#dClose').onclick = closeDetail;
  dlg.addEventListener('click', e => { if (e.target === dlg) closeDetail(); });
  dlg.addEventListener('close', () => { openId = null; });
  $('#cClose').onclick = $('#cKeep').onclick = () => cdlg.close();
  $('#cConfirm').onclick = () => {
    if (!openId) return;
    C.cancel(openId, $('#cReason').value);
    cdlg.close();
    C.toast('ยกเลิกการจองแล้ว');
    render();
    openDetail(openId);
  };

  // ข้อมูลเปลี่ยนจากแท็บอื่น (เช่น ทีมงานอัปเดตสถานะ) → รีเฟรชทันที
  C.onChange(() => {
    render();
    if (openId && dlg.open) {
      const keep = $('#dBody').scrollTop;
      openDetail(openId);
      $('#dBody').scrollTop = keep;
    }
  });

  /* ---------- เริ่มต้น ---------- */
  const hash = decodeURIComponent(location.hash.slice(1));
  const target = hash && C.get(hash);
  if (target) {
    // ถ้ารายการที่เปิดมาไม่อยู่ในตัวกรองเริ่มต้น ให้แสดงทุกสถานะ
    if (!isActive(target)) {
      statusF = 'all';
      $$('#statusTabs .tab').forEach(x => x.setAttribute('aria-selected', x.dataset.s === 'all'));
    }
  }
  render();
  if (target) openDetail(target.id);
})();
