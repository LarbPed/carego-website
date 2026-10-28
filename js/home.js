/* CareGo – หน้าแรก: สร้างการ์ดบริการจากข้อมูลกลาง (data.js) เพื่อให้ราคาตรงกันทั้งเว็บ */
(function () {
  const C = window.CareGo, D = C.data;

  const veh = document.getElementById('vehicleCards');
  if (veh) {
    veh.innerHTML = D.vehicles.map(v => `
      <article class="card svc-card">
        <div class="icon-badge"><span data-icon="${v.icon}"></span></div>
        <h3>${v.name}</h3>
        <p>${v.desc}</p>
        <div class="meta">${CareGoIcon('users', 16)} ${v.seats}</div>
        <div class="price"><small>เริ่มต้น</small> ${C.baht(v.base)}</div>
        <a class="btn btn-ghost btn-sm" href="booking.html?type=transport&vehicle=${v.id}">เลือกบริการนี้ ${CareGoIcon('arrow-right', 16)}</a>
      </article>`).join('');
  }

  const home = document.getElementById('homeCards');
  if (home) {
    home.innerHTML = D.homeServices.map(s => `
      <article class="card svc-card">
        <div class="icon-badge teal"><span data-icon="${s.icon}"></span></div>
        <h3>${s.name}</h3>
        <p>${s.desc}</p>
        <div class="meta">${CareGoIcon('info', 16)} ${s.note}</div>
        <div class="price"><small>เริ่มต้น</small> ${C.baht(s.unitPrice)}<small> / ${s.unit}</small></div>
        <a class="btn btn-ghost btn-sm" href="booking.html?type=homecare&service=${s.id}">เลือกบริการนี้ ${CareGoIcon('arrow-right', 16)}</a>
      </article>`).join('');
  }
  CareGoIcons();
})();
