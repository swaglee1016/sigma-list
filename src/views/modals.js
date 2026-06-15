import { QS } from '../constants.js';
import { esc, fmtTime } from '../utils/dom.js';
import { saveTasks, saveNotes } from '../data/storage.js';
import { createTask, migrateTask } from '../data/models.js';
import { scheduleReminder, cancelReminder } from '../services/notifications.js';
import { lightTap, mediumTap } from '../services/haptics.js';

let tasks = null;
let notes = null;
let editingTask = null;
let editingNoteId = null;
let onDataChange = null;

export function init(t, n, onChange) {
  tasks = t;
  notes = n;
  onDataChange = onChange;
}

// ===== Task Modal =====

export function openTaskModal(q, id) {
  editingTask = { q, id: id || null };
  const qInfo = QS.find(x => x.id === q);
  const header = document.getElementById('taskModalQuadrant');
  header.textContent = qInfo.label + ' · ' + qInfo.tag;
  header.style.background = qInfo.color;

  const titleEl = document.getElementById('taskModalTitle');
  const tipsEl = document.getElementById('taskModalTips');
  const dueEl = document.getElementById('taskModalDue');
  const reminderEl = document.getElementById('taskModalReminder');
  const reminderTimeEl = document.getElementById('taskModalReminderTime');
  const delBtn = document.getElementById('taskModalDelete');
  const metaEl = document.getElementById('taskModalMeta');

  if (id) {
    const t = tasks[q].find(i => i.id === id);
    if (!t) return;
    titleEl.value = t.text;
    tipsEl.value = t.tips || '';
    dueEl.value = t.dueDate || '';
    reminderEl.checked = t.reminderEnabled || false;
    reminderTimeEl.value = t.reminderTime || '09:00';
    reminderTimeEl.style.display = reminderEl.checked ? '' : 'none';
    delBtn.classList.add('show');
    if (metaEl) metaEl.textContent = 'Created ' + fmtTime(t.ts) + ' · Updated ' + fmtTime(t.updatedAt || t.ts);
  } else {
    if (tasks[q].length >= 133) { alert('Quadrant is full'); editingTask = null; return; }
    titleEl.value = '';
    tipsEl.value = '';
    dueEl.value = '';
    reminderEl.checked = false;
    reminderTimeEl.value = '09:00';
    reminderTimeEl.style.display = 'none';
    delBtn.classList.remove('show');
    if (metaEl) metaEl.textContent = '';
  }

  document.getElementById('taskModal').classList.add('open');
  setTimeout(() => titleEl.focus(), 50);
}

export function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  editingTask = null;
}

export function saveTaskFromModal() {
  if (!editingTask) return;
  const text = document.getElementById('taskModalTitle').value.trim();
  const tips = document.getElementById('taskModalTips').value.trim();
  const dueDate = document.getElementById('taskModalDue').value || null;
  const reminderEnabled = document.getElementById('taskModalReminder').checked;
  const reminderTime = document.getElementById('taskModalReminderTime').value || '09:00';

  if (!text && !tips) return;
  const { q, id } = editingTask;

  if (id) {
    const t = tasks[q].find(i => i.id === id);
    if (t) {
      t.text = text || 'Untitled';
      t.tips = tips;
      t.dueDate = dueDate;
      t.reminderEnabled = reminderEnabled;
      t.reminderTime = reminderTime;
      t.updatedAt = Date.now();

      // Update reminder
      cancelReminder(t.id);
      if (reminderEnabled && dueDate) {
        scheduleReminder(t);
      }
    }
  } else {
    const now = Date.now();
    const task = {
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      text: text || 'Untitled',
      tips,
      done: false,
      ts: now,
      updatedAt: now,
      dueDate,
      reminderEnabled,
      reminderTime,
    };
    tasks[q].push(task);
    if (reminderEnabled && dueDate) {
      scheduleReminder(task);
    }
  }

  saveTasks(tasks);
  if (onDataChange) onDataChange();
  closeTaskModal();
  mediumTap();
}

export function deleteTaskFromModal() {
  if (!editingTask || !editingTask.id) return;
  const { q, id } = editingTask;
  const task = tasks[q].find(i => i.id === id);
  if (task) cancelReminder(task.id);
  tasks[q] = tasks[q].filter(i => i.id !== id);
  saveTasks(tasks);
  if (onDataChange) onDataChange();
  closeTaskModal();
  mediumTap();
}

// ===== Note Modal =====

export function openNoteModal(note) {
  editingNoteId = note.id;
  document.getElementById('modalTitle').value = note.title === 'Untitled' ? '' : note.title;
  document.getElementById('modalBody').value = note.body;
  const catEl = document.getElementById('noteModalCategory');
  if (catEl) {
    catEl.textContent = (note.category || 'reflections') === 'reflections' ? 'Reflections' : 'Ideas';
    catEl.className = 'note-modal-cat ' + (note.category || 'reflections');
  }
  document.getElementById('noteModal').classList.add('open');
}

export function closeNoteModal() {
  document.getElementById('noteModal').classList.remove('open');
  editingNoteId = null;
}

export function saveNoteFromModal() {
  if (!editingNoteId) return;
  const note = notes.find(n => n.id === editingNoteId);
  if (!note) return;
  const title = document.getElementById('modalTitle').value.trim();
  note.title = title || 'Untitled';
  note.body = document.getElementById('modalBody').value;
  saveNotes(notes);
  if (onDataChange) onDataChange();
  closeNoteModal();
  lightTap();
}

export function deleteNoteFromModal() {
  if (!editingNoteId) return;
  notes = notes.filter(n => n.id !== editingNoteId);
  saveNotes(notes);
  if (onDataChange) onDataChange();
  closeNoteModal();
  mediumTap();
}

// Reminder toggle in task modal
export function toggleReminderFields() {
  const checked = document.getElementById('taskModalReminder').checked;
  document.getElementById('taskModalReminderTime').style.display = checked ? '' : 'none';
}
