// Background Service Worker untuk Chrome Extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('WhatsApp Group Member Exporter installed');
});

// Handle pesan dari content script atau popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadCSV') {
    chrome.downloads.download({
      url: request.url,
      filename: request.filename
    });
  }
});
