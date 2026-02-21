// Content Script untuk WhatsApp-Extractor
// Script ini berjalan di context halaman WhatsApp Web

console.log('WhatsApp Group Member Exporter content script loaded');

// Listen untuk pesan dari popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'extractMembers') {
    sendResponse({ status: 'extraction started' });
  }
});