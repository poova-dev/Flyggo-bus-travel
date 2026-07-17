// ============================================================
// booking.js — Tamil Nadu / RedBus-style booking logic
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, query, where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ── State ──
let allBuses = [];
let filteredBuses = [];
let activeFilters = { type: [], time: [] };
let activeSort    = 'rating';
let selectedBus   = null;
let selectedSeats = [];
let bookingStep   = 'seats'; // 'seats' | 'passenger'
let currentUser   = null;

// Listen for auth state
window.addEventListener('authStateChanged', e => { currentUser = e.detail; });

// ── Tamil Nadu Demo Trips ──
function getTNDemoBuses() {
  return [
    {
      id: 'tn-1',
      operator:    'PARVEEN TRAVELS',
      bus_type:    'AC Sleeper',
      layout:      '2+1',
      berths:       30,
      depart:      '21:00', arrive: '06:30',
      duration:    '9h 30m',
      origin:      'Chennai', dest: 'Coimbatore',
      price:        950, price_original: 1100,
      seats_left:   8,
      rating:       4.5, rating_count: 1823,
      amenities:   ['❄️ AC','📶 Wi-Fi','🔌 USB','🛌 Sleeper'],
      is_new:       false, cancellable: true,
      booked:      ['1A','1B','2A','3B','4C','5A','6B','7C'],
    },
    {
      id: 'tn-2',
      operator:    'THAMARAI BUS',
      bus_type:    'AC Sleeper',
      layout:      '2+1',
      berths:       30,
      depart:      '22:00', arrive: '07:30',
      duration:    '9h 30m',
      origin:      'Chennai', dest: 'Coimbatore',
      price:        1150, price_original: 1300,
      seats_left:   3,
      rating:       4.8, rating_count: 2204,
      amenities:   ['❄️ AC','📶 Wi-Fi','🔌 USB','🛌 Sleeper','🍶 Water'],
      is_new:       true, cancellable: true,
      booked:      ['1A','2A','2B','3A','3B','3C','4A','4B','5A','5B','6A','7A','7C','8B','9A','9B','9C','10A','10B','11A'],
    },
    {
      id: 'tn-3',
      operator:    'SRM TRANSPORTS',
      bus_type:    'AC Seater',
      layout:      '2+2',
      berths:       40,
      depart:      '06:00', arrive: '13:30',
      duration:    '7h 30m',
      origin:      'Chennai', dest: 'Coimbatore',
      price:        550, price_original: 650,
      seats_left:   22,
      rating:       4.2, rating_count: 945,
      amenities:   ['❄️ AC','🔌 USB','💺 Seater'],
      is_new:       false, cancellable: false,
      booked:      ['1A','1B','2C','2D','3A'],
    },
    {
      id: 'tn-4',
      operator:    'VRL TRAVELS',
      bus_type:    'Non-AC Seater',
      layout:      '2+3',
      berths:       54,
      depart:      '07:00', arrive: '15:00',
      duration:    '8h 0m',
      origin:      'Chennai', dest: 'Coimbatore',
      price:        350, price_original: 400,
      seats_left:   38,
      rating:       3.9, rating_count: 512,
      amenities:   ['💧 Water','💺 Seater','🔒 Luggage Rack'],
      is_new:       false, cancellable: false,
      booked:      ['1A','2B'],
    },
    {
      id: 'tn-5',
      operator:    'KPN TRAVELS',
      bus_type:    'AC Sleeper',
      layout:      '2+1',
      berths:       30,
      depart:      '20:00', arrive: '05:30',
      duration:    '9h 30m',
      origin:      'Chennai', dest: 'Coimbatore',
      price:        1050, price_original: 1200,
      seats_left:   15,
      rating:       4.6, rating_count: 3156,
      amenities:   ['❄️ AC','📶 Wi-Fi','🔌 USB','🛌 Sleeper','🍶 Water','🎭 Reading Light'],
      is_new:       false, cancellable: true,
      booked:      ['1A','2B','3C','4A','5B','6C'],
    },
  ];
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  setupDates();
  prefillSearch();
  loadAndSearchBuses();
  setupFilterPills();
});

function setupDates() {
  const today = new Date();
  const fmt   = d => d.toISOString().split('T')[0];
  const di    = document.getElementById('s-date');
  di.min   = fmt(today);
  di.value = fmt(today);
}

function prefillSearch() {
  const params = new URLSearchParams(window.location.search);
  const from   = params.get('from') || 'Chennai';
  const to     = params.get('to')   || 'Coimbatore';
  const date   = params.get('date');

  setSelectVal('s-from', from);
  setSelectVal('s-to',   to);
  if (date) document.getElementById('s-date').value = date;

  document.getElementById('breadcrumb-from').textContent = from;
  document.getElementById('breadcrumb-to').textContent   = to;
}

function setSelectVal(id, val) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const opt = [...sel.options].find(o => o.value.toLowerCase() === val.toLowerCase());
  if (opt) sel.value = opt.value;
}

function setDay(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  document.getElementById('s-date').value = d.toISOString().split('T')[0];
  document.getElementById('today-btn').classList.toggle('active', offset === 0);
  document.getElementById('tomorrow-btn').classList.toggle('active', offset === 1);
}
window.setDay = setDay;

async function loadAndSearchBuses() {
  const listEl = document.getElementById('trips-list');
  listEl.innerHTML = [1,2,3].map(() =>
    `<div class="skeleton" style="height:108px;border-radius:var(--radius-lg);margin-bottom:12px;"></div>`
  ).join('');

  const from = document.getElementById('s-from')?.value || '';
  const to   = document.getElementById('s-to')?.value   || '';

  try {
    const [routesSnap, tripsSnap, vehiclesSnap, fleetSnap, pricingSnap, schedulesSnap] = await Promise.all([
      getDocs(collection(db, 'routes')),
      getDocs(collection(db, 'trips')),
      getDocs(collection(db, 'vehicles')),
      getDocs(collection(db, 'fleet_types')),
      getDocs(collection(db, 'pricing')),
      getDocs(collection(db, 'schedules')),
    ]);

    const routes = {}, vehicles = {}, fleets = {}, pricing = {}, schedules = {};
    routesSnap.forEach(d    => routes[d.id]    = { id:d.id, ...d.data() });
    vehiclesSnap.forEach(d  => vehicles[d.id]  = { id:d.id, ...d.data() });
    fleetSnap.forEach(d     => fleets[d.id]    = { id:d.id, ...d.data() });
    pricingSnap.forEach(d   => pricing[d.id]   = { id:d.id, ...d.data() });
    schedulesSnap.forEach(d => schedules[d.id] = { id:d.id, ...d.data() });

    allBuses = [];
    tripsSnap.forEach(d => {
      const t   = { id:d.id, ...d.data() };
      const r   = routes[t.route_id];
      const v   = vehicles[t.vehicle_id];
      const f   = v ? fleets[v.fleet_type_id] : null;
      const sc  = schedules[t.schedule_id];
      const p   = Object.values(pricing).find(x => x.route_id===t.route_id && x.fleet_type_id===v?.fleet_type_id);

      allBuses.push({
        id:          t.id,
        operator:    v?.operator_name || 'FLYGGO BUS',
        bus_type:    f?.name || 'AC Seater',
        layout:      f?.seat_layout || '2+2',
        berths:      f?.total_seats || 40,
        depart:      sc?.departure_time || '00:00',
        arrive:      sc?.arrival_time   || '00:00',
        duration:    `${Math.floor((r?.duration_mins||0)/60)}h ${(r?.duration_mins||0)%60}m`,
        origin:      r?.origin || '',
        dest:        r?.destination || '',
        price:       p?.price || 0,
        price_original: Math.round((p?.price||0) * 1.15),
        seats_left:  t.available_seats || 0,
        rating:      4.2,
        rating_count: 800,
        amenities:   f?.amenities || [],
        is_new:      false,
        cancellable: true,
        booked:      t.booked_seats || [],
      });
    });

    if (allBuses.length === 0) allBuses = getTNDemoBuses();
  } catch(e) {
    console.warn('Firestore error, using demo data:', e.message);
    allBuses = getTNDemoBuses();
  }

  applyFilters();
  const from2 = document.getElementById('s-from')?.value || from;
  const to2   = document.getElementById('s-to')?.value   || to;
  document.getElementById('breadcrumb-from').textContent = from2;
  document.getElementById('breadcrumb-to').textContent   = to2;
}

// ── Filter & Sort ──
window.searchTrips = () => { loadAndSearchBuses(); };

window.applyFilters = function() {
  const from = document.getElementById('s-from')?.value?.toLowerCase() || '';
  const to   = document.getElementById('s-to')?.value?.toLowerCase()   || '';

  const activeTypes = activeFilters.type;
  const activeTimes = activeFilters.time;
  const needWifi    = document.querySelector('input[value="wifi"]')?.checked;
  const needCharge  = document.querySelector('input[value="charging"]')?.checked;
  const needAc      = document.querySelector('input[value="ac"]')?.checked;
  const needCancel  = document.querySelector('input[value="cancellable"]')?.checked;
  const needNew     = document.querySelector('input[value="new_bus"]')?.checked;

  filteredBuses = allBuses.filter(b => {
    if (from && !b.origin.toLowerCase().includes(from)) return false;
    if (to   && !b.dest.toLowerCase().includes(to))   return false;
    if (activeTypes.length && !activeTypes.includes(b.bus_type)) return false;

    const hr = parseInt(b.depart.split(':')[0]);
    if (activeTimes.length) {
      const inMorning = hr < 10;
      const inDay     = hr >= 10 && hr < 18;
      const inNight   = hr >= 18;
      const ok = (activeTimes.includes('morning') && inMorning) ||
                 (activeTimes.includes('day') && inDay) ||
                 (activeTimes.includes('night') && inNight);
      if (!ok) return false;
    }

    if (needWifi   && !b.amenities.some(a => a.toLowerCase().includes('wi-fi'))) return false;
    if (needCharge && !b.amenities.some(a => a.toLowerCase().includes('usb')))   return false;
    if (needAc     && b.bus_type.includes('Non-AC')) return false;
    if (needCancel && !b.cancellable) return false;
    if (needNew    && !b.is_new)      return false;

    return true;
  });

  // Sort
  filteredBuses.sort((a, b) => {
    if (activeSort === 'rating') return b.rating - a.rating;
    if (activeSort === 'time')   return a.depart.localeCompare(b.depart);
    if (activeSort === 'price')  return a.price - b.price;
    return 0;
  });

  renderBuses(filteredBuses);
};

// Filter pill toggle
function setupFilterPills() {}

window.togglePill = function(el, group, value) {
  el.classList.toggle('active');
  if (el.classList.contains('active')) {
    if (!activeFilters[group]) activeFilters[group] = [];
    activeFilters[group].push(value);
  } else {
    activeFilters[group] = activeFilters[group].filter(v => v !== value);
  }
  applyFilters();
};

window.clearFilters = function() {
  activeFilters = { type: [], time: [] };
  document.querySelectorAll('.filter-pill.active').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.filter-checkbox input:checked').forEach(cb => cb.checked = false);
  applyFilters();
};

window.setSort = function(sort, btn) {
  activeSort = sort;
  document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyFilters();
};

// ── Render Bus Cards ──
function renderBuses(buses) {
  const listEl  = document.getElementById('trips-list');
  const countEl = document.getElementById('results-count');
  const subEl   = document.getElementById('bus-count-sub');

  const n = buses.length;
  countEl.innerHTML = `<strong>${n} ${n===1?'bus':'buses'}</strong> found`;
  subEl.textContent = `${n} buses found`;

  if (n === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🔍</span>
        <div class="empty-title">No buses found</div>
        <p class="empty-sub">Try changing filters or search a different route / date.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = buses.map(bus => {
    const seatsClass = bus.seats_left <= 5 ? 'seats-low' : 'seats-ok';
    const seatsText  = bus.seats_left <= 5
      ? `⚠ Only ${bus.seats_left} seats left`
      : `${bus.seats_left} seats available`;
    const discount   = Math.round(((bus.price_original - bus.price) / bus.price_original) * 100);

    return `
    <div class="bus-card" id="bus-${bus.id}">
      <div class="bus-card-main">
        <!-- Operator -->
        <div>
          <div class="bus-operator">${bus.operator}</div>
          <div class="bus-type-badge">${bus.bus_type} (${bus.layout}) · ${bus.berths} ${bus.layout.includes('1') ? 'berths' : 'seats'}</div>
          <div style="margin-top:6px;display:flex;gap:5px;">
            ${bus.is_new ? '<span class="bus-tag tag-new">New Bus</span>' : ''}
            ${bus.cancellable ? '<span class="bus-tag tag-cancellable">Free Cancel</span>' : ''}
          </div>
        </div>
        <!-- Timing -->
        <div class="bus-timing">
          <div>
            <div class="time-val">${bus.depart}</div>
            <div class="time-city">${bus.origin}</div>
          </div>
          <div class="time-sep">
            <div class="time-dur">${bus.duration}</div>
            <div class="time-line"></div>
          </div>
          <div>
            <div class="time-val">${bus.arrive}</div>
            <div class="time-city">${bus.dest}</div>
          </div>
        </div>
        <!-- Rating -->
        <div class="bus-rating">
          <div>
            <div class="rating-badge">★ ${bus.rating.toFixed(1)}</div>
            <div class="rating-count" style="text-align:center;margin-top:3px;">${bus.rating_count.toLocaleString()}</div>
          </div>
        </div>
        <!-- Price + CTA -->
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:var(--sp-sm);">
          <div class="bus-price-block">
            <div class="bus-price-original">₹${bus.price_original.toLocaleString()}</div>
            <div class="bus-price-main">₹${bus.price.toLocaleString()}</div>
            <div class="bus-price-label">onwards per ${bus.layout.includes('1') ? 'berth' : 'seat'}</div>
          </div>
          <div class="bus-seats-left ${seatsClass}">${seatsText}</div>
          <button class="view-seats-btn" onclick="openSeatPanel('${bus.id}')">View seats →</button>
        </div>
      </div>
      <div class="bus-card-footer">
        <div class="bus-amenity-list">
          ${bus.amenities.map(a => `<span class="bus-amenity">${a}</span>`).join('')}
        </div>
        ${discount > 0 ? `<span class="badge badge-red">SAVE ${discount}% OFF</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ── Seat Panel ──
window.openSeatPanel = function(busId) {
  selectedBus = allBuses.find(b => b.id === busId);
  if (!selectedBus) return;
  selectedSeats = [];

  document.getElementById('sp-route-title').textContent   = `${selectedBus.origin} → ${selectedBus.dest}`;
  document.getElementById('sp-operator-name').textContent = `${selectedBus.operator} · ${selectedBus.depart} - ${selectedBus.arrive} · ${selectedBus.bus_type}`;
  document.getElementById('sp-seats').textContent  = '—';
  document.getElementById('sp-fare').textContent   = `₹${selectedBus.price.toLocaleString()} per seat`;
  document.getElementById('sp-total').textContent  = '—';
  document.getElementById('sp-proceed-btn').disabled      = true;
  document.getElementById('sp-proceed-btn').textContent   = 'Select seats to continue';
  document.getElementById('passenger-step').style.display = 'none';

  renderSeatMap(selectedBus);
  document.getElementById('seat-panel-overlay').classList.add('open');
};

window.closeSeatPanel = function() {
  document.getElementById('seat-panel-overlay').classList.remove('open');
  selectedSeats = [];
  selectedBus   = null;
};

function renderSeatMap(bus) {
  const grid  = document.getElementById('seat-map-grid');
  const [left, right] = bus.layout.split('+').map(Number);
  const rows  = Math.ceil(bus.berths / (left + right));
  const booked = bus.booked || [];

  grid.innerHTML = '';

  for (let row = 1; row <= rows; row++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'seat-row';

    for (let col = 1; col <= left; col++) {
      const id = `${row}${String.fromCharCode(64+col)}`;
      rowEl.appendChild(makeSeat(id, booked));
    }
    const aisle = document.createElement('div');
    aisle.className = 'seat-aisle';
    rowEl.appendChild(aisle);

    for (let col = left+1; col <= left+right; col++) {
      const id = `${row}${String.fromCharCode(64+col)}`;
      rowEl.appendChild(makeSeat(id, booked));
    }
    grid.appendChild(rowEl);
  }
}

function makeSeat(id, booked) {
  const el = document.createElement('div');
  el.className = booked.includes(id) ? 'seat sold' : 'seat available';
  el.textContent = id;
  el.id = `s-${id}`;
  el.title = booked.includes(id) ? 'Sold' : `Seat ${id} — ₹${selectedBus?.price?.toLocaleString()}`;
  el.onclick = () => toggleSeat(id, booked);
  return el;
}

function toggleSeat(id, booked) {
  if (booked.includes(id)) return;
  const el = document.getElementById(`s-${id}`);
  if (selectedSeats.includes(id)) {
    selectedSeats = selectedSeats.filter(s => s !== id);
    el.className = 'seat available';
  } else {
    selectedSeats.push(id);
    el.className = 'seat selected';
  }
  updateSummary();
}

function updateSummary() {
  const n   = selectedSeats.length;
  const btn = document.getElementById('sp-proceed-btn');
  const pasStep = document.getElementById('passenger-step');

  document.getElementById('sp-seats').textContent  = n ? selectedSeats.join(', ') : '—';
  document.getElementById('sp-total').textContent  = n ? `₹${(selectedBus.price * n).toLocaleString()}` : '—';

  if (n > 0) {
    btn.disabled     = false;
    btn.textContent  = `Confirm ${n} seat${n>1?'s':''} · ₹${(selectedBus.price*n).toLocaleString()} →`;
    pasStep.style.display = 'block';
  } else {
    btn.disabled     = true;
    btn.textContent  = 'Select seats to continue';
    pasStep.style.display = 'none';
  }
}

// ── Book ──
window.proceedBooking = async function() {
  if (!currentUser) {
    openAuthModal?.();
    showToast('Please sign in to complete booking', 'info');
    return;
  }
  if (!selectedSeats.length) { showToast('Please select at least one seat', 'error'); return; }

  const name  = document.getElementById('pax-name')?.value?.trim();
  const phone = document.getElementById('pax-phone')?.value?.trim();
  const email = document.getElementById('pax-email')?.value?.trim();

  if (!name || !phone) { showToast('Please fill in passenger name and mobile number', 'error'); return; }
  if (phone.length !== 10) { showToast('Please enter a valid 10-digit mobile number', 'error'); return; }

  const btn = document.getElementById('sp-proceed-btn');
  btn.classList.add('loading'); btn.disabled = true;

  try {
    const ref = await addDoc(collection(db,'bookings'), {
      user_id:       currentUser.uid,
      operator:      selectedBus.operator,
      bus_type:      selectedBus.bus_type,
      origin:        selectedBus.origin,
      destination:   selectedBus.dest,
      departure:     selectedBus.depart,
      arrival:       selectedBus.arrive,
      seat_numbers:  selectedSeats,
      pax_name:      name,
      pax_phone:     phone,
      pax_email:     email || currentUser.email,
      price_per_seat: selectedBus.price,
      total_amount:  selectedBus.price * selectedSeats.length,
      status:        'confirmed',
      created_at:    serverTimestamp(),
    });

    const ref8 = ref.id.slice(0,8).toUpperCase();
    showToast(`🎉 Booking confirmed! Ref: ${ref8}. Check SMS/Email for e-ticket.`, 'success');
    closeSeatPanel();
  } catch(e) {
    showToast('Booking failed. Please try again.', 'error');
    console.error(e);
  } finally {
    btn.classList.remove('loading'); btn.disabled = false;
  }
};
