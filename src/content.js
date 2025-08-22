/**
 * ChatGPT Branching Extension - Content Script
 * Main entry point for the extension functionality
 */

console.log("ChatGPT Branching Extension loaded");

// Import all modules
import {
  extractConversationId,
  findConversationContainer,
  findConversationTurns,
  isValidChatGPTPage,
  waitForElement,
} from "./utils/dom-utils.js";

import { StorageManager } from "./core/storage-manager.js";
import { TreeBuilder } from "./core/tree-builder.js";
import { BranchDetector } from "./core/branch-detector.js";

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
  console.log("Waiting for React to stabilize...");

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

  console.log("React appears stable, proceeding with extension initialization");
}

async function initializeExtension() {
  console.log("Initializing ChatGPT Branching Extension...");

  try {
    // Wrap all DOM operations in try-catch to prevent React conflicts
    const initResult = await safelyInitializeComponents();

    if (!initResult.success) {
      throw new Error(`Initialization failed: ${initResult.error}`);
    }

    console.log("Extension initialization completed successfully");
  } catch (error) {
    console.error("Error initializing ChatGPT Branching Extension:", error);

    // Schedule retry with exponential backoff
    const retryDelay = Math.min(
      5000,
      1000 * Math.pow(2, window.extensionRetryCount || 0)
    );
    window.extensionRetryCount = (window.extensionRetryCount || 0) + 1;

    if (window.extensionRetryCount < 5) {
      console.log(
        `Retrying initialization in ${retryDelay}ms (attempt ${window.extensionRetryCount})`
      );
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
      console.log(
        "Not a valid ChatGPT conversation page, extension not activated"
      );
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

    console.log(
      "Initializing extension for conversation:",
      extensionState.conversationId
    );

    // Initialize core components
    extensionState.storageManager = new StorageManager();
    extensionState.treeBuilder = new TreeBuilder();
    extensionState.branchDetector = new BranchDetector();

    // TODO: Initialize remaining components when they are extracted
    // extensionState.performanceMonitor = new PerformanceMonitor();
    // extensionState.uiManager = new UIManager();
    // extensionState.domObserver = new DOMObserver();
    // extensionState.tabRenderer = new TabRenderer(extensionState.uiManager);
    // extensionState.navigationController = new NavigationController(
    //   extensionState.treeBuilder,
    //   extensionState.branchDetector
    // );

    // Set up component relationships and callbacks
    setupComponentCallbacks();

    // Load saved data
    await safelyLoadSavedData();

    // Initialize UI components
    // await safelyInitializeUI();

    // Initialize DOM observer
    // await safelyInitializeDOMObserver();

    // Perform initial scan
    await performInitialScan();

    extensionState.isInitialized = true;
    console.log("All extension components initialized successfully");

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
    // if (extensionState.tabRenderer) {
    //   await renderTabsFromTree();
    // }
  });

  // Branch detector callbacks
  extensionState.branchDetector.onBranchDetected((branchInfo) => {
    console.log("Branch detected:", branchInfo);

    // Update tree with detected branch
    if (extensionState.treeBuilder) {
      extensionState.treeBuilder.buildFromBranches([branchInfo]);
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
    console.log(
      "Loading saved tree data for conversation:",
      extensionState.conversationId
    );

    const savedTreeData =
      await extensionState.storageManager.loadConversationTree(
        extensionState.conversationId
      );

    if (savedTreeData && extensionState.treeBuilder) {
      extensionState.treeBuilder.importData(savedTreeData);
      console.log("Loaded saved tree data for conversation");

      // Trigger tab rendering after loading saved data
      // if (extensionState.tabRenderer) {
      //   setTimeout(async () => {
      //     try {
      //       await renderTabsFromTree();
      //       console.log("Rendered tabs from loaded tree data");
      //     } catch (error) {
      //       console.error("Error rendering tabs from loaded data:", error);
      //     }
      //   }, 500);
      // }
    } else {
      console.log("No saved tree data found for conversation");
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
    console.log("Performing initial branch scan...");

    const turns = findConversationTurns();
    if (turns.length === 0) {
      console.log("No conversation turns found for initial scan");
      return;
    }

    const detectedBranches =
      extensionState.branchDetector.detectBranches(turns);

    if (detectedBranches.length > 0) {
      console.log(`Initial scan detected ${detectedBranches.length} branches`);
      extensionState.treeBuilder.buildFromBranches(detectedBranches);
    } else {
      console.log("No branches detected in initial scan");
    }
  } catch (error) {
    console.error("Error in initial scan:", error);
  }
}

// Export for debugging
window.extensionState = extensionState;
window.debugExtension = () => {
  console.log("Extension State:", extensionState);
  console.log("Tree Summary:", extensionState.treeBuilder?.getTreeSummary());
  console.log(
    "Detected Branches:",
    extensionState.branchDetector?.getAllBranches()
  );
};

console.log("ChatGPT Branching Extension content script loaded");
