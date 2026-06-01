const isNative = () => {
  try {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform());
  } catch {
    return false;
  }
};

export async function exportAllData(tasks, notes) {
  const data = JSON.stringify({
    tasks,
    notes,
    exportedAt: new Date().toISOString(),
    version: '2.0.0',
  }, null, 2);

  const fileName = 'sigma-list-backup-' + new Date().toISOString().slice(0, 10) + '.json';

  if (isNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');

      await Filesystem.writeFile({
        path: fileName,
        data,
        directory: Directory.Cache,
      });

      await Share.share({
        title: 'Sigma List Backup',
        text: 'Sigma List data backup — ' + new Date().toISOString().slice(0, 10),
        url: fileName,
        dialogTitle: 'Share Backup',
      });
    } catch {
      // Fallback to download
      triggerDownload(data, fileName);
    }
  } else {
    triggerDownload(data, fileName);
  }
}

function triggerDownload(data, fileName) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
