import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  browserSessionPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { doc, getDocFromServer, getFirestore } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const app = initializeApp({"apiKey": "AIzaSyCgXCmP1FW8qrGt1cV0btOi98sVDzkel3E", "authDomain": "studio-8216248509-d2d60.firebaseapp.com", "projectId": "studio-8216248509-d2d60", "appId": "1:712802627768:web:5487f13e15e583382cc44d", "storageBucket": "studio-8216248509-d2d60.appspot.com"});
const auth = initializeAuth(app, { persistence: browserSessionPersistence });
const db = getFirestore(app);
const form = document.querySelector('#login');
const email = document.querySelector('#email');
const password = document.querySelector('#password');
const member = document.querySelector('#member');
const account = document.querySelector('#account');
const approval = document.querySelector('#approval');
const feedback = document.querySelector('#feedback');
const logout = document.querySelector('#logout');
const intro = document.querySelector('#intro');
const adminEntry = document.querySelector('#admin-entry');
const adminTools = document.querySelector('#admin-tools');
let adminDashboard;
const adminMode = new URLSearchParams(location.search).get('mode') === 'admin';

if (adminMode) {
  document.title = 'Admin sign-in · JNVH Alumni';
  document.querySelector('h1').textContent = 'Admin sign-in';
  document.querySelector('#account-title').textContent = 'Association administration';
  intro.textContent = 'Use your existing Firebase administrator account.';
  adminEntry.querySelector('a').href = './members.html';
  adminEntry.querySelector('a').textContent = 'Back to member sign-in';
}

const membershipLabels = new Map([
  ['approved', 'Your membership is approved.'],
  ['pending', 'Your membership is awaiting approval.'],
  ['rejected', 'Your membership was not approved. Contact the association for help.']
]);

onAuthStateChanged(auth, async (user) => {
  adminTools.hidden = true;
  adminDashboard?.clear();
  form.hidden = Boolean(user);
  intro.hidden = Boolean(user);
  member.hidden = !user;
  feedback.textContent = '';
  account.textContent = user?.email ?? '';
  approval.textContent = user ? 'Checking your account access…' : '';
  if (!user) return;

  try {
    const record = await getDocFromServer(doc(db, 'userStatus', user.uid));
    if (auth.currentUser !== user) return;
    const access = record.data();
    const isAdmin = access?.role === 'admin';
    if (isAdmin) {
      const { createAdminDashboard } = await import('./admin.js');
      if (auth.currentUser !== user) return;
      adminDashboard ??= createAdminDashboard(app, db, auth);
      adminDashboard.open(user);
      adminTools.hidden = false;
    }
    if (adminMode) {
      approval.textContent = isAdmin
        ? 'Administrator access confirmed.'
        : 'This account does not have administrator access.';
      return;
    }
    approval.textContent = membershipLabels.get(access?.status)
      ?? 'We could not find an approval status for this account. Contact the association for help.';
  } catch {
    if (auth.currentUser !== user) return;
    approval.textContent = 'Membership status is unavailable. Please try again later.';
  }
}, () => {
  feedback.textContent = 'Sign-in is unavailable. Please reload to try again.';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  feedback.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    form.reset();
  } catch (error) {
    feedback.textContent = error.code === 'auth/too-many-requests'
      ? 'Too many attempts. Please wait before trying again.'
      : error.code === 'auth/network-request-failed'
        ? 'Could not reach Firebase. Check your connection and try again.'
        : 'Sign-in failed. Check your email and password and try again.';
  } finally {
    password.value = '';
    button.disabled = false;
  }
});

logout.addEventListener('click', async () => {
  logout.disabled = true;
  try {
    await signOut(auth);
  } catch {
    feedback.textContent = 'Could not sign out. Please try again.';
  } finally {
    logout.disabled = false;
  }
});
