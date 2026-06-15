import { STORAGE_KEYS } from '../constants.js';
import { pushAll } from '../services/sync.js';

const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
};

export async function load(key) {
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value ? JSON.parse(value) : null;
    } catch {
      // fall through to localStorage
    }
  }
  try {
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch {
    return null;
  }
}

export async function save(key, data) {
  const json = JSON.stringify(data);
  if (isNative()) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value: json });
    } catch {
      // fall through to localStorage
    }
  }
  localStorage.setItem(key, json);
}

export async function loadTasks() {
  const t = (await load(STORAGE_KEYS.tasks)) || { un: [], ue: [], nn: [], ne: [] };
  if (_tasksCache === null) _tasksCache = t;
  return t;
}

let _tasksCache = null;
let _notesCache = null;

async function syncIfReady() {
  if (_tasksCache !== null && _notesCache !== null) {
    await pushAll(_tasksCache, _notesCache);
  }
}

export async function saveTasks(tasks) {
  _tasksCache = tasks;
  await save(STORAGE_KEYS.tasks, tasks);
  await syncIfReady();
}

export async function loadNotes() {
  const n = (await load(STORAGE_KEYS.notes)) || [];
  if (_notesCache === null) _notesCache = n;
  return n;
}

export async function saveNotes(notes) {
  _notesCache = notes;
  await save(STORAGE_KEYS.notes, notes);
  await syncIfReady();
}
