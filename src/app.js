import './styles/variables.css';
import './styles/base.css';
import './styles/nav.css';
import './styles/tab-bar.css';
import './styles/matrix.css';
import './styles/list.css';
import './styles/notes.css';
import './styles/calendar.css';
import './styles/modal.css';
import './styles/mobile.css';

import { loadTasks, loadNotes, saveTasks, saveNotes } from './data/storage.js';
import { migrateTask } from './data/models.js';
import { QS, MAX } from './constants.js';
import { esc, fmtTime } from './utils/dom.js';
import { todayISO } from './utils/date.js';
import { rescheduleAll } from './services/notifications.js';
import { exportAllData } from './services/export.js';
import { initSync, pullAndMerge, onPulled, startAutoPull } from './services/sync.js';

import * as Matrix from './views/matrix.js';
import * as List from './views/list.js';
import * as Notes from './views/notes.js';
import * as Calendar from './views/calendar.js';
import * as Modals from './views/modals.js';

// ===== State =====
let tasks = { un: [], ue: [], nn: [], ne: [] };
let notes = [];
let currentView = 'matrix';
let calendarYear, calendarMonth;

// ===== Init =====
export async function init() {
  buildDOM();
  tasks = await loadTasks();
  notes = await loadNotes();
  migrateData(tasks);

  // Pull from cloud, merge with local
  await initSync();

  // When auto-pull brings fresh data, merge into local state and refresh UI
  onPulled((merged) => {
    let changed = false;
    if (merged.tasks) { tasks = merged.tasks; changed = true; }
    if (merged.notes) { notes = merged.notes; changed = true; }
    if (changed) {
      saveTasks(tasks);
      saveNotes(notes);
      Matrix.init(tasks, refreshAll);
      Notes.init(notes, () => { saveNotes(notes); });
      refreshAll();
    }
  });

  const merged = await pullAndMerge(tasks, notes);
  if (merged) {
    tasks = merged.tasks;
    notes = merged.notes;
    await saveTasks(tasks);
    await saveNotes(notes);
  }

  startAutoPull(() => tasks, () => notes);

  setupGlobalCallbacks();

  Matrix.init(tasks, refreshAll);
  List.init(tasks, {
    onOpenTask: (q, id) => Modals.openTaskModal(q, id),
    onToggleDone: (q, id) => toggleDone(q, id),
    onDeleteTask: (q, id) => deleteTask(q, id),
  });
  Notes.init(notes, () => { saveNotes(notes); });
  Calendar.init(tasks, refreshAll);
  Modals.init(tasks, notes, refreshAll);

  switchView('matrix');
  rescheduleAll(tasks);
}

function migrateData(t) {
  for (const q of ['un', 'ue', 'nn', 'ne']) {
    (t[q] || []).forEach(migrateTask);
  }
}

function setupGlobalCallbacks() {
  window._onOpenTask = (q, id) => Modals.openTaskModal(q, id);
  window._onOpenNote = (note) => Modals.openNoteModal(note);

  // Matrix drag (desktop)
  window._matrixDragStart = Matrix.handleDragStart;
  window._matrixDragEnd = Matrix.handleDragEnd;

  // Matrix touch (mobile)
  window._matrixTouchStart = Matrix.handleTouchStart;
  window._matrixTouchMove = Matrix.handleTouchMove;
  window._matrixTouchEnd = Matrix.handleTouchEnd;
}

function refreshAll() {
  Matrix.renderMatrix();
  List.renderList();
  Notes.renderNotes();
  Calendar.renderCalendar(calendarYear, calendarMonth);
  Calendar.renderDateDetail(window._selectedDate || null);
}

function toggleDone(q, id) {
  Matrix.handleToggleDone(q, id);
}

function deleteTask(q, id) {
  tasks[q] = tasks[q].filter(i => i.id !== id);
  saveTasks(tasks);
  refreshAll();
}

// ===== Build DOM =====
function buildDOM() {
  const app = document.getElementById('app');
  if (!app) return;

  const now = new Date();
  calendarYear = now.getFullYear();
  calendarMonth = now.getMonth();

  app.innerHTML = `
    <!-- Top Nav -->
    <div class="nav">
      <div class="nav-title">&Sigma; <span>List</span></div>
      <div class="nav-actions">
        <button class="nav-btn" id="exportBtn" title="Export backup">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Matrix View -->
      <div id="matrixView" class="matrix-wrap visible">
        <div class="matrix-board" id="matrixBoard">
          <div class="matrix-header">
            <div class="h-the">The</div>
            <div class="h-title">Eisenhower Matrix</div>
            <div class="h-dots"></div>
          </div>
          ${QS.map(q => `
            <div class="zone z-${q.id}" data-q="${q.id}">
              <div class="zone-label">
                <span class="q-main">${q.label}</span>
                <span class="q-count" id="cnt-${q.id}">0</span>
              </div>
              <div class="zone-body" id="body-${q.id}"
                ondragover="window._matrixDragOver(event)"
                ondrop="window._matrixDrop(event, '${q.id}')"></div>
              <form class="add-form" id="form-${q.id}">
                <input class="add-input" id="inp-${q.id}" placeholder="Task name" maxlength="200" autocomplete="off">
                <input class="add-tips" id="tips-${q.id}" placeholder="Tips..." maxlength="500" autocomplete="off">
                <button type="submit" style="display:none"></button>
              </form>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- List View -->
      <div id="listView" class="list-wrap"></div>

      <!-- Calendar View -->
      <div id="calendarView" class="calendar-wrap">
        <button class="cal-today-btn" id="calTodayBtn">Today</button>
        <div class="cal-header">
          <button class="cal-nav" id="calPrev">◀</button>
          <span class="cal-month" id="calMonthTitle"></span>
          <button class="cal-nav" id="calNext">▶</button>
        </div>
        <div class="cal-grid" id="calGrid"></div>
        <div class="cal-detail" id="calDetail">
          <div class="cal-detail-empty">Select a date to see tasks</div>
        </div>
      </div>

      <!-- Notes View -->
      <div id="notesView" class="notes-wrap">
        <div class="notes-columns">
          <div class="notes-col" id="notesColReflections">
            <div class="notes-col-header reflections">Reflections</div>
            <div class="notes-col-add">
              <input id="refTitle" placeholder="Title" maxlength="100">
              <input id="refBody" placeholder="A thought, a feeling..." maxlength="5000">
              <button id="refSaveBtn">Save</button>
            </div>
            <div class="notes-grid" id="notesGridReflections"></div>
            <div class="notes-empty" id="notesEmptyReflections">No reflections yet<br>Capture a moment of insight</div>
          </div>
          <div class="notes-col" id="notesColIdeas">
            <div class="notes-col-header ideas">Ideas</div>
            <div class="notes-col-add">
              <input id="ideaTitle" placeholder="Title" maxlength="100">
              <input id="ideaBody" placeholder="A spark, a design..." maxlength="5000">
              <button id="ideaSaveBtn">Save</button>
            </div>
            <div class="notes-grid" id="notesGridIdeas"></div>
            <div class="notes-empty" id="notesEmptyIdeas">No ideas yet<br>Jot down a spark before it fades</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Tab Bar -->
    <div class="tab-bar">
      <button class="tab-btn active" data-view="matrix">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        Matrix
      </button>
      <button class="tab-btn" data-view="list">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        List
      </button>
      <button class="tab-btn" data-view="calendar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Calendar
      </button>
      <button class="tab-btn" data-view="notes">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        Notes
      </button>
    </div>

    <!-- Task Modal -->
    <div class="modal-overlay" id="taskModal">
      <div class="modal task-modal">
        <div class="tm-header" id="taskModalQuadrant"></div>
        <div class="tm-body">
          <label class="tm-label">Task</label>
          <input id="taskModalTitle" placeholder="What needs to be done?" maxlength="200">
          <label class="tm-label">Tips &amp; notes</label>
          <textarea id="taskModalTips" placeholder="Things to watch out for, reminders, context..." maxlength="2000"></textarea>
          <label class="tm-label">Due date</label>
          <div class="tm-date-row">
            <input type="date" id="taskModalDue">
          </div>
          <label class="tm-label">Reminder</label>
          <div class="tm-reminder">
            <label><input type="checkbox" id="taskModalReminder"> Enable reminder</label>
            <input type="time" id="taskModalReminderTime" value="09:00" style="display:none">
          </div>
        </div>
        <div class="tm-meta" id="taskModalMeta"></div>
        <div class="modal-actions tm-actions">
          <button class="danger" id="taskModalDelete">Delete</button>
          <button id="taskModalCancel">Cancel</button>
          <button class="primary" id="taskModalSave">Save</button>
        </div>
      </div>
    </div>

    <!-- Note Modal -->
    <div class="modal-overlay" id="noteModal">
      <div class="modal">
        <div class="note-modal-cat" id="noteModalCategory"></div>
        <input id="modalTitle" placeholder="Title (optional)" maxlength="100">
        <textarea id="modalBody" placeholder="Write something..."></textarea>
        <div class="modal-actions">
          <button class="danger" id="noteModalDelete">Delete</button>
          <button id="noteModalCancel">Cancel</button>
          <button class="primary" id="noteModalSave">Save</button>
        </div>
      </div>
    </div>
  `;

  // Wire events
  wireEvents();
}

function wireEvents() {
  // Tab bar
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // Matrix add forms
  QS.forEach(q => {
    const form = document.getElementById('form-' + q.id);
    if (form) {
      form.addEventListener('submit', e => {
        e.preventDefault();
        const inp = document.getElementById('inp-' + q.id);
        const tipsEl = document.getElementById('tips-' + q.id);
        const ok = Matrix.handleAddItem(q.id, inp.value.trim(), tipsEl ? tipsEl.value.trim() : '');
        if (ok) {
          inp.value = '';
          if (tipsEl) tipsEl.value = '';
          List.renderList();
          Calendar.renderCalendar(calendarYear, calendarMonth);
          inp.focus();
        }
      });
    }
  });

  // Matrix drag helpers
  window._matrixDragOver = Matrix.handleDragOver;
  window._matrixDrop = Matrix.handleDrop;

  // Matrix body click delegation (open/toggle)
  document.getElementById('matrixBoard').addEventListener('click', e => {
    const checkBtn = e.target.closest('[data-action="toggle"]');
    if (checkBtn) {
      e.stopPropagation();
      toggleDone(checkBtn.dataset.q, +checkBtn.dataset.id);
      return;
    }
    const textEl = e.target.closest('[data-action="open"]');
    if (textEl) {
      Modals.openTaskModal(textEl.dataset.q, +textEl.dataset.id);
      return;
    }
  });

  // List click delegation
  const listView = document.getElementById('listView');
  listView.addEventListener('click', e => {
    List.handleListClick(e);
  });

  // Notes click delegation
  document.getElementById('notesView').addEventListener('click', e => {
    Notes.handleNotesClick(e);
  });
  document.getElementById('refSaveBtn').addEventListener('click', () => {
    const titleEl = document.getElementById('refTitle');
    const bodyEl = document.getElementById('refBody');
    const ok = Notes.addNote(titleEl.value.trim(), bodyEl.value.trim(), 'reflections');
    if (ok) { titleEl.value = ''; bodyEl.value = ''; }
  });
  document.getElementById('ideaSaveBtn').addEventListener('click', () => {
    const titleEl = document.getElementById('ideaTitle');
    const bodyEl = document.getElementById('ideaBody');
    const ok = Notes.addNote(titleEl.value.trim(), bodyEl.value.trim(), 'ideas');
    if (ok) { titleEl.value = ''; bodyEl.value = ''; }
  });

  // Calendar click delegation
  document.getElementById('calendarView').addEventListener('click', e => {
    Calendar.handleCalendarClick(e);
  });
  document.getElementById('calPrev').addEventListener('click', () => {
    calendarMonth--;
    if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
    Calendar.renderCalendar(calendarYear, calendarMonth);
    Calendar.renderDateDetail(null);
  });
  document.getElementById('calNext').addEventListener('click', () => {
    calendarMonth++;
    if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
    Calendar.renderCalendar(calendarYear, calendarMonth);
    Calendar.renderDateDetail(null);
  });
  document.getElementById('calTodayBtn').addEventListener('click', () => {
    const today = new Date();
    calendarYear = today.getFullYear();
    calendarMonth = today.getMonth();
    Calendar.renderCalendar(calendarYear, calendarMonth);
    Calendar.renderDateDetail(todayISO());
    window._selectedDate = todayISO();
    document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
    const todayEl = document.querySelector(`.cal-day[data-date="${todayISO()}"]`);
    if (todayEl) todayEl.classList.add('selected');
  });

  // Task modal
  document.getElementById('taskModalSave').addEventListener('click', () => {
    Modals.saveTaskFromModal();
  });
  document.getElementById('taskModalCancel').addEventListener('click', Modals.closeTaskModal);
  document.getElementById('taskModalDelete').addEventListener('click', () => {
    Modals.deleteTaskFromModal();
  });
  document.getElementById('taskModalReminder').addEventListener('change', Modals.toggleReminderFields);
  document.getElementById('taskModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) Modals.closeTaskModal();
  });

  // Note modal
  document.getElementById('noteModalSave').addEventListener('click', () => {
    Modals.saveNoteFromModal();
  });
  document.getElementById('noteModalCancel').addEventListener('click', Modals.closeNoteModal);
  document.getElementById('noteModalDelete').addEventListener('click', () => {
    Modals.deleteNoteFromModal();
  });
  document.getElementById('noteModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) Modals.closeNoteModal();
  });

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportAllData(tasks, notes);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('taskModal').classList.contains('open')) Modals.closeTaskModal();
      else if (document.getElementById('noteModal').classList.contains('open')) Modals.closeNoteModal();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      if (document.getElementById('taskModal').classList.contains('open')) {
        e.preventDefault();
        Modals.saveTaskFromModal();
      } else if (document.getElementById('noteModal').classList.contains('open')) {
        e.preventDefault();
        Modals.saveNoteFromModal();
      }
    }
  });
}

// ===== View Switching =====
export function switchView(view) {
  currentView = view;

  document.getElementById('matrixView').classList.toggle('visible', view === 'matrix');
  document.getElementById('listView').classList.toggle('visible', view === 'list');
  document.getElementById('calendarView').classList.toggle('visible', view === 'calendar');
  document.getElementById('notesView').classList.toggle('visible', view === 'notes');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });

  if (view === 'matrix') Matrix.renderMatrix();
  if (view === 'list') List.renderList();
  if (view === 'calendar') {
    Calendar.renderCalendar(calendarYear, calendarMonth);
    Calendar.renderDateDetail(window._selectedDate || null);
  }
  if (view === 'notes') Notes.renderNotes();
}
