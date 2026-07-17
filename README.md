# 🚌 Flyggo Bus Travel

Tamil Nadu's online bus ticket booking platform — a RedBus-inspired travel booking site with real-time seat selection, an admin management dashboard, and a Cloudinary-powered photo gallery.

**Live site:** [flyggobustravel.ragavananbu2018.workers.dev](https://flyggobustravel.ragavananbu2018.workers.dev)

---

## ✨ Features

- **Home Page** — route search, dynamic marquee, popular routes, traveller reviews, and a live photo gallery preview
- **Booking Engine** — interactive 2+1 Sleeper / 2+2 Seater seat layout maps, filters by timing/bus type/amenities, and passenger detail verification
- **Photo Gallery** — masonry-style gallery with category filters; passengers can submit photos (pending admin approval), and admins can upload photos that publish instantly
- **Admin Dashboard** — bookings management, revenue/trip/user stats, route & trip scheduling (CRUD), gallery moderation, and contact message inbox
- **Authentication** — Firebase Auth (email/password) with role-based access control for admin routes

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Database | Firebase Cloud Firestore |
| Authentication | Firebase Authentication |
| Image Storage | Cloudinary (unsigned client-side uploads) |
| Hosting / Deployment | Cloudflare Pages (via GitHub integration) |
| Security | Firestore Security Rules (role-based) |

No build step or framework — plain JS modules imported directly by the browser, deployed as static files.

---

## 📁 Project Structure

```
Flyggo-bus-travel/
├── index.html              # Home page
├── booking.html             # Seat selection & booking flow
├── gallery.html              # Public photo gallery
├── contact.html               # Contact / enquiry form
├── profile.html                 # Passenger profile
├── admin/
│   ├── index.html            # Admin dashboard
│   └── seed.html               # One-time Firestore seed data tool
├── css/
│   └── index.css               # Global styles
├── js/
│   ├── firebase-config.js      # Firebase + Cloudinary configuration
│   ├── auth.js                  # Auth state handling
│   ├── booking.js                 # Booking engine logic
│   ├── gallery.js                   # Public gallery + passenger uploads
│   └── admin.js                       # Admin dashboard logic
├── firebase.json                       # Firebase Hosting config
├── firestore.rules                       # Firestore security rules
└── firestore.indexes.json                 # Firestore composite indexes
```

---

## 🚀 Setup & Run Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/poova-dev/Flyggo-bus-travel.git
   cd Flyggo-bus-travel
   ```
2. Serve the project with any static file server (no build step required):
   ```bash
   npx http-server
   ```
3. Open `admin/seed.html` once to populate sample routes, vehicles, and schedules into Firestore.
4. Visit `index.html` to browse and book, or `admin/index.html` to manage the platform.

---

## ⚙️ Configuration

All third-party credentials live in `js/firebase-config.js`:

```js
const firebaseConfig = { /* Firebase project config */ };

export const CLOUDINARY_CONFIG = {
  cloudName: "YOUR_CLOUD_NAME",     // Cloudinary dashboard → top-left
  uploadPreset: "flyggo_gallery",    // Must be created as an UNSIGNED preset
  folder: "flyggo/gallery"
};
```

**Cloudinary setup:** Settings → Upload → Add upload preset → name it `flyggo_gallery` → Signing Mode: **Unsigned**.

---

## 🔐 Admin Access

| Field | Value |
|---|---|
| URL | `/admin/` |
| Email | `admin@flyggo.com` |
| Password | `admin123` |
| Role | `admin` |
| UID | `h13jlb8zxFhNQC8EV36GeLQKYFI3` |

> ⚠️ **Before going to production:** change this password in Firebase Authentication, and confirm `firestore.rules` restricts write access to users with `role: "admin"` only.

Admin capabilities:
- View & cancel bookings
- Manage routes, vehicles, and scheduled trips
- Upload gallery photos (auto-published) or approve/reject passenger submissions
- View contact form messages
- Manage user accounts and roles

---

## ☁️ Deployment

This project deploys as a static site with **Cloudflare Pages**, connected directly to this GitHub repository:

1. Cloudflare Dashboard → Pages → Create a project → Connect to Git → select this repo
2. Build command: *(none)*
3. Build output directory: `/`
4. Every push to `main` auto-deploys

Firestore indexes and security rules are deployed separately via the Firebase CLI:
```bash
firebase login
firebase use --add        # select the flyggo-bus-travel project
firebase deploy --only firestore:indexes,firestore:rules
```

---

## 📄 License

Built for demonstration and interview purposes.