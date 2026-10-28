/* CareGo – หน้าจองบริการ (ฟอร์ม 4 ขั้นตอน, ตรวจสอบข้อมูล, คำนวณราคา, บันทึกการจอง) */
(function () {
  const C = window.CareGo, D = C.data, CFG = C.cfg;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const form = $('#bookForm');
  const TOTAL = 4;
  let step = 1;

  /* ---------- สร้างตัวเลือกจากข้อมูลกลาง ---------- */
  const choice = (kind, name, value, inner, cls, checked) =>
    `<label class="choice ${cls || ''}"><input type="${kind}" name="${name}" value="${value}"${checked ? ' checked' : ''}><span class="box">${inner}</span></label>`;

  function renderStatic() {
    $('#emNo').textContent = CFG.emergencyNumber;
    $('#vehicleChoices').innerHTML = D.vehicles.map(v => choice('radio', 'vehicle', v.id,
      `<span class="icon-badge"><span data-icon="${v.icon}"></span></span>
       <span><b>${v.name}</b><small>${v.desc}<br>${v.seats}</small><span class="p">เริ่มต้น ${C.baht(v.base)}</span></span>`)).join('');
    $('#tripChoices').innerHTML = D.tripTypes.map((t, i) => choice('radio', 'trip', t.id, t.name, 'pill', i === 0)).join('');
    $('#hospital').innerHTML = '<option value="">เลือกโรงพยาบาล</option>' + D.hospitals.map(h => `<option>${h}</option>`).join('');
    $('#zone').innerHTML = D.zones.map(z => `<option value="${z.id}">${z.name}${z.add ? ' (+' + C.baht(z.add) + ')' : ''}</option>`).join('');
    $('#extraChoices').innerHTML = D.extras.map(e => choice('checkbox', 'extras', e.id,
      `<span class="icon-badge"><span data-icon="${e.icon}"></span></span>
       <span><b>${e.name}</b><small>${e.desc}</small><span class="p">+${C.baht(e.price)}</span></span>`)).join('');
    $('#serviceChoices').innerHTML = D.homeServices.map(s => choice('radio', 'service', s.id,
      `<span class="icon-badge teal"><span data-icon="${s.icon}"></span></span>
       <span><b>${s.name}</b><small>${s.desc}<br>${s.note}</small><span class="p">${C.baht(s.unitPrice)} / ${s.unit}</span></span>`)).join('');
    $('#mobilityChoices').innerHTML = D.mobility.map(m => choice('radio', 'mobility', m.id, m.name, 'pill')).join('');
    $('#cRelation').innerHTML = D.relations.map(r => `<option>${r}</option>`).join('');
    $('#paymentChoices').innerHTML = D.payments.map((p, i) => choice('radio', 'payment', p.id, `<span><b>${p.name}</b></span>`, '', i === 0)).join('');

    // วันที่ / เวลา
    const dateEl = $('#date');
    const today = new Date(), max = new Date();
    max.setFullYear(max.getFullYear() + 1);
    dateEl.min = C.todayISO(today);
    dateEl.max = C.todayISO(max);
    $('#time').innerHTML = '<option value="">เลือกเวลา</option>';
    $('#leadHint').textContent = 'กรุณาจองล่วงหน้าอย่างน้อย ' + CFG.minLeadHours + ' ชั่วโมง · เวลาให้บริการ ' +
      String(CFG.openHour).padStart(2, '0') + ':00–' + String(CFG.closeHour).padStart(2, '0') + ':00 น.';
    refreshTimes();
    CareGoIcons();
  }

  function refreshTimes() {
    const sel = $('#time'), prev = sel.value, date = $('#date').value;
    const minTs = Date.now() + CFG.minLeadHours * 3600000;
    let html = '<option value="">เลือกเวลา</option>';
    for (let h = CFG.openHour; h <= CFG.closeHour; h++) {
      for (const m of [0, 30]) {
        if (h === CFG.closeHour && m) continue;
        const t = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        const dis = date && new Date(date + 'T' + t + ':00').getTime() < minTs;
        html += `<option value="${t}"${dis ? ' disabled' : ''}>${t} น.${dis ? ' (เลยกำหนดจอง)' : ''}</option>`;
      }
    }
    sel.innerHTML = html;
    const opt = Array.from(sel.options).find(o => o.value === prev && !o.disabled);
    sel.value = opt ? prev : '';
  }

  function renderQty() {
    const sid = radio('service');
    const s = C.byId(D.homeServices, sid);
    const prev = Number(radio('qty'));
    const box = $('#qtyChoices');
    if (!s) {
      box.innerHTML = '<p class="hint">เลือกประเภทการดูแลก่อน</p>';
      $('#qtyLabel').textContent = 'จำนวน';
      return;
    }
    $('#qtyLabel').textContent = s.unit === 'ชม.' ? 'ระยะเวลาให้บริการ' : 'จำนวนครั้ง';
    box.innerHTML = s.options.map(n => choice('radio', 'qty', n, n + ' ' + s.unit, 'pill', n === prev)).join('');
  }

  /* ---------- อ่านค่าจากฟอร์ม ---------- */
  const val = n => (form.elements[n] ? form.elements[n].value : '');
  const radio = n => { const r = form.querySelector(`input[name="${n}"]:checked`); return r ? r.value : ''; };
  function normPhone(p) {
    p = String(p || '').replace(/[\s\-().]/g, '');
    if (p.startsWith('+66')) p = '0' + p.slice(3);
    else if (/^66\d{9}$/.test(p)) p = '0' + p.slice(2);
    return p;
  }
  function getDraft() {
    const type = radio('type');
    const d = {
      type, date: val('date'), time: val('time'), payment: radio('payment') || 'cash',
      patient: { name: val('pName').trim(), age: Number(val('pAge')) || null, mobility: radio('mobility'), notes: val('pNotes').trim() },
      contact: { name: val('cName').trim(), phone: normPhone(val('cPhone')), relation: val('cRelation'), line: val('cLine').trim() }
    };
    if (type === 'transport') {
      d.transport = {
        vehicle: radio('vehicle'), trip: radio('trip') || 'round', zone: val('zone'),
        hospital: val('hospital'), hospitalOther: val('hospitalOther').trim(),
        pickup: val('pickup').trim(), dropoff: val('dropoff').trim(), stops: val('stops').trim(),
        extras: $$('input[name="extras"]:checked').map(x => x.value), apptNote: val('apptNote').trim()
      };
    } else if (type === 'homecare') {
      d.homecare = { service: radio('service'), qty: Number(radio('qty')) || 0, address: val('address').trim(), notes: val('hcNotes').trim() };
    }
    return d;
  }

  /* ---------- สรุปราคาด้านข้าง ---------- */
  function updateSummary() {
    const d = getDraft();
    const body = $('#sumBody');
    const p = C.computePrice(d);
    let html = '';
    if (!d.type) {
      html = '<p class="sum-empty">เลือกบริการเพื่อดูราคาประเมิน</p>';
    } else {
      if (p.items.length) {
        html = '<ul class="sum-list">' + p.items.map(i => `<li><span>${C.esc(i.label)}</span><span>${C.baht(i.amount)}</span></li>`).join('') + '</ul>';
      } else {
        html = '<p class="sum-empty">' + (d.type === 'transport' ? 'เลือกประเภทรถเพื่อดูราคา' : 'เลือกประเภทการดูแลและจำนวนเพื่อดูราคา') + '</p>';
      }
      if (d.date && d.time) html += `<p class="hint">${CareGoIcon('calendar', 16)} ${C.fmtDate(d.date)} เวลา ${d.time} น.</p>`;
    }
    body.innerHTML = html;
    $('#sumTotal').textContent = C.baht(p.total);
    const bar = $('#priceBarTotal');
    if (bar) bar.textContent = C.baht(p.total);
  }

  /* ---------- การแสดงผลแต่ละขั้น ---------- */
  function applyDynamic() {
    const type = radio('type');
    $('#tp').hidden = type !== 'transport';
    $('#hc').hidden = type !== 'homecare';

    const trip = radio('trip') || 'round';
    const t = C.byId(D.tripTypes, trip);
    $('#tripHint').textContent = t ? t.hint : '';
    $('#stopsWrap').hidden = trip !== 'multi';
    $('#dropoffWrap').hidden = trip === 'oneway';
    $('#hospitalOtherWrap').hidden = val('hospital') !== D.hospitals[D.hospitals.length - 1];
    $('#emWarn').hidden = radio('vehicle') !== 'ambulance';

    // คำแนะนำตามลักษณะผู้ป่วย
    const mob = radio('mobility'), veh = radio('vehicle');
    let hint = '';
    if (type === 'transport') {
      if (mob === 'wheel' && veh && veh !== 'wheelchair') hint = 'ผู้ป่วยใช้รถเข็น แนะนำเลือก “รถรับ-ส่งวีลแชร์” หรือเพิ่มบริการเสริม “รถเข็น / อุปกรณ์ช่วยพยุง” (ย้อนกลับไปแก้ไขขั้นที่ 2 ได้)';
      else if (mob === 'bed' && veh && veh !== 'ambulance') hint = 'ผู้ป่วยติดเตียงควรใช้รถพยาบาลที่มีอุปกรณ์การแพทย์ และแจ้งรายละเอียดอาการให้ทีมงานทราบ (ย้อนกลับไปแก้ไขขั้นที่ 2 ได้)';
    }
    $('#mobHint').hidden = !hint;
    $('#mobHintText').textContent = hint;
  }

  function showStep(n, focus) {
    step = n;
    $$('[data-step]').forEach(s => { s.hidden = Number(s.dataset.step) !== n; });
    $$('#stepper li').forEach((li, i) => {
      li.className = i + 1 < n ? 'done' : i + 1 === n ? 'current' : '';
      li.setAttribute('aria-current', i + 1 === n ? 'step' : 'false');
    });
    $('#btnBack').hidden = n === 1;
    $('#btnNext').hidden = n === TOTAL;
    $('#btnSubmit').hidden = n !== TOTAL;
    applyDynamic();
    if (n === 4) renderReview();
    if (focus !== false) {
      const h = $(`[data-step="${n}"] h2`);
      $('#stepper').scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (h) setTimeout(() => h.focus({ preventScroll: true }), 250);
    }
  }

  /* ---------- ตรวจสอบข้อมูล ---------- */
  function validate(n) {
    const sec = $(`[data-step="${n}"]`);
    $$('.invalid', sec).forEach(x => x.classList.remove('invalid'));
    let first = null;
    const bad = (wrap, focusEl, msg) => {
      wrap.classList.add('invalid');
      if (msg) { const e = $('.err', wrap); if (e) e.textContent = msg; }
      if (!first) first = focusEl || wrap;
    };
    const type = radio('type');

    if (n === 1 && !type) bad($('#g-type'), $('#g-type input'));

    if (n === 2) {
      if (type === 'transport') {
        if (!radio('vehicle')) bad($('#g-vehicle'), $('#g-vehicle input'));
        if (!radio('trip')) bad($('#g-trip'), $('#g-trip input'));
      } else if (type === 'homecare') {
        if (!radio('service')) bad($('#g-service'), $('#g-service input'));
        if (radio('service') && !radio('qty')) bad($('#g-qty'), $('#g-qty input'));
      }
    }

    // ช่องที่บังคับกรอก (เฉพาะที่แสดงอยู่ในขั้นนี้)
    $$('.field[data-req]', sec).forEach(w => {
      if (w.closest('[hidden]')) return;
      const el = $('input,select,textarea', w);
      if (!el.value.trim()) bad(w, el);
    });

    if (n === 2) {
      const dateEl = $('#date'), timeEl = $('#time');
      if (dateEl.value && !timeEl.closest('.field').classList.contains('invalid') && timeEl.value) {
        const ts = new Date(dateEl.value + 'T' + timeEl.value + ':00').getTime();
        if (ts < Date.now() + CFG.minLeadHours * 3600000) bad(timeEl.closest('.field'), timeEl, 'กรุณาจองล่วงหน้าอย่างน้อย ' + CFG.minLeadHours + ' ชั่วโมง');
      }
      if (dateEl.value && dateEl.value < dateEl.min) bad(dateEl.closest('.field'), dateEl, 'กรุณาเลือกวันที่ตั้งแต่วันนี้เป็นต้นไป');
      if (dateEl.value && dateEl.max && dateEl.value > dateEl.max) bad(dateEl.closest('.field'), dateEl, 'จองล่วงหน้าได้ไม่เกิน 1 ปี');
    }

    if (n === 3) {
      const age = Number(val('pAge'));
      if (val('pAge') && !(Number.isInteger(age) && age >= 1 && age <= 120)) bad($('#pAge').closest('.field'), $('#pAge'));
      if (!radio('mobility')) bad($('#g-mobility'), $('#g-mobility input'));
      const ph = normPhone(val('cPhone'));
      if (val('cPhone').trim() && !/^0\d{8,9}$/.test(ph)) bad($('#cPhone').closest('.field'), $('#cPhone'));
    }

    if (n === 4) {
      if (!$('#consent1').checked || !$('#consent2').checked) bad($('#g-consent'), $('#consent1').checked ? $('#consent2') : $('#consent1'));
    }

    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 300);
      return false;
    }
    return true;
  }

  /* ---------- หน้าตรวจสอบ ---------- */
  function renderReview() {
    const d = getDraft(), p = C.computePrice(d), E = C.esc;
    const dl = rows => '<dl>' + rows.filter(r => r[1]).map(r => `<dt>${r[0]}</dt><dd>${E(r[1])}</dd>`).join('') + '</dl>';
    let h = '<h3>บริการ</h3>';
    if (d.type === 'transport') {
      const t = d.transport, v = C.byId(D.vehicles, t.vehicle), trip = C.byId(D.tripTypes, t.trip), z = C.byId(D.zones, t.zone);
      const hosp = t.hospital === D.hospitals[D.hospitals.length - 1] ? t.hospitalOther : t.hospital;
      h += dl([
        ['บริการ', 'พาไปโรงพยาบาล'], ['ประเภทรถ', v.name], ['รูปแบบ', trip.name],
        ['วัน-เวลา', C.fmtDateLong(d.date) + ' เวลา ' + d.time + ' น.'],
        ['โรงพยาบาล', hosp], ['จุดรับ', t.pickup], ['จุดส่งกลับ', trip.id !== 'oneway' ? t.dropoff : ''],
        ['จุดแวะ', t.stops], ['ระยะทาง', z.name],
        ['บริการเสริม', t.extras.map(id => C.byId(D.extras, id).name).join(', ')], ['แผนก/เวลานัด', t.apptNote]
      ]);
    } else {
      const hc = d.homecare, s = C.byId(D.homeServices, hc.service);
      h += dl([
        ['บริการ', 'ดูแลที่บ้าน'], ['ประเภทการดูแล', s.name], ['จำนวน', hc.qty + ' ' + s.unit],
        ['วัน-เวลา', C.fmtDateLong(d.date) + ' เวลา ' + d.time + ' น.'], ['ที่อยู่', hc.address], ['สิ่งที่ต้องการให้ดูแล', hc.notes]
      ]);
    }
    h += '<h3>ผู้ป่วย</h3>' + dl([
      ['ชื่อ', d.patient.name], ['อายุ', d.patient.age + ' ปี'],
      ['การเคลื่อนไหว', C.byId(D.mobility, d.patient.mobility).name], ['โรคประจำตัว/ข้อควรระวัง', d.patient.notes]
    ]);
    h += '<h3>ผู้ติดต่อ</h3>' + dl([
      ['ชื่อ', d.contact.name], ['โทรศัพท์', C.fmtPhone(d.contact.phone)], ['เกี่ยวข้องเป็น', d.contact.relation], ['LINE ID', d.contact.line]
    ]);
    h += '<h3>ราคาประเมิน</h3><ul class="sum-list">' + p.items.map(i => `<li><span>${E(i.label)}</span><span>${C.baht(i.amount)}</span></li>`).join('') + '</ul>' +
      `<div class="sum-total"><span>รวมโดยประมาณ</span><b>${C.baht(p.total)}</b></div><br>`;
    $('#review').innerHTML = h;
  }

  /* ---------- ส่งคำขอ ---------- */
  function submit() {
    for (let n = 1; n <= 3; n++) {
      if (!validate(n)) { showStep(n, false); validate(n); return; }
    }
    if (!validate(4)) return;
    const b = C.create(getDraft());
    C.sendWebhook(b);

    $('#stepper').hidden = true;
    $('#priceBar').hidden = true;
    form.hidden = true;
    const ok = $('#success');
    ok.hidden = false;
    $('#successCode').textContent = b.id;
    $('#successPhone').textContent = C.fmtPhone(b.contact.phone);
    $('#goTrack').href = 'my-bookings.html#' + b.id;
    const line = C.lineUrl(b);
    const lb = $('#btnLine');
    if (line) { lb.href = line; lb.hidden = false; }
    $('#btnIcs').onclick = () => C.download(b.id + '.ics', C.toICS(b), 'text/calendar;charset=utf-8');
    CareGoIcons(ok);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => $('#successTitle').focus({ preventScroll: true }), 300);
  }

  /* ---------- events ---------- */
  function bind() {
    $('#btnNext').addEventListener('click', () => { if (validate(step)) showStep(step + 1); });
    $('#btnBack').addEventListener('click', () => showStep(step - 1));
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (step < TOTAL) { if (validate(step)) showStep(step + 1); }
      else submit();
    });
    form.addEventListener('change', e => {
      if (e.target.name === 'service') renderQty();
      if (e.target.id === 'date') refreshTimes();
      const wrap = e.target.closest('.field, .group');
      if (wrap) wrap.classList.remove('invalid');
      applyDynamic();
      updateSummary();
    });
    form.addEventListener('input', e => {
      const wrap = e.target.closest('.field');
      if (wrap) wrap.classList.remove('invalid');
      if (e.target.id === 'hospitalOther' || e.target.type === 'text' || e.target.tagName === 'TEXTAREA') return;
      updateSummary();
    });
  }

  /* ---------- เริ่มต้น ---------- */
  renderStatic();
  renderQty();
  bind();
  const q = new URLSearchParams(location.search);
  const qType = q.get('type');
  if (qType === 'transport' || qType === 'homecare') {
    const r = form.querySelector(`input[name="type"][value="${qType}"]`);
    if (r) r.checked = true;
    if (qType === 'transport' && q.get('vehicle')) {
      const v = form.querySelector(`input[name="vehicle"][value="${q.get('vehicle')}"]`);
      if (v) v.checked = true;
    }
    if (qType === 'homecare' && q.get('service')) {
      const s = form.querySelector(`input[name="service"][value="${q.get('service')}"]`);
      if (s) { s.checked = true; renderQty(); }
    }
    showStep(2, false);
  } else {
    showStep(1, false);
  }
  updateSummary();
})();
