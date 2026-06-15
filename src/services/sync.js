import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA75VRzI-eE2mC2rXsY_biUZwye0GbKHPw",
  authDomain: "sigma-list.firebaseapp.com",
  projectId: "sigma-list",
  storageBucket: "sigma-list.firebasestorage.app",
  messagingSenderId: "565476484381",
  appId: "1:565476484381:web:447d75343c1909f7b1edf4",
};

let db = null;
let ready = false;
let onSync = null;
let pollTimer = null;
let visibilityHandler = null;

export function initSync() {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    ready = true;
    console.log('[Sync] Firebase ready; push/pull active');
  } catch (e) {
    console.warn('Firebase init failed, working offline:', e.message);
    ready = false;
  }
}

export function isReady() {
  return ready;
}

/**
 * Register a callback that will be called after fresh cloud data is merged.
 * app.js passes its refreshAll so the UI updates after a pull.
 */
export function onPulled(cb) {
  onSync = cb;
}

/**
 * Start automatic pulls: on tab focus + every `intervalMs`.
 */
export function startAutoPull(getTasks, getNotes, intervalMs = 30000) {
  stopAutoPull();

  const doPull = async () => {
    const merged = await pullAndMerge(getTasks(), getNotes());
    if (merged && onSync) onSync(merged);
  };

  // Pull when user switches back to this tab
  visibilityHandler = () => {
    if (document.visibilityState === 'visible') doPull();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

  // Periodic polling
  pollTimer = setInterval(doPull, intervalMs);
}

export function stopAutoPull() {
  if (visibilityHandler) {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/** Push local tasks + notes to cloud */
export async function pushAll(tasks, notes) {
  if (!ready || !db) return;
  try {
    await Promise.all([
      setDoc(doc(db, 'data', 'tasks'), {
        value: JSON.stringify(tasks),
        updatedAt: Date.now(),
      }),
      setDoc(doc(db, 'data', 'notes'), {
        value: JSON.stringify(notes),
        updatedAt: Date.now(),
      }),
    ]);
  } catch (e) {
    console.warn('Sync push failed:', e.message);
  }
}

/** Pull cloud data and merge into local. Returns merged { tasks, notes } or null. */
export async function pullAndMerge(localTasks, localNotes) {
  if (!ready || !db) return null;
  try {
    const [taskSnap, noteSnap] = await Promise.all([
      getDoc(doc(db, 'data', 'tasks')),
      getDoc(doc(db, 'data', 'notes')),
    ]);

    let cloudTasks = null;
    let cloudNotes = null;

    if (taskSnap.exists()) {
      try { cloudTasks = JSON.parse(taskSnap.data().value); } catch {}
    }
    if (noteSnap.exists()) {
      try { cloudNotes = JSON.parse(noteSnap.data().value); } catch {}
    }

    if (!cloudTasks && !cloudNotes) return null;

    const mergedTasks = cloudTasks ? mergeTasks(localTasks, cloudTasks) : localTasks;
    const mergedNotes = cloudNotes ? mergeNotes(localNotes, cloudNotes) : localNotes;

    return { tasks: mergedTasks, notes: mergedNotes };
  } catch (e) {
    console.warn('Sync pull failed:', e.message);
    return null;
  }
}

function mergeTasks(local, cloud) {
  const result = {};
  for (const q of ['un', 'ue', 'nn', 'ne']) {
    const map = new Map();
    for (const t of (local[q] || [])) map.set(t.id, t);
    for (const t of (cloud[q] || [])) {
      const existing = map.get(t.id);
      if (!existing || (t.updatedAt || t.ts) > (existing.updatedAt || existing.ts)) {
        map.set(t.id, t);
      }
    }
    result[q] = Array.from(map.values());
  }
  return result;
}

function mergeNotes(local, cloud) {
  const map = new Map();
  for (const n of local) map.set(n.id, n);
  for (const n of cloud) {
    const existing = map.get(n.id);
    if (!existing || n.ts > existing.ts) {
      map.set(n.id, n);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
}
