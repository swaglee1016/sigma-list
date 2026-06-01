import { QS, MAX } from '../constants.js';
import { esc } from '../utils/dom.js';
import { saveTasks } from '../data/storage.js';
import { createTask } from '../data/models.js';
import { lightTap } from '../services/haptics.js';

let tasks = null;
let onDataChange = null;

export function init(t, onChange) {
  tasks = t;
  onDataChange = onChange;
}

function itemRow(qId, item) {
  const tipMark = item.tips ? '<span class="item-tip-mark" title="Has tips">●</span>' : '';
  return `<div class="item" draggable="true"
    data-id="${item.id}" data-q="${qId}"
    ontouchstart="window._matrixTouchStart(event)"
    ontouchmove="window._matrixTouchMove(event)"
    ontouchend="window._matrixTouchEnd(event)"
    ondragstart="window._matrixDragStart(event)"
    ondragend="window._matrixDragEnd(event)">
    <div class="item-bullet"></div>
    <span class="item-text" data-action="open" data-q="${qId}" data-id="${item.id}">${esc(item.text)}${tipMark ? ' ' + tipMark : ''}</span>
    <button class="item-check" data-action="toggle" data-q="${qId}" data-id="${item.id}" title="Mark done">✔</button>
  </div>`;
}

export function renderMatrix() {
  for (const q of QS) {
    const body = document.getElementById('body-' + q.id);
    const cnt = document.getElementById('cnt-' + q.id);
    const inp = document.getElementById('inp-' + q.id);
    const tipsInp = document.getElementById('tips-' + q.id);
    const active = tasks[q.id].filter(i => !i.done);

    if (cnt) cnt.textContent = active.length;

    if (inp) {
      const full = tasks[q.id].length >= MAX;
      inp.disabled = full;
      inp.placeholder = full ? 'Full' : 'Task name';
      if (tipsInp) {
        tipsInp.disabled = full;
        tipsInp.placeholder = full ? 'Full' : 'Tips...';
      }
    }

    if (!body) continue;

    if (active.length === 0) {
      const qInfo = QS.find(x => x.id === q.id);
      body.innerHTML = '<div class="empty-msg">' + qInfo.hint + '</div>';
      continue;
    }

    let html = '';
    active.forEach(item => { html += itemRow(q.id, item); });
    body.innerHTML = html;
  }
}

export function handleAddItem(q, text, tips) {
  if (!text && !tips) return false;
  if (tasks[q].length >= MAX) return false;
  const now = Date.now();
  tasks[q].push({ ...createTask(text, tips), ts: now, updatedAt: now });
  saveTasks(tasks);
  renderMatrix();
  if (onDataChange) onDataChange();
  return true;
}

export function handleToggleDone(q, id) {
  const item = tasks[q].find(i => i.id === id);
  if (item) {
    item.done = !item.done;
    item.updatedAt = Date.now();
    saveTasks(tasks);
    renderMatrix();
    if (onDataChange) onDataChange();
    lightTap();
  }
}

// Drag & Drop (desktop)
let dragItem = null;

export function handleDragStart(e) {
  dragItem = { id: +e.target.dataset.id, q: e.target.dataset.q };
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

export function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  dragItem = null;
}

export function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

export function handleDrop(e, targetQ) {
  e.preventDefault();
  if (!dragItem) return;
  const { id, srcQ } = dragItem;
  if (srcQ !== targetQ) return;

  const items = tasks[targetQ];
  const srcIdx = items.findIndex(i => i.id === id);
  if (srcIdx === -1) return;

  const body = document.getElementById('body-' + targetQ);
  const children = [...body.querySelectorAll('.item[draggable]')];
  const target = children.find(c => c === e.target.closest('.item'));
  if (!target || target.dataset.id === String(id)) return;

  const dstIdx = items.findIndex(i => i.id === +target.dataset.id);
  if (dstIdx === -1) return;

  const [moved] = items.splice(srcIdx, 1);
  items.splice(dstIdx, 0, moved);
  saveTasks(tasks);
  renderMatrix();
  if (onDataChange) onDataChange();
}

// Touch reorder (mobile)
let touchData = null;

export function handleTouchStart(e) {
  const item = e.target.closest('.item');
  if (!item) return;
  touchData = {
    item,
    q: item.dataset.q,
    id: +item.dataset.id,
    startY: e.touches[0].clientY,
    startX: e.touches[0].clientX,
    timer: setTimeout(() => {
      if (touchData) {
        touchData.reordering = true;
        item.classList.add('reordering');
      }
    }, 400),
  };
}

export function handleTouchMove(e) {
  if (!touchData) return;
  // Cancel long-press if moved too far
  if (!touchData.reordering) {
    const dy = Math.abs(e.touches[0].clientY - touchData.startY);
    const dx = Math.abs(e.touches[0].clientX - touchData.startX);
    if (dy > 10 || dx > 10) {
      clearTimeout(touchData.timer);
      touchData = null;
    }
    return;
  }
  e.preventDefault();
  // Highlight nearest sibling
  const body = document.getElementById('body-' + touchData.q);
  const items = [...body.querySelectorAll('.item:not(.reordering)')];
  const touchY = e.touches[0].clientY;
  items.forEach(el => el.classList.remove('drag-over'));
  const nearest = items.reduce((best, el) => {
    const rect = el.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const dist = Math.abs(touchY - mid);
    return dist < best.dist ? { el, dist } : best;
  }, { el: null, dist: Infinity });
  if (nearest.el) nearest.el.classList.add('drag-over');
}

export function handleTouchEnd(e) {
  if (!touchData) return;
  clearTimeout(touchData.timer);
  if (touchData.reordering) {
    const itemEl = touchData.item;
    itemEl.classList.remove('reordering');
    // Find the target
    const body = document.getElementById('body-' + touchData.q);
    const over = body.querySelector('.drag-over');
    if (over) {
      over.classList.remove('drag-over');
      const items = tasks[touchData.q];
      const srcIdx = items.findIndex(i => i.id === touchData.id);
      const dstId = +over.dataset.id;
      const dstIdx = items.findIndex(i => i.id === dstId);
      if (srcIdx !== -1 && dstIdx !== -1 && srcIdx !== dstIdx) {
        const [moved] = items.splice(srcIdx, 1);
        items.splice(dstIdx, 0, moved);
        saveTasks(tasks);
        renderMatrix();
        if (onDataChange) onDataChange();
      }
    }
  }
  touchData = null;
}
