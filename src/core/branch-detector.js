// ============================================================================
// BRANCH DETECTOR CLASS
// ============================================================================

// Dependencies: generateTurnId, simpleHash, findConversationTurns from dom-utils.js

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
    const branches = [];

    turnElements.forEach((turn, index) => {
      const branchInfo = this.analyzeTurn(turn, index);
      if (branchInfo) {
        branches.push(branchInfo);

        // Store in detected branches map
        this.detectedBranches.set(branchInfo.turnId, branchInfo);
        console.log("detectedBranches set:", this.detectedBranches);

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

    console.log("Detected branches:", branches);
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

    if (!hasNavControls) {
      console.warn(
        "Found variant indicator but no navigation controls:",
        variantInfo
      );
      return null;
    }

    // Generate base turn ID (without variant info)
    const id = generateTurnId(turnElement, index);

    // Classify turn role
    const role = this.classifyTurnRole(turnElement);

    // Extract content preview for current variant
    const preview = this.extractContentPreview(turnElement);
    const textHash = this.generateContentHash(turnElement);

    // Create comprehensive branch information for ALL variants
    const branchInfo = {
      id,
      turnIndex: index,
      currentVariant: variantInfo.current,
      totalVariants: variantInfo.total,
      role,
      element: turnElement,
      timestamp: Date.now(),
      // Create entries for all variants
      variants: this.createVariantEntries(
        id,
        variantInfo,
        preview,
        textHash,
        role,
        index
      ),
      // Mark which variant is currently active
      activeVariantId: `${id}_v${variantInfo.current}`,
    };

    console.log("Detected branch information:", branchInfo);

    return branchInfo;
  }

  /**
   * Create variant entries for all possible variants of a turn
   * @param {string} id - Base turn ID
   * @param {Object} variantInfo - Variant information {current, total}
   * @param {string} currentPreview - Preview text for current variant
   * @param {string} currentTextHash - Text hash for current variant
   * @param {string} role - Turn role (user/assistant)
   * @param {number} turnIndex - Turn index
   * @returns {Object[]} Array of variant entries
   */
  createVariantEntries(
    id,
    variantInfo,
    currentPreview,
    currentTextHash,
    role,
    turnIndex
  ) {
    const variants = [];

    for (let i = 1; i <= variantInfo.total; i++) {
      const variantId = `${id}_v${i}`;
      const isCurrentVariant = i === variantInfo.current;

      variants.push({
        id: variantId,
        turnId: id,
        turnIndex: turnIndex,
        variantIndex: i,
        totalVariants: variantInfo.total,
        role: role,
        preview: isCurrentVariant ? currentPreview : i,
        textHash: isCurrentVariant ? currentTextHash : null, // Will be filled when navigated to
        isActive: isCurrentVariant,
        isDiscovered: isCurrentVariant, // Only current variant is discovered initially
        timestamp: Date.now(),
      });
    }

    return variants;
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

    if (!counterText) {
      return null;
    }

    // Match pattern like "1/2", "2/3", etc.
    const match = counterText.match(/^(\d+)\/(\d+)$/);

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
  }

  /**
   * Get current conversation turns from DOM
   * @returns {Array} Array of current turn elements with metadata
   */
  getCurrentTurns() {
    try {
      const turns = findConversationTurns();
      return turns.map((turnElement, index) => {
        const turnId = this.generateTurnId(turnElement, index);
        return {
          turnId,
          element: turnElement,
          index,
          role: this.determineTurnRole(turnElement),
        };
      });
    } catch (error) {
      console.warn("Error getting current turns:", error);
      return [];
    }
  }

  /**
   * Get detected branch by turn ID
   * @param {string} turnId - Turn ID to look up
   * @returns {Object|null} Branch info or null if not found
   */
  getDetectedBranch(turnId) {
    return this.detectedBranches.get(turnId) || null;
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
