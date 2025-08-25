/**
 * ChatGPT Branching Extension - Content Script
 * Main entry point for the extension functionality
 */

// All modules are loaded via manifest.json in order:
// 1. dom-utils.js (provides utility functions)
// 2. storage-manager.js (provides StorageManager class)
// 3. tree-builder.js (provides TreeBuilder class)
// 4. branch-detector.js (provides BranchDetector class)
// 5. content.js (this file - main coordinator)

// Import remaining classes (these will be extracted in subsequent steps)
// For now, we'll keep them in this file temporarily
// TODO: Extract these to separate modules
// - DOMObserver -> src/core/dom-observer.js
// - TabRenderer -> src/core/tab-renderer.js
// - NavigationController -> src/core/navigation-controller.js
// - UIManager -> src/core/ui-manager.js
// - PerformanceMonitor -> src/utils/performance-monitor.js

// Global extension state
let extensionState = {
  domObserver: null,
  branchDetector: null,
  treeBuilder: null,
  storageManager: null,
  performanceMonitor: null,
  uiManager: null,
  tabRenderer: null,
  navigationController: null,
  conversationId: null,
  isInitialized: false,
};

// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", safeInitializeExtension);
} else {
  safeInitializeExtension();
}

/**
 * Safe initialization wrapper that handles React conflicts
 */
async function safeInitializeExtension() {
  try {
    // Wait for React to finish initial render
    await waitForReactStability();

    // Initialize with error boundaries
    await initializeExtension();
  } catch (error) {
    console.error("Failed to initialize extension safely:", error);

    // Retry after a longer delay if initialization fails
    setTimeout(safeInitializeExtension, 3000);
  }
}

/**
 * Wait for React to stabilize before initializing extension
 */
async function waitForReactStability() {
  // Wait for main element to exist
  await waitForElement("main", 10000);

  // Wait for conversation content to be present
  await waitForElement(
    '[data-testid="conversation-turn"], article, .group\\/conversation-turn',
    8000
  );

  // Wait for React to finish rendering by checking for stability
  let stableCount = 0;
  const requiredStableChecks = 3;

  while (stableCount < requiredStableChecks) {
    const beforeCount = document.querySelectorAll("*").length;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const afterCount = document.querySelectorAll("*").length;

    if (Math.abs(afterCount - beforeCount) < 5) {
      stableCount++;
    } else {
      stableCount = 0; // Reset if DOM is still changing significantly
    }
  }

  // Additional safety delay
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function initializeExtension() {
  try {
    // Wrap all DOM operations in try-catch to prevent React conflicts
    const initResult = await safelyInitializeComponents();

    if (!initResult.success) {
      throw new Error(`Initialization failed: ${initResult.error}`);
    }
  } catch (error) {
    console.error("Error initializing ChatGPT Branching Extension:", error);

    // Schedule retry with exponential backoff
    const retryDelay = Math.min(
      5000,
      1000 * Math.pow(2, window.extensionRetryCount || 0)
    );
    window.extensionRetryCount = (window.extensionRetryCount || 0) + 1;

    if (window.extensionRetryCount < 5) {
      setTimeout(safeInitializeExtension, retryDelay);
    } else {
      console.error(
        "Max retry attempts reached, extension initialization failed"
      );
    }
  }
}

/**
 * Safely initialize all extension components with error boundaries
 */
async function safelyInitializeComponents() {
  try {
    // Check if we're on a valid ChatGPT conversation page
    if (!isValidChatGPTPage()) {
      return { success: false, error: "Invalid page" };
    }

    // Extract conversation ID
    extensionState.conversationId = extractConversationId();
    if (!extensionState.conversationId) {
      console.error(
        "Could not extract conversation ID, extension not activated"
      );
      return { success: false, error: "No conversation ID" };
    }

    // Initialize core components
    extensionState.storageManager = new StorageManager();
    extensionState.treeBuilder = new TreeBuilder();
    extensionState.branchDetector = new BranchDetector();

    // Initialize UI components (temporary inline until extracted)
    extensionState.uiManager = new SimpleUIManager();
    extensionState.tabRenderer = new SimpleTabRenderer();
    extensionState.navigationController = new SimpleNavigationController();

    // Set up component relationships and callbacks
    setupComponentCallbacks();

    // Load saved data
    await safelyLoadSavedData();

    // Initialize UI components
    await extensionState.uiManager.initialize();

    // Perform initial scan
    await performInitialScan();

    // Set up DOM observer to watch for changes
    setupDOMObserver();

    extensionState.isInitialized = true;

    return { success: true };
  } catch (error) {
    console.error("Error in safelyInitializeComponents:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Set up callbacks between components
 */
function setupComponentCallbacks() {
  // Tree builder callbacks
  extensionState.treeBuilder.onTreeUpdated(async (treeState) => {
    // Save tree data when updated
    if (extensionState.storageManager && extensionState.conversationId) {
      await extensionState.storageManager.saveConversationTree(
        extensionState.conversationId,
        treeState
      );
    }

    // Render tabs when tree is updated
    if (extensionState.tabRenderer) {
      await renderTabsFromTree();
    }
  });

  // Branch detector callbacks
  extensionState.branchDetector.onBranchDetected((branchInfo) => {
    // Update tree with detected branch
    if (extensionState.treeBuilder) {
      extensionState.treeBuilder.buildFromNodes([branchInfo]);
    }
  });
}

/**
 * Safely load saved data with error handling
 */
async function safelyLoadSavedData() {
  if (!extensionState.storageManager || !extensionState.conversationId) {
    return;
  }

  try {
    const savedTreeData =
      await extensionState.storageManager.loadConversationTree(
        extensionState.conversationId
      );

    // Only pass valid treeData to importData
    if (
      savedTreeData &&
      typeof savedTreeData === "object" &&
      extensionState.treeBuilder
    ) {
      extensionState.treeBuilder.importData(savedTreeData);

      // Render tabs after loading tree data
      if (extensionState.tabRenderer) {
        try {
          await renderTabsFromTree();
        } catch (error) {
          console.error("Error rendering tabs from loaded data:", error);
        }
      }
    } else {
    }
  } catch (error) {
    console.error("Failed to load saved tree data:", error);
  }
}

/**
 * Perform initial scan for branches
 */
async function performInitialScan() {
  try {
    const turns = findConversationTurns();
    if (turns.length === 0) {
      // Debug: try to understand the page structure
      debugPageStructure();
      return;
    }

    const detectedBranches =
      extensionState.branchDetector.detectBranches(turns);

    if (detectedBranches.length > 0) {
      extensionState.treeBuilder.buildFromNodes(detectedBranches);
    } else {
      // Create a fallback display showing all turns
      const fallbackBranches = turns.map((turn, index) => {
        const preview = turn.textContent?.substring(0, 80) + "..." || "Message";
        const variants = [
          {
            id: `turn-${index}_v1`,
            variantIndex: 1,
            totalVariants: 1,
            preview: preview,
            isActive: true,
            timestamp: Date.now(),
          },
        ];

        return {
          id: `turn-${index}`,
          turnIndex: index,
          currentVariant: 1,
          totalVariants: 1,
          role: turn.querySelector(".tabular-nums") ? "assistant" : "user",
          element: turn,
          timestamp: Date.now(),
          variants: variants,
        };
      });

      if (fallbackBranches.length > 0) {
        extensionState.treeBuilder.buildFromNodes(fallbackBranches);
      }
    }

    // Save to comprehensive storage after building tree
    if (extensionState.conversationId && extensionState.treeBuilder) {
      await extensionState.treeBuilder.saveToComprehensiveStorage(
        extensionState.conversationId
      );
    }
  } catch (error) {
    console.error("❌ Error in initial scan:", error);
  }
}

// Export for debugging
window.extensionState = extensionState;

// Add manual rescan function
window.rescanBranches = async () => {
  if (extensionState.branchDetector && extensionState.treeBuilder) {
    const turns = findConversationTurns();
    const detectedBranches =
      extensionState.branchDetector.detectBranches(turns);
    if (detectedBranches.length > 0) {
      extensionState.treeBuilder.buildFromNodes(detectedBranches);
    }
  }
};

// Add manual UI refresh
window.refreshUI = async () => {
  await renderTabsFromTree();
};

// Add immediate debug logging

// ============================================================================
// TEMPORARY INLINE UI COMPONENTS (until properly extracted)
// ============================================================================

class SimpleUIManager {
  constructor() {
    this.isInitialized = false;
    this.uiContainer = null;
    this.tabsContainer = null;
  }

  async initialize() {
    try {
      // Wait for header to be available
      await waitForElement("#page-header", 5000);

      const header = document.querySelector("#page-header");
      if (!header) {
        console.error("Could not find page header");
        return false;
      }

      // Create main UI container
      this.uiContainer = document.createElement("div");
      this.uiContainer.className = "chatgpt-branching-extension";
      this.uiContainer.innerHTML = `
        <div class="conversation-path" id="conversation-path">
          <!-- Conversation path will be rendered here -->
        </div>
      `;

      // Add styles for proper two-row header layout
      const style = document.createElement("style");
      style.textContent = `
        #page-header {
          flex-direction: column !important;
          align-items: stretch !important;
          min-height: auto !important;
          height: auto !important;
        }
        
        /* The wrapper maintains the original header layout */
        .original-header-content {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          width: 100% !important;
          flex-shrink: 0 !important;
        }
        
        .chatgpt-branching-extension {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          padding: 8px 16px 4px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: inherit;
          width: 100%;
          flex-shrink: 0;
        }
        
        .conversation-path {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          overflow-x: auto;
          flex: 1;
        }
        
        .path-node {
          background: rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 6px;
          padding: 4px 6px;
          cursor: pointer;
          position: relative;
          min-width: 100px;
          max-width: 250px;
          color: rgba(255, 255, 255, 0.95);
          font-weight: 500;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }
        
        .node-content {
          display: flex;
          align-items: center;
          gap: 4px;
          width: 100%;
        }
        
        .node-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          min-width: 0;
        }
        
        .nav-button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          height: 20px;
          width: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        
        .nav-button:hover {
          background: rgba(255, 255, 255, 0.2);
          border-color: rgba(255, 255, 255, 0.4);
          color: rgba(255, 255, 255, 1);
          transform: scale(1.1);
        }
        
        .nav-button:active {
          transform: scale(0.95);
        }
        
        .nav-button.disabled,
        .nav-button:disabled {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
          transform: none;
        }
        
        .nav-button.disabled:hover,
        .nav-button:disabled:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.3);
          transform: none;
        }
        
        .path-node:hover {
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(255, 255, 255, 0.5);
          color: rgba(255, 255, 255, 1);
          transform: translateY(-1px);
        }
        
        .path-node.has-branches {
          border-color: rgba(255, 255, 255, 0.6);
          background: rgba(0, 0, 0, 0.15);
          color: rgba(255, 255, 255, 1);
        }
        
        .path-node.has-branches:hover {
          background: rgba(0, 0, 0, 0.25);
          border-color: rgba(255, 255, 255, 0.8);
        }
        
        .path-arrow {
          color: rgba(255, 255, 255, 0.6);
          font-weight: bold;
          font-size: 14px;
          margin: 0 2px;
        }
        
        .branch-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(255, 0, 0, 0.9);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
          min-width: 220px;
          max-width: 320px;
          z-index: 10001;
          opacity: 0;
          visibility: hidden;
          overflow: hidden;
          backdrop-filter: blur(12px);
          pointer-events: none;
          transition: opacity 0.15s ease-out, visibility 0.15s ease-out;
        }
        
        /* Ensure menu is visible when shown */
        .branch-menu.show {
          opacity: 1 !important;
          visibility: visible !important;
          pointer-events: auto !important;
        }
        
        /* Adjust menu position if it would go off-screen */
        .path-node:last-child .branch-menu {
          left: auto;
          right: 0;
          transform: none;
        }
        
        .branch-menu-header {
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.1);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .branch-item-content {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        
        .variant-label {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 10px;
          font-weight: bold;
          padding: 2px 6px;
          min-width: 16px;
          text-align: center;
          flex-shrink: 0;
        }
        
        .branch-text {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 13px;
        }
        
        .sub-branches-indicator {
          color: rgba(255, 255, 255, 0.6);
          font-size: 14px;
          font-weight: bold;
          margin-left: auto;
          flex-shrink: 0;
        }
        
        .branch-menu.show {
          display: block;
          animation: fadeIn 0.15s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .branch-item {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          transition: all 0.15s ease;
          gap: 8px;
        }
        
        .branch-item:last-child {
          border-bottom: none;
        }
        
        .branch-item:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 1);
        }
        
        .branch-item:hover .variant-label {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .branch-item.active {
          background: rgba(59, 130, 246, 0.2);
          color: rgba(255, 255, 255, 1);
          border-left: 3px solid rgba(59, 130, 246, 0.8);
        }
        
        .branch-item.active .variant-label {
          background: rgba(59, 130, 246, 0.6);
          color: white;
        }
        
        .branch-item.active:hover {
          background: rgba(59, 130, 246, 0.3);
        }
        
        /* Floating visualization button */
        .chatgpt-viz-button {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 50px;
          height: 50px;
          background: rgba(0, 0, 0, 0.8);
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.9);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          transition: all 0.3s ease;
          backdrop-filter: blur(10px);
        }
        
        .chatgpt-viz-button:hover {
          background: rgba(0, 0, 0, 0.9);
          border-color: rgba(255, 255, 255, 0.6);
          color: rgba(255, 255, 255, 1);
          transform: scale(1.1);
        }
        
        /* Visualization modal */
        .chatgpt-viz-modal {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10002;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s ease;
        }
        
        .chatgpt-viz-modal.show {
          opacity: 1;
          visibility: visible;
        }
        
        .viz-modal-content {
          background: rgba(0, 0, 0, 0.95);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 12px;
          width: 90%;
          max-width: 1000px;
          height: 80%;
          max-height: 800px;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(20px);
        }
        
        .viz-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .viz-modal-header h2 {
          color: rgba(255, 255, 255, 0.9);
          font-size: 24px;
          font-weight: 600;
          margin: 0;
        }
        
        .viz-close-button {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          font-size: 32px;
          cursor: pointer;
          padding: 0;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
        }
        
        .viz-close-button:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 1);
        }
        
        .viz-modal-body {
          flex: 1;
          padding: 24px;
          overflow-y: auto;
        }
        
        /* Tree visualization styles */
        .tree-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        
        .tree-node {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
          transition: all 0.2s ease;
        }
        
        .tree-node:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
        }
        
        .tree-node-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .node-role {
          background: rgba(59, 130, 246, 0.2);
          color: rgba(255, 255, 255, 0.9);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .node-variants {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .tree-node-content {
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
          line-height: 1.4;
          margin-bottom: 12px;
        }
        
        .tree-node-branches {
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding-top: 12px;
        }
        
        .branches-header {
          color: rgba(255, 255, 255, 0.7);
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        
        .tree-branch {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          margin: 4px 0;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .tree-branch:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
        }
        
        .tree-branch.active {
          background: rgba(59, 130, 246, 0.2);
          border-color: rgba(59, 130, 246, 0.4);
        }
        
        .branch-number {
          background: rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.9);
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          flex-shrink: 0;
        }
        
        .tree-branch.active .branch-number {
          background: rgba(59, 130, 246, 0.6);
          color: white;
        }
        
        .branch-text {
          flex: 1;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        
        .no-tree-data {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          padding: 40px 20px;
        }
        
        .no-tree-data p {
          margin: 8px 0;
          font-size: 16px;
        }
        
        /* Tree header and stats */
        .tree-header {
          padding: 16px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 20px;
        }
        
        .tree-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        
        .stat-item {
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
        }
        
        .stat-item strong {
          color: rgba(255, 255, 255, 1);
          font-weight: 600;
        }
        
        .stat-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .stat-badge.comprehensive {
          background: rgba(34, 197, 94, 0.2);
          color: rgba(34, 197, 94, 1);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }
        
        .stat-badge.current {
          background: rgba(59, 130, 246, 0.2);
          color: rgba(59, 130, 246, 1);
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        
        /* Node groups */
        .node-group {
          margin-bottom: 24px;
        }
        
        .node-group:last-child {
          margin-bottom: 0;
        }
        
        /* Loading and error states */
        .loading-tree-data,
        .error-tree-data {
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          padding: 40px 20px;
        }
        
        .loading-tree-data p,
        .error-tree-data p {
          margin: 8px 0;
          font-size: 16px;
        }
        
        .error-tree-data {
          color: rgba(239, 68, 68, 0.8);
        }
      `;
      document.head.appendChild(style);

      // Create a wrapper for the original header content to maintain proper layout
      const originalChildren = Array.from(header.children);

      // Create wrapper for original content
      const originalWrapper = document.createElement("div");
      originalWrapper.className = "original-header-content";
      originalWrapper.style.cssText = `
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        width: 100% !important;
        flex-shrink: 0 !important;
      `;

      // Move original children to wrapper
      originalChildren.forEach((child) => {
        if (!child.classList.contains("chatgpt-branching-extension")) {
          originalWrapper.appendChild(child);
        }
      });

      // Add wrapper back to header, then add our extension
      header.appendChild(originalWrapper);
      header.appendChild(this.uiContainer);

      this.tabsContainer = this.uiContainer.querySelector("#conversation-path");

      // Create floating tree visualization icon
      await this.createVisualizationButton();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize UI Manager:", error);
      return false;
    }
  }

  /**
   * Create floating visualization button
   */
  async createVisualizationButton() {
    // Create floating button
    this.vizButton = document.createElement("button");
    this.vizButton.className = "chatgpt-viz-button";
    this.vizButton.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7.5V9M15 9L12 12L9 9V7.5L3 7V9L9 9L12 12L15 9ZM12 13.5L9 16.5H15L12 13.5ZM12 18C10.9 18 10 18.9 10 20C10 21.1 10.9 22 12 22C13.1 22 14 21.1 14 20C14 18.9 13.1 18 12 18Z"/>
      </svg>
    `;
    this.vizButton.title = "Show Conversation Tree";

    // Add click handler
    this.vizButton.addEventListener("click", () => this.showVisualization());

    // Add to page
    document.body.appendChild(this.vizButton);
  }

  /**
   * Show the tree visualization modal
   */
  async showVisualization() {
    // Create modal if it doesn't exist
    if (!this.vizModal) {
      this.createVisualizationModal();
    }

    // Show modal
    this.vizModal.classList.add("show");
    document.body.style.overflow = "hidden"; // Prevent background scrolling

    // Render the tree (now async)
    await this.renderTreeVisualization();
  }

  /**
   * Create the visualization modal
   */
  createVisualizationModal() {
    this.vizModal = document.createElement("div");
    this.vizModal.className = "chatgpt-viz-modal";
    this.vizModal.innerHTML = `
      <div class="viz-modal-content">
        <div class="viz-modal-header">
          <h2>Conversation Tree</h2>
          <button class="viz-close-button">&times;</button>
        </div>
        <div class="viz-modal-body">
          <div id="tree-visualization"></div>
        </div>
      </div>
    `;

    // Add close handlers
    const closeButton = this.vizModal.querySelector(".viz-close-button");
    closeButton.addEventListener("click", () => this.hideVisualization());

    this.vizModal.addEventListener("click", (e) => {
      if (e.target === this.vizModal) {
        this.hideVisualization();
      }
    });

    document.body.appendChild(this.vizModal);
  }

  /**
   * Hide the visualization modal
   */
  hideVisualization() {
    if (this.vizModal) {
      this.vizModal.classList.remove("show");
      document.body.style.overflow = ""; // Restore scrolling
    }
  }

  /**
   * Render the tree visualization
   */
  async renderTreeVisualization() {
    const container = document.getElementById("tree-visualization");
    if (!container) return;

    // One-time style injection for D3 viz
    if (!document.getElementById("chatgpt-branches-d3-style")) {
      const style = document.createElement("style");
      style.id = "chatgpt-branches-d3-style";
      style.textContent = `
        .cb-tree-wrapper { position:relative; width:100%; height:100%; min-height:560px; }
        .cb-tree-svg { font:11px/1.2 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; }
  .cb-tree-node circle { stroke:#fff; stroke-width:2px; cursor:pointer; }
  .cb-tree-node circle.cb-hit-area { stroke:none !important; stroke-width:0 !important; fill:transparent !important; }
        .cb-tree-node circle.user { fill:#34d399; }
        .cb-tree-node circle.assistant { fill:#4f8ef7; }
        .cb-tree-node circle.root { fill:#6b7280; }
        .cb-tree-node circle.inactive { opacity:.45; }
  .cb-tree-link { fill:none; stroke:rgba(190,210,255,0.55); stroke-width:1.8px; stroke-linecap:round; transition:stroke .18s, stroke-width .18s, stroke-opacity .18s; pointer-events:none; }
        .cb-tree-link.highlight { stroke:#60a5fa; stroke-width:2.4px; stroke-opacity:0.95; filter:drop-shadow(0 0 4px rgba(96,165,250,0.55)); }
        .cb-tree-label { pointer-events:none; font-weight:600; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.6); }
        .cb-tree-badge { font-size:10px; font-weight:500; fill:#e5e7eb; }
        .cb-tree-tooltip { position:absolute; pointer-events:none; background:rgba(0,0,0,.85); color:#fff; padding:6px 8px; border-radius:6px; font-size:12px; line-height:1.3; max-width:240px; box-shadow:0 4px 16px rgba(0,0,0,.4); backdrop-filter:blur(6px); }
        .cb-tree-controls { position:absolute; top:8px; right:8px; display:flex; gap:6px; z-index:10; }
        .cb-tree-controls button { background:rgba(255,255,255,0.08); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:4px 8px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:4px; }
        .cb-tree-controls button:hover { background:rgba(255,255,255,0.15); }
        .cb-tree-legend { position:absolute; bottom:8px; left:8px; background:rgba(0,0,0,0.55); padding:6px 10px; border:1px solid rgba(255,255,255,0.15); border-radius:8px; display:flex; gap:12px; font-size:11px; color:#e5e7eb; }
        .cb-tree-legend span { display:flex; align-items:center; gap:4px; }
        .cb-tree-legend i { display:inline-block; width:12px; height:12px; border-radius:50%; }
        .cb-tree-legend i.user { background:#34d399; }
        .cb-tree-legend i.assistant { background:#4f8ef7; }
        .cb-tree-legend i.inactive { background:#6b7280; opacity:.5; }
        .cb-tree-header { margin-bottom:12px; }
      `;
      document.head.appendChild(style);
    }

    // Loading placeholder
    container.innerHTML = `<div class="loading-tree-data"><p>Loading comprehensive tree data...</p></div>`;

    // Helper: ensure D3 present (CSP-safe: expects bundled local copy)
    const ensureD3 = () =>
      new Promise((resolve, reject) => {
        if (window.d3) return resolve(window.d3);
        // No remote injection due to host CSP blocking external scripts.
        reject(new Error("D3 library not found in page context"));
      });

    try {
      let d3;
      try {
        d3 = await ensureD3();
      } catch (missingErr) {
        container.innerHTML = `
          <div class="error-tree-data" style="text-align:left;max-width:640px;margin:0 auto;line-height:1.5">
            <p style="font-weight:600;margin-bottom:6px;">D3.js not available</p>
            <p style="margin:4px 0 10px;">Due to the site Content Security Policy, external CDN scripts are blocked. Bundle D3 with the extension instead:</p>
            <ol style="padding-left:20px;margin:0 0 12px;">
              <li>Add <code>vendor/d3.v7.min.js</code> to your extension (download from official D3 release).</li>
              <li>List it in <code>manifest.json</code> before <code>src/content.js</code> under <code>content_scripts[0].js</code>.</li>
              <li>Reload the extension (chrome://extensions → Reload) and reopen this visualization.</li>
            </ol>
            <p style="margin:0 0 12px;">Example manifest snippet:</p>
            <pre style="white-space:pre;overflow:auto;background:rgba(255,255,255,0.05);padding:8px;border-radius:6px;font-size:11px;">"content_scripts": [{
  "matches": ["https://chatgpt.com/*", "https://chat.openai.com/*"],
  "js": [
    "vendor/d3.v7.min.js",
    "src/utils/dom-utils.js",
    "src/core/storage-manager.js",
    "src/core/tree-builder.js",
    "src/core/branch-detector.js",
    "src/content.js"
  ],
  "css": ["styles/extension.css"],
  "run_at": "document_idle"
}]</pre>
            <button id="cb-retry-d3" style="margin-top:6px;background:#2563eb;color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;">Retry</button>
          </div>`;
        const retryBtn = container.querySelector("#cb-retry-d3");
        if (retryBtn)
          retryBtn.addEventListener("click", () =>
            this.renderTreeVisualization()
          );
        return; // Stop; cannot proceed without D3
      }

      const conversationId = extensionState.conversationId;
      const treeState =
        await extensionState.treeBuilder?.getComprehensiveTreeState(
          conversationId
        );

      if (!treeState || !treeState.nodes || treeState.nodes.length === 0) {
        container.innerHTML = `<div class="no-tree-data"><p>No conversation tree data available</p><p>Navigate through some conversation variants to build the tree</p></div>`;
        return;
      }

      // Clear
      container.innerHTML = "";

      // Header (reuse existing style classes)
      const header = document.createElement("div");
      header.className = "tree-header cb-tree-header";
      header.innerHTML = `
        <div class="tree-stats">
          <span class="stat-item"><strong>${
            treeState.nodes.length
          }</strong> nodes</span>
          ${
            treeState.totalSessions
              ? `<span class="stat-item"><strong>${treeState.totalSessions}</strong> sessions</span>`
              : ""
          }
          ${
            treeState.isComprehensive
              ? `<span class="stat-badge comprehensive">Complete History</span>`
              : `<span class="stat-badge current">Current Session</span>`
          }
        </div>`;
      container.appendChild(header);

      // Wrapper
      const wrapper = document.createElement("div");
      wrapper.className = "cb-tree-wrapper";
      container.appendChild(wrapper);

      // Tooltip
      const tooltip = document.createElement("div");
      tooltip.className = "cb-tree-tooltip";
      tooltip.style.display = "none";
      wrapper.appendChild(tooltip);

      // Controls
      const controls = document.createElement("div");
      controls.className = "cb-tree-controls";
      controls.innerHTML = `
        <button data-action="fit" title="Fit to view">Fit</button>
        <button data-action="reset" title="Reset zoom">Reset</button>
        <button data-action="expand" title="Expand / Collapse all">Toggle</button>
      `;
      wrapper.appendChild(controls);

      // Legend
      const legend = document.createElement("div");
      legend.className = "cb-tree-legend";
      legend.innerHTML = `
        <span><i class="user"></i>User</span>
        <span><i class="assistant"></i>Assistant</span>
        <span><i class="inactive"></i>Inactive Variant</span>
      `;
      wrapper.appendChild(legend);

      // -----------------------------
      // LEAN TREE RENDERING (each variant is a node)
      // -----------------------------
      // Expect treeState to be lean: { nodes: [nodeObjects], rootChildren: [] }
      // Node shape: { id, role, text, turnIndex, variantIndex, children: [childIds], turnId, variantId }

      // const isLean = treeState.isLean || treeState.rootChildren;
      let rootData;
      // treeState.nodes is an array of plain node objects
      console.log("treeState.nodes:", treeState.nodes);
      const nodeMap = new Map((treeState.nodes || []).map((n) => [n.id, n]));
      const toHierarchy = (id) => {
        if (id === "ROOT") {
          return {
            id: "ROOT",
            role: "root",
            name: "ROOT",
            children: (treeState.rootChildren || []).map(toHierarchy),
          };
        }
        const n = nodeMap.get(id);
        if (!n) return { id, name: id, children: [] };
        return {
          id: n.id,
          role: n.role,
          name: (n.text || n.id).slice(0, 80),
          turnIndex: n.turnIndex,
          variantIndex: n.variantIndex,
          turnId: n.turnId,
          variantId: n.variantId,
          isVariant: true,
          children: (n.children || []).map(toHierarchy),
        };
      };
      rootData = toHierarchy("ROOT");

      function labelWithVariant(d) {
        const raw = d.name || d.role || d.id || "";
        return raw.length > 40 ? raw.slice(0, 40).trimEnd() + "…" : raw;
      }

      const data = rootData;
      let root = d3.hierarchy(data);
      root.sort(
        (a, b) =>
          d3.ascending(a.data.role || "", b.data.role || "") ||
          d3.ascending(a.data.name, b.data.name)
      );
      const width = Math.max(928, container.clientWidth - 10);
      const dx = 90; // vertical separation between siblings (increased)
      const dy = 140; // horizontal distance per depth; will override using width/(root.height+1) optional
      const treeLayout = d3.tree().nodeSize([dx, dy]);
      treeLayout(root);

      // Compute extents for dynamic height
      let x0 = Infinity;
      let x1 = -x0;
      root.each((d) => {
        if (d.x > x1) x1 = d.x;
        if (d.x < x0) x0 = d.x;
      });
      const height = x1 - x0 + dx * 2;

      const svg = d3
        .select(wrapper)
        .append("svg")
        .attr("class", "cb-tree-svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-(dy / 3), x0 - dx, width, height])
        .style("max-width", "100%")
        .style("height", "auto")
        .style(
          "background",
          "linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))"
        )
        .style("border", "1px solid rgba(255,255,255,0.08)")
        .style("border-radius", "12px");

      // GROUPS
      const gLinks = svg
        .append("g")
        .attr("fill", "none")
        .attr("stroke", "rgba(190,210,255,0.55)")
        .attr("stroke-opacity", 1)
        .attr("stroke-width", 1.8)
        .attr("stroke-linecap", "round");
      const gNodes = svg
        .append("g")
        .attr("stroke-linejoin", "round")
        .attr("stroke-width", 2);

      // Links
      const linkPaths = gLinks
        .selectAll("path")
        .data(root.links())
        .join("path")
        .attr("class", "cb-tree-link")
        .attr(
          "d",
          d3
            .linkHorizontal()
            .x((d) => d.y)
            .y((d) => d.x)
        );

      // Nodes
      const node = gNodes
        .selectAll("g")
        .data(root.descendants())
        .join("g")
        .attr("class", (d) => `cb-tree-node depth-${d.depth}`)
        .attr("transform", (d) => `translate(${d.y},${d.x})`);

      node
        .append("circle")
        .attr("r", 10)
        .attr("class", (d) => d.data.role || "unknown")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          // Lean node: navigate using underlying turnId if available
          const variantIndex = d.data.variantIndex || 1;
          const navId = d.data.turnId || d.data.id;
          this.navigateToVariantFromTree(
            { ...d.data, id: navId },
            variantIndex
          );
        })
        .on("mouseenter", (event, d) => {
          // Tooltip disabled per request
          tooltip.style.display = "none";
          // Highlight ancestor path links
          const ancestors = new Set();
          let cur = d;
          while (cur.parent) {
            ancestors.add(cur);
            cur = cur.parent;
          }
          linkPaths.classed("highlight", (l) => ancestors.has(l.target));
        })
        .on("mousemove", () => {})
        .on("mouseleave", () => {
          tooltip.style.display = "none";
          linkPaths.classed("highlight", false);
        });

      // Multiline / wrapped labels using foreignObject (HTML) for easier wrapping
      const LABEL_WIDTH = 140; // width in px before wrapping (below-node label)
      const MAX_LINES = 4; // cap lines to avoid huge boxes
      const LINE_HEIGHT = 1.25; // em
      const LABEL_HEIGHT = Math.round(MAX_LINES * 14 * LINE_HEIGHT + 8);
      node
        .append("foreignObject")
        .attr("x", -LABEL_WIDTH / 2) // center under node
        .attr("y", 12) // very close below circle
        .attr("width", LABEL_WIDTH)
        .attr("height", LABEL_HEIGHT)
        .append("xhtml:div")
        .attr("class", "cb-tree-label")
        .style("width", LABEL_WIDTH + "px")
        .style("font-size", "11px")
        .style("line-height", LINE_HEIGHT)
        .style("font-weight", "600")
        .style("text-align", "center")
        .style("word-break", "break-word")
        .style("overflow", "hidden")
        .style("display", "block")
        .style("pointer-events", "none")
        .style("padding", "0")
        .style("border-radius", "0")
        .style("background", "transparent")
        .text((d) => labelWithVariant(d.data));

      // Add a larger invisible hit area behind each node to improve clickability
      node
        .insert("circle", ":first-child")
        .attr("class", "cb-hit-area")
        .attr("r", 16)
        .attr("fill", "transparent")
        .style("cursor", "pointer")
        .on("click", (event, d) => {
          event.stopPropagation();
          const variantIndex = d.data.variantIndex || 1;
          const navId = d.data.turnId || d.data.id;
          this.navigateToVariantFromTree(
            { ...d.data, id: navId },
            variantIndex
          );
        });

      // Controls repurposed
      const refit = () => {
        // For tidy tree static layout, refit just recenters horizontally using current viewBox
        // Could add zoom behavior later
        svg.attr("viewBox", [-(dy / 3), x0 - dx, width, height]);
      };
      controls
        .querySelector('[data-action="fit"]')
        .addEventListener("click", refit);
      controls
        .querySelector('[data-action="reset"]')
        .addEventListener("click", refit);
      controls
        .querySelector('[data-action="expand"]')
        .addEventListener("click", () => {
          // Not implementing collapse for tidy version yet; could rebuild with _collapsed markers
          refit();
        });
      refit();
    } catch (err) {
      console.error("Error rendering D3 tree visualization", err);
      container.innerHTML = `<div class="error-tree-data"><p>Error loading tree visualization</p><p>${
        (err && err.message) || "Unknown error"
      }</p></div>`;
    }
  }

  /**
   * Group nodes for better visualization
   * @param {Array} nodes - Array of [nodeId, nodeData] pairs
   * @returns {Array} Array of grouped nodes
   */
  groupNodesForVisualization(nodes) {
    // Sort nodes by turn index and group by conversation flow
    const sortedNodes = nodes.sort(([, a], [, b]) => {
      return (a.turnIndex || 0) - (b.turnIndex || 0);
    });

    // For now, return all nodes as one group
    // Future enhancement: group by conversation branches
    return [sortedNodes];
  }

  /**
   * Create a tree node element for visualization
   */
  createTreeNode(node) {
    const nodeElement = document.createElement("div");
    nodeElement.className = "tree-node";

    // Node header
    const header = document.createElement("div");
    header.className = "tree-node-header";
    header.innerHTML = `
      <span class="node-role">${node.role || "Unknown"}</span>
      <span class="node-variants">${node.currentVariant || 1}/${
      node.totalVariants || 1
    }</span>
    `;

    // Node content preview
    const content = document.createElement("div");
    content.className = "tree-node-content";
    const preview =
      extensionState.tabRenderer?.getNodePreview(node) ||
      "No preview available";
    content.textContent = preview;

    // Branches section
    if (node.variants && node.variants.length > 1) {
      const branchesContainer = document.createElement("div");
      branchesContainer.className = "tree-node-branches";

      const branchesHeader = document.createElement("div");
      branchesHeader.className = "branches-header";
      branchesHeader.textContent = `${node.variants.length} Variants:`;
      branchesContainer.appendChild(branchesHeader);

      node.variants.forEach((variant) => {
        const branchElement = document.createElement("div");
        branchElement.className = `tree-branch ${
          variant.isActive ? "active" : ""
        }`;
        branchElement.innerHTML = `
          <span class="branch-number">${variant.variantIndex}</span>
          <span class="branch-text">${
            variant.userPrompt ||
            variant.preview ||
            `Variant ${variant.variantIndex}`
          }</span>
        `;

        // Add click handler to navigate to this branch
        branchElement.addEventListener("click", async () => {
          await this.navigateToVariantFromTree(node, variant.variantIndex);
        });

        branchesContainer.appendChild(branchElement);
      });

      nodeElement.appendChild(header);
      nodeElement.appendChild(content);
      nodeElement.appendChild(branchesContainer);
    } else {
      nodeElement.appendChild(header);
      nodeElement.appendChild(content);
    }

    return nodeElement;
  }

  /**
   * Navigate to variant from tree view
   */
  async navigateToVariantFromTree(node, variantIndex) {
    // Hide the modal first
    this.hideVisualization();

    // Scroll to the node
    this.scrollToNode(node);

    // Navigate to the variant
    if (extensionState.navigationController) {
      const success =
        await extensionState.navigationController.navigateToVariant(
          node.id,
          variantIndex
        );
      if (success) {
      } else {
        console.error("Navigation from tree view failed");
      }
    }
  }

  /**
   * Scroll to a specific node in the conversation
   */
  scrollToNode(node) {
    if (node.element) {
      node.element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }

  getTabsContainer() {
    return this.tabsContainer;
  }
}

class SimpleTabRenderer {
  constructor() {
    this.activeNodeId = null;
  }

  async renderConversationPath(treeState) {
    if (!extensionState.uiManager?.tabsContainer) {
      console.warn("No tabs container available");
      return;
    }

    const container = extensionState.uiManager.tabsContainer;

    // Get the conversation path (sequence of nodes)
    const conversationPath = this.buildConversationPath(treeState);

    // Clear container
    container.innerHTML = "";

    if (conversationPath.length === 0) {
      // Show a message when no conversation is detected
      const messageElement = document.createElement("div");
      messageElement.className = "path-node";
      messageElement.textContent = "No conversation detected";
      messageElement.style.opacity = "0.7";
      container.appendChild(messageElement);
      return;
    }

    // Render the path
    conversationPath.forEach((node, index) => {
      // Add arrow between nodes
      if (index > 0) {
        const arrow = document.createElement("span");
        arrow.className = "path-arrow";
        arrow.textContent = "→";
        container.appendChild(arrow);
      }

      // Add node with navigation buttons
      const nodeElement = document.createElement("div");
      nodeElement.className = "path-node";
      if ((node.totalVariants || 1) > 1) {
        nodeElement.classList.add("has-branches");
      }

      // Create node content structure
      const nodeContent = document.createElement("div");
      nodeContent.className = "node-content";

      // Add navigation buttons for multi-variant nodes
      if ((node.totalVariants || 1) > 1) {
        const currentVariant = node.currentVariant || 1;
        const totalVariants = node.totalVariants || 1;

        // Previous button
        const prevButton = document.createElement("button");
        prevButton.className = "nav-button prev-button";
        prevButton.innerHTML = "‹";
        prevButton.title = "Previous variant";

        // Disable if on first variant
        if (currentVariant === 1) {
          prevButton.disabled = true;
          prevButton.classList.add("disabled");
        }

        prevButton.addEventListener("click", (e) =>
          this.handleNavigation(e, node, -1)
        );

        nodeContent.appendChild(prevButton);
      }

      // Add main text content
      const textContent = document.createElement("span");
      textContent.className = "node-text";
      const previewText = this.getNodePreview(node);
      textContent.textContent = previewText;
      nodeContent.appendChild(textContent);

      // Add next button for multi-variant nodes
      if ((node.totalVariants || 1) > 1) {
        const currentVariant = node.currentVariant || 1;
        const totalVariants = node.totalVariants || 1;

        // Next button
        const nextButton = document.createElement("button");
        nextButton.className = "nav-button next-button";
        nextButton.innerHTML = "›";
        nextButton.title = "Next variant";

        // Disable if on last variant
        if (currentVariant === totalVariants) {
          nextButton.disabled = true;
          nextButton.classList.add("disabled");
        }

        nextButton.addEventListener("click", (e) =>
          this.handleNavigation(e, node, 1)
        );

        nodeContent.appendChild(nextButton);
      }

      nodeElement.appendChild(nodeContent);

      // Set title and click handler for scrolling
      nodeElement.title = `${node.role || "Unknown"} message (${
        node.currentVariant || 1
      }/${node.totalVariants || 1}): ${previewText}`;

      // Add click handler to scroll to the node in conversation
      nodeElement.addEventListener("click", (e) => {
        if (!e.target.classList.contains("nav-button")) {
          this.scrollToNode(node);
        }
      });

      // Add hover menu for branches
      if ((node.totalVariants || 1) > 1) {
        this.addBranchMenu(nodeElement, node);
      }

      container.appendChild(nodeElement);
    });
  }

  buildConversationPath(treeState) {
    const path = [];

    if (treeState.nodes && treeState.nodes.length > 0) {
      // Get all nodes and sort by turn index
      const allNodes = treeState.nodes.map(([id, node]) => node);
      allNodes.sort((a, b) => (a.turnIndex || 0) - (b.turnIndex || 0));

      // Show all nodes, not just first 5
      path.push(...allNodes);
    }

    return path;
  }

  getNodePreview(node) {
    // Try to get preview from variants
    if (node.variants && node.variants.length > 0) {
      const activeVariant =
        node.variants.find((v) => v.isActive) || node.variants[0];
      if (
        activeVariant &&
        activeVariant.preview &&
        activeVariant.preview !==
          `${node.role} message (variant ${activeVariant.variantIndex})`
      ) {
        return activeVariant.preview;
      }
    }

    // Try to extract from DOM element if available
    if (node.element) {
      const preview = this.extractPreviewFromElement(node.element);
      if (preview && preview !== "[No content]") return preview;
    }

    // Try to get preview from node properties
    if (node.preview && node.preview !== `${node.role} message`) {
      return node.preview;
    }

    // Fallback to role-based text with better formatting
    const role = node.role || "Unknown";
    const variant = node.currentVariant || 1;
    const total = node.totalVariants || 1;

    if (total > 1) {
      return `${role} response ${variant}/${total}`;
    } else {
      return `${role} message`;
    }
  }

  extractPreviewFromElement(element) {
    // Try to find the main content area, avoiding navigation controls
    const contentSelectors = [
      ".prose p:first-child",
      ".prose",
      "p:not([class*='tabular'])",
      'div[class*="content"] p',
      'div[class*="message"] p',
      "[data-message-content]",
      "p",
      'div[class*="content"]',
    ];

    for (const selector of contentSelectors) {
      const contentEl = element.querySelector(selector);
      if (contentEl) {
        let text = contentEl.textContent?.trim() || "";

        // Skip if it's just navigation text like "1/2"
        if (/^\d+\/\d+$/.test(text.trim())) {
          continue;
        }

        // Clean up and truncate
        text = text.replace(/\s+/g, " ").substring(0, 80);
        if (text.length > 77) text += "...";

        if (text.length > 3) {
          // Must have some meaningful content
          return text;
        }
      }
    }

    // Fallback to element text content, but filter out navigation
    let text = element.textContent?.trim() || "";

    // Remove common navigation patterns
    text = text.replace(/\d+\/\d+/g, ""); // Remove "1/2" patterns
    text = text.replace(/Previous response|Next response/gi, ""); // Remove button labels
    text = text.replace(/\s+/g, " ").trim();

    if (text.length > 80) {
      text = text.substring(0, 77) + "...";
    }

    return text || "Message";
  }

  /**
   * Handle navigation button clicks
   * @param {Event} e - Click event
   * @param {Object} node - Node data
   * @param {number} direction - Direction: -1 for previous, 1 for next
   */
  async handleNavigation(e, node, direction) {
    e.preventDefault();
    e.stopPropagation();

    // Check if button is disabled
    if (e.target.disabled || e.target.classList.contains("disabled")) {
      return;
    }

    const currentVariant = node.currentVariant || 1;
    const totalVariants = node.totalVariants || 1;

    let targetVariant;
    if (direction === -1) {
      // Previous variant - don't wrap around, just prevent if at first
      if (currentVariant === 1) {
        return;
      }
      targetVariant = currentVariant - 1;
    } else {
      // Next variant - don't wrap around, just prevent if at last
      if (currentVariant === totalVariants) {
        return;
      }
      targetVariant = currentVariant + 1;
    }
    // Perform navigation
    if (extensionState.navigationController) {
      const success =
        await extensionState.navigationController.navigateToVariant(
          node.id,
          targetVariant
        );
      if (success) {
      } else {
        console.error("Navigation failed");
      }
    }
  }

  /**
   * Scroll to the node in the conversation
   * @param {Object} node - Node data
   */
  scrollToNode(node) {
    if (node.element && node.element.isConnected) {
      // Scroll to the element with smooth behavior
      node.element.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });

      // Add a temporary highlight effect
      node.element.style.transition = "background-color 0.3s ease";
      const originalBg = node.element.style.backgroundColor;
      node.element.style.backgroundColor = "rgba(59, 130, 246, 0.1)";

      setTimeout(() => {
        node.element.style.backgroundColor = originalBg;
      }, 1000);
    } else {
      console.warn("Node element not found or not connected to DOM");
    }
  }

  addBranchMenu(nodeElement, node) {
    const menu = document.createElement("div");
    menu.className = "branch-menu";

    // Add header showing current variant
    const header = document.createElement("div");
    header.className = "branch-menu-header";
    header.textContent = `${node.role || "Message"} Variants (${
      node.currentVariant || 1
    }/${node.totalVariants || 1})`;
    menu.appendChild(header);

    // Add branch options using branches data if available
    if (node.branches && node.branches.length > 0) {
      node.branches.forEach((branch, index) => {
        const item = document.createElement("div");
        item.className = "branch-item";
        if (branch.isActive) {
          item.classList.add("active");
        }

        // Create item content with variant indicator
        const itemContent = document.createElement("div");
        itemContent.className = "branch-item-content";

        const variantLabel = document.createElement("span");
        variantLabel.className = "variant-label";
        variantLabel.textContent = `${branch.variantIndex}`;

        const itemText = document.createElement("span");
        itemText.className = "branch-text";
        const displayText =
          branch.userPrompt ||
          branch.preview ||
          `Variant ${branch.variantIndex}`;
        itemText.textContent = displayText;
        itemText.title = displayText;

        itemContent.appendChild(variantLabel);
        itemContent.appendChild(itemText);
        item.appendChild(itemContent);

        // Add sub-branches indicator if they exist
        if (branch.nodes && branch.nodes.length > 0) {
          const subIndicator = document.createElement("span");
          subIndicator.className = "sub-branches-indicator";
          subIndicator.textContent = "›";
          item.appendChild(subIndicator);
        }

        item.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Hide menu immediately
          menu.classList.remove("show");

          // Perform navigation using the enhanced navigation controller
          await this.navigateToVariantWithSimulation(node, branch.variantIndex);
        });

        menu.appendChild(item);
      });
    } else {
      // Fallback to old method if branches data not available
      for (let i = 1; i <= node.totalVariants; i++) {
        const item = document.createElement("div");
        item.className = "branch-item";
        if (i === node.currentVariant) {
          item.classList.add("active");
        }

        const itemContent = document.createElement("div");
        itemContent.className = "branch-item-content";

        const variantLabel = document.createElement("span");
        variantLabel.className = "variant-label";
        variantLabel.textContent = `${i}`;

        const itemText = document.createElement("span");
        itemText.className = "branch-text";
        itemText.textContent = `Variant ${i}`;

        itemContent.appendChild(variantLabel);
        itemContent.appendChild(itemText);
        item.appendChild(itemContent);

        item.addEventListener("click", async (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Hide menu immediately
          menu.classList.remove("show");

          // Perform navigation using the enhanced navigation controller
          await this.navigateToVariantWithSimulation(node, i);
        });

        menu.appendChild(item);
      }
    }

    nodeElement.appendChild(menu);

    // Show/hide menu on hover with debugging
    nodeElement.addEventListener("mouseenter", () => {
      menu.classList.add("show");
    });

    nodeElement.addEventListener("mouseleave", () => {
      setTimeout(() => {
        if (!menu.matches(":hover")) {
          menu.classList.remove("show");
        }
      }, 150);
    });

    menu.addEventListener("mouseenter", () => {});

    menu.addEventListener("mouseleave", () => {
      menu.classList.remove("show");
    });
  }

  /**
   * Navigate to variant with simulation of multiple clicks
   * @param {Object} node - Node data
   * @param {number} targetVariant - Target variant number
   */
  async navigateToVariantWithSimulation(node, targetVariant) {
    const currentVariant = node.currentVariant || 1;
    const totalVariants = node.totalVariants || 1;

    if (currentVariant === targetVariant) {
      return;
    }

    // Calculate the shortest path (considering wrap-around)
    const forwardSteps =
      targetVariant > currentVariant
        ? targetVariant - currentVariant
        : totalVariants - currentVariant + targetVariant;

    const backwardSteps =
      currentVariant > targetVariant
        ? currentVariant - targetVariant
        : currentVariant + (totalVariants - targetVariant);

    const useForward = forwardSteps <= backwardSteps;
    const steps = useForward ? forwardSteps : backwardSteps;
    const direction = useForward ? 1 : -1;

    // Perform the navigation by simulating multiple button clicks
    if (extensionState.navigationController) {
      const success =
        await extensionState.navigationController.navigateToVariantWithSteps(
          node.id,
          targetVariant,
          steps,
          direction
        );

      if (success) {
      } else {
        console.error("Multi-step navigation failed");
      }
    }
  }
}

class SimpleNavigationController {
  constructor() {
    this.isNavigating = false;
  }

  /**
   * Navigate to variant with multiple steps simulation
   * @param {string} nodeId - Node ID
   * @param {number} targetVariant - Target variant number
   * @param {number} steps - Number of steps to take
   * @param {number} direction - Direction: 1 for forward, -1 for backward
   */
  async navigateToVariantWithSteps(nodeId, targetVariant, steps, direction) {
    if (this.isNavigating) {
      return false;
    }

    try {
      this.isNavigating = true;

      // Find the node in our tree
      const node = extensionState.treeBuilder?.getNode(nodeId);
      if (!node || !node.element) {
        console.error("Node or element not found for navigation");
        return false;
      }

      // Find navigation buttons in the element
      const prevButton = node.element.querySelector(
        'button[aria-label="Previous response"]'
      );
      const nextButton = node.element.querySelector(
        'button[aria-label="Next response"]'
      );

      if (!prevButton && !nextButton) {
        console.error("No navigation buttons found");
        return false;
      }

      const targetButton = direction > 0 ? nextButton : prevButton;

      if (!targetButton) {
        console.error(
          `${direction > 0 ? "Next" : "Previous"} button not found`
        );
        return false;
      }

      // Perform multiple clicks with delays
      for (let i = 0; i < steps; i++) {
        // Check if button is still enabled
        if (targetButton.disabled) {
          console.warn("Button became disabled, stopping navigation");
          break;
        }

        // Simulate click
        targetButton.click();

        // Wait between clicks to let ChatGPT update
        if (i < steps - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }

      // Wait for the final UI update
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Trigger a rescan to update our data and refresh UI
      setTimeout(async () => {
        if (extensionState.branchDetector && extensionState.treeBuilder) {
          const turns = findConversationTurns();
          const detectedBranches =
            extensionState.branchDetector.detectBranches(turns);
          if (detectedBranches.length > 0) {
            extensionState.treeBuilder.buildFromNodes(detectedBranches);
          } else {
            await renderTabsFromTree();
          }
        }
      }, 300);

      return true;
    } catch (error) {
      console.error("Error during multi-step navigation:", error);
      return false;
    } finally {
      this.isNavigating = false;
    }
  }

  async navigateToVariant(nodeId, variantIndex) {
    if (this.isNavigating) {
      return false;
    }
    try {
      this.isNavigating = true;

      // Find the node in our tree
      const node = extensionState.treeBuilder?.getNode(nodeId);
      if (!node || !node.element) {
        console.error("Node or element not found for navigation");
        return false;
      }

      // Get current variant info
      const currentVariant = node.currentVariant || 1;
      const targetVariant = variantIndex;

      if (currentVariant === targetVariant) {
        return true;
      }

      // Calculate how many clicks we need
      const clicksNeeded = targetVariant - currentVariant;
      const isForward = clicksNeeded > 0;
      const absoluteClicks = Math.abs(clicksNeeded);

      // Find navigation buttons in the element
      const prevButton = node.element.querySelector(
        'button[aria-label="Previous response"]'
      );
      const nextButton = node.element.querySelector(
        'button[aria-label="Next response"]'
      );

      if (!prevButton && !nextButton) {
        console.error("No navigation buttons found");
        return false;
      }

      // Perform the clicks
      const targetButton = isForward ? nextButton : prevButton;

      if (!targetButton) {
        console.error(`${isForward ? "Next" : "Previous"} button not found`);
        return false;
      }

      // Click the appropriate button the required number of times
      for (let i = 0; i < absoluteClicks; i++) {
        // Check if button is still enabled
        if (targetButton.disabled) {
          console.warn("Button became disabled, stopping navigation");
          break;
        }

        // Simulate click
        targetButton.click();

        // Wait a bit between clicks to let ChatGPT update
        if (i < absoluteClicks - 1) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }

      // Wait for the UI to update
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Trigger a rescan to update our data and refresh UI
      setTimeout(async () => {
        if (extensionState.branchDetector && extensionState.treeBuilder) {
          const turns = findConversationTurns();
          const detectedBranches =
            extensionState.branchDetector.detectBranches(turns);
          if (detectedBranches.length > 0) {
            extensionState.treeBuilder.buildFromNodes(detectedBranches);
            // The tree builder will automatically trigger UI update via callback
          } else {
            // Force UI refresh even if no branches detected
            await renderTabsFromTree();
          }
        }
      }, 200);

      return true;
    } catch (error) {
      console.error("Error during navigation:", error);
      return false;
    } finally {
      this.isNavigating = false;
    }
  }
}

// Helper function to render tabs from tree
async function renderTabsFromTree() {
  if (!extensionState.tabRenderer || !extensionState.treeBuilder) {
    return;
  }

  const treeState = extensionState.treeBuilder.getTreeState();
  await extensionState.tabRenderer.renderConversationPath(treeState);
}

/**
 * Set up DOM observer to watch for conversation changes
 */
function setupDOMObserver() {
  const targetNode = document.querySelector("main") || document.body;

  const observer = new MutationObserver((mutations) => {
    let shouldRescan = false;

    for (const mutation of mutations) {
      // Check if any added nodes contain tabular-nums (branch indicators)
      if (mutation.type === "childList") {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.querySelector && node.querySelector(".tabular-nums")) {
              shouldRescan = true;
              break;
            }
          }
        }
      }

      // Check if any modified nodes have tabular-nums
      if (mutation.type === "attributes" && mutation.target.querySelector) {
        if (mutation.target.querySelector(".tabular-nums")) {
          shouldRescan = true;
        }
      }
    }

    if (shouldRescan) {
      // Debounce the rescan to avoid too many updates
      clearTimeout(window.extensionRescanTimeout);
      window.extensionRescanTimeout = setTimeout(async () => {
        if (extensionState.branchDetector && extensionState.treeBuilder) {
          const turns = findConversationTurns();
          const detectedBranches =
            extensionState.branchDetector.detectBranches(turns);
          if (detectedBranches.length > 0) {
            extensionState.treeBuilder.buildFromNodes(detectedBranches);
          }
        }
      }, 500);
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-message-id"],
  });

  extensionState.domObserver = observer;
}
