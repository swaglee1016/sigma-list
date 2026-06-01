import { QS } from '../constants.js';
import { esc, fmtTime } from '../utils/dom.js';

let tasks = null;
let onDataChange = null;

export function init(t, onChange) {
  tasks = t;
  onDataChange = onChange;
}

export function renderCalendar(year, month) {
  const grid = document.getElementById('calGrid');
  const title = document.getElementById('calMonthTitle');
  if (!grid || !title) return;

  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  title.textContent = months[month] + ' ' + year;

  // Build date → quadrant colors map
  const dateColors = {};
  for (const q of QS) {
    tasks[q.id].forEach(t => {
      if (t.dueDate) {
        if (!dateColors[t.dueDate]) dateColors[t.dueDate] = [];
        dateColors[t.dueDate].push(q.color);
      }
    });
  }

  const today = new Date();
  const todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  let html = '';

  // Day of week headers (Mon-Sun)
  const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  dows.forEach(d => { html += `<div class="cal-dow">${d}</div>`; });

  // Leading days from previous month
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Convert to Mon-start
  for (let i = startOffset - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const dStr = (month === 0 ? year - 1 : year) + '-' +
      String(month === 0 ? 12 : month).padStart(2, '0') + '-' +
      String(day).padStart(2, '0');
    html += calDayCell(day, 'other-month', dStr, dateColors, todayStr);
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const dStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const isToday = dStr === todayStr;
    const cls = isToday ? 'today' : '';
    html += calDayCell(day, cls, dStr, dateColors, todayStr);
  }

  // Trailing days to fill grid
  const totalCells = startOffset + totalDays;
  const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  for (let day = 1; day <= remaining; day++) {
    const dStr = (month === 11 ? year + 1 : year) + '-' +
      String(month === 11 ? 1 : month + 2).padStart(2, '0') + '-' +
      String(day).padStart(2, '0');
    html += calDayCell(day, 'other-month', dStr, dateColors, todayStr);
  }

  grid.innerHTML = html;
}

function calDayCell(day, cls, dateStr, dateColors, todayStr) {
  const dots = dateColors[dateStr]
    ? dateColors[dateStr].map(c => `<span class="cal-dot" style="background:${c}"></span>`).join('')
    : '';
  const sel = dateStr === window._selectedDate ? ' selected' : '';
  return `<div class="cal-day ${cls}${sel}" data-date="${dateStr}">
    <span class="cal-day-num">${day}</span>
    <div class="cal-dots">${dots}</div>
  </div>`;
}

export function renderDateDetail(dateStr) {
  const detail = document.getElementById('calDetail');
  if (!detail) return;

  if (!dateStr) {
    detail.innerHTML = '<div class="cal-detail-empty">Select a date to see tasks</div>';
    return;
  }

  window._selectedDate = dateStr;

  const dueTasks = [];
  for (const q of QS) {
    tasks[q.id].forEach(t => {
      if (t.dueDate === dateStr) {
        dueTasks.push({ ...t, qId: q.id, qColor: q.color, qTag: q.tag });
      }
    });
  }

  const d = new Date(dateStr + 'T00:00:00');
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const title = months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();

  let html = `<h3>${title}</h3>`;
  if (dueTasks.length === 0) {
    html += '<div class="cal-detail-empty">No tasks due this day</div>';
  } else {
    dueTasks.forEach(t => {
      const doneCls = t.done ? ' done' : '';
      html += `<div class="cal-task${doneCls}" data-action="open" data-q="${t.qId}" data-id="${t.id}" style="border-left-color:${t.qColor}">
        <span class="cal-task-qtag" style="background:${t.qColor}">${t.qTag}</span>
        <span class="cal-task-text">${esc(t.text)}</span>
      </div>`;
    });
  }
  detail.innerHTML = html;
}

export function handleCalendarClick(e) {
  const dayEl = e.target.closest('.cal-day');
  if (dayEl) {
    const dateStr = dayEl.dataset.date;
    // Update selected styling
    document.querySelectorAll('.cal-day.selected').forEach(el => el.classList.remove('selected'));
    dayEl.classList.add('selected');
    window._selectedDate = dateStr;
    renderDateDetail(dateStr);
    return;
  }
  const taskEl = e.target.closest('.cal-task');
  if (taskEl && window._onOpenTask) {
    window._onOpenTask(taskEl.dataset.q, +taskEl.dataset.id);
  }
}
