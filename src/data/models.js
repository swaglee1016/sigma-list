import { uid } from '../utils/dom.js';

export function createTask(text = '', tips = '') {
  const now = Date.now();
  return {
    id: uid(),
    text: text || 'Untitled',
    tips,
    done: false,
    ts: now,
    updatedAt: now,
    dueDate: null,
    reminderEnabled: false,
    reminderTime: '09:00',
  };
}

export function createNote(title = '', body = '', category = 'reflections') {
  return {
    id: uid(),
    title: title || 'Untitled',
    body: body || '',
    category,
    ts: Date.now(),
  };
}

export function migrateTask(task) {
  if (task.tips === undefined) task.tips = '';
  if (task.updatedAt === undefined) task.updatedAt = task.ts || Date.now();
  if (task.dueDate === undefined) task.dueDate = null;
  if (task.reminderEnabled === undefined) task.reminderEnabled = false;
  if (task.reminderTime === undefined) task.reminderTime = '09:00';
}
