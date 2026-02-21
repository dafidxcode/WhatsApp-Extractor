document.addEventListener('DOMContentLoaded', () => {
  const exportBtn = document.getElementById('exportBtn');
  const retryBtn = document.getElementById('retryBtn');
  const dismissBtn = document.getElementById('dismissBtn');

  exportBtn.addEventListener('click', startExport);
  retryBtn.addEventListener('click', () => {
    resetUI();
    startExport();
  });
  dismissBtn.addEventListener('click', resetUI);
});

async function startExport() {
  const exportBtn = document.getElementById('exportBtn');
  const statusArea = document.getElementById('statusArea');
  const progressArea = document.getElementById('progressArea');
  const resultArea = document.getElementById('resultArea');
  const errorArea = document.getElementById('errorArea');

  // Reset UI
  exportBtn.disabled = true;
  statusArea.classList.add('hidden');
  progressArea.classList.remove('hidden');
  resultArea.classList.add('hidden');
  errorArea.classList.add('hidden');

  try {
    // Dapatkan tab aktif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    // Inject dan jalankan script ekstraksi
    const result = await chrome.tabs.executeScript({
      target: { tabId: tab.id },
      function: extractGroupMembers
    });

    if (result && result[0]) {
      const data = result[0];
      showSuccess(data);
    } else {
      showError('Gagal mengekstrak anggota. Periksa struktur halaman.');
    }
  } catch (error) {
    showError(`Error: ${error.message}`);
  } finally {
    exportBtn.disabled = false;
    progressArea.classList.add('hidden');
  }
}

function extractGroupMembers() {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) {
          resolve(null);
          return;
        }

        const findScrollableArea = (container) => {
          const listItems = container.querySelectorAll('[role="listitem"]');
          if (listItems.length) {
            let el = listItems[0].parentElement, depth = 0;
            while (el && el !== container && depth++ < 10) {
              if (el.scrollHeight > el.clientHeight && el.clientHeight > 0 && el.offsetHeight > 50)
                return el;
              if (el.style.height && parseFloat(el.style.height) > 1000 &&
                  el.parentElement?.scrollHeight > el.parentElement.clientHeight)
                return el.parentElement;
              el = el.parentElement;
            }
          }

          let best = null, maxH = 0;
          container.querySelectorAll('div').forEach(div => {
            if (div.scrollHeight > div.clientHeight && div.offsetHeight > 50 && div.scrollHeight > maxH) {
              maxH = div.scrollHeight;
              best = div;
            }
          });
          return best;
        };

        const scrollableArea = findScrollableArea(dialog);
        if (!scrollableArea) {
          resolve(null);
          return;
        }

        const contacts = new Map();
        const scrollStep = scrollableArea.clientHeight * 0.8;
        let prevTop = -1, staleCount = 0;

        while (staleCount < 7) {
          scrollableArea.querySelectorAll('div[role="listitem"]').forEach(item => {
            let name = '', number = '', about = '';
            const cell2 = item.querySelector('div[role="gridcell"][aria-colindex="2"] span[title]');
            
            if (cell2) {
              const title = cell2.getAttribute('title').trim();
              const text = cell2.textContent.trim();
              if (title.startsWith('+') || !isNaN(title.replace(/[-+()\s]/g, ''))) {
                number = title;
                name = text;
              } else {
                name = title;
                item.querySelectorAll('span').forEach(s => {
                  if (!number && s.textContent.trim().startsWith('+'))
                    number = s.textContent.trim();
                });
              }
            }

            const aboutEl = item.querySelector('span[data-testid="selectable-text"]');
            if (aboutEl) about = aboutEl.getAttribute('title').trim();

            if (number && !contacts.has(number))
              contacts.set(number, { name, number, about });
          });

          scrollableArea.scrollBy(0, scrollStep);
          await new Promise(r => setTimeout(r, 1500));

          const top = scrollableArea.scrollTop;
          if (top === prevTop) {
            staleCount++;
          } else {
            staleCount = 0;
          }
          prevTop = top;

          if (top + scrollableArea.clientHeight >= scrollableArea.scrollHeight) {
            break;
          }
        }

        const final = Array.from(contacts.values());
        if (!final.length) {
          resolve(null);
          return;
        }

        const groupNameEl = dialog.querySelector('header span[title]:not([data-testid])');
        const groupName = (groupNameEl?.getAttribute('title') || 'grup-whatsapp')
          .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
          .trim()
          .substring(0, 50);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 16);
        const filename = `anggota_${groupName}_${timestamp}.csv`;

        const escapeCsv = s => `"${(s || '').replace(/"/g, '""')}"`;
        const csv = "Nama Kontak,Nomor Telepon,Info\n" +
          final.map(c => [escapeCsv(c.name), escapeCsv(c.number), escapeCsv(c.about)].join(",")).join("\n");

        resolve({
          success: true,
          filename,
          memberCount: final.length,
          csv,
          groupName
        });
      } catch (error) {
        resolve(null);
      }
    })();
  });
}

function showSuccess(data) {
  const progressArea = document.getElementById('progressArea');
  const resultArea = document.getElementById('resultArea');
  const resultText = document.getElementById('resultText');
  const fileNameText = document.getElementById('fileNameText');

  progressArea.classList.add('hidden');
  resultArea.classList.remove('hidden');

  resultText.textContent = `✅ Berhasil! ${data.memberCount} anggota berhasil diekstrak.`;
  fileNameText.textContent = `File: ${data.filename}`;

  // Download CSV
  downloadCSV(data.csv, data.filename);
}

function showError(message) {
  const progressArea = document.getElementById('progressArea');
  const errorArea = document.getElementById('errorArea');
  const errorText = document.getElementById('errorText');

  progressArea.classList.add('hidden');
  errorArea.classList.remove('hidden');
  errorText.textContent = message;
}

function resetUI() {
  const exportBtn = document.getElementById('exportBtn');
  const statusArea = document.getElementById('statusArea');
  const progressArea = document.getElementById('progressArea');
  const resultArea = document.getElementById('resultArea');
  const errorArea = document.getElementById('errorArea');

  exportBtn.disabled = false;
  statusArea.classList.remove('hidden');
  progressArea.classList.add('hidden');
  resultArea.classList.add('hidden');
  errorArea.classList.add('hidden');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}