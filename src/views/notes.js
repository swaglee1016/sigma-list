import { esc, fmtTime } from '../utils/dom.js';
import { lightTap } from '../services/haptics.js';

let notes = [];
let onDataChange = null;

export function init(n, onChange) {
  notes = n;
  onDataChange = onChange;
}

export function addNote(title, body, category) {
  if (!title && !body) return false;
  notes.unshift({
    id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
    title: title || 'Untitled',
    body: body || '',
    ts: Date.now(),
    category: category || 'reflections',
  });
  save();
  renderNotes();
  lightTap();
  return true;
}

function save() {
  if (onDataChange) onDataChange();
}

function catNotes(cat) {
  return notes.filter(n => (n.category || 'reflections') === cat);
}

function renderCol(cat, gridId, emptyId) {
  const grid = document.getElementById(gridId);
  const empty = document.getElementById(emptyId);
  if (!grid) return;

  const items = catNotes(cat);

  if (items.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';
  grid.innerHTML = items.map(n => `
    <div class="note-card" data-action="open-note" data-id="${n.id}">
      <button class="note-del" data-action="delete-note" data-id="${n.id}">&times;</button>
      <div class="note-title">${esc(n.title)}</div>
      <div class="note-body-preview">${esc(n.body)}</div>
      <div class="note-meta"><span>${fmtTime(n.ts)}</span></div>
    </div>
  `).join('');
}

export function renderNotes() {
  renderCol('reflections', 'notesGridReflections', 'notesEmptyReflections');
  renderCol('ideas', 'notesGridIdeas', 'notesEmptyIdeas');
}

export function handleNotesClick(e) {
  const card = e.target.closest('.note-card');
  const delBtn = e.target.closest('[data-action="delete-note"]');
  if (delBtn) {
    e.stopPropagation();
    const id = +delBtn.dataset.id;
    notes = notes.filter(n => n.id !== id);
    save();
    renderNotes();
    return;
  }
  if (card) {
    const id = +card.dataset.id;
    const note = notes.find(n => n.id === id);
    if (note && window._onOpenNote) window._onOpenNote(note);
  }
}
