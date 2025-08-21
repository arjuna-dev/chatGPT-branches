/**
 * ChatGPT Branching Extension - Content Script
 * Main entry point for the extension functionality
 */

console.log("ChatGPT Branching Extension loaded");

// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  initializeExtension();
}

function initializeExtension() {
  console.log("Initializing ChatGPT Branching Extension...");

  // Check if we're on a ChatGPT conversation page
  if (!isValidChatGPTPage()) {
    console.log(
      "Not a valid ChatGPT conversation page, extension not activated"
    );
    return;
  }

  // TODO: Initialize extension components
  // - DOM Observer
  // - Branch Detector
  // - UI Manager
  // - Storage Manager
  // - Navigation Controller

  console.log("ChatGPT Branching Extension initialized successfully");
}

function isValidChatGPTPage() {
  // Check if we're on a conversation page (has URL pattern /c/[conversation-id])
  const url = window.location.href;
  return (
    url.includes("/c/") ||
    url.includes("chatgpt.com") ||
    url.includes("chat.openai.com")
  );
}
