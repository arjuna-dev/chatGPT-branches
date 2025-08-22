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
 * Safely append child element with React conflict prevention
 * @param {Element} parent - Parent element
 * @param {Element} child - Child element to append
 * @returns {boolean} Success status
 */
function safeAppendChild(parent, child) {
  try {
    // Check if parent is still in DOM and not controlled by React
    if (!parent || !parent.isConnected) {
      console.warn("Parent element not in DOM");
      return false;
    }

    // Avoid appending to React-controlled elements
    if (
      parent.hasAttribute("data-reactroot") ||
      parent.closest("[data-reactroot]") ||
      parent.hasAttribute("data-react-checksum")
    ) {
      console.warn("Avoiding React-controlled element");
      return false;
    }

    parent.appendChild(child);
    return true;
  } catch (error) {
    console.error("Error in safeAppendChild:", error);
    return false;
  }
}

/**
 * Safely insert element with React conflict prevention
 * @param {Element} parent - Parent element
 * @param {Element} newElement - Element to insert
 * @param {Element} referenceElement - Reference element
 * @returns {boolean} Success status
 */
function safeInsertBefore(parent, newElement, referenceElement) {
  try {
    // Check if parent is still in DOM and not controlled by React
    if (!parent || !parent.isConnected) {
      console.warn("Parent element not in DOM");
      return false;
    }

    // Avoid inserting into React-controlled elements
    if (
      parent.hasAttribute("data-reactroot") ||
      parent.closest("[data-reactroot]") ||
      parent.hasAttribute("data-react-checksum")
    ) {
      console.warn("Avoiding React-controlled element");
      return false;
    }

    parent.insertBefore(newElement, referenceElement);
    return true;
  } catch (error) {
    console.error("Error in safeInsertBefore:", error);
    return false;
  }
}

/**
 * Safely set innerHTML with React conflict prevention
 * @param {Element} element - Element to modify
 * @param {string} html - HTML content
 * @returns {boolean} Success status
 */
function safeSetInnerHTML(element, html) {
  try {
    // Check if element is still in DOM and not controlled by React
    if (!element || !element.isConnected) {
      console.warn("Element not in DOM");
      return false;
    }

    // Avoid modifying React-controlled elements
    if (
      element.hasAttribute("data-reactroot") ||
      element.closest("[data-reactroot]") ||
      element.hasAttribute("data-react-checksum")
    ) {
      console.warn("Avoiding React-controlled element");
      return false;
    }

    element.innerHTML = html;
    return true;
  } catch (error) {
    console.error("Error in safeSetInnerHTML:", error);
    return false;
  }
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
