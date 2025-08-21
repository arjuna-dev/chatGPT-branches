/**
 * ChatGPT Branching Extension - Content Script
 * Main entry point for the extension functionality
 */

console.log("ChatGPT Branching Extension loaded");

// ============================================================================
// DOM UTILITIES
// ============================================================================

/**
 * Extract conversation ID from ChatGPT URL
 * @returns {string|null} Conversation ID or null if not found
 */
function extractConversationId() {
  const url = window.location.href;

  // Match patterns like /c/conversation-id or /chat/conversation-id
  const patterns = [
    /\/c\/([a-f0-9-]{36})/i, // Standard UUID format
    /\/c\/([a-zA-Z0-9-_]+)/i, // Alternative ID formats
    /\/chat\/([a-f0-9-]{36})/i, // Alternative chat path
    /\/chat\/([a-zA-Z0-9-_]+)/i, // Alternative chat path with different ID format
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      console.log("Extracted conversation ID:", match[1]);
      return match[1];
    }
  }

  console.warn("Could not extract conversation ID from URL:", url);
  return null;
}

/**
 * Find the main conversation container
 * @returns {Element|null} The conversation container element
 */
function findConversationContainer() {
  // Priority order of selectors for conversation container
  const selectors = [
    'main[role="main"]',
    "main",
    '[role="main"]',
    ".conversation-container",
    "#__next main",
    'div[class*="conversation"]',
    // Additional selectors for current ChatGPT structure
    'div[class*="flex-1"]',
    'div[class*="overflow"]',
    ".h-full",
    "div.flex-1.overflow-hidden",
  ];

  for (const selector of selectors) {
    try {
      const container = document.querySelector(selector);
      if (container) {
        console.log("Found conversation container with selector:", selector);
        return container;
      }
    } catch (error) {
      console.warn(`Error with container selector "${selector}":`, error);
    }
  }

  console.warn("Could not find conversation container");

  // Debug: log available containers
  console.log(
    "Available main elements:",
    document.querySelectorAll("main").length
  );
  console.log(
    "Available role=main elements:",
    document.querySelectorAll('[role="main"]').length
  );

  return null;
}

/**
 * Find all conversation turn elements
 * @returns {Element[]} Array of turn elements
 */
function findConversationTurns() {
  // Priority order of selectors for turn elements
  const selectors = [
    '[data-testid="conversation-turn"]',
    "article",
    'li[role="listitem"]',
    'div[class*="turn"]',
    'div[class*="message"]',
    // Additional selectors for ChatGPT's current structure
    "div[data-message-author-role]",
    "div[data-message-id]",
    ".group\\/conversation-turn",
    ".group.w-full",
    "div.group",
    // More generic fallbacks
    "main > div > div",
    'main div[class*="flex"]',
    'div[class*="conversation"] > div',
  ];

  let turns = [];

  for (const selector of selectors) {
    try {
      turns = Array.from(document.querySelectorAll(selector));
      if (turns.length > 0) {
        console.log(`Found ${turns.length} turns with selector:`, selector);
        break;
      }
    } catch (error) {
      console.warn(`Error with selector "${selector}":`, error);
    }
  }

  if (turns.length === 0) {
    console.warn(
      "Could not find any conversation turns with standard selectors"
    );

    // Fallback: Look for elements that contain branch indicators
    turns = findTurnsByBranchIndicators();

    if (turns.length === 0) {
      console.warn(
        "Could not find any conversation turns with fallback method"
      );
      // Debug: Log some information about the page structure
      debugPageStructure();
    } else {
      console.log(
        `Found ${turns.length} turns using branch indicator fallback`
      );
    }
  }

  return turns;
}

/**
 * Fallback method to find turns by looking for branch indicators
 * @returns {Element[]} Array of turn elements
 */
function findTurnsByBranchIndicators() {
  const turns = [];

  // Find all elements with tabular-nums (branch indicators)
  const branchIndicators = document.querySelectorAll(".tabular-nums");

  branchIndicators.forEach((indicator) => {
    // Walk up the DOM to find the turn container
    let current = indicator;
    let turnElement = null;

    // Look for a reasonable turn container (max 10 levels up)
    for (let i = 0; i < 10 && current.parentElement; i++) {
      current = current.parentElement;

      // Check if this looks like a turn container
      if (isLikelyTurnContainer(current)) {
        turnElement = current;
        break;
      }
    }

    if (turnElement && !turns.includes(turnElement)) {
      turns.push(turnElement);
    }
  });

  // Also look for all potential message containers and filter by content
  const allDivs = document.querySelectorAll("div");
  allDivs.forEach((div) => {
    if (isLikelyTurnContainer(div) && !turns.includes(div)) {
      turns.push(div);
    }
  });

  return turns;
}

/**
 * Check if an element is likely a turn container
 * @param {Element} element - Element to check
 * @returns {boolean} True if likely a turn container
 */
function isLikelyTurnContainer(element) {
  // Check for common patterns that indicate a turn container
  const className = element.className || "";
  const hasRelevantClass = [
    "group",
    "turn",
    "message",
    "conversation",
    "flex",
    "w-full",
    "border",
    "rounded",
  ].some((keyword) => className.includes(keyword));

  // Check for data attributes that suggest it's a message
  const hasMessageData =
    element.hasAttribute("data-message-id") ||
    element.hasAttribute("data-message-author-role") ||
    element.hasAttribute("data-testid");

  // Check if it contains message-like content
  const hasMessageContent =
    element.querySelector("p, pre, code, .prose") !== null;

  // Check if it has a reasonable size (not too small, not too large)
  const rect = element.getBoundingClientRect();
  const hasReasonableSize =
    rect.height > 20 && rect.height < window.innerHeight;

  // Must have at least one positive indicator
  return (
    (hasRelevantClass || hasMessageData || hasMessageContent) &&
    hasReasonableSize
  );
}

/**
 * Debug function to help identify the page structure
 */
function debugPageStructure() {
  console.log("=== DEBUG: Page Structure Analysis ===");

  const main = document.querySelector("main");
  if (main) {
    console.log("Found main element:", main);
    console.log("Main children count:", main.children.length);

    // Log first few children of main
    Array.from(main.children)
      .slice(0, 5)
      .forEach((child, index) => {
        console.log(`Main child ${index}:`, {
          tagName: child.tagName,
          className: child.className,
          id: child.id,
          dataAttributes: getDataAttributes(child),
        });
      });
  }

  // Look for elements that might contain conversation content
  const possibleContainers = [
    'div[class*="conversation"]',
    'div[class*="chat"]',
    'div[class*="message"]',
    'div[class*="turn"]',
    '[role="log"]',
    '[role="main"]',
  ];

  possibleContainers.forEach((selector) => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      console.log(
        `Found ${elements.length} elements with selector "${selector}"`
      );
    }
  });

  // Look for elements with tabular-nums (our branch indicators)
  const tabularNums = document.querySelectorAll(".tabular-nums");
  if (tabularNums.length > 0) {
    console.log(`Found ${tabularNums.length} .tabular-nums elements`);
    tabularNums.forEach((el, index) => {
      console.log(`tabular-nums ${index}:`, {
        text: el.textContent,
        parent: el.parentElement?.tagName,
        parentClass: el.parentElement?.className,
      });
    });
  }

  console.log("=== END DEBUG ===");
}

/**
 * Get data attributes from an element
 * @param {Element} element - The element
 * @returns {Object} Object with data attributes
 */
function getDataAttributes(element) {
  const dataAttrs = {};
  for (const attr of element.attributes) {
    if (attr.name.startsWith("data-")) {
      dataAttrs[attr.name] = attr.value;
    }
  }
  return dataAttrs;
}

/**
 * Generate a stable ID for a turn element
 * @param {Element} turnElement - The turn element
 * @param {number} index - The turn index as fallback
 * @returns {string} Stable turn ID
 */
function generateTurnId(turnElement, index) {
  // Try to use stable attributes first
  const stableAttributes = [
    "data-message-id",
    "data-turn-id",
    "data-testid",
    "id",
  ];

  for (const attr of stableAttributes) {
    const value = turnElement.getAttribute(attr);
    if (value) {
      console.log(`Using stable ID from ${attr}:`, value);
      return value;
    }
  }

  // Fallback: generate deterministic ID from content and position
  const textContent = turnElement.textContent?.trim().substring(0, 100) || "";
  const contentHash = simpleHash(textContent);
  const domPath = getDOMPath(turnElement);
  const pathHash = simpleHash(domPath);

  const syntheticId = `turn-${index}-${contentHash}-${pathHash}`;
  console.log("Generated synthetic turn ID:", syntheticId);
  return syntheticId;
}

/**
 * Get DOM path for an element (for ID generation)
 * @param {Element} element - The element
 * @returns {string} DOM path string
 */
function getDOMPath(element) {
  const path = [];
  let current = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      path.unshift(selector);
      break;
    }

    if (current.className) {
      const classes = current.className.split(" ").filter((c) => c.length > 0);
      if (classes.length > 0) {
        selector += `.${classes[0]}`;
      }
    }

    // Add position among siblings if needed for uniqueness
    const siblings = Array.from(current.parentNode?.children || []);
    const sameTagSiblings = siblings.filter(
      (s) => s.tagName === current.tagName
    );
    if (sameTagSiblings.length > 1) {
      const position = sameTagSiblings.indexOf(current) + 1;
      selector += `:nth-of-type(${position})`;
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(" > ");
}

/**
 * Simple hash function for generating consistent IDs
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString();

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}

/**
 * Check if we're on a valid ChatGPT conversation page
 * @returns {boolean} True if on a valid conversation page
 */
function isValidChatGPTPage() {
  const url = window.location.href;
  const hostname = window.location.hostname;

  // Check hostname
  const validHosts = ["chatgpt.com", "chat.openai.com"];
  const isValidHost = validHosts.some((host) => hostname.includes(host));

  // Check if we're on a conversation page (has conversation ID in URL)
  const hasConversationId = extractConversationId() !== null;

  // Check if conversation container exists
  const hasConversationContainer = findConversationContainer() !== null;

  const isValid = isValidHost && hasConversationId && hasConversationContainer;

  console.log("Page validation:", {
    url,
    hostname,
    isValidHost,
    hasConversationId,
    hasConversationContainer,
    isValid,
  });

  return isValid;
}

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector to wait for
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<Element|null>} Promise that resolves with the element or null on timeout
 */
function waitForElement(selector, timeout = 5000) {
  return new Promise((resolve) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout fallback
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

// ============================================================================
// STORAGE MANAGER CLASS
// ============================================================================

class StorageManager {
  constructor() {
    this.storagePrefix = "chatgpt_branching_";
    this.currentVersion = "1.0.0";
    this.maxStorageSize = 5 * 1024 * 1024; // 5MB limit
    this.compressionThreshold = 1024; // Compress data larger than 1KB
  }

  /**
   * Generate storage key for conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} dataType - Type of data (tree, customizations, metadata)
   * @returns {string} Storage key
   */
  getStorageKey(conversationId, dataType = "tree") {
    return `${this.storagePrefix}${conversationId}_${dataType}`;
  }

  /**
   * Save conversation tree to localStorage
   * @param {string} conversationId - Conversation ID
   * @param {Object} treeData - Tree data from TreeBuilder
   * @returns {Promise<boolean>} Success status
   */
  async saveConversationTree(conversationId, treeData) {
    try {
      const key = this.getStorageKey(conversationId, "tree");

      // Prepare data with metadata
      const dataToSave = {
        version: this.currentVersion,
        timestamp: Date.now(),
        conversationId,
        treeData: this.sanitizeTreeData(treeData),
      };

      // Compress if needed
      const serializedData = JSON.stringify(dataToSave);
      const finalData =
        serializedData.length > this.compressionThreshold
          ? this.compressData(serializedData)
          : serializedData;

      // Check storage size
      if (this.getDataSize(finalData) > this.maxStorageSize) {
        console.warn("Tree data exceeds storage limit, performing cleanup");
        await this.performStorageCleanup();
      }

      localStorage.setItem(key, finalData);
      console.log(`Saved conversation tree for ${conversationId}`, {
        size: this.getDataSize(finalData),
        compressed: serializedData.length > this.compressionThreshold,
      });

      return true;
    } catch (error) {
      console.error("Failed to save conversation tree:", error);
      return false;
    }
  }

  /**
   * Load conversation tree from localStorage
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Tree data or null if not found
   */
  async loadConversationTree(conversationId) {
    try {
      const key = this.getStorageKey(conversationId, "tree");
      const rawData = localStorage.getItem(key);

      if (!rawData) {
        console.log(`No saved tree found for conversation ${conversationId}`);
        return null;
      }

      // Decompress if needed
      const serializedData = this.isCompressed(rawData)
        ? this.decompressData(rawData)
        : rawData;

      const parsedData = JSON.parse(serializedData);

      // Validate and migrate if needed
      const validatedData = await this.validateAndMigrate(parsedData);

      if (!validatedData) {
        console.warn(`Invalid tree data for conversation ${conversationId}`);
        return null;
      }

      console.log(`Loaded conversation tree for ${conversationId}`, {
        version: validatedData.version,
        nodeCount: validatedData.treeData?.nodeCount || 0,
      });

      return validatedData.treeData;
    } catch (error) {
      console.error("Failed to load conversation tree:", error);
      return null;
    }
  }

  /**
   * Save user customizations (branch names, colors)
   * @param {string} conversationId - Conversation ID
   * @param {Object} customizations - User customizations
   * @returns {Promise<boolean>} Success status
   */
  async saveCustomizations(conversationId, customizations) {
    try {
      const key = this.getStorageKey(conversationId, "customizations");

      const dataToSave = {
        version: this.currentVersion,
        timestamp: Date.now(),
        conversationId,
        customizations: this.sanitizeCustomizations(customizations),
      };

      localStorage.setItem(key, JSON.stringify(dataToSave));
      console.log(`Saved customizations for ${conversationId}`, customizations);

      return true;
    } catch (error) {
      console.error("Failed to save customizations:", error);
      return false;
    }
  }

  /**
   * Load user customizations
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object>} Customizations object
   */
  async loadCustomizations(conversationId) {
    try {
      const key = this.getStorageKey(conversationId, "customizations");
      const rawData = localStorage.getItem(key);

      if (!rawData) {
        return this.getDefaultCustomizations();
      }

      const parsedData = JSON.parse(rawData);
      const validatedData = await this.validateAndMigrate(parsedData);

      if (!validatedData) {
        return this.getDefaultCustomizations();
      }

      return {
        ...this.getDefaultCustomizations(),
        ...validatedData.customizations,
      };
    } catch (error) {
      console.error("Failed to load customizations:", error);
      return this.getDefaultCustomizations();
    }
  }

  /**
   * Update specific customization
   * @param {string} conversationId - Conversation ID
   * @param {string} nodeId - Node ID
   * @param {string} property - Property to update (name, color)
   * @param {any} value - New value
   * @returns {Promise<boolean>} Success status
   */
  async updateCustomization(conversationId, nodeId, property, value) {
    try {
      const customizations = await this.loadCustomizations(conversationId);

      if (!customizations.branches[nodeId]) {
        customizations.branches[nodeId] = {};
      }

      customizations.branches[nodeId][property] = value;
      customizations.lastModified = Date.now();

      return await this.saveCustomizations(conversationId, customizations);
    } catch (error) {
      console.error("Failed to update customization:", error);
      return false;
    }
  }

  /**
   * Get default customizations structure
   * @returns {Object} Default customizations
   */
  getDefaultCustomizations() {
    return {
      branches: {}, // nodeId -> { name: string, color: string }
      preferences: {
        defaultTabColor: "#3b82f6",
        showBranchCounts: true,
        autoSave: true,
      },
      lastModified: Date.now(),
    };
  }

  /**
   * Sanitize tree data before storage
   * @param {Object} treeData - Raw tree data
   * @returns {Object} Sanitized tree data
   */
  sanitizeTreeData(treeData) {
    if (!treeData || typeof treeData !== "object") {
      return null;
    }

    // Remove functions and non-serializable data
    const sanitized = {
      nodeCount: treeData.nodeCount || 0,
      edgeCount: treeData.edgeCount || 0,
      rootBranches: Array.isArray(treeData.rootBranches)
        ? treeData.rootBranches
        : [],
      currentPath: Array.isArray(treeData.currentPath)
        ? treeData.currentPath
        : [],
      nodes: [],
      edges: [],
    };

    // Sanitize nodes
    if (Array.isArray(treeData.nodes)) {
      sanitized.nodes = treeData.nodes.map(([nodeId, nodeData]) => [
        nodeId,
        {
          turnId: nodeData.turnId,
          turnIndex: nodeData.turnIndex,
          currentVariant: nodeData.currentVariant,
          totalVariants: nodeData.totalVariants,
          role: nodeData.role,
          children: Array.isArray(nodeData.children) ? nodeData.children : [],
          parent: nodeData.parent || null,
          depth: nodeData.depth || 0,
          isRoot: Boolean(nodeData.isRoot),
          lastSeen: nodeData.lastSeen || Date.now(),
        },
      ]);
    }

    // Sanitize edges
    if (Array.isArray(treeData.edges)) {
      sanitized.edges = treeData.edges.map(([parentId, children]) => [
        parentId,
        Array.isArray(children) ? children : [],
      ]);
    }

    return sanitized;
  }

  /**
   * Sanitize customizations before storage
   * @param {Object} customizations - Raw customizations
   * @returns {Object} Sanitized customizations
   */
  sanitizeCustomizations(customizations) {
    if (!customizations || typeof customizations !== "object") {
      return this.getDefaultCustomizations();
    }

    const sanitized = this.getDefaultCustomizations();

    // Sanitize branches
    if (
      customizations.branches &&
      typeof customizations.branches === "object"
    ) {
      for (const [nodeId, branchData] of Object.entries(
        customizations.branches
      )) {
        if (branchData && typeof branchData === "object") {
          sanitized.branches[nodeId] = {
            name:
              typeof branchData.name === "string" ? branchData.name : undefined,
            color:
              typeof branchData.color === "string"
                ? branchData.color
                : undefined,
          };
        }
      }
    }

    // Sanitize preferences
    if (
      customizations.preferences &&
      typeof customizations.preferences === "object"
    ) {
      const prefs = customizations.preferences;
      sanitized.preferences = {
        defaultTabColor:
          typeof prefs.defaultTabColor === "string"
            ? prefs.defaultTabColor
            : sanitized.preferences.defaultTabColor,
        showBranchCounts:
          typeof prefs.showBranchCounts === "boolean"
            ? prefs.showBranchCounts
            : sanitized.preferences.showBranchCounts,
        autoSave:
          typeof prefs.autoSave === "boolean"
            ? prefs.autoSave
            : sanitized.preferences.autoSave,
      };
    }

    sanitized.lastModified =
      typeof customizations.lastModified === "number"
        ? customizations.lastModified
        : Date.now();

    return sanitized;
  }

  /**
   * Validate and migrate stored data
   * @param {Object} data - Stored data
   * @returns {Promise<Object|null>} Validated data or null if invalid
   */
  async validateAndMigrate(data) {
    if (!data || typeof data !== "object") {
      return null;
    }

    // Check version and migrate if needed
    if (!data.version || data.version !== this.currentVersion) {
      console.log(
        `Migrating data from version ${data.version} to ${this.currentVersion}`
      );
      data = await this.migrateData(data);
    }

    // Validate required fields
    if (!data.conversationId || !data.timestamp) {
      return null;
    }

    // Check if data is too old (older than 30 days)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (Date.now() - data.timestamp > maxAge) {
      console.log("Data is too old, considering it invalid");
      return null;
    }

    return data;
  }

  /**
   * Migrate data between versions
   * @param {Object} data - Old version data
   * @returns {Promise<Object>} Migrated data
   */
  async migrateData(data) {
    // For now, just update version and preserve data
    // Future migrations can be added here
    return {
      ...data,
      version: this.currentVersion,
      migrated: true,
      migrationTimestamp: Date.now(),
    };
  }

  /**
   * Simple compression using JSON string manipulation
   * @param {string} data - Data to compress
   * @returns {string} Compressed data with marker
   */
  compressData(data) {
    // Simple compression: remove extra whitespace and add compression marker
    const compressed = data.replace(/\s+/g, " ").trim();
    return `__COMPRESSED__${compressed}`;
  }

  /**
   * Decompress data
   * @param {string} data - Compressed data
   * @returns {string} Decompressed data
   */
  decompressData(data) {
    if (this.isCompressed(data)) {
      return data.substring("__COMPRESSED__".length);
    }
    return data;
  }

  /**
   * Check if data is compressed
   * @param {string} data - Data to check
   * @returns {boolean} True if compressed
   */
  isCompressed(data) {
    return typeof data === "string" && data.startsWith("__COMPRESSED__");
  }

  /**
   * Get data size in bytes
   * @param {string} data - Data string
   * @returns {number} Size in bytes
   */
  getDataSize(data) {
    return new Blob([data]).size;
  }

  /**
   * Perform storage cleanup when approaching limits
   * @returns {Promise<void>}
   */
  async performStorageCleanup() {
    try {
      const keys = Object.keys(localStorage).filter((key) =>
        key.startsWith(this.storagePrefix)
      );

      // Sort by timestamp (oldest first)
      const keyData = [];
      for (const key of keys) {
        try {
          const data = JSON.parse(localStorage.getItem(key));
          keyData.push({ key, timestamp: data.timestamp || 0 });
        } catch (error) {
          // Invalid data, mark for removal
          keyData.push({ key, timestamp: 0 });
        }
      }

      keyData.sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 25% of entries
      const toRemove = Math.ceil(keyData.length * 0.25);
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(keyData[i].key);
        console.log(`Cleaned up old storage entry: ${keyData[i].key}`);
      }
    } catch (error) {
      console.error("Failed to perform storage cleanup:", error);
    }
  }

  /**
   * Clear all data for a conversation
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async clearConversation(conversationId) {
    try {
      const keys = [
        this.getStorageKey(conversationId, "tree"),
        this.getStorageKey(conversationId, "customizations"),
        this.getStorageKey(conversationId, "metadata"),
      ];

      for (const key of keys) {
        localStorage.removeItem(key);
      }

      console.log(`Cleared all data for conversation ${conversationId}`);
      return true;
    } catch (error) {
      console.error("Failed to clear conversation data:", error);
      return false;
    }
  }

  /**
   * Get storage statistics
   * @returns {Object} Storage statistics
   */
  getStorageStats() {
    const keys = Object.keys(localStorage).filter((key) =>
      key.startsWith(this.storagePrefix)
    );

    let totalSize = 0;
    const conversations = new Set();

    for (const key of keys) {
      const data = localStorage.getItem(key);
      totalSize += this.getDataSize(data);

      // Extract conversation ID from key
      const match = key.match(new RegExp(`${this.storagePrefix}([^_]+)_`));
      if (match) {
        conversations.add(match[1]);
      }
    }

    return {
      totalEntries: keys.length,
      totalSize,
      conversationCount: conversations.size,
      storageUsagePercent: (totalSize / this.maxStorageSize) * 100,
    };
  }
}

// ============================================================================
// TREE BUILDER CLASS
// ============================================================================

class TreeBuilder {
  constructor() {
    this.nodes = new Map(); // nodeId -> BranchNode
    this.edges = new Map(); // parentId -> [childId1, childId2, ...]
    this.currentPath = []; // [nodeId1, nodeId2, ...] - active conversation path
    this.rootBranches = []; // [nodeId1, nodeId2, ...] - top-level branch points
  }

  /**
   * Add a node to the tree
   * @param {Object} nodeData - Branch node data from BranchDetector
   * @returns {string} The node ID
   */
  addNode(nodeData) {
    const nodeId = nodeData.turnId;

    // Create enhanced node with tree-specific properties
    const treeNode = {
      ...nodeData,
      id: nodeId,
      children: [],
      parent: null,
      isRoot: false,
      depth: 0,
    };

    this.nodes.set(nodeId, treeNode);
    console.log("Added node to tree:", nodeId);

    return nodeId;
  }

  /**
   * Link two nodes with parent-child relationship
   * @param {string} parentId - Parent node ID
   * @param {string} childId - Child node ID
   */
  linkNodes(parentId, childId) {
    // Add to edges map
    if (!this.edges.has(parentId)) {
      this.edges.set(parentId, []);
    }

    const children = this.edges.get(parentId);
    if (!children.includes(childId)) {
      children.push(childId);
    }

    // Update node relationships
    const parentNode = this.nodes.get(parentId);
    const childNode = this.nodes.get(childId);

    if (parentNode && childNode) {
      if (!parentNode.children.includes(childId)) {
        parentNode.children.push(childId);
      }
      childNode.parent = parentId;
      childNode.depth = parentNode.depth + 1;
    }

    console.log(`Linked nodes: ${parentId} -> ${childId}`);
  }

  /**
   * Update the current conversation path
   * @param {string[]} path - Array of node IDs representing the active path
   */
  updateCurrentPath(path) {
    const oldPath = [...this.currentPath];
    this.currentPath = [...path];
    console.log("Updated current path:", this.currentPath);

    // Notify callbacks
    this.notifyPathChanged(this.currentPath, oldPath);
  }

  /**
   * Find and identify root branches (top-level branch points)
   * @returns {string[]} Array of root branch node IDs
   */
  findRootBranches() {
    const rootBranches = [];

    for (const [nodeId, node] of this.nodes) {
      // A root branch is a branch point with no parent that's also a branch
      if (!node.parent && node.totalVariants > 1) {
        rootBranches.push(nodeId);
        node.isRoot = true;
      }

      // Also consider branches that are direct children of non-branching nodes
      if (node.parent) {
        const parentNode = this.nodes.get(node.parent);
        if (
          parentNode &&
          parentNode.totalVariants === 1 &&
          node.totalVariants > 1
        ) {
          // This is effectively a root branch in terms of UI
          if (!rootBranches.includes(nodeId)) {
            rootBranches.push(nodeId);
            node.isRoot = true;
          }
        }
      }
    }

    this.rootBranches = rootBranches;
    console.log("Found root branches:", this.rootBranches);
    return this.rootBranches;
  }

  /**
   * Get sub-branches (children) for a given node
   * @param {string} nodeId - Parent node ID
   * @returns {string[]} Array of child node IDs
   */
  getSubBranches(nodeId) {
    return this.edges.get(nodeId) || [];
  }

  /**
   * Get all variants of a specific turn (siblings in the tree)
   * @param {string} nodeId - Node ID to find siblings for
   * @returns {string[]} Array of sibling node IDs (including the node itself)
   */
  getTurnVariants(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return [nodeId];

    const variants = [];

    // If it has a parent, get all children of that parent at the same turn index
    if (node.parent) {
      const siblings = this.getSubBranches(node.parent);
      for (const siblingId of siblings) {
        const sibling = this.nodes.get(siblingId);
        if (sibling && sibling.turnIndex === node.turnIndex) {
          variants.push(siblingId);
        }
      }
    } else {
      // If no parent, look for other root nodes at the same turn index
      for (const [otherId, otherNode] of this.nodes) {
        if (otherNode.turnIndex === node.turnIndex && !otherNode.parent) {
          variants.push(otherId);
        }
      }
    }

    // If no variants found, at least include the node itself
    if (variants.length === 0) {
      variants.push(nodeId);
    }

    return variants;
  }

  /**
   * Find path from root to a specific node
   * @param {string} targetNodeId - Target node ID
   * @returns {string[]} Array of node IDs from root to target
   */
  findPathToNode(targetNodeId) {
    const path = [];
    let currentNodeId = targetNodeId;

    // Walk up the tree to build path
    while (currentNodeId) {
      path.unshift(currentNodeId);
      const node = this.nodes.get(currentNodeId);
      currentNodeId = node?.parent || null;
    }

    return path;
  }

  /**
   * Get node by ID
   * @param {string} nodeId - Node ID
   * @returns {Object|null} Node data or null if not found
   */
  getNode(nodeId) {
    return this.nodes.get(nodeId) || null;
  }

  /**
   * Get all nodes
   * @returns {Object[]} Array of all nodes
   */
  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  /**
   * Build tree structure from detected branches
   * @param {Object[]} branches - Array of branch data from BranchDetector
   */
  buildFromBranches(branches) {
    console.log("Building tree from branches:", branches);

    // Clear existing tree
    this.clear();

    // Add all nodes first
    for (const branch of branches) {
      this.addNode(branch);
    }

    // Sort branches by turn index to process in order
    const sortedBranches = [...branches].sort(
      (a, b) => a.turnIndex - b.turnIndex
    );

    // Build relationships based on turn sequence and conversation flow
    for (let i = 0; i < sortedBranches.length; i++) {
      const currentBranch = sortedBranches[i];

      // Look for parent (previous turn in conversation)
      for (let j = i - 1; j >= 0; j--) {
        const potentialParent = sortedBranches[j];

        // Parent should be the most recent previous turn
        if (potentialParent.turnIndex < currentBranch.turnIndex) {
          this.linkNodes(potentialParent.turnId, currentBranch.turnId);
          break;
        }
      }
    }

    // Identify root branches
    this.findRootBranches();

    console.log("Tree built successfully:", this.getTreeSummary());

    // Notify callbacks
    this.notifyTreeUpdated();
  }

  /**
   * Update tree when a branch changes (e.g., user navigates to different variant)
   * @param {Object} updatedBranch - Updated branch data
   */
  updateBranch(updatedBranch) {
    const nodeId = updatedBranch.turnId;
    const existingNode = this.nodes.get(nodeId);

    if (existingNode) {
      // Update existing node
      Object.assign(existingNode, updatedBranch);
      console.log("Updated existing node:", nodeId);

      // Notify callbacks
      this.notifyTreeUpdated();
    } else {
      // Add new node and try to link it appropriately
      this.addNode(updatedBranch);

      // Try to find appropriate parent based on turn index
      let parentId = null;
      let closestTurnIndex = -1;

      for (const [otherId, otherNode] of this.nodes) {
        if (
          otherNode.turnIndex < updatedBranch.turnIndex &&
          otherNode.turnIndex > closestTurnIndex
        ) {
          closestTurnIndex = otherNode.turnIndex;
          parentId = otherId;
        }
      }

      if (parentId) {
        this.linkNodes(parentId, nodeId);
      }

      // Re-identify root branches
      this.findRootBranches();

      console.log("Added new node to tree:", nodeId);

      // Notify callbacks
      this.notifyTreeUpdated();
    }
  }

  /**
   * Clear the entire tree
   */
  clear() {
    this.nodes.clear();
    this.edges.clear();
    this.currentPath = [];
    this.rootBranches = [];
    console.log("Tree cleared");
  }

  /**
   * Get tree summary for debugging
   * @returns {Object} Tree summary
   */
  getTreeSummary() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      rootBranches: this.rootBranches.length,
      currentPathLength: this.currentPath.length,
      nodes: Array.from(this.nodes.keys()),
      edges: Object.fromEntries(this.edges),
    };
  }

  /**
   * Export tree data for storage
   * @returns {Object} Serializable tree data
   */
  exportData() {
    return {
      nodes: Object.fromEntries(this.nodes),
      edges: Object.fromEntries(this.edges),
      currentPath: this.currentPath,
      rootBranches: this.rootBranches,
    };
  }

  /**
   * Get tree state for callbacks (compatible with StorageManager)
   * @returns {Object} Tree state data
   */
  getTreeState() {
    return {
      nodeCount: this.nodes.size,
      edgeCount: this.edges.size,
      rootBranches: this.rootBranches,
      currentPath: this.currentPath,
      nodes: Array.from(this.nodes.entries()),
      edges: Array.from(this.edges.entries()),
    };
  }

  /**
   * Register callback for tree updates
   * @param {Function} callback - Callback function
   */
  onTreeUpdated(callback) {
    if (typeof callback === "function") {
      this.callbacks = this.callbacks || {
        onTreeUpdated: [],
        onPathChanged: [],
      };
      this.callbacks.onTreeUpdated.push(callback);
    }
  }

  /**
   * Register callback for path changes
   * @param {Function} callback - Callback function
   */
  onPathChanged(callback) {
    if (typeof callback === "function") {
      this.callbacks = this.callbacks || {
        onTreeUpdated: [],
        onPathChanged: [],
      };
      this.callbacks.onPathChanged.push(callback);
    }
  }

  /**
   * Notify tree updated callbacks
   */
  notifyTreeUpdated() {
    if (this.callbacks && this.callbacks.onTreeUpdated) {
      this.callbacks.onTreeUpdated.forEach((callback) => {
        try {
          callback(this.getTreeState());
        } catch (error) {
          console.error("Error in onTreeUpdated callback:", error);
        }
      });
    }
  }

  /**
   * Notify path changed callbacks
   */
  notifyPathChanged(newPath, oldPath) {
    if (this.callbacks && this.callbacks.onPathChanged) {
      this.callbacks.onPathChanged.forEach((callback) => {
        try {
          callback(newPath, oldPath);
        } catch (error) {
          console.error("Error in onPathChanged callback:", error);
        }
      });
    }
  }

  /**
   * Import tree data from storage
   * @param {Object} data - Tree data to import
   */
  importData(data) {
    this.clear();

    if (data.nodes) {
      this.nodes = new Map(Object.entries(data.nodes));
    }
    if (data.edges) {
      this.edges = new Map(Object.entries(data.edges));
    }
    if (data.currentPath) {
      this.currentPath = data.currentPath;
    }
    if (data.rootBranches) {
      this.rootBranches = data.rootBranches;
    }

    console.log("Imported tree data:", this.getTreeSummary());
  }
}

// ============================================================================
// BRANCH DETECTOR CLASS
// ============================================================================

class BranchDetector {
  constructor() {
    this.detectedBranches = new Map(); // turnId -> branch info
    this.callbacks = {
      onBranchDetected: [],
      onBranchUpdated: [],
    };
  }

  /**
   * Detect branches in the provided turn elements
   * @param {Element[]} turnElements - Array of turn elements to analyze
   * @returns {Object[]} Array of detected branch information
   */
  detectBranches(turnElements) {
    console.log(`Analyzing ${turnElements.length} turns for branches...`);
    const branches = [];

    turnElements.forEach((turn, index) => {
      const branchInfo = this.analyzeTurn(turn, index);
      if (branchInfo) {
        branches.push(branchInfo);

        // Store in detected branches map
        this.detectedBranches.set(branchInfo.turnId, branchInfo);

        // Notify callbacks
        this.callbacks.onBranchDetected.forEach((callback) => {
          try {
            callback(branchInfo);
          } catch (error) {
            console.error("Error in onBranchDetected callback:", error);
          }
        });
      }
    });

    console.log(`Detected ${branches.length} branches`);
    return branches;
  }

  /**
   * Analyze a single turn for branch indicators
   * @param {Element} turnElement - The turn element to analyze
   * @param {number} index - Turn index in conversation
   * @returns {Object|null} Branch information or null if no branch detected
   */
  analyzeTurn(turnElement, index) {
    // Look for variant indicators
    const variantInfo = this.parseVariantInfo(turnElement);

    if (!variantInfo) {
      return null; // No branch detected
    }

    // Verify navigation controls are present
    const hasNavControls = this.verifyNavigationControls(turnElement);
    console.log(`Turn ${index} has nav controls:`, hasNavControls);

    if (!hasNavControls) {
      console.warn(
        "Found variant indicator but no navigation controls:",
        variantInfo
      );
      return null;
    }

    // Generate stable turn ID
    const turnId = generateTurnId(turnElement, index);

    // Classify turn role
    const role = this.classifyTurnRole(turnElement);

    // Extract content preview
    const preview = this.extractContentPreview(turnElement);

    // Create branch information object
    const branchInfo = {
      turnId,
      turnIndex: index,
      currentVariant: variantInfo.current,
      totalVariants: variantInfo.total,
      role,
      preview,
      element: turnElement,
      timestamp: Date.now(),
      textHash: this.generateContentHash(turnElement),
    };

    console.log("Detected branch:", branchInfo);
    return branchInfo;
  }

  /**
   * Parse variant information from turn element
   * @param {Element} turnElement - The turn element
   * @returns {Object|null} Variant info {current, total} or null if not found
   */
  parseVariantInfo(turnElement) {
    // Look for .tabular-nums element with pattern like "1/2"
    const variantCounter = turnElement.querySelector(".tabular-nums");

    if (!variantCounter) {
      return null;
    }

    const counterText = variantCounter.textContent?.trim();
    console.log("Found tabular-nums text:", counterText);

    if (!counterText) {
      return null;
    }

    // Match pattern like "1/2", "2/3", etc.
    const match = counterText.match(/^(\d+)\/(\d+)$/);
    console.log("Regex match result:", match);

    if (!match) {
      return null;
    }

    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);

    // Validate numbers make sense
    if (current < 1 || total < 2 || current > total) {
      console.warn("Invalid variant numbers:", { current, total, counterText });
      return null;
    }

    console.log("Parsed variant info:", { current, total });
    return { current, total };
  }

  /**
   * Verify that navigation controls are present
   * @param {Element} turnElement - The turn element
   * @returns {boolean} True if navigation controls are found
   */
  verifyNavigationControls(turnElement) {
    const prevButton = turnElement.querySelector(
      'button[aria-label="Previous response"]'
    );
    const nextButton = turnElement.querySelector(
      'button[aria-label="Next response"]'
    );

    console.log("Navigation controls check:", {
      prevButton: !!prevButton,
      nextButton: !!nextButton,
      hasEither: !!(prevButton || nextButton),
    });

    // At least one navigation button should be present
    // (Previous might be disabled on first variant, Next might be disabled on last)
    return !!(prevButton || nextButton);
  }

  /**
   * Classify the role of a turn (user or assistant)
   * @param {Element} turnElement - The turn element
   * @returns {string} 'user' or 'assistant'
   */
  classifyTurnRole(turnElement) {
    // Method 1: Check for data attributes that might indicate role
    const dataRole = turnElement.getAttribute("data-role");
    if (dataRole === "user" || dataRole === "assistant") {
      return dataRole;
    }

    // Method 2: Look for role indicators in aria-labels
    const ariaLabel = turnElement.getAttribute("aria-label") || "";
    if (ariaLabel.toLowerCase().includes("user")) {
      return "user";
    }
    if (
      ariaLabel.toLowerCase().includes("assistant") ||
      ariaLabel.toLowerCase().includes("chatgpt")
    ) {
      return "assistant";
    }

    // Method 3: Check for navigation buttons (typically only on assistant messages)
    const hasNavButtons = this.verifyNavigationControls(turnElement);
    if (hasNavButtons) {
      return "assistant"; // Navigation controls are typically on assistant responses
    }

    // Method 4: Look for edit button (typically only on user messages)
    const editButton = turnElement.querySelector(
      'button[aria-label="Edit message"]'
    );
    if (editButton) {
      return "user";
    }

    // Method 5: Check DOM structure/positioning
    // Look for common class patterns or structural indicators
    const className = turnElement.className || "";
    if (className.includes("user")) {
      return "user";
    }
    if (className.includes("assistant") || className.includes("bot")) {
      return "assistant";
    }

    // Method 6: Check parent structure for layout clues
    const parent = turnElement.parentElement;
    if (parent) {
      const parentClass = parent.className || "";
      if (parentClass.includes("user")) {
        return "user";
      }
      if (parentClass.includes("assistant") || parentClass.includes("bot")) {
        return "assistant";
      }
    }

    // Default fallback: if we found variant controls, it's likely an assistant message
    console.warn("Could not determine turn role, defaulting to assistant");
    return "assistant";
  }

  /**
   * Extract content preview from turn element
   * @param {Element} turnElement - The turn element
   * @returns {string} Content preview (first ~120 characters)
   */
  extractContentPreview(turnElement) {
    // Try to find the main content area, avoiding buttons and controls
    let contentElement = turnElement;

    // Look for common content selectors
    const contentSelectors = [
      ".message-content",
      ".turn-content",
      "[data-message-content]",
      "p",
      'div[class*="content"]',
    ];

    for (const selector of contentSelectors) {
      const found = turnElement.querySelector(selector);
      if (found) {
        contentElement = found;
        break;
      }
    }

    // Extract text content, clean it up
    let text = contentElement.textContent || "";

    // Remove extra whitespace and newlines
    text = text.replace(/\s+/g, " ").trim();

    // Truncate to reasonable preview length
    const maxLength = 120;
    if (text.length > maxLength) {
      text = text.substring(0, maxLength) + "...";
    }

    return text || "[No content]";
  }

  /**
   * Generate content hash for change detection
   * @param {Element} turnElement - The turn element
   * @returns {string} Content hash
   */
  generateContentHash(turnElement) {
    const content = this.extractContentPreview(turnElement);
    return simpleHash(content);
  }

  /**
   * Update branch information when variant changes
   * @param {string} turnId - The turn ID
   * @param {Object} updates - Updates to apply
   */
  updateBranch(turnId, updates) {
    const existing = this.detectedBranches.get(turnId);
    if (!existing) {
      console.warn("Attempted to update non-existent branch:", turnId);
      return;
    }

    const updated = { ...existing, ...updates, timestamp: Date.now() };
    this.detectedBranches.set(turnId, updated);

    // Notify callbacks
    this.callbacks.onBranchUpdated.forEach((callback) => {
      try {
        callback(updated, existing);
      } catch (error) {
        console.error("Error in onBranchUpdated callback:", error);
      }
    });

    console.log("Updated branch:", updated);
  }

  /**
   * Get all detected branches
   * @returns {Object[]} Array of all detected branch information
   */
  getAllBranches() {
    return Array.from(this.detectedBranches.values());
  }

  /**
   * Get branch by turn ID
   * @param {string} turnId - The turn ID
   * @returns {Object|null} Branch information or null if not found
   */
  getBranch(turnId) {
    return this.detectedBranches.get(turnId) || null;
  }

  /**
   * Register callback for branch detection
   * @param {Function} callback - Callback function
   */
  onBranchDetected(callback) {
    if (typeof callback === "function") {
      this.callbacks.onBranchDetected.push(callback);
    }
  }

  /**
   * Register callback for branch updates
   * @param {Function} callback - Callback function
   */
  onBranchUpdated(callback) {
    if (typeof callback === "function") {
      this.callbacks.onBranchUpdated.push(callback);
    }
  }

  /**
   * Clear all detected branches (useful for page navigation)
   */
  clear() {
    this.detectedBranches.clear();
    console.log("Cleared all detected branches");
  }

  /**
   * Get current state for debugging
   * @returns {Object} Current detector state
   */
  getState() {
    return {
      branchCount: this.detectedBranches.size,
      branches: this.getAllBranches(),
      callbackCount: {
        onBranchDetected: this.callbacks.onBranchDetected.length,
        onBranchUpdated: this.callbacks.onBranchUpdated.length,
      },
    };
  }
}

// ============================================================================
// DOM OBSERVER CLASS
// ============================================================================

class DOMObserver {
  constructor() {
    this.observer = null;
    this.conversationContainer = null;
    this.isInitialized = false;
    this.callbacks = {
      onTurnsChanged: [],
      onVariantChanged: [],
      onNewBranch: [],
      onBranchNavigation: [],
    };

    // Throttling for performance
    this.lastScanTime = 0;
    this.scanThrottleMs = 100; // Minimum time between scans

    // State tracking for incremental updates
    this.lastTurnCount = 0;
    this.lastVariantStates = new Map(); // turnId -> { current, total }
    this.pendingUpdates = new Set(); // Track pending update operations

    // Debouncing for batch updates
    this.updateTimeout = null;
    this.batchUpdateDelay = 50; // ms to wait before processing batched updates
  }

  /**
   * Initialize the DOM observer
   * @returns {boolean} True if successfully initialized
   */
  initialize() {
    console.log("Initializing DOM Observer...");

    // Find conversation container
    this.conversationContainer = findConversationContainer();
    if (!this.conversationContainer) {
      console.error(
        "Cannot initialize DOM Observer: conversation container not found"
      );
      return false;
    }

    // Set up MutationObserver
    this.observer = new MutationObserver((mutations) => {
      this.onMutation(mutations);
    });

    // Start observing
    this.observer.observe(this.conversationContainer, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "data-testid", "aria-label"],
    });

    // Perform initial scan
    this.scanVisibleTurns();

    this.isInitialized = true;
    console.log("DOM Observer initialized successfully");
    return true;
  }

  /**
   * Handle DOM mutations with enhanced variant detection
   * @param {MutationRecord[]} mutations - Array of mutation records
   */
  onMutation(mutations) {
    // Throttle scanning to avoid excessive processing
    const now = Date.now();
    if (now - this.lastScanTime < this.scanThrottleMs) {
      // Queue update for later if we're throttling
      this.queueBatchedUpdate();
      return;
    }
    this.lastScanTime = now;

    let detectedChanges = {
      newTurns: false,
      variantChanges: [],
      removedTurns: false,
      structuralChanges: false,
    };

    for (const mutation of mutations) {
      // Handle new nodes (new turns or content)
      if (mutation.type === "childList") {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (
                this.isLikelyTurnElement(node) ||
                this.containsTurnElements(node)
              ) {
                detectedChanges.newTurns = true;
                console.log("Detected new turn element added");
              }

              // Check for new variant indicators
              if (node.querySelector && node.querySelector(".tabular-nums")) {
                detectedChanges.structuralChanges = true;
                console.log("Detected new variant indicator");
              }
            }
          }
        }

        if (mutation.removedNodes.length > 0) {
          for (const node of mutation.removedNodes) {
            if (
              node.nodeType === Node.ELEMENT_NODE &&
              this.isLikelyTurnElement(node)
            ) {
              detectedChanges.removedTurns = true;
              console.log("Detected turn element removed");
            }
          }
        }
      }

      // Handle attribute changes (variant navigation)
      if (mutation.type === "attributes") {
        const target = mutation.target;
        const attributeName = mutation.attributeName;

        // Detect variant counter changes
        if (target.classList?.contains("tabular-nums")) {
          const variantChange = this.detectVariantChange(target);
          if (variantChange) {
            detectedChanges.variantChanges.push(variantChange);
            console.log("Detected variant navigation:", variantChange);
          }
        }

        // Detect button state changes (Previous/Next response buttons)
        if (attributeName === "aria-label" || attributeName === "disabled") {
          const ariaLabel = target.getAttribute("aria-label") || "";
          if (
            ariaLabel.includes("Previous response") ||
            ariaLabel.includes("Next response")
          ) {
            detectedChanges.structuralChanges = true;
            console.log("Detected navigation button state change");
          }
        }

        // Detect class changes that might indicate UI state changes
        if (attributeName === "class") {
          const newClasses = target.className || "";
          if (
            newClasses.includes("tabular-nums") ||
            newClasses.includes("response") ||
            newClasses.includes("variant")
          ) {
            detectedChanges.structuralChanges = true;
          }
        }
      }
    }

    // Process detected changes
    this.processDetectedChanges(detectedChanges);
  }

  /**
   * Process detected changes and trigger appropriate callbacks
   * @param {Object} changes - Detected changes object
   */
  processDetectedChanges(changes) {
    // Handle variant changes first (most specific)
    if (changes.variantChanges.length > 0) {
      for (const variantChange of changes.variantChanges) {
        this.notifyVariantChanged(variantChange);
      }
    }

    // Handle structural changes (new/removed turns, new branches)
    if (changes.newTurns || changes.removedTurns || changes.structuralChanges) {
      console.log("Processing structural changes:", changes);
      this.queueBatchedUpdate();
    }
  }

  /**
   * Detect variant navigation from tabular-nums element
   * @param {Element} tabularElement - The .tabular-nums element
   * @returns {Object|null} Variant change info or null
   */
  detectVariantChange(tabularElement) {
    const counterText = tabularElement.textContent?.trim();
    if (!counterText) return null;

    const match = counterText.match(/^(\d+)\/(\d+)$/);
    if (!match) return null;

    const current = parseInt(match[1], 10);
    const total = parseInt(match[2], 10);

    // Find the turn element this belongs to
    const turnElement = this.findParentTurnElement(tabularElement);
    if (!turnElement) return null;

    const turnId = generateTurnId(turnElement, -1); // Index will be determined later

    // Check if this is actually a change
    const lastState = this.lastVariantStates.get(turnId);
    if (
      lastState &&
      lastState.current === current &&
      lastState.total === total
    ) {
      return null; // No actual change
    }

    // Update our tracking
    this.lastVariantStates.set(turnId, { current, total });

    return {
      turnId,
      turnElement,
      previousVariant: lastState?.current || null,
      currentVariant: current,
      totalVariants: total,
      timestamp: Date.now(),
    };
  }

  /**
   * Find parent turn element for a given element
   * @param {Element} element - Child element
   * @returns {Element|null} Parent turn element
   */
  findParentTurnElement(element) {
    let current = element;
    const maxLevels = 10; // Prevent infinite loops

    for (let i = 0; i < maxLevels && current; i++) {
      if (this.isLikelyTurnElement(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return null;
  }

  /**
   * Check if element contains turn elements
   * @param {Element} element - Element to check
   * @returns {boolean} True if contains turn elements
   */
  containsTurnElements(element) {
    if (!element.querySelector) return false;

    const turnSelectors = [
      '[data-testid="conversation-turn"]',
      "article",
      'li[role="listitem"]',
    ];

    for (const selector of turnSelectors) {
      if (element.querySelector(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Queue a batched update to avoid excessive processing
   */
  queueBatchedUpdate() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.processBatchedUpdate();
      this.updateTimeout = null;
    }, this.batchUpdateDelay);
  }

  /**
   * Process batched updates
   */
  processBatchedUpdate() {
    console.log("Processing batched DOM updates...");
    this.scanVisibleTurns();
  }

  /**
   * Notify callbacks about variant changes
   * @param {Object} variantChange - Variant change information
   */
  notifyVariantChanged(variantChange) {
    this.callbacks.onVariantChanged.forEach((callback) => {
      try {
        callback(variantChange);
      } catch (error) {
        console.error("Error in onVariantChanged callback:", error);
      }
    });

    // Also notify branch navigation callbacks
    this.callbacks.onBranchNavigation.forEach((callback) => {
      try {
        callback(variantChange);
      } catch (error) {
        console.error("Error in onBranchNavigation callback:", error);
      }
    });
  }

  /**
   * Scan visible turns and notify callbacks with incremental updates
   */
  scanVisibleTurns() {
    const turns = findConversationTurns();
    const currentTurnCount = turns.length;

    console.log(`Scanned ${currentTurnCount} conversation turns`);

    // Check for incremental changes
    const incrementalUpdate = this.analyzeIncrementalChanges(turns);

    // Update our state tracking
    this.lastTurnCount = currentTurnCount;
    this.updateVariantStateTracking(turns);

    // Notify callbacks about turn changes
    this.callbacks.onTurnsChanged.forEach((callback) => {
      try {
        callback(turns, incrementalUpdate);
      } catch (error) {
        console.error("Error in onTurnsChanged callback:", error);
      }
    });

    // Notify about new branches if detected
    if (incrementalUpdate.newBranches.length > 0) {
      this.callbacks.onNewBranch.forEach((callback) => {
        try {
          callback(incrementalUpdate.newBranches);
        } catch (error) {
          console.error("Error in onNewBranch callback:", error);
        }
      });
    }
  }

  /**
   * Analyze incremental changes in turns
   * @param {Element[]} currentTurns - Current turn elements
   * @returns {Object} Incremental update information
   */
  analyzeIncrementalChanges(currentTurns) {
    const update = {
      isIncremental: currentTurns.length >= this.lastTurnCount,
      newTurns: [],
      newBranches: [],
      changedVariants: [],
      totalTurns: currentTurns.length,
      previousTurnCount: this.lastTurnCount,
    };

    // If we have more turns than before, identify new ones
    if (currentTurns.length > this.lastTurnCount) {
      const newTurnCount = currentTurns.length - this.lastTurnCount;
      update.newTurns = currentTurns.slice(-newTurnCount);

      console.log(`Detected ${newTurnCount} new turns`);

      // Check if any new turns have branch indicators
      for (const turn of update.newTurns) {
        if (turn.querySelector(".tabular-nums")) {
          update.newBranches.push(turn);
        }
      }
    }

    // Check for variant changes in existing turns
    for (
      let i = 0;
      i < Math.min(currentTurns.length, this.lastTurnCount);
      i++
    ) {
      const turn = currentTurns[i];
      const variantElement = turn.querySelector(".tabular-nums");

      if (variantElement) {
        const turnId = generateTurnId(turn, i);
        const counterText = variantElement.textContent?.trim();
        const match = counterText?.match(/^(\d+)\/(\d+)$/);

        if (match) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          const lastState = this.lastVariantStates.get(turnId);

          if (
            !lastState ||
            lastState.current !== current ||
            lastState.total !== total
          ) {
            update.changedVariants.push({
              turnId,
              turnElement: turn,
              turnIndex: i,
              previousState: lastState,
              currentState: { current, total },
            });
          }
        }
      }
    }

    return update;
  }

  /**
   * Update variant state tracking for all turns
   * @param {Element[]} turns - Current turn elements
   */
  updateVariantStateTracking(turns) {
    // Clear old states for turns that no longer exist
    const currentTurnIds = new Set();

    turns.forEach((turn, index) => {
      const turnId = generateTurnId(turn, index);
      currentTurnIds.add(turnId);

      const variantElement = turn.querySelector(".tabular-nums");
      if (variantElement) {
        const counterText = variantElement.textContent?.trim();
        const match = counterText?.match(/^(\d+)\/(\d+)$/);

        if (match) {
          const current = parseInt(match[1], 10);
          const total = parseInt(match[2], 10);
          this.lastVariantStates.set(turnId, { current, total });
        }
      }
    });

    // Remove tracking for turns that no longer exist
    for (const [turnId] of this.lastVariantStates) {
      if (!currentTurnIds.has(turnId)) {
        this.lastVariantStates.delete(turnId);
      }
    }
  }

  /**
   * Check if an element is likely a conversation turn
   * @param {Element} element - Element to check
   * @returns {boolean} True if likely a turn element
   */
  isLikelyTurnElement(element) {
    // Check for common turn element patterns
    const turnSelectors = [
      '[data-testid="conversation-turn"]',
      "article",
      'li[role="listitem"]',
    ];

    for (const selector of turnSelectors) {
      if (element.matches && element.matches(selector)) {
        return true;
      }
    }

    // Check for turn-like class names
    const className = element.className || "";
    const turnKeywords = ["turn", "message", "conversation"];
    return turnKeywords.some((keyword) =>
      className.toLowerCase().includes(keyword)
    );
  }

  /**
   * Register callback for turn changes
   * @param {Function} callback - Callback function that receives array of turn elements
   */
  onTurnsChanged(callback) {
    if (typeof callback === "function") {
      this.callbacks.onTurnsChanged.push(callback);
    }
  }

  /**
   * Register callback for variant changes
   * @param {Function} callback - Callback function for variant changes
   */
  onVariantChanged(callback) {
    if (typeof callback === "function") {
      this.callbacks.onVariantChanged.push(callback);
    }
  }

  /**
   * Register callback for new branch detection
   * @param {Function} callback - Callback function for new branches
   */
  onNewBranch(callback) {
    if (typeof callback === "function") {
      this.callbacks.onNewBranch.push(callback);
    }
  }

  /**
   * Register callback for branch navigation
   * @param {Function} callback - Callback function for branch navigation
   */
  onBranchNavigation(callback) {
    if (typeof callback === "function") {
      this.callbacks.onBranchNavigation.push(callback);
    }
  }

  /**
   * Disconnect the observer and clean up state
   */
  disconnect() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    // Clean up timers
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    // Clear state tracking
    this.lastVariantStates.clear();
    this.pendingUpdates.clear();
    this.lastTurnCount = 0;

    this.isInitialized = false;
    console.log("DOM Observer disconnected and cleaned up");
  }

  /**
   * Get current state
   * @returns {Object} Current observer state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      hasContainer: !!this.conversationContainer,
      lastTurnCount: this.lastTurnCount,
      trackedVariants: this.lastVariantStates.size,
      pendingUpdates: this.pendingUpdates.size,
      callbackCount: {
        onTurnsChanged: this.callbacks.onTurnsChanged.length,
        onVariantChanged: this.callbacks.onVariantChanged.length,
        onNewBranch: this.callbacks.onNewBranch.length,
        onBranchNavigation: this.callbacks.onBranchNavigation.length,
      },
    };
  }
}

// ============================================================================
// TAB RENDERER CLASS
// ============================================================================

class TabRenderer {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.tabs = new Map(); // tabId -> { element, data }
    this.activeTabId = null;
    this.tabsContainer = null;

    // Tab generation settings
    this.maxTabNameLength = 25;
    this.defaultTabNames = [
      "Main Branch",
      "Alternative",
      "Option A",
      "Option B",
      "Variant",
      "Branch A",
      "Branch B",
      "Path 1",
      "Path 2",
      "Approach",
    ];

    // Event handlers
    this.boundHandlers = {
      onTabClick: this.handleTabClick.bind(this),
      onTabHover: this.handleTabHover.bind(this),
      onTabLeave: this.handleTabLeave.bind(this),
    };
  }

  /**
   * Initialize the tab renderer
   * @param {Element} tabsContainer - Container element for tabs
   */
  initialize(tabsContainer) {
    this.tabsContainer = tabsContainer;
    console.log("Tab Renderer initialized");
  }

  /**
   * Render tabs from tree data
   * @param {Object} treeData - Tree data from TreeBuilder
   * @param {Object} customizations - User customizations from storage
   */
  async renderTabs(treeData, customizations = {}) {
    if (!this.tabsContainer) {
      console.warn("Tab container not available for rendering");
      return;
    }

    console.log("Rendering tabs from tree data:", treeData);

    // Get root branches from tree data
    const rootBranches = this.extractRootBranches(treeData);

    if (rootBranches.length === 0) {
      console.log("No root branches found, clearing tabs");
      this.clearTabs();
      return;
    }

    // Create tabs for each root branch
    const newTabs = new Map();

    for (let i = 0; i < rootBranches.length; i++) {
      const branch = rootBranches[i];
      const tabData = this.createTabData(branch, i, customizations);
      const tabElement = this.createTabElement(tabData);

      newTabs.set(tabData.id, {
        element: tabElement,
        data: tabData,
      });
    }

    // Update DOM efficiently
    this.updateTabsDOM(newTabs);

    // Set active tab if none is set
    if (!this.activeTabId && newTabs.size > 0) {
      const firstTabId = Array.from(newTabs.keys())[0];
      this.setActiveTab(firstTabId);
    }

    console.log(`Rendered ${newTabs.size} tabs`);
  }

  /**
   * Extract root branches from tree data
   * @param {Object} treeData - Tree data
   * @returns {Array} Root branch data
   */
  extractRootBranches(treeData) {
    if (!treeData || !treeData.nodes) {
      return [];
    }

    const rootBranches = [];

    // If we have rootBranches array, use that
    if (treeData.rootBranches && Array.isArray(treeData.rootBranches)) {
      for (const nodeId of treeData.rootBranches) {
        const nodeData = this.findNodeById(treeData.nodes, nodeId);
        if (nodeData) {
          rootBranches.push(nodeData);
        }
      }
    } else {
      // Fallback: find nodes with variants > 1 and no parent
      for (const [nodeId, nodeData] of treeData.nodes) {
        if (
          nodeData.totalVariants > 1 &&
          (!nodeData.parent || nodeData.isRoot)
        ) {
          rootBranches.push(nodeData);
        }
      }
    }

    // Sort by turn index
    rootBranches.sort((a, b) => (a.turnIndex || 0) - (b.turnIndex || 0));

    return rootBranches;
  }

  /**
   * Find node by ID in nodes array
   * @param {Array} nodes - Nodes array from tree data
   * @param {string} nodeId - Node ID to find
   * @returns {Object|null} Node data or null
   */
  findNodeById(nodes, nodeId) {
    if (Array.isArray(nodes)) {
      for (const [id, data] of nodes) {
        if (id === nodeId) {
          return { ...data, id };
        }
      }
    }
    return null;
  }

  /**
   * Create tab data object
   * @param {Object} branchData - Branch data from tree
   * @param {number} index - Tab index
   * @param {Object} customizations - User customizations
   * @returns {Object} Tab data
   */
  createTabData(branchData, index, customizations) {
    const tabId = branchData.turnId || branchData.id || `tab-${index}`;
    const branchCustom = customizations.branches?.[tabId] || {};

    // Generate tab name
    let tabName = branchCustom.name;
    if (!tabName) {
      tabName = this.generateTabName(branchData, index);
    }

    // Truncate if too long
    if (tabName.length > this.maxTabNameLength) {
      tabName = tabName.substring(0, this.maxTabNameLength - 3) + "...";
    }

    return {
      id: tabId,
      name: tabName,
      color:
        branchCustom.color ||
        customizations.preferences?.defaultTabColor ||
        "blue",
      variantCount: branchData.totalVariants || 1,
      currentVariant: branchData.currentVariant || 1,
      turnIndex: branchData.turnIndex || 0,
      role: branchData.role || "assistant",
      preview: branchData.preview || "",
      isActive: false,
      branchData,
    };
  }

  /**
   * Generate a tab name from branch data
   * @param {Object} branchData - Branch data
   * @param {number} index - Tab index
   * @returns {string} Generated tab name
   */
  generateTabName(branchData, index) {
    // Try to extract meaningful name from content preview
    if (branchData.preview) {
      const preview = branchData.preview.trim();

      // Look for question or statement patterns
      const questionMatch = preview.match(
        /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does|did)\s+.{0,20}/i
      );
      if (questionMatch) {
        return this.capitalizeFirst(questionMatch[0]);
      }

      // Look for imperative statements
      const imperativeMatch = preview.match(
        /^(create|make|write|build|generate|explain|describe|analyze|compare|list)\s+.{0,15}/i
      );
      if (imperativeMatch) {
        return this.capitalizeFirst(imperativeMatch[0]);
      }

      // Use first few words
      const words = preview.split(/\s+/).slice(0, 3);
      if (words.length > 0) {
        return this.capitalizeFirst(words.join(" "));
      }
    }

    // Fallback to default names
    if (index < this.defaultTabNames.length) {
      return this.defaultTabNames[index];
    }

    // Final fallback
    return `Branch ${index + 1}`;
  }

  /**
   * Capitalize first letter of string
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalizeFirst(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Create tab DOM element
   * @param {Object} tabData - Tab data
   * @returns {Element} Tab element
   */
  createTabElement(tabData) {
    const tab = document.createElement("div");
    tab.className = "branch-tab";
    tab.setAttribute("data-tab-id", tabData.id);
    tab.setAttribute("data-color", tabData.color);
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("tabindex", "0");

    // Create tab content
    tab.innerHTML = `
      <div class="branch-tab-content">
        <svg class="branch-tab-icon" viewBox="0 0 24 24" fill="currentColor">
          ${this.getTabIcon(tabData.role)}
        </svg>
        <span class="branch-tab-text">${this.escapeHtml(tabData.name)}</span>
        ${
          tabData.variantCount > 1
            ? `<span class="branch-tab-count">${tabData.variantCount}</span>`
            : ""
        }
      </div>
    `;

    // Add event listeners
    tab.addEventListener("click", this.boundHandlers.onTabClick);
    tab.addEventListener("mouseenter", this.boundHandlers.onTabHover);
    tab.addEventListener("mouseleave", this.boundHandlers.onTabLeave);

    // Add keyboard support
    tab.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        this.handleTabClick(event);
      }
    });

    return tab;
  }

  /**
   * Get SVG icon for tab based on role
   * @param {string} role - Turn role (user/assistant)
   * @returns {string} SVG path
   */
  getTabIcon(role) {
    if (role === "user") {
      return '<path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>';
    } else {
      return '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';
    }
  }

  /**
   * Escape HTML in strings
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Update tabs DOM efficiently
   * @param {Map} newTabs - New tabs to render
   */
  updateTabsDOM(newTabs) {
    // Remove tabs that no longer exist
    for (const [tabId, tabInfo] of this.tabs) {
      if (!newTabs.has(tabId)) {
        tabInfo.element.remove();
      }
    }

    // Add or update existing tabs
    const fragment = document.createDocumentFragment();
    let hasChanges = false;

    for (const [tabId, tabInfo] of newTabs) {
      const existingTab = this.tabs.get(tabId);

      if (existingTab) {
        // Update existing tab if data changed
        if (this.hasTabDataChanged(existingTab.data, tabInfo.data)) {
          this.updateTabElement(existingTab.element, tabInfo.data);
          existingTab.data = tabInfo.data;
        }
      } else {
        // Add new tab
        fragment.appendChild(tabInfo.element);
        hasChanges = true;
      }
    }

    // Append new tabs to container
    if (hasChanges) {
      this.tabsContainer.appendChild(fragment);
    }

    // Update tabs map
    this.tabs = newTabs;

    // Update scroll indicators
    this.updateScrollIndicators();
  }

  /**
   * Check if tab data has changed
   * @param {Object} oldData - Old tab data
   * @param {Object} newData - New tab data
   * @returns {boolean} True if data changed
   */
  hasTabDataChanged(oldData, newData) {
    return (
      oldData.name !== newData.name ||
      oldData.color !== newData.color ||
      oldData.variantCount !== newData.variantCount ||
      oldData.currentVariant !== newData.currentVariant
    );
  }

  /**
   * Update existing tab element
   * @param {Element} element - Tab element
   * @param {Object} tabData - New tab data
   */
  updateTabElement(element, tabData) {
    element.setAttribute("data-color", tabData.color);

    const textElement = element.querySelector(".branch-tab-text");
    if (textElement) {
      textElement.textContent = tabData.name;
    }

    const countElement = element.querySelector(".branch-tab-count");
    if (tabData.variantCount > 1) {
      if (countElement) {
        countElement.textContent = tabData.variantCount;
      } else {
        // Add count element
        const content = element.querySelector(".branch-tab-content");
        const count = document.createElement("span");
        count.className = "branch-tab-count";
        count.textContent = tabData.variantCount;
        content.appendChild(count);
      }
    } else if (countElement) {
      countElement.remove();
    }
  }

  /**
   * Handle tab click
   * @param {Event} event - Click event
   */
  handleTabClick(event) {
    const tab = event.currentTarget;
    const tabId = tab.getAttribute("data-tab-id");

    if (tabId) {
      this.setActiveTab(tabId);

      // Notify UI manager about tab selection
      if (this.uiManager && this.uiManager.onTabSelected) {
        const tabData = this.tabs.get(tabId)?.data;
        this.uiManager.onTabSelected(tabId, tabData);
      }
    }
  }

  /**
   * Handle tab hover
   * @param {Event} event - Hover event
   */
  handleTabHover(event) {
    const tab = event.currentTarget;
    const tabId = tab.getAttribute("data-tab-id");

    // Show hover menu after delay (will be implemented in later tasks)
    console.log("Tab hover:", tabId);
  }

  /**
   * Handle tab leave
   * @param {Event} event - Leave event
   */
  handleTabLeave(event) {
    // Hide hover menu (will be implemented in later tasks)
  }

  /**
   * Set active tab
   * @param {string} tabId - Tab ID to activate
   */
  setActiveTab(tabId) {
    // Remove active state from all tabs
    for (const [id, tabInfo] of this.tabs) {
      const isActive = id === tabId;
      tabInfo.element.classList.toggle("active", isActive);
      tabInfo.element.setAttribute("aria-selected", isActive.toString());
      tabInfo.data.isActive = isActive;
    }

    this.activeTabId = tabId;

    // Scroll active tab into view
    const activeTab = this.tabs.get(tabId);
    if (activeTab) {
      this.scrollTabIntoView(activeTab.element);
    }

    console.log("Set active tab:", tabId);
  }

  /**
   * Scroll tab into view
   * @param {Element} tabElement - Tab element to scroll to
   */
  scrollTabIntoView(tabElement) {
    if (!this.tabsContainer || !tabElement) return;

    const containerRect = this.tabsContainer.getBoundingClientRect();
    const tabRect = tabElement.getBoundingClientRect();

    if (tabRect.left < containerRect.left) {
      // Tab is to the left, scroll left
      this.tabsContainer.scrollLeft -= containerRect.left - tabRect.left + 8;
    } else if (tabRect.right > containerRect.right) {
      // Tab is to the right, scroll right
      this.tabsContainer.scrollLeft += tabRect.right - containerRect.right + 8;
    }
  }

  /**
   * Update scroll indicators
   */
  updateScrollIndicators() {
    if (!this.tabsContainer) return;

    const canScrollLeft = this.tabsContainer.scrollLeft > 0;
    const canScrollRight =
      this.tabsContainer.scrollLeft <
      this.tabsContainer.scrollWidth - this.tabsContainer.clientWidth;

    // Update scroll indicators (will be enhanced in later tasks)
    console.log("Scroll indicators:", { canScrollLeft, canScrollRight });
  }

  /**
   * Clear all tabs
   */
  clearTabs() {
    if (this.tabsContainer) {
      this.tabsContainer.innerHTML = "";
    }
    this.tabs.clear();
    this.activeTabId = null;
    console.log("Cleared all tabs");
  }

  /**
   * Get current state
   * @returns {Object} Current state
   */
  getState() {
    return {
      tabCount: this.tabs.size,
      activeTabId: this.activeTabId,
      tabs: Array.from(this.tabs.entries()).map(([id, info]) => ({
        id,
        name: info.data.name,
        isActive: info.data.isActive,
        variantCount: info.data.variantCount,
      })),
    };
  }
}

// ============================================================================
// UI MANAGER CLASS
// ============================================================================

class UIManager {
  constructor() {
    this.isInitialized = false;
    this.uiContainer = null;
    this.tabsContainer = null;
    this.floatingButton = null;
    this.modalOverlay = null;
    this.currentModal = null;

    // UI state
    this.isUIVisible = true;
    this.activeTabId = null;
    this.tabs = new Map(); // tabId -> tab element

    // Event handlers
    this.boundHandlers = {
      onResize: this.handleResize.bind(this),
      onScroll: this.handleScroll.bind(this),
      onKeydown: this.handleKeydown.bind(this),
      onClickOutside: this.handleClickOutside.bind(this),
    };
  }

  /**
   * Initialize the UI Manager and inject base UI
   * @returns {boolean} Success status
   */
  initialize() {
    console.log("Initializing UI Manager...");

    try {
      // Inject CSS styles
      this.injectStyles();

      // Create base UI structure
      this.createBaseUI();

      // Set up event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      console.log("UI Manager initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize UI Manager:", error);
      return false;
    }
  }

  /**
   * Inject CSS styles into the page
   */
  injectStyles() {
    // Check if styles are already injected
    if (document.getElementById("chatgpt-branching-styles")) {
      return;
    }

    const styleElement = document.createElement("style");
    styleElement.id = "chatgpt-branching-styles";

    // CSS will be loaded from the extension's CSS file
    // For now, we'll inject critical styles inline
    styleElement.textContent = `
      .chatgpt-branching-extension {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        box-sizing: border-box;
        position: relative;
        z-index: 1000;
      }
      
      .chatgpt-branching-extension *,
      .chatgpt-branching-extension *::before,
      .chatgpt-branching-extension *::after {
        box-sizing: border-box;
      }
      
      .branch-ui-container {
        position: sticky;
        top: 0;
        background: #ffffff;
        border-bottom: 1px solid #e5e7eb;
        padding: 12px 16px;
        margin: 0;
        width: 100%;
        z-index: 1000;
        transition: all 0.2s ease;
      }
      
      .branch-tabs-wrapper {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-behavior: smooth;
        scrollbar-width: none;
        -ms-overflow-style: none;
        padding: 4px 0;
      }
      
      .branch-tabs-wrapper::-webkit-scrollbar {
        display: none;
      }
      
      .branch-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 36px;
        padding: 8px 12px;
        background: #f7f7f8;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        flex-shrink: 0;
        transition: all 0.2s ease;
        position: relative;
        min-width: 80px;
        max-width: 200px;
        font-weight: 500;
        font-size: 13px;
      }
      
      .branch-tab:hover {
        background: #ececf1;
        border-color: #d1d5db;
        box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      }
      
      .branch-tab.active {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }
      
      .branch-floating-button {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 48px;
        height: 48px;
        background: #3b82f6;
        border: none;
        border-radius: 50%;
        cursor: pointer;
        z-index: 1000;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .branch-floating-button:hover {
        background: #2563eb;
        transform: scale(1.05);
      }
      
      .branch-hidden {
        display: none !important;
      }
      
      @media (prefers-color-scheme: dark) {
        .branch-ui-container {
          background: #212121;
          border-bottom-color: #4a4a4a;
        }
        
        .branch-tab {
          background: #2f2f2f;
          border-color: #4a4a4a;
          color: #ececec;
        }
        
        .branch-tab:hover {
          background: #404040;
          border-color: #565656;
        }
      }
    `;

    document.head.appendChild(styleElement);
    console.log("Injected UI styles");
  }

  /**
   * Create the base UI structure
   */
  createBaseUI() {
    // Find the main conversation container
    const mainContainer = this.findMainContainer();
    if (!mainContainer) {
      throw new Error("Could not find main conversation container");
    }

    // Create the main UI container
    this.uiContainer = document.createElement("div");
    this.uiContainer.className = "chatgpt-branching-extension";
    this.uiContainer.innerHTML = `
      <div class="branch-ui-container">
        <div class="branch-tabs-container">
          <div class="branch-tabs-wrapper" role="tablist" aria-label="Conversation branches">
            <!-- Tabs will be dynamically added here -->
          </div>
        </div>
      </div>
    `;

    // Insert at the top of the conversation
    mainContainer.insertBefore(this.uiContainer, mainContainer.firstChild);

    // Get reference to tabs container
    this.tabsContainer = this.uiContainer.querySelector(".branch-tabs-wrapper");

    // Create floating button
    this.createFloatingButton();

    console.log("Created base UI structure");
  }

  /**
   * Find the main conversation container
   * @returns {Element|null} Main container element
   */
  findMainContainer() {
    // Try multiple selectors to find the conversation container
    const selectors = [
      "main",
      '[role="main"]',
      ".conversation",
      "#__next main",
      'div[class*="conversation"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`Found main container using selector: ${selector}`);
        return element;
      }
    }

    // Fallback: use body if nothing else found
    console.warn("Could not find specific main container, using body");
    return document.body;
  }

  /**
   * Create the floating button for graph view
   */
  createFloatingButton() {
    this.floatingButton = document.createElement("button");
    this.floatingButton.className = "branch-floating-button";
    this.floatingButton.setAttribute("aria-label", "Open conversation graph");
    this.floatingButton.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19Z"/>
      </svg>
    `;

    // Add click handler
    this.floatingButton.addEventListener("click", () => {
      this.showGraphModal();
    });

    document.body.appendChild(this.floatingButton);
    console.log("Created floating button");
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    window.addEventListener("resize", this.boundHandlers.onResize);
    window.addEventListener("scroll", this.boundHandlers.onScroll);
    document.addEventListener("keydown", this.boundHandlers.onKeydown);
    document.addEventListener("click", this.boundHandlers.onClickOutside);
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Update UI layout if needed
    this.updateTabsScrolling();
  }

  /**
   * Handle window scroll
   */
  handleScroll() {
    // Update sticky positioning if needed
    this.updateStickyPosition();
  }

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} event - Keyboard event
   */
  handleKeydown(event) {
    // Handle Escape key to close modals
    if (event.key === "Escape" && this.currentModal) {
      this.closeModal();
    }

    // Handle tab navigation (Ctrl/Cmd + number)
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key >= "1" &&
      event.key <= "9"
    ) {
      const tabIndex = parseInt(event.key) - 1;
      const tabs = Array.from(this.tabs.values());
      if (tabs[tabIndex]) {
        event.preventDefault();
        this.activateTab(tabs[tabIndex].dataset.tabId);
      }
    }
  }

  /**
   * Handle clicks outside of dropdowns/modals
   * @param {MouseEvent} event - Click event
   */
  handleClickOutside(event) {
    // Close any open dropdowns
    const dropdowns = document.querySelectorAll(".branch-dropdown.visible");
    dropdowns.forEach((dropdown) => {
      if (!dropdown.contains(event.target)) {
        dropdown.classList.remove("visible");
      }
    });
  }

  /**
   * Update tabs scrolling indicators
   */
  updateTabsScrolling() {
    if (!this.tabsContainer) return;

    const wrapper = this.tabsContainer;
    const canScrollLeft = wrapper.scrollLeft > 0;
    const canScrollRight =
      wrapper.scrollLeft < wrapper.scrollWidth - wrapper.clientWidth;

    // Update scroll indicators (will be implemented when needed)
    console.log("Scroll state:", { canScrollLeft, canScrollRight });
  }

  /**
   * Update sticky position
   */
  updateStickyPosition() {
    if (!this.uiContainer) return;

    // Adjust for any ChatGPT header changes
    const chatgptHeader = document.querySelector(
      'header, .sticky-header, [class*="header"]'
    );
    if (chatgptHeader) {
      const headerHeight = chatgptHeader.offsetHeight;
      this.uiContainer.style.top = `${headerHeight}px`;
    }
  }

  /**
   * Show the graph modal (placeholder)
   */
  showGraphModal() {
    this.showModal(
      "Graph View",
      `
      <div style="text-align: center; padding: 40px 20px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="#3b82f6" style="margin-bottom: 16px;">
          <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9M19 21H5V3H13V9H19Z"/>
        </svg>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600;">Graph View Coming Soon</h3>
        <p style="margin: 0; color: #6b7280; font-size: 14px;">
          Interactive conversation graph visualization will be available in a future update.
        </p>
      </div>
    `
    );
  }

  /**
   * Show a modal dialog
   * @param {string} title - Modal title
   * @param {string} content - Modal content HTML
   */
  showModal(title, content) {
    // Create modal if it doesn't exist
    if (!this.modalOverlay) {
      this.modalOverlay = document.createElement("div");
      this.modalOverlay.className = "branch-modal-overlay";
      this.modalOverlay.innerHTML = `
        <div class="branch-modal">
          <div class="branch-modal-header">
            <h2 class="branch-modal-title"></h2>
            <button class="branch-modal-close" aria-label="Close modal">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          <div class="branch-modal-body"></div>
        </div>
      `;

      // Add close handler
      this.modalOverlay
        .querySelector(".branch-modal-close")
        .addEventListener("click", () => {
          this.closeModal();
        });

      // Close on overlay click
      this.modalOverlay.addEventListener("click", (event) => {
        if (event.target === this.modalOverlay) {
          this.closeModal();
        }
      });

      document.body.appendChild(this.modalOverlay);
    }

    // Update modal content
    this.modalOverlay.querySelector(".branch-modal-title").textContent = title;
    this.modalOverlay.querySelector(".branch-modal-body").innerHTML = content;

    // Show modal
    this.modalOverlay.classList.add("visible");
    this.currentModal = this.modalOverlay;

    // Focus management
    const firstFocusable = this.modalOverlay.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  /**
   * Close the current modal
   */
  closeModal() {
    if (this.modalOverlay) {
      this.modalOverlay.classList.remove("visible");
      this.currentModal = null;
    }
  }

  /**
   * Show or hide the UI
   * @param {boolean} visible - Whether UI should be visible
   */
  setUIVisibility(visible) {
    if (!this.uiContainer) return;

    this.isUIVisible = visible;
    if (visible) {
      this.uiContainer.classList.remove("branch-hidden");
    } else {
      this.uiContainer.classList.add("branch-hidden");
    }
  }

  /**
   * Clean up UI and event listeners
   */
  cleanup() {
    // Remove event listeners
    window.removeEventListener("resize", this.boundHandlers.onResize);
    window.removeEventListener("scroll", this.boundHandlers.onScroll);
    document.removeEventListener("keydown", this.boundHandlers.onKeydown);
    document.removeEventListener("click", this.boundHandlers.onClickOutside);

    // Remove UI elements
    if (this.uiContainer) {
      this.uiContainer.remove();
      this.uiContainer = null;
    }

    if (this.floatingButton) {
      this.floatingButton.remove();
      this.floatingButton = null;
    }

    if (this.modalOverlay) {
      this.modalOverlay.remove();
      this.modalOverlay = null;
    }

    // Remove styles
    const styleElement = document.getElementById("chatgpt-branching-styles");
    if (styleElement) {
      styleElement.remove();
    }

    // Clear state
    this.tabs.clear();
    this.activeTabId = null;
    this.isInitialized = false;

    console.log("UI Manager cleaned up");
  }

  /**
   * Get current UI state
   * @returns {Object} UI state
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isUIVisible: this.isUIVisible,
      activeTabId: this.activeTabId,
      tabCount: this.tabs.size,
      hasModal: !!this.currentModal,
      hasFloatingButton: !!this.floatingButton,
    };
  }
}

// ============================================================================
// PERFORMANCE MONITORING UTILITIES
// ============================================================================

/**
 * Performance monitor for DOM Observer operations
 */
class PerformanceMonitor {
  constructor() {
    this.stats = {
      mutationCount: 0,
      scanCount: 0,
      throttledCount: 0,
      totalScanTime: 0,
      maxScanTime: 0,
      minScanTime: Infinity,
      recentScanTimes: [], // Keep last 10 scan times
      variantChanges: 0,
      incrementalUpdates: 0,
      fullRebuilds: 0,
    };
  }

  /**
   * Record a mutation event
   */
  recordMutation() {
    this.stats.mutationCount++;
  }

  /**
   * Record a scan operation
   * @param {number} duration - Scan duration in ms
   * @param {boolean} isIncremental - Whether this was an incremental update
   */
  recordScan(duration, isIncremental = false) {
    this.stats.scanCount++;
    this.stats.totalScanTime += duration;
    this.stats.maxScanTime = Math.max(this.stats.maxScanTime, duration);
    this.stats.minScanTime = Math.min(this.stats.minScanTime, duration);

    // Keep recent scan times for trend analysis
    this.stats.recentScanTimes.push(duration);
    if (this.stats.recentScanTimes.length > 10) {
      this.stats.recentScanTimes.shift();
    }

    if (isIncremental) {
      this.stats.incrementalUpdates++;
    } else {
      this.stats.fullRebuilds++;
    }
  }

  /**
   * Record a throttled operation
   */
  recordThrottle() {
    this.stats.throttledCount++;
  }

  /**
   * Record a variant change
   */
  recordVariantChange() {
    this.stats.variantChanges++;
  }

  /**
   * Get performance statistics
   * @returns {Object} Performance stats
   */
  getStats() {
    const avgScanTime =
      this.stats.scanCount > 0
        ? this.stats.totalScanTime / this.stats.scanCount
        : 0;

    const recentAvgScanTime =
      this.stats.recentScanTimes.length > 0
        ? this.stats.recentScanTimes.reduce((a, b) => a + b, 0) /
          this.stats.recentScanTimes.length
        : 0;

    return {
      ...this.stats,
      averageScanTime: avgScanTime,
      recentAverageScanTime: recentAvgScanTime,
      throttleRate:
        this.stats.mutationCount > 0
          ? (this.stats.throttledCount / this.stats.mutationCount) * 100
          : 0,
      incrementalRate:
        this.stats.scanCount > 0
          ? (this.stats.incrementalUpdates / this.stats.scanCount) * 100
          : 0,
    };
  }

  /**
   * Reset statistics
   */
  reset() {
    this.stats = {
      mutationCount: 0,
      scanCount: 0,
      throttledCount: 0,
      totalScanTime: 0,
      maxScanTime: 0,
      minScanTime: Infinity,
      recentScanTimes: [],
      variantChanges: 0,
      incrementalUpdates: 0,
      fullRebuilds: 0,
    };
  }
}

// ============================================================================
// MAIN EXTENSION LOGIC
// ============================================================================

// Global extension state
let extensionState = {
  domObserver: null,
  branchDetector: null,
  treeBuilder: null,
  storageManager: null,
  performanceMonitor: null,
  uiManager: null,
  tabRenderer: null,
  conversationId: null,
  isInitialized: false,
};

// Initialize extension when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeExtension);
} else {
  initializeExtension();
}

async function initializeExtension() {
  console.log("Initializing ChatGPT Branching Extension...");

  try {
    // Wait for page to be fully loaded
    await waitForElement("main", 5000);

    // Wait a bit more for dynamic content to load
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check if we're on a valid ChatGPT conversation page
    if (!isValidChatGPTPage()) {
      console.log(
        "Not a valid ChatGPT conversation page, extension not activated"
      );
      return;
    }

    // Extract conversation ID
    extensionState.conversationId = extractConversationId();
    if (!extensionState.conversationId) {
      console.error(
        "Could not extract conversation ID, extension not activated"
      );
      return;
    }

    console.log(
      "Initializing extension for conversation:",
      extensionState.conversationId
    );

    // Initialize Performance Monitor
    extensionState.performanceMonitor = new PerformanceMonitor();

    // Initialize Storage Manager
    extensionState.storageManager = new StorageManager();

    // Initialize UI Manager
    extensionState.uiManager = new UIManager();
    const uiInitialized = extensionState.uiManager.initialize();

    if (!uiInitialized) {
      console.error("Failed to initialize UI Manager");
      return;
    }

    // Initialize Tab Renderer
    extensionState.tabRenderer = new TabRenderer(extensionState.uiManager);
    extensionState.tabRenderer.initialize(
      extensionState.uiManager.tabsContainer
    );

    // Set up tab selection callback
    extensionState.uiManager.onTabSelected = async (tabId, tabData) => {
      console.log("Tab selected:", tabId, tabData);
      // TODO: Implement navigation to selected branch (Task 9)
    };

    // Initialize Tree Builder
    extensionState.treeBuilder = new TreeBuilder();

    // Set up tree builder callbacks
    extensionState.treeBuilder.onTreeUpdated(async (treeState) => {
      console.log("Tree updated:", treeState);

      // Auto-save tree data if enabled
      if (extensionState.storageManager && extensionState.conversationId) {
        const customizations =
          await extensionState.storageManager.loadCustomizations(
            extensionState.conversationId
          );
        if (customizations.preferences.autoSave) {
          await extensionState.storageManager.saveConversationTree(
            extensionState.conversationId,
            treeState
          );
        }
      }
    });

    extensionState.treeBuilder.onPathChanged(async (newPath, oldPath) => {
      console.log("Path changed:", { newPath, oldPath });

      // Save path change if auto-save is enabled
      if (extensionState.storageManager && extensionState.conversationId) {
        const customizations =
          await extensionState.storageManager.loadCustomizations(
            extensionState.conversationId
          );
        if (customizations.preferences.autoSave) {
          const treeState = extensionState.treeBuilder.getTreeState();
          await extensionState.storageManager.saveConversationTree(
            extensionState.conversationId,
            treeState
          );
        }
      }
    });

    // Initialize Branch Detector
    extensionState.branchDetector = new BranchDetector();

    // Set up branch detector callbacks
    extensionState.branchDetector.onBranchDetected((branchInfo) => {
      console.log("New branch detected:", branchInfo);

      // Add branch to tree
      if (extensionState.treeBuilder) {
        extensionState.treeBuilder.addNode(branchInfo);
      }
    });

    extensionState.branchDetector.onBranchUpdated((updated, previous) => {
      console.log("Branch updated:", { updated, previous });

      // Update tree with new branch info
      if (extensionState.treeBuilder) {
        extensionState.treeBuilder.updateBranch(updated);
      }
    });

    // Initialize DOM Observer
    extensionState.domObserver = new DOMObserver();
    const observerInitialized = extensionState.domObserver.initialize();

    if (!observerInitialized) {
      console.error("Failed to initialize DOM Observer");
      return;
    }

    // Set up DOM Observer callbacks to trigger branch detection
    extensionState.domObserver.onTurnsChanged(
      async (turns, incrementalUpdate) => {
        console.log(
          `DOM Observer detected ${turns.length} turns`,
          incrementalUpdate
        );

        // Pass turns to branch detector for analysis
        if (extensionState.branchDetector) {
          const detectedBranches =
            extensionState.branchDetector.detectBranches(turns);

          // Build/update tree from all detected branches
          if (extensionState.treeBuilder && detectedBranches.length > 0) {
            if (
              incrementalUpdate &&
              incrementalUpdate.isIncremental &&
              incrementalUpdate.newTurns.length > 0
            ) {
              // Incremental update: only process new turns
              console.log("Processing incremental update for new turns");
              const newBranches = [];

              for (const newTurn of incrementalUpdate.newTurns) {
                const turnIndex = turns.indexOf(newTurn);
                const branchInfo = extensionState.branchDetector.analyzeTurn(
                  newTurn,
                  turnIndex
                );
                if (branchInfo) {
                  newBranches.push(branchInfo);
                  extensionState.treeBuilder.addNode(branchInfo);
                }
              }
            } else {
              // Full rebuild
              console.log("Processing full tree rebuild");
              extensionState.treeBuilder.buildFromBranches(detectedBranches);
            }
          }
        }
      }
    );

    // Set up variant change detection
    extensionState.domObserver.onVariantChanged(async (variantChange) => {
      console.log("Variant navigation detected:", variantChange);

      // Update branch detector with variant change
      if (extensionState.branchDetector) {
        extensionState.branchDetector.updateBranch(variantChange.turnId, {
          currentVariant: variantChange.currentVariant,
          totalVariants: variantChange.totalVariants,
          timestamp: variantChange.timestamp,
        });
      }
    });

    // Set up new branch detection
    extensionState.domObserver.onNewBranch(async (newBranchElements) => {
      console.log("New branches detected:", newBranchElements.length);

      // Process new branches immediately
      if (extensionState.branchDetector && extensionState.treeBuilder) {
        for (const branchElement of newBranchElements) {
          const turns = findConversationTurns();
          const turnIndex = turns.indexOf(branchElement);

          if (turnIndex >= 0) {
            const branchInfo = extensionState.branchDetector.analyzeTurn(
              branchElement,
              turnIndex
            );
            if (branchInfo) {
              extensionState.treeBuilder.addNode(branchInfo);
            }
          }
        }
      }
    });

    // Set up branch navigation tracking
    extensionState.domObserver.onBranchNavigation(async (navigationInfo) => {
      console.log("Branch navigation tracked:", navigationInfo);

      // Update current path in tree builder
      if (extensionState.treeBuilder) {
        // This will be used by UI components to highlight active branch
        const currentPath = extensionState.treeBuilder.findPathToNode(
          navigationInfo.turnId
        );
        extensionState.treeBuilder.updateCurrentPath(currentPath);
      }
    });

    // Load saved tree data if available
    if (extensionState.storageManager && extensionState.conversationId) {
      try {
        const savedTreeData =
          await extensionState.storageManager.loadConversationTree(
            extensionState.conversationId
          );
        if (savedTreeData && extensionState.treeBuilder) {
          extensionState.treeBuilder.importData(savedTreeData);
          console.log("Loaded saved tree data for conversation");
        }
      } catch (error) {
        console.error("Failed to load saved tree data:", error);
      }
    }

    // TODO: Initialize other extension components
    // - Branch Detector
    // - UI Manager
    // - Storage Manager
    // - Navigation Controller

    extensionState.isInitialized = true;
    console.log("ChatGPT Branching Extension initialized successfully");

    // Trigger initial tab rendering after a short delay to let DOM settle
    setTimeout(async () => {
      if (extensionState.tabRenderer) {
        await renderTabsFromTree();
      }
    }, 1000);

    // Log current state for debugging
    console.log("Extension state:", {
      conversationId: extensionState.conversationId,
      domObserver: extensionState.domObserver.getState(),
      branchDetector: extensionState.branchDetector.getState(),
      treeBuilder: extensionState.treeBuilder.getTreeSummary(),
      storageStats: extensionState.storageManager.getStorageStats(),
      uiManager: extensionState.uiManager.getState(),
      isInitialized: extensionState.isInitialized,
    });
  } catch (error) {
    console.error("Error initializing ChatGPT Branching Extension:", error);
  }
}

// Handle page navigation (SPA routing)
let lastUrl = window.location.href;
const navigationObserver = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log("Page navigation detected, reinitializing extension...");

    // Clean up existing state
    if (extensionState.domObserver) {
      extensionState.domObserver.disconnect();
    }
    if (extensionState.branchDetector) {
      extensionState.branchDetector.clear();
    }
    if (extensionState.treeBuilder) {
      extensionState.treeBuilder.clear();
    }
    if (extensionState.uiManager) {
      extensionState.uiManager.cleanup();
    }

    // Reset state
    extensionState = {
      domObserver: null,
      branchDetector: null,
      treeBuilder: null,
      storageManager: null,
      performanceMonitor: null,
      uiManager: null,
      tabRenderer: null,
      conversationId: null,
      isInitialized: false,
    };

    // Reinitialize after a short delay to let the page load
    setTimeout(initializeExtension, 1000);
  }
});

navigationObserver.observe(document.body, { childList: true, subtree: true });

// ============================================================================
// UTILITY FUNCTIONS FOR STORAGE INTEGRATION
// ============================================================================

/**
 * Save branch customization (name or color)
 * @param {string} nodeId - Node ID
 * @param {string} property - Property to update ('name' or 'color')
 * @param {any} value - New value
 * @returns {Promise<boolean>} Success status
 */
async function saveBranchCustomization(nodeId, property, value) {
  if (!extensionState.storageManager || !extensionState.conversationId) {
    console.warn("Storage manager or conversation ID not available");
    return false;
  }

  return await extensionState.storageManager.updateCustomization(
    extensionState.conversationId,
    nodeId,
    property,
    value
  );
}

/**
 * Load all customizations for current conversation
 * @returns {Promise<Object>} Customizations object
 */
async function loadConversationCustomizations() {
  if (!extensionState.storageManager || !extensionState.conversationId) {
    console.warn("Storage manager or conversation ID not available");
    return {};
  }

  return await extensionState.storageManager.loadCustomizations(
    extensionState.conversationId
  );
}

/**
 * Get storage statistics for debugging
 * @returns {Object} Storage statistics
 */
function getStorageStatistics() {
  if (!extensionState.storageManager) {
    return { error: "Storage manager not available" };
  }

  return extensionState.storageManager.getStorageStats();
}

/**
 * Clear all data for current conversation
 * @returns {Promise<boolean>} Success status
 */
async function clearConversationData() {
  if (!extensionState.storageManager || !extensionState.conversationId) {
    console.warn("Storage manager or conversation ID not available");
    return false;
  }

  const success = await extensionState.storageManager.clearConversation(
    extensionState.conversationId
  );

  if (success && extensionState.treeBuilder) {
    // Also clear the in-memory tree
    extensionState.treeBuilder.clear();
  }

  return success;
}

/**
 * Get performance statistics for debugging
 * @returns {Object} Performance statistics
 */
function getPerformanceStatistics() {
  if (!extensionState.performanceMonitor) {
    return { error: "Performance monitor not available" };
  }

  return extensionState.performanceMonitor.getStats();
}

/**
 * Reset performance statistics
 */
function resetPerformanceStatistics() {
  if (extensionState.performanceMonitor) {
    extensionState.performanceMonitor.reset();
    console.log("Performance statistics reset");
  }
}

// Export for debugging
window.chatgptBranchingExtension = {
  ...extensionState,
  utils: {
    saveBranchCustomization,
    loadConversationCustomizations,
    getStorageStatistics,
    clearConversationData,
    getPerformanceStatistics,
    resetPerformanceStatistics,
  },
};
/**
 * Show or hide the extension UI
 * @param {boolean} visible - Whether UI should be visible
 */
function setUIVisibility(visible) {
  if (extensionState.uiManager) {
    extensionState.uiManager.setUIVisibility(visible);
  }
}

/**
 * Show a modal dialog
 * @param {string} title - Modal title
 * @param {string} content - Modal content HTML
 */
function showModal(title, content) {
  if (extensionState.uiManager) {
    extensionState.uiManager.showModal(title, content);
  }
}

/**
 * Close the current modal
 */
function closeModal() {
  if (extensionState.uiManager) {
    extensionState.uiManager.closeModal();
  }
}

/**
 * Get UI state for debugging
 * @returns {Object} UI state
 */
function getUIState() {
  if (!extensionState.uiManager) {
    return { error: "UI Manager not available" };
  }

  return extensionState.uiManager.getState();
}

// Export for debugging
window.chatgptBranchingExtension = {
  ...extensionState,
  utils: {
    saveBranchCustomization,
    loadConversationCustomizations,
    getStorageStatistics,
    clearConversationData,
    getPerformanceStatistics,
    resetPerformanceStatistics,
    setUIVisibility,
    showModal,
    closeModal,
    getUIState,
  },
};
/**
 * Trigger tab rendering from current tree state
 */
async function renderTabsFromTree() {
  if (
    !extensionState.tabRenderer ||
    !extensionState.treeBuilder ||
    !extensionState.storageManager ||
    !extensionState.conversationId
  ) {
    console.warn("Cannot render tabs: missing required components");
    return;
  }

  try {
    const treeState = extensionState.treeBuilder.getTreeState();
    const customizations =
      await extensionState.storageManager.loadCustomizations(
        extensionState.conversationId
      );

    await extensionState.tabRenderer.renderTabs(treeState, customizations);
    console.log("Tabs rendered successfully");
  } catch (error) {
    console.error("Failed to render tabs:", error);
  }
}

/**
 * Get tab renderer state for debugging
 * @returns {Object} Tab renderer state
 */
function getTabState() {
  if (!extensionState.tabRenderer) {
    return { error: "Tab Renderer not available" };
  }

  return extensionState.tabRenderer.getState();
}
