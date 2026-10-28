/* CareGo – ส่วนหัว/ท้ายเว็บ, เมนูมือถือ, ปรับขนาดตัวอักษร/คอนทราสต์ (ใช้ทุกหน้า) */
(function () {
  const C = window.CareGo, CFG = C.cfg;
  const page = document.body.dataset.page || '';

  const nav = [
    ['home', 'index.html', 'หน้าแรก'],
    ['services', 'index.html#services', 'บริการ'],
    ['booking', 'booking.html', 'จองบริการ'],
    ['my', 'my-bookings.html', 'นัดหมายของฉัน'],
    ['about', 'about.html', 'เกี่ยวกับโครงการ']
  ];

  function activeCount() {
    return C.all().filter(b => b.status !== 'done' && b.status !== 'cancelled').length;
  }

  function headerHTML() {
    const links = nav.map(n => {
      const cur = n[0] === page ? ' aria-current="page"' : '';
      const badge = n[0] === 'my' && activeCount() ? '<span class="nav-badge" id="navBadge">' + activeCount() + '</span>' : '';
      return '<a href="' + n[1] + '"' + cur + '>' + n[2] + badge + '</a>';
    }).join('');
    return '' +
      '<a class="skip" href="#main">ข้ามไปยังเนื้อหา</a>' +
      '<div class="topbar"><div class="wrap topbar-in">' +
        '<span>' + CareGoIcon('alert', 16) + ' กรณีฉุกเฉินวิกฤต โทร <strong>' + CFG.emergencyNumber + '</strong> ทันที</span>' +
        '<span class="topbar-r">พื้นที่ให้บริการนำร่อง: ' + C.esc(CFG.pilotArea) + '</span>' +
      '</div></div>' +
      '<header class="site-header"><div class="wrap head-in">' +
        '<a class="brand" href="index.html" aria-label="CareGo หน้าแรก"><img src="assets/logo.png" alt="CareGo – พาคุณไปโรงพยาบาลอย่างอุ่นใจ" width="150" height="53"></a>' +
        '<nav class="nav" id="nav" aria-label="เมนูหลัก">' + links +
          '<a class="btn btn-primary nav-cta" href="booking.html">' + CareGoIcon('calendar', 18) + 'จองบริการ</a>' +
        '</nav>' +
        '<div class="a11y" role="group" aria-label="การแสดงผล">' +
          '<button type="button" id="fsDown" aria-label="ลดขนาดตัวอักษร">A−</button>' +
          '<button type="button" id="fsUp" aria-label="เพิ่มขนาดตัวอักษร">A+</button>' +
          '<button type="button" id="hc" aria-label="โหมดคอนทราสต์สูง" aria-pressed="false">' + CareGoIcon('contrast', 18) + '</button>' +
        '</div>' +
        '<button class="burger" id="burger" aria-label="เปิดเมนู" aria-expanded="false" aria-controls="nav">' + CareGoIcon('menu', 26) + '</button>' +
      '</div></header>';
  }

  function footerHTML() {
    const contact = [];
    if (CFG.lineOfficialAccount) contact.push('<li>' + CareGoIcon('chat', 18) + ' LINE: ' + C.esc(CFG.lineOfficialAccount) + '</li>');
    if (CFG.phone) contact.push('<li>' + CareGoIcon('phone', 18) + ' <a href="tel:' + C.esc(CFG.phone.replace(/[^0-9+]/g, '')) + '">' + C.esc(CFG.phone) + '</a></li>');
    if (CFG.email) contact.push('<li>' + CareGoIcon('chat', 18) + ' <a href="mailto:' + C.esc(CFG.email) + '">' + C.esc(CFG.email) + '</a></li>');
    if (!contact.length) contact.push('<li>' + CareGoIcon('calendar', 18) + ' ติดต่อผ่านแบบฟอร์มจองบริการ ทีมงานจะโทรกลับเพื่อยืนยัน</li>');
    return '' +
      '<footer class="site-footer"><div class="wrap foot-grid">' +
        '<div><img class="foot-logo" src="assets/logo.png" alt="CareGo" width="140" height="50">' +
          '<p>' + CFG.tagline + '<br>แพลตฟอร์มรับ-ส่งไปโรงพยาบาลและดูแลที่บ้านสำหรับผู้สูงอายุและผู้ป่วย</p></div>' +
        '<div><h3>เมนู</h3><ul>' +
          '<li><a href="index.html#services">บริการของเรา</a></li>' +
          '<li><a href="booking.html">จองบริการ</a></li>' +
          '<li><a href="my-bookings.html">นัดหมายของฉัน</a></li>' +
          '<li><a href="about.html">เกี่ยวกับโครงการ</a></li>' +
          '<li><a href="admin.html">สำหรับทีมงาน (โหมดสาธิต)</a></li></ul></div>' +
        '<div><h3>ติดต่อ</h3><ul>' + contact.join('') + '</ul>' +
          '<p class="foot-note">กรณีฉุกเฉินวิกฤต โทร ' + CFG.emergencyNumber + '</p></div>' +
      '</div>' +
      '<div class="wrap foot-bottom"><span>© ' + (new Date().getFullYear() + 543) + ' CareGo · โครงงานรายวิชา BS93114 นวัตกรรมธุรกิจและพาณิชย์: จากไอเดียสู่ตลาด คณะบริหารธุรกิจและการบัญชี มหาวิทยาลัยขอนแก่น</span></div>' +
      '</footer>';
  }

  function mount() {
    const h = document.getElementById('site-header');
    const f = document.getElementById('site-footer');
    if (h) h.innerHTML = headerHTML();
    if (f) f.innerHTML = footerHTML();
    CareGoIcons();

    /* เมนูมือถือ */
    const burger = document.getElementById('burger'), navEl = document.getElementById('nav');
    if (burger) burger.addEventListener('click', () => {
      const open = navEl.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
    });

    /* ตัวอักษร / คอนทราสต์ */
    const sizes = ['0', '1', '2', '3'];            // 0 = เล็ก, 1 = ปกติ, 2 = ใหญ่, 3 = ใหญ่มาก
    const hc = document.getElementById('hc');
    const syncHc = () => hc && hc.setAttribute('aria-pressed', C.prefs.get().contrast ? 'true' : 'false');
    syncHc();
    const bump = d => {
      const cur = sizes.indexOf(C.prefs.get().fs || '1');
      C.prefs.set({ fs: sizes[Math.max(0, Math.min(sizes.length - 1, cur + d))] });
    };
    document.getElementById('fsUp')?.addEventListener('click', () => bump(1));
    document.getElementById('fsDown')?.addEventListener('click', () => bump(-1));
    hc?.addEventListener('click', () => { C.prefs.set({ contrast: !C.prefs.get().contrast }); syncHc(); });

    /* ป้ายจำนวนนัดหมายที่ยังไม่เสร็จ ให้อัปเดตเมื่อข้อมูลเปลี่ยน */
    C.onChange(() => {
      const link = document.querySelector('.nav a[href="my-bookings.html"]');
      if (!link) return;
      link.querySelector('.nav-badge')?.remove();
      const n = activeCount();
      if (n) link.insertAdjacentHTML('beforeend', '<span class="nav-badge">' + n + '</span>');
    });
  }

  /* ข้อความแจ้งสั้น ๆ มุมล่าง (ใช้ร่วมกันทุกหน้า) */
  C.toast = function (msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(C.toast._t);
    C.toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
