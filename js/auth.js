// ============================================================
// auth.js — Firebase Authentication Helper
// ============================================================
import { auth, db } from './firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js';
import {
  doc, setDoc, getDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js';

// ── Current user state ──
let currentUser = null;
let currentUserData = null;

// ── Auth State Listener ──
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Fetch user profile from Firestore
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      currentUserData = userDoc.exists() ? userDoc.data() : null;
    } catch (e) {
      console.warn('Could not fetch user profile:', e.message);
    }
    updateNavUI(user, currentUserData);
    onAuthChange(user, currentUserData);
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: user }));
  } else {
    currentUserData = null;
    updateNavUI(null, null);
    onAuthChange(null, null);
    window.dispatchEvent(new CustomEvent('authStateChanged', { detail: null }));
  }
});

function updateNavUI(user, userData) {
  const btn = document.getElementById('nav-auth-btn');
  if (!btn) return;
  if (user) {
    const name = userData?.display_name || user.email?.split('@')[0] || 'User';
    btn.textContent = `👤 ${name}`;
    btn.onclick = () => {
      const isSubDir = window.location.pathname.includes('/admin/');
      window.location.href = isSubDir ? '../profile.html' : 'profile.html';
    };
    btn.title = 'View Profile & Bookings';

    // Show admin link if admin
    if (userData?.role === 'admin') {
      const adminLink = document.getElementById('admin-nav-link');
      if (adminLink) adminLink.style.display = 'block';
    }
  } else {
    btn.textContent = 'Sign In';
    btn.onclick = () => window.openAuthModal?.();
  }
}

// Override-able callback
window.onAuthChange = function(user, userData) {
  // Pages can override this to react to auth changes
};

// ── Sign In ──
window.handleSignIn = async function() {
  const email    = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  if (!email || !password) { showToast('Please enter email and password', 'error'); return; }

  const btn = document.getElementById('auth-submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    window.closeAuthModal?.();
    showToast('Welcome back! ✅', 'success');
  } catch (err) {
    console.error("Sign in error details:", err);
    showToast(getFriendlyError(err.code), 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// ── Sign Up ──
window.handleSignUp = async function() {
  const email    = document.getElementById('auth-email')?.value?.trim();
  const password = document.getElementById('auth-password')?.value;
  const name     = document.getElementById('auth-name')?.value?.trim() || email?.split('@')[0];
  if (!email || !password) { showToast('Please enter email and password', 'error'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }

  const btn = document.getElementById('auth-submit-btn');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Save user profile to Firestore
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      email: email,
      display_name: name,
      role: 'user',
      created_at: serverTimestamp()
    });
    window.closeAuthModal?.();
    showToast('Account created! Welcome to Flyggo 🎉', 'success');
  } catch (err) {
    console.error("Signup error details:", err);
    showToast(getFriendlyError(err.code), 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
};

// ── Sign Out ──
window.handleSignOut = async function() {
  try {
    await signOut(auth);
    showToast('Signed out successfully', 'info');
    if (window.location.pathname.includes('/admin/')) {
      window.location.href = '../index.html';
    }
  } catch (err) {
    showToast('Sign out failed', 'error');
  }
};

// ── Getters ──
export function getCurrentUser()     { return currentUser; }
export function getCurrentUserData() { return currentUserData; }
export function isAdmin() {
  return currentUserData?.role === 'admin';
}

// ── Error messages ──
function getFriendlyError(code) {
  const messages = {
    'auth/wrong-password':         'Incorrect password. Please try again.',
    'auth/user-not-found':         'No account found with this email.',
    'auth/email-already-in-use':   'This email is already registered.',
    'auth/weak-password':          'Password must be at least 6 characters.',
    'auth/invalid-email':          'Please enter a valid email address.',
    'auth/too-many-requests':      'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential':     'Invalid email or password.',
    'auth/operation-not-allowed':  'Email/Password sign-in is disabled in Firebase. Enable it in Firebase Console -> Authentication -> Sign-in method.',
  };
  return messages[code] || 'Authentication failed. Please try again.';
}
