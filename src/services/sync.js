/**
 * Cloud sync via Vercel proxy → Firestore.
 *
 * Web:          /api/sync  (Vite proxy in dev, direct Vercel function in prod)
 * Android:      https://sigma-list.vercel.app/api/sync  (no local server)
 *
 * Firestore REST API uses typed value fields:
 *   { fields: { value: { stringValue: "..." }, updatedAt: { integerValue: "..." } } }
 */

/** Vercel API proxy base. Detects platform at call time, not module load time. */
const VERCEL = 'https://sigma-list.vercel.app';

function getBase() {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      return `${VERCEL}/api/sync`;
    }
  } catch {}
  return '/api/sync';
}

let ready = false;
let onSync = null;
let pollTimer = null;
let visibilityHandler = null;

export function initSync() {
  ready = true;
  console.log('[Sync] REST API ready; push/pull active');
}

export function isReady() {
  return ready;
}

export function onPulled(cb) {
  onSync = cb;
}

export function startAutoPull(getTasks, getNotes, intervalMs = 30000) {
  stopAutoPull();

  const doPull = async () => {
    const merged = await pullAndMerge(getTasks(), getNotes());
    if (merged && onSync) onSync(merged);
  };

  visibilityHandler = () => {
    if (document.visibilityState === 'visible') doPull();
  };
  document.addEventListener('visibilitychange', visibilityHandler);

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

/** Push local tasks + notes to cloud via Vercel proxy */
export async function pushAll(tasks, notes) {
  if (!ready) return;
  const base = getBase();
  try {
    const body = (data) => JSON.stringify({
      fields: {
        value: { stringValue: JSON.stringify(data) },
        updatedAt: { integerValue: String(Date.now()) },
      },
    });
    await Promise.all([
      fetch(`${base}?doc=tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body(tasks),
      }),
      fetch(`${base}?doc=notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: body(notes),
      }),
    ]);
  } catch (e) {
    console.warn('Sync push failed:', e.message);
  }
}

/** Pull cloud data and merge into local. Returns merged { tasks, notes } or null. */
export async function pullAndMerge(localTasks, localNotes) {
  if (!ready) return null;
  const base = getBase();
  try {
    const [taskRes, noteRes] = await Promise.all([
      fetch(`${base}?doc=tasks`),
      fetch(`${base}?doc=notes`),
    ]);

    let cloudTasks = null;
    let cloudNotes = null;

    if (taskRes.ok) {
      try {
        const data = await taskRes.json();
        if (data.fields && data.fields.value && data.fields.value.stringValue) {
          cloudTasks = JSON.parse(data.fields.value.stringValue);
        }
      } catch {}
    }
    if (noteRes.ok) {
      try {
        const data = await noteRes.json();
        if (data.fields && data.fields.value && data.fields.value.stringValue) {
          cloudNotes = JSON.parse(data.fields.value.stringValue);
        }
      } catch {}
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
