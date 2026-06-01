import { QS } from '../constants.js';
import { esc, fmtTime } from '../utils/dom.js';
import { formatDateShort } from '../utils/date.js';
import { lightTap } from '../services/haptics.js';

let tasks = null;
let onOpenTask = null;
let onToggleDone = null;
let onDeleteTask = null;

export function init(t, callbacks) {
  tasks = t;
  onOpenTask = callbacks.onOpenTask;
  onToggleDone = callbacks.onToggleDone;
  onDeleteTask = callbacks.onDeleteTask;
}

function listRow(item) {
  const cls = item.done ? 'list-item done' : 'list-item';
  const t = item.updatedAt || item.ts;
  const tipsHtml = item.tips ? `<div class="li-tips">${esc(item.tips)}</div>` : '';
  const dueHtml = item.dueDate ? `<span class="li-due">Due ${formatDateShort(item.dueDate)}</span>` : '';
  const checkIcon = item.done ? '↺' : '✔';
  const checkTitle = item.done ? 'Reopen' : 'Mark done';
  return `<div class="${cls}" style="border-left-color:${item.qColor}">
    <span class="item-qtag" style="background:${item.qColor}">${item.qTag}</span>
    <div class="li-body" data-action="open" data-q="${item.qId}" data-id="${item.id}">
      <div class="li-text">${esc(item.text)}</div>
      ${tipsHtml}
    </div>
    ${dueHtml}
    <span class="item-time">${fmtTime(t)}</span>
    <button class="li-check" data-action="toggle" data-q="${item.qId}" data-id="${item.id}" title="${checkTitle}">${checkIcon}</button>
    <button class="li-del" data-action="delete" data-q="${item.qId}" data-id="${item.id}" title="Delete">&times;</button>
  </div>`;
}

export function renderList() {
  const c = document.getElementById('listView');
  if (!c) return;

  const active = [], done = [];
  for (const q of QS) {
    tasks[q.id].forEach(item => {
      const row = { ...item, qId: q.id, qLabel: q.label, qColor: q.color, qTag: q.tag };
      (item.done ? done : active).push(row);
    });
  }
  const quadrantOrder = { un: 0, ue: 1, nn: 2, ne: 3 };
  active.sort((a, b) => {
    const pq = quadrantOrder[a.qId] - quadrantOrder[b.qId];
    if (pq !== 0) return pq;
    return (b.updatedAt || b.ts) - (a.updatedAt || a.ts);
  });
  done.sort((a, b) => (b.updatedAt || b.ts) - (a.updatedAt || a.ts));

  if (!active.length && !done.length) {
    c.innerHTML = '<div class="list-empty">No tasks yet</div>';
    return;
  }

  let html = '';
  html += `<div class="list-section-head"><span>Active</span><span class="lsh-count">${active.length}</span></div>`;
  html += active.length ? active.map(listRow).join('') : '<div class="list-empty" style="padding:24px 0">Nothing active</div>';
  html += `<div class="list-section-head"><span>Done</span><span class="lsh-count">${done.length}</span></div>`;
  html += done.length ? done.map(listRow).join('') : '<div class="list-empty" style="padding:24px 0">Nothing done yet</div>';
  c.innerHTML = html;
}

// Delegate click handling on list container
export function handleListClick(e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const q = target.dataset.q;
  const id = +target.dataset.id;

  if (action === 'open' && onOpenTask) onOpenTask(q, id);
  if (action === 'toggle' && onToggleDone) onToggleDone(q, id);
  if (action === 'delete' && onDeleteTask) {
    e.stopPropagation();
    onDeleteTask(q, id);
  }
}
