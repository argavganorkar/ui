chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

  try {
    // Try to toggle panel
    await chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
  } catch (err) {
    // If injection check fails, try re-injecting
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      // Content script now has its own listener ready; send message again
      chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" });
    } catch (e) {
      console.error("Insight Extractor: Script injection failed", e);
    }
  }
});

// Listener for opening full-page app
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'OPEN_APP') {
    chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
  }
});
