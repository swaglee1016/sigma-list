/**
 * Cloud sync → TiDB Cloud via /api/sync proxy.
 *
 * Web:     /api/sync  (Vite proxy in dev, Vercel function in prod)
 * Android: https://YOUR_VERCEL.vercel.app/api/sync
 */

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
  console.log('[Sync] TiDB Cloud ready');
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

/** Push local tasks + notes → TiDB Cloud */
export async function pushAll(tasks, notes) {
  if (!ready) return;
  const base = getBase();
  try {
    await Promise.all([
      fetch(`${base}?doc=tasks`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.stringify(tasks), updatedAt: Date.now() }),
      }),
      fetch(`${base}?doc=notes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.stringify(notes), updatedAt: Date.now() }),
      }),
    ]);
  } catch (e) {
    console.warn('Sync push failed:', e.message);
  }
}

/** Pull cloud data → merge into local. Returns { tasks, notes } or null. */
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
        const json = await taskRes.json();
        cloudTasks = parseData(json.data);
      } catch {}
    }
    if (noteRes.ok) {
      try {
        const json = await noteRes.json();
        cloudNotes = parseData(json.data);
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

function parseData(raw) {
  if (raw === null || raw === undefined) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
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
