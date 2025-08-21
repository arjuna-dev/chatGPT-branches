/**
 * ChatGPT Branching Extension - Background Script
 * Minimal service worker for extension lifecycle management
 */

// Extension installation/update handler
chrome.runtime.onInstalled.addListener((details) => {
  console.log("ChatGPT Branching Extension installed/updated:", details.reason);

  if (details.reason === "install") {
    console.log("Extension installed for the first time");
  } else if (details.reason === "update") {
    console.log(
      "Extension updated to version:",
      chrome.runtime.getManifest().version
    );
  }
});

// Handle extension icon click (optional - for future features)
chrome.action.onClicked.addListener((tab) => {
  console.log("Extension icon clicked on tab:", tab.url);

  // Could be used to open settings or help page in the future
  // For now, the extension works automatically on ChatGPT pages
});
