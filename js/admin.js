// ============================================================
// admin.js — Flyggo Admin Panel Logic
// ============================================================
import { db, auth } from '../js/firebase-config.js';
import {
  collection, getDocs, doc, updateDoc, deleteDoc,
  query, orderBy, limit, where, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';

let currentAdmin = null;

// ── Auth Guard ──
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = '../index.html';
    return;
  }

  // Check admin role
  try {
    const userSnap = await getDocs(query(collection(db, 'users'), where('email','==', user.email)));
    let isAdmin = false;
    userSnap.forEach(d => { if (d.data().role === 'admin') isAdmin = true; });

    if (!isAdmin) {
      document.getElementById('auth-guard').innerHTML = `
        <div style="font-size:3rem;">🚫</div>
        <h2>Access Denied</h2>
        <p>You do not have admin privileges.</p>
        <a href="../index.html" class="btn btn-primary btn-sm">Back to Home</a>`;
      return;
    }

    currentAdmin = user;
    document.getElementById('auth-guard').style.display = 'none';
    document.getElementById('admin-app').style.display  = 'block';
    document.getElementById('admin-name').textContent = user.displayName || user.email.split('@')[0];
    document.getElementById('admin-avatar').textContent = (user.displayName || user.email)[0].toUpperCase();
    loadDashboard();
  } catch(e) {
    // If no users collection yet, allow first-time access (dev mode)
    currentAdmin = user;
    document.getElementById('auth-guard').style.display = 'none';
    document.getElementById('admin-app').style.display  = 'block';
    document.getElementById('admin-name').textContent = user.email?.split('@')[0] || 'Admin';
    document.getElementById('admin-avatar').textContent = (user.email || 'A')[0].toUpperCase();
    loadDashboard();
  }
});

window.signOutAdmin = async () => {
  await signOut(auth);
  window.location.href = '../index.html';
};

// ── Dashboard Stats ──
async function loadDashboard() {
  try {
    const [bookingsSnap, usersSnap, tripsSnap] = await Promise.all([
      getDocs(collection(db, 'bookings')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'trips')),
    ]);

    let totalRevenue = 0;
    bookingsSnap.forEach(d => { totalRevenue += (d.data().total_amount || 0); });

    document.getElementById('stat-bookings').textContent = bookingsSnap.size;
    document.getElementById('stat-revenue').textContent  = `₹${(totalRevenue/1000).toFixed(1)}K`;
    document.getElementById('stat-trips').textContent    = tripsSnap.size;
    document.getElementById('stat-users').textContent    = usersSnap.size;
    document.getElementById('stat-bookings-change').textContent = `+${bookingsSnap.size} total`;
    document.getElementById('stat-rev-change').textContent      = `₹${totalRevenue.toLocaleString()} earned`;

    renderRecentBookings(bookingsSnap);
  } catch(e) {
    console.warn('Stats error:', e.message);
    ['stat-bookings','stat-revenue','stat-trips','stat-users'].forEach(id => {
      document.getElementById(id).textContent = '—';
    });
  }
}

function renderRecentBookings(snap) {
  const tbody = document.getElementById('recent-bookings-tbody');
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--clr-text-muted);">No bookings yet</td></tr>`;
    return;
  }

  const rows = [];
  snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  const recent = rows.slice(-10).reverse();

  tbody.innerHTML = recent.map(b => `
    <tr>
      <td><strong style="color:var(--clr-primary);">${b.id?.slice(0,8).toUpperCase()}</strong></td>
      <td>${b.pax_name || b.passenger_name || '—'}</td>
      <td>${b.origin || b.route_origin || '—'} → ${b.destination || b.route_dest || '—'}</td>
      <td>${b.bus_type || b.fleet_type || '—'}</td>
      <td>${(b.seat_numbers || []).join(', ')}</td>
      <td><strong>₹${(b.total_amount || b.total_price || 0).toLocaleString()}</strong></td>
      <td><span class="status-pill status-${b.status || 'confirmed'}">${(b.status||'confirmed').toUpperCase()}</span></td>
    </tr>
  `).join('');
}

// ── Bookings ──
window.loadBookings = async function() {
  const tbody = document.getElementById('bookings-tbody');
  tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;
  try {
    const snap  = await getDocs(query(collection(db,'bookings'), orderBy('created_at','desc')));
    const rows  = [];
    snap.forEach(d => rows.push({ id:d.id, ...d.data() }));
    renderBookingsTable(rows);
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:24px;color:var(--clr-text-muted);">Error loading bookings: ${e.message}</td></tr>`;
  }
};

function renderBookingsTable(rows) {
  const tbody = document.getElementById('bookings-tbody');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:32px;color:var(--clr-text-muted);">No bookings found</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(b => `
    <tr>
      <td><strong style="color:var(--clr-primary);">${b.id?.slice(0,8).toUpperCase()}</strong></td>
      <td>${b.pax_name || b.passenger_name || '—'}</td>
      <td>${b.pax_phone || b.passenger_phone || '—'}</td>
      <td>${b.origin || b.route_origin || '—'} → ${b.destination || b.route_dest || '—'}</td>
      <td>${b.departure || b.departure_time || '—'}</td>
      <td>${b.bus_type || b.fleet_type || '—'}</td>
      <td>${(b.seat_numbers||[]).join(', ')}</td>
      <td><strong>₹${(b.total_amount||b.total_price||0).toLocaleString()}</strong></td>
      <td><span class="status-pill status-${b.status||'confirmed'}">${(b.status||'confirmed').toUpperCase()}</span></td>
      <td>
        ${b.status !== 'cancelled' ? `<button class="btn btn-sm" style="background:var(--clr-primary-bg);color:var(--clr-primary);border:1px solid var(--clr-primary-border);" onclick="cancelBooking('${b.id}')">Cancel</button>` : '<span style="color:var(--clr-text-muted);font-size:0.72rem;">—</span>'}
      </td>
    </tr>
  `).join('');
}

window.cancelBooking = async function(id) {
  if (!confirm('Cancel this booking?')) return;
  try {
    await updateDoc(doc(db,'bookings',id), { status:'cancelled' });
    showToast('Booking cancelled', 'success');
    loadBookings();
  } catch(e) {
    showToast('Error: ' + e.message, 'error');
  }
};

window.filterBookings = function() {
  const status = document.getElementById('booking-status-filter').value;
  // Re-apply filter on existing rows
  document.querySelectorAll('#bookings-tbody tr').forEach(row => {
    const pill = row.querySelector('.status-pill');
    if (!pill) return;
    const s = pill.textContent.trim().toLowerCase();
    row.style.display = (!status || s === status) ? '' : 'none';
  });
};

// ── Gallery Management ──
window.loadAdminGallery = async function() {
  const grid = document.getElementById('admin-gallery-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;"><div class="spinner" style="margin:0 auto;"></div></div>`;
  try {
    const snap = await getDocs(query(collection(db,'gallery'), orderBy('created_at','desc')));
    const photos = [];
    snap.forEach(d => photos.push({ id:d.id, ...d.data() }));

    if (!photos.length) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--clr-text-muted);">No photos uploaded yet.</div>`;
      return;
    }

    grid.innerHTML = photos.map(p => `
      <div style="border:1px solid var(--clr-border);border-radius:var(--radius-lg);overflow:hidden;background:#fff;">
        <img src="${p.url}" alt="${p.caption}" style="width:100%;height:120px;object-fit:cover;" loading="lazy">
        <div style="padding:8px;">
          <div style="font-size:0.72rem;font-weight:600;color:var(--clr-text-dark);margin-bottom:2px;">${p.caption||'—'}</div>
          <div style="font-size:0.68rem;color:var(--clr-text-muted);">By: ${p.uploader||'—'}</div>
          <div style="display:flex;gap:4px;margin-top:6px;">
            ${!p.approved ? `<button class="btn btn-sm" style="flex:1;background:var(--clr-green-bg);color:var(--clr-green);border:1px solid var(--clr-green-border);font-size:0.68rem;padding:4px 6px;" onclick="approvePhoto('${p.id}')">✓ Approve</button>` : `<span style="font-size:0.68rem;color:var(--clr-green);font-weight:600;">✓ Approved</span>`}
            <button class="btn btn-sm" style="background:var(--clr-primary-bg);color:var(--clr-primary);border:1px solid var(--clr-primary-border);font-size:0.68rem;padding:4px 6px;" onclick="deletePhoto('${p.id}')">🗑</button>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--clr-text-muted);">Error: ${e.message}</div>`;
  }
};

window.filterAdminGallery = function(status) {
  const items = document.querySelectorAll('#admin-gallery-grid > div');
  items.forEach(item => {
    if (status === 'pending') {
      item.style.display = item.querySelector('.btn-approve') ? '' : 'none';
    } else {
      item.style.display = '';
    }
  });
};

window.approvePhoto = async function(id) {
  try {
    await updateDoc(doc(db,'gallery',id), { approved: true });
    showToast('Photo approved and published!', 'success');
    loadAdminGallery();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

window.deletePhoto = async function(id) {
  if (!confirm('Delete this photo permanently?')) return;
  try {
    await deleteDoc(doc(db,'gallery',id));
    showToast('Photo deleted', 'success');
    loadAdminGallery();
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
};

// ── Messages ──
window.loadMessages = async function() {
  const tbody = document.getElementById('messages-tbody');
  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;"><div class="spinner" style="margin:0 auto;"></div></td></tr>`;
  try {
    const snap = await getDocs(query(collection(db,'contact_messages'), orderBy('created_at','desc')));
    const msgs = [];
    snap.forEach(d => msgs.push({ id:d.id, ...d.data() }));

    if (!msgs.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--clr-text-muted);">No messages yet</td></tr>`;
      return;
    }

    tbody.innerHTML = msgs.map(m => `
      <tr>
        <td><strong>${m.name||'—'}</strong></td>
        <td>${m.phone||'—'}</td>
        <td><span class="badge badge-grey">${m.subject||'—'}</span></td>
        <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.message||'—'}</td>
        <td>${m.created_at?.toDate?.()?.toLocaleDateString('en-IN') || '—'}</td>
        <td><span class="status-pill ${m.status==='read' ? 'status-confirmed' : 'status-pending'}">${m.status||'UNREAD'}</span></td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--clr-text-muted);">Error: ${e.message}</td></tr>`;
  }
};

// ── Routes ──
window.loadRoutes = async function() {
  const tbody = document.getElementById('routes-tbody');
  try {
    const snap = await getDocs(collection(db,'routes'));
    const rows = [];
    snap.forEach(d => rows.push({ id:d.id, ...d.data() }));

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--clr-text-muted);">No routes in database. Run the seed script to populate.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><strong>${r.origin||'—'}</strong></td>
        <td><strong>${r.destination||'—'}</strong></td>
        <td>${r.distance_km||'—'} km</td>
        <td>${r.duration_mins ? `${Math.floor(r.duration_mins/60)}h ${r.duration_mins%60}m` : '—'}</td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--clr-text-muted);">Error: ${e.message}</td></tr>`;
  }
};

// ── Users ──
window.loadUsers = async function() {
  const tbody = document.getElementById('users-tbody');
  try {
    const snap = await getDocs(collection(db,'users'));
    const rows = [];
    snap.forEach(d => rows.push({ id:d.id, ...d.data() }));

    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--clr-text-muted);">No users yet</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(u => `
      <tr>
        <td><strong>${u.displayName||'—'}</strong></td>
        <td>${u.email||'—'}</td>
        <td>${u.phone||'—'}</td>
        <td><span class="badge ${u.role==='admin' ? 'badge-red' : 'badge-grey'}">${(u.role||'user').toUpperCase()}</span></td>
        <td>${u.created_at?.toDate?.()?.toLocaleDateString('en-IN') || '—'}</td>
      </tr>
    `).join('');
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--clr-text-muted);">Error: ${e.message}</td></tr>`;
  }
};
