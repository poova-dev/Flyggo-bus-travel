// ============================================================
// gallery.js — Cloudinary upload + Firestore gallery
// ============================================================
import { db } from './firebase-config.js';
import {
  collection, getDocs, addDoc, query, orderBy, where,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

let allPhotos = [];
let currentFilter = 'all';
let currentUser   = null;

window.addEventListener('authStateChanged', e => {
  currentUser = e.detail;
  document.getElementById('upload-strip').style.display = currentUser ? 'block' : 'none';
});

document.addEventListener('DOMContentLoaded', () => {
  loadGallery();
});

// ── Demo gallery photos (used when Firestore is empty) ──
function getDemoPhotos() {
  return [
    { id:'d1', url:'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=600', caption:'Our AC Sleeper fleet ready for departure', category:'fleet', uploader:'Flyggo Team', width:600, height:400 },
    { id:'d2', url:'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600', caption:'Comfortable AC Seater on the Chennai–Coimbatore route', category:'journey', uploader:'Karthik R.', width:600, height:450 },
    { id:'d3', url:'https://images.unsplash.com/photo-1606220588913-b3aacb4d2f46?w=600', caption:'Chennai Koyambedu Bus Terminal', category:'terminal', uploader:'Flyggo Team', width:600, height:380 },
    { id:'d4', url:'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600', caption:'Happy passengers on the Madurai route', category:'passengers', uploader:'Priya M.', width:600, height:500 },
    { id:'d5', url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', caption:'Night journey — AC Sleeper interior', category:'fleet', uploader:'Sundar K.', width:600, height:340 },
    { id:'d6', url:'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600', caption:'Coimbatore terminal waiting area', category:'terminal', uploader:'Flyggo Team', width:600, height:420 },
    { id:'d7', url:'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=600', caption:'Scenic Tamil Nadu highway at sunrise', category:'journey', uploader:'Ramesh B.', width:600, height:460 },
    { id:'d8', url:'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=600', caption:'Passenger enjoying the comfortable ride', category:'passengers', uploader:'Arun T.', width:600, height:380 },
  ];
}

async function loadGallery() {
  try {
    const q    = query(collection(db, 'gallery'), where('approved', '==', true));
    const snap = await getDocs(q);
    allPhotos  = [];
    snap.forEach(d => allPhotos.push({ id: d.id, ...d.data() }));
    // Sort in memory to avoid index requirements
    allPhotos.sort((a,b) => {
      const ta = a.created_at?.seconds || 0;
      const tb = b.created_at?.seconds || 0;
      return tb - ta;
    });
    if (allPhotos.length === 0) allPhotos = getDemoPhotos();
  } catch(e) {
    allPhotos = getDemoPhotos();
  }
  renderGallery();
}

window.filterGallery = function(category, tabEl) {
  currentFilter = category;
  document.querySelectorAll('.g-tab').forEach(t => t.classList.remove('active'));
  tabEl.classList.add('active');
  renderGallery();
};

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const photos = currentFilter === 'all'
    ? allPhotos
    : allPhotos.filter(p => p.category === currentFilter);

  if (photos.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:64px;color:var(--clr-text-muted);">
      <div style="font-size:3rem;margin-bottom:16px;">📷</div>
      <div style="font-weight:700;color:var(--clr-text-dark);margin-bottom:8px;">No photos yet</div>
      <div>Be the first to upload in this category!</div>
    </div>`;
    return;
  }

  grid.innerHTML = photos.map(p => `
    <div class="gallery-item" onclick="window.openLightbox('${p.url}')" data-category="${p.category}">
      <img src="${p.url}" alt="${p.caption}" loading="lazy">
      <div class="gallery-overlay">
        <span class="gallery-overlay-icon">🔍</span>
      </div>
      <div class="gallery-item-caption">
        ${p.caption}
        <div class="gallery-item-meta">📸 ${p.uploader || 'Flyggo Passenger'}</div>
      </div>
    </div>
  `).join('');
}

// ── Upload to Cloudinary ──
window.handleGalleryUpload = async function(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  if (!currentUser) { showToast('Please sign in to upload photos', 'info'); return; }

  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) { showToast(`${file.name} is too large. Max 10 MB.`, 'error'); continue; }
    showToast(`Uploading ${file.name}…`, 'info');
    try {
      // Cloudinary unsigned upload
      const CLOUD_NAME   = window.CLOUDINARY_CLOUD_NAME || 'YOUR_CLOUD_NAME';
      const UPLOAD_PRESET = window.CLOUDINARY_PRESET    || 'flyggo_gallery';

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'flyggo/gallery');

      const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method:'POST', body:formData });
      const data = await res.json();

      if (!data.secure_url) throw new Error('Cloudinary upload failed');

      // Save to Firestore
      await addDoc(collection(db, 'gallery'), {
        url:        data.secure_url,
        public_id:  data.public_id,
        caption:    file.name.split('.')[0].replace(/[-_]/g,' '),
        category:   'journey',
        uploader:   currentUser.displayName || currentUser.email,
        user_id:    currentUser.uid,
        created_at: serverTimestamp(),
        approved:   false, // Admin must approve
      });

      showToast(`✅ ${file.name} uploaded! Pending admin approval.`, 'success');
    } catch(err) {
      showToast(`Failed to upload ${file.name}: ${err.message}`, 'error');
    }
  }
  e.target.value = '';
  loadGallery();
};
