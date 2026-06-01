const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
};

export async function requestPermission() {
  if (!isNative()) return true;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleReminder(task) {
  if (!task.dueDate || !task.reminderEnabled) return;
  if (!isNative()) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Check permission first
    const permResult = await LocalNotifications.checkPermissions();
    if (permResult.display !== 'granted') {
      const reqResult = await LocalNotifications.requestPermissions();
      if (reqResult.display !== 'granted') return;
    }

    const [y, m, d] = task.dueDate.split('-').map(Number);
    const [hh, mm] = (task.reminderTime || '09:00').split(':').map(Number);
    const at = new Date(y, m - 1, d, hh, mm);

    // Don't schedule if time has passed
    if (at.getTime() <= Date.now()) return;

    await LocalNotifications.schedule({
      notifications: [{
        id: task.id,
        title: task.text,
        body: task.tips || 'Task is due',
        schedule: { at },
        extra: { taskId: task.id },
      }],
    });
  } catch {
    // Silent fail — notifications are non-critical
  }
}

export async function cancelReminder(taskId) {
  if (!isNative()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id: taskId }] });
  } catch {
    // Silent
  }
}

export async function rescheduleAll(tasks) {
  if (!isNative()) return;
  for (const q of ['un', 'ue', 'nn', 'ne']) {
    for (const t of tasks[q]) {
      if (t.reminderEnabled && t.dueDate) {
        await scheduleReminder(t);
      }
    }
  }
}
