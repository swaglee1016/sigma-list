/**
 * Cloud sync — Tencent CloudBase via @cloudbase/js-sdk.
 *
 * Browser-direct document database. No backend proxy needed.
 * Anonymous auth — no login required.
 */

import cloudbase from '@cloudbase/js-sdk';

const ENV_ID = 'sigma-list-d7gxfeaenc4b950f6';

let db = null;
let ready = false;
let onSync = null;
let pollTimer = null;
let visibilityHandler = null;

/** One-time init: anonymous sign-in → get database handle */
export async function initSync() {
  try {
    const app = cloudbase.init({ env: ENV_ID });
    const auth = app.auth();
    await auth.anonymousAuthProvider().signIn();
    db = app.database();
    ready = true;
    console.log('[Sync] CloudBase ready');
  } catch (e) {
    console.warn('[Sync] CloudBase init failed:', e.message);
  }
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

/** Push local tasks + notes → CloudBase */
export async function pushAll(tasks, notes) {
  if (!ready || !db) return;
  const coll = db.collection('sync_data');
  const now = Date.now();
  try {
    await Promise.all([
      upsertDoc(coll, 'tasks', JSON.stringify(tasks), now),
      upsertDoc(coll, 'notes', JSON.stringify(notes), now),
    ]);
  } catch (e) {
    console.warn('Sync push failed:', e.message);
  }
}

async function upsertDoc(coll, docType, data, updatedAt) {
  const res = await coll.where({ doc_type: docType }).get();
  if (res.data && res.data.length > 0) {
    const existing = res.data[0];
    await coll.doc(existing._id).update({ data, updated_at: updatedAt });
  } else {
    await coll.add({ doc_type: docType, data, updated_at: updatedAt });
  }
}

/** Pull cloud data → merge into local. Returns { tasks, notes } or null. */
export async function pullAndMerge(localTasks, localNotes) {
  if (!ready || !db) return null;
  const coll = db.collection('sync_data');
  try {
    const [taskRes, noteRes] = await Promise.all([
      coll.where({ doc_type: 'tasks' }).get(),
      coll.where({ doc_type: 'notes' }).get(),
    ]);

    let cloudTasks = null;
    let cloudNotes = null;

    if (taskRes.data && taskRes.data.length > 0) {
      try { cloudTasks = parseData(taskRes.data[0].data); } catch {}
    }
    if (noteRes.data && noteRes.data.length > 0) {
      try { cloudNotes = parseData(noteRes.data[0].data); } catch {}
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
