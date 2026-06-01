import { STORAGE_KEYS } from '../constants.js';

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
  return (await load(STORAGE_KEYS.tasks)) || { un: [], ue: [], nn: [], ne: [] };
}

export async function saveTasks(tasks) {
  await save(STORAGE_KEYS.tasks, tasks);
}

export async function loadNotes() {
  return (await load(STORAGE_KEYS.notes)) || [];
}

export async function saveNotes(notes) {
  await save(STORAGE_KEYS.notes, notes);
}
