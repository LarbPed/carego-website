/* ==========================================================
   CareGo – ระบบเก็บข้อมูลการจอง (ใช้ localStorage ของเบราว์เซอร์)
   ใช้ร่วมกันทุกหน้า: booking / my-bookings / admin
   ========================================================== */
(function () {
  const D = window.CAREGO_DATA;
  const CFG = window.CAREGO_CONFIG;
  const KEY = 'carego.bookings.v1';
  const PREF_KEY = 'carego.prefs.v1';
  let memory = [];            // สำรองกรณี localStorage ใช้ไม่ได้ (เช่น private mode)
  let memoryPrefs = {};

  /* ---------- storage ---------- */
  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return memory; }
  }
  function writeAll(list) {
    memory = list;
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* ใช้ memory */ }
  }
  function readPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return memoryPrefs; }
  }
  function writePrefs(p) {
    memoryPrefs = p;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  }

  /* ---------- helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  function todayISO(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function genId() {
    const d = new Date();
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return 'CG-' + String(d.getFullYear() % 100) + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + s;
  }
  const baht = n => '฿' + Number(n).toLocaleString('th-TH');
  function fmtDate(iso, opts) {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('th-TH', opts || { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateLong(iso) {
    return fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  function fmtDateTime(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' น.';
  }
  function fmtPhone(p) {
    p = String(p || '');
    if (/^0\d{9}$/.test(p)) return p.slice(0, 3) + '-' + p.slice(3, 6) + '-' + p.slice(6);
    if (/^0\d{8}$/.test(p)) return p.slice(0, 2) + '-' + p.slice(2, 5) + '-' + p.slice(5);
    return p;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const byId = (arr, id) => arr.find(x => x.id === id);

  /* ---------- ราคา ---------- */
  function computePrice(b) {
    const items = [];
    if (b.type === 'transport') {
      const t = b.transport || {};
      const v = byId(D.vehicles, t.vehicle);
      const trip = byId(D.tripTypes, t.trip);
      const zone = byId(D.zones, t.zone);
      if (v && trip) {
        const base = Math.round(v.base * trip.mult);
        items.push({ label: v.name + ' (' + trip.name + ')', amount: base });
      }
      if (zone && zone.add) items.push({ label: 'ค่าระยะทาง: ' + zone.name, amount: zone.add });
      (t.extras || []).forEach(id => {
        const e = byId(D.extras, id);
        if (e) items.push({ label: e.name, amount: e.price });
      });
    } else if (b.type === 'homecare') {
      const h = b.homecare || {};
      const s = byId(D.homeServices, h.service);
      if (s && h.qty) items.push({ label: s.name + ' × ' + h.qty + ' ' + s.unit, amount: s.unitPrice * h.qty });
    }
    const total = items.reduce((a, i) => a + i.amount, 0);
    return { items, total };
  }

  /* ---------- สถานะ ---------- */
  function flowFor(b) {
    if (b.type === 'homecare') return ['pending', 'confirmed', 'enroute', 'serving', 'done'];
    const trip = b.transport && b.transport.trip;
    return trip === 'oneway'
      ? ['pending', 'confirmed', 'enroute', 'atHospital', 'done']
      : ['pending', 'confirmed', 'enroute', 'atHospital', 'returning', 'done'];
  }
  function serviceTitle(b) {
    if (b.type === 'transport') {
      const v = byId(D.vehicles, b.transport.vehicle);
      return 'พาไปโรงพยาบาล · ' + (v ? v.name : '');
    }
    const s = byId(D.homeServices, b.homecare.service);
    return 'ดูแลที่บ้าน · ' + (s ? s.name : '');
  }
  function placeText(b) {
    if (b.type === 'transport') {
      const t = b.transport;
      return t.hospital === D.hospitals[D.hospitals.length - 1] && t.hospitalOther ? t.hospitalOther : t.hospital;
    }
    return b.homecare.address;
  }
  function canCancel(b) { return b.status === 'pending' || b.status === 'confirmed'; }

  /* ---------- CRUD ---------- */
  function all() { return readAll().slice().sort((a, b) => b.createdAt - a.createdAt); }
  function get(id) { return readAll().find(b => b.id === id) || null; }
  function create(draft) {
    const list = readAll();
    const now = Date.now();
    const b = Object.assign({}, draft, {
      id: genId(), createdAt: now, status: 'pending', provider: null, rating: null,
      history: [{ status: 'pending', at: now }]
    });
    b.price = computePrice(b);
    list.push(b);
    writeAll(list);
    return b;
  }
  function update(id, fn) {
    const list = readAll();
    const i = list.findIndex(b => b.id === id);
    if (i < 0) return null;
    fn(list[i]);
    writeAll(list);
    return list[i];
  }
  function setStatus(id, status) {
    return update(id, b => {
      if (b.status === status) return;
      const flow = flowFor(b), idx = flow.indexOf(status), now = Date.now();
      b.history = b.history || [];
      if (idx >= 0) {
        // รักษาลำดับเวลาให้สอดคล้อง: ขั้นก่อนหน้าต้องมีเวลา ขั้นหลังจากนี้ถูกตัดออก
        const have = {};
        b.history.forEach(h => { const i = flow.indexOf(h.status); if (i >= 0 && i < idx) have[h.status] = h.at; });
        b.history = flow.slice(0, idx).map(s => ({ status: s, at: have[s] || now }));
      }
      b.status = status;
      b.history.push({ status: status, at: now });
    });
  }
  function advance(id) {
    const b = get(id);
    if (!b || b.status === 'done' || b.status === 'cancelled') return b;
    const flow = flowFor(b);
    const i = flow.indexOf(b.status);
    return setStatus(id, flow[Math.min(i + 1, flow.length - 1)]);
  }
  function cancel(id, reason) {
    return update(id, b => {
      if (!canCancel(b)) return;
      b.status = 'cancelled';
      b.cancelReason = reason || '';
      b.history.push({ status: 'cancelled', at: Date.now() });
    });
  }
  function rate(id, stars, comment) {
    return update(id, b => { b.rating = { stars: stars, comment: comment || '', at: Date.now() }; });
  }
  function assign(id, provider) { return update(id, b => { b.provider = provider || null; }); }
  function clearAll() { writeAll([]); }

  /* ---------- ข้อความ / ไฟล์ส่งออก ---------- */
  function summaryText(b) {
    const L = [];
    L.push('คำขอจองบริการ CareGo');
    L.push('รหัสการจอง: ' + b.id);
    L.push('บริการ: ' + serviceTitle(b));
    L.push('วันเวลา: ' + fmtDate(b.date) + ' ' + b.time + ' น.');
    if (b.type === 'transport') {
      const t = b.transport;
      L.push('ประเภท: ' + byId(D.tripTypes, t.trip).name);
      L.push('จุดรับ: ' + t.pickup);
      L.push('โรงพยาบาล: ' + placeText(b));
      if (t.dropoff) L.push('ส่งกลับที่: ' + t.dropoff);
      if (t.stops) L.push('จุดแวะ: ' + t.stops);
    } else {
      const s = byId(D.homeServices, b.homecare.service);
      L.push('จำนวน: ' + b.homecare.qty + ' ' + s.unit);
      L.push('ที่อยู่: ' + b.homecare.address);
    }
    L.push('ผู้ป่วย: ' + b.patient.name + (b.patient.age ? ' อายุ ' + b.patient.age + ' ปี' : '') +
      ' (' + byId(D.mobility, b.patient.mobility).name + ')');
    L.push('ผู้ติดต่อ: ' + b.contact.name + ' โทร ' + b.contact.phone);
    L.push('ราคาประเมิน: ' + baht(b.price.total));
    return L.join('\n');
  }
  function lineUrl(b) {
    const oa = CFG.lineOfficialAccount;
    if (!oa) return null;
    return 'https://line.me/R/oaMessage/' + encodeURIComponent(oa) + '/?' + encodeURIComponent(summaryText(b));
  }
  function toICS(b) {
    const [y, m, d] = b.date.split('-');
    const [hh, mm] = b.time.split(':');
    const start = y + m + d + 'T' + hh + mm + '00';
    const durH = b.type === 'homecare' ? b.homecare.qty : 3;   // ชม. หรือ ครั้ง (~1 ชม./ครั้ง)
    const endDate = new Date(+y, +m - 1, +d, +hh + Math.min(durH, 12), +mm);
    const end = endDate.getFullYear() + pad(endDate.getMonth() + 1) + pad(endDate.getDate()) +
      'T' + pad(endDate.getHours()) + pad(endDate.getMinutes()) + '00';
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const esc2 = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CareGo//TH', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + b.id + '@carego',
      'DTSTAMP:' + stamp,
      'DTSTART:' + start,          // เวลาท้องถิ่น (floating) ใช้ได้กับปฏิทินทุกแอป
      'DTEND:' + end,
      'SUMMARY:' + esc2('CareGo – ' + serviceTitle(b)),
      'LOCATION:' + esc2(placeText(b) || ''),
      'DESCRIPTION:' + esc2(summaryText(b)),
      'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:CareGo', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
  }
  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function sendWebhook(b) {
    if (!CFG.webhookUrl) return;
    try {
      fetch(CFG.webhookUrl, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(b)
      }).catch(() => {});
    } catch (e) { /* ไม่ให้กระทบการจอง */ }
  }

  /* ---------- ข้อมูลตัวอย่าง (สำหรับสาธิต) ---------- */
  function seedDemo() {
    const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return todayISO(d); };
    const mk = (draft, status, ago) => {
      const b = create(draft);
      update(b.id, x => {
        x.createdAt = Date.now() - ago * 86400000;
        x.history = [{ status: 'pending', at: x.createdAt }];
      });
      const flow = flowFor(b);
      if (status === 'cancelled') { setStatus(b.id, 'cancelled'); }
      else flow.slice(1, flow.indexOf(status) + 1).forEach(s => setStatus(b.id, s));
      return b;
    };
    const contact = { name: 'คุณเอ (ตัวอย่าง)', phone: '0812345678', relation: 'บุตร / ธิดา', line: '' };
    const patient = { name: 'คุณแม่ (ตัวอย่าง)', age: 72, mobility: 'cane', notes: '' };
    const T = (vehicle, trip, d) => ({
      type: 'transport', date: day(d), time: '08:00', patient, contact, payment: 'cash',
      transport: { vehicle, trip, zone: 'city', hospital: D.hospitals[0], pickup: 'บ้านเลขที่ 99 อ.เมือง จ.ขอนแก่น (ตัวอย่าง)', dropoff: '', stops: '', extras: ['escort'], apptNote: 'คลินิกอายุรกรรม' }
    });
    const H = (service, qty, d) => ({
      type: 'homecare', date: day(d), time: '14:00', patient, contact, payment: 'cash',
      homecare: { service, qty, address: 'บ้านเลขที่ 99 อ.เมือง จ.ขอนแก่น (ตัวอย่าง)', notes: '' }
    });
    const a = mk(T('van', 'round', -6), 'done', 7); rate(a.id, 5, 'สะดวกมาก ลูกหลานสบายใจ');
    const c = mk(H('nurse', 4, -2), 'done', 3); rate(c.id, 4, '');
    mk(T('wheelchair', 'round', 2), 'confirmed', 1);
    mk(H('wound', 1, 4), 'pending', 0);
    mk(T('van', 'oneway', -1), 'cancelled', 2);
  }

  /* ---------- การตั้งค่าการแสดงผล (ตัวอักษร / คอนทราสต์) ---------- */
  function applyPrefs() {
    const p = readPrefs();
    const html = document.documentElement;
    html.dataset.fs = p.fs || '1';
    html.dataset.contrast = p.contrast ? 'high' : 'normal';
  }

  window.CareGo = {
    cfg: CFG, data: D,
    all, get, create, update, setStatus, advance, cancel, rate, assign, clearAll, seedDemo,
    computePrice, flowFor, serviceTitle, placeText, canCancel, summaryText, lineUrl, toICS, download, sendWebhook,
    baht, fmtDate, fmtDateLong, fmtDateTime, fmtPhone, esc, byId, todayISO,
    prefs: { get: readPrefs, set: p => { writePrefs(Object.assign(readPrefs(), p)); applyPrefs(); }, apply: applyPrefs },
    onChange: fn => window.addEventListener('storage', e => { if (e.key === KEY) fn(); })
  };
  applyPrefs();
})();
