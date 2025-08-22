// ============================================================================
// STORAGE MANAGER CLASS
// ============================================================================

class StorageManager {
  constructor() {
    this.storagePrefix = "chatgpt_branching_";
    this.currentVersion = "1.0.0";
    this.maxStorageSize = 100 * 1024 * 1024; // 100MB limit
    this.compressionThreshold = 1024; // Compress data larger than 1KB
  }

  /**
   * Generate storage key for conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} dataType - Type of data (tree, customizations, metadata)
   * @returns {string} Storage key
   */
  getStorageKey(conversationId, dataType = "tree") {
    const key = `${this.storagePrefix}${conversationId}_${dataType}`;
    return key;
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
        const allKeys = Object.keys(localStorage).filter((k) =>
          k.startsWith(this.storagePrefix)
        );

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
      rootBranches: Array.isArray(treeData.rootBranches)
        ? treeData.rootBranches
        : [],
      currentPath: Array.isArray(treeData.currentPath)
        ? treeData.currentPath
        : [],
      nodes: [],
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
          // Include variants and branches for hierarchical tree structure
          variants: Array.isArray(nodeData.variants) ? nodeData.variants : [],
          branches: Array.isArray(nodeData.branches) ? nodeData.branches : [],
          // Include other important properties
          type: nodeData.type || "branch",
          timestamp: nodeData.timestamp || Date.now(),
        },
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
      data = await this.migrateData(data);
    }

    // Validate required fields
    if (!data.conversationId || !data.timestamp) {
      return null;
    }

    // Check if data is too old (older than 30 days)
    const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    if (Date.now() - data.timestamp > maxAge) {
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
      return true;
    } catch (error) {
      console.error("Failed to clear conversation data:", error);
      return false;
    }
  }

  /**
   * Save comprehensive tree data (accumulates all discovered nodes)
   * @param {string} conversationId - Conversation ID
   * @param {Object} newTreeData - New tree data to merge
   * @returns {Promise<boolean>} Success status
   */
  async saveComprehensiveTree(conversationId, newTreeData) {
    // Redirect to lean save
    return this.saveLeanTree(conversationId, newTreeData);
  }

  /**
   * Load comprehensive tree data (all discovered nodes)
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Object|null>} Comprehensive tree data or null
   */
  async loadComprehensiveTree(conversationId) {
    // Redirect to lean load
    return this.loadLeanTree(conversationId);
  }

  // ================= LEAN TREE PERSISTENCE =================
  async saveLeanTree(conversationId, leanState) {
    try {
      if (!leanState) return false;
      const key = this.getStorageKey(conversationId, "lean_tree");
      const payload = {
        version: this.currentVersion,
        timestamp: Date.now(),
        conversationId,
        treeData: {
          nodeCount: leanState.nodeCount,
          nodes: leanState.nodes, // plain node objects
          rootChildren: leanState.rootChildren || [],
        },
      };
      const serialized = JSON.stringify(payload);
      const finalData =
        serialized.length > this.compressionThreshold
          ? this.compressData(serialized)
          : serialized;
      localStorage.setItem(key, finalData);
      return true;
    } catch (e) {
      console.error("Failed to save lean tree:", e);
      return false;
    }
  }

  async loadLeanTree(conversationId) {
    try {
      const key = this.getStorageKey(conversationId, "lean_tree");
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const serialized = this.isCompressed(raw)
        ? this.decompressData(raw)
        : raw;
      const parsed = JSON.parse(serialized);
      const validated = await this.validateAndMigrate(parsed);
      if (!validated) return null;
      const td = validated.treeData;
      return {
        nodeCount: td.nodeCount || (td.nodes ? td.nodes.length : 0),
        nodes: td.nodes || [],
        rootChildren: td.rootChildren || [],
        isLean: true,
      };
    } catch (e) {
      console.error("Failed to load lean tree:", e);
      return null;
    }
  }

  /**
   * Merge variant arrays, avoiding duplicates
   * @param {Array} existing - Existing variants
   * @param {Array} newVariants - New variants to merge
   * @returns {Array} Merged variants
   */
  mergeVariants(existing, newVariants) {
    const merged = [...existing];

    for (const newVariant of newVariants) {
      const existingIndex = merged.findIndex(
        (v) => v.variantIndex === newVariant.variantIndex
      );

      if (existingIndex >= 0) {
        // Update existing variant with new information
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...newVariant,
          lastSeen: Date.now(),
        };
      } else {
        // Add new variant
        merged.push({
          ...newVariant,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    }

    return merged;
  }

  /**
   * Merge branch arrays, avoiding duplicates
   * @param {Array} existing - Existing branches
   * @param {Array} newBranches - New branches to merge
   * @returns {Array} Merged branches
   */
  mergeBranches(existing, newBranches) {
    const merged = [...existing];

    for (const newBranch of newBranches) {
      const existingIndex = merged.findIndex(
        (b) => b.variantIndex === newBranch.variantIndex
      );

      if (existingIndex >= 0) {
        // Update existing branch
        merged[existingIndex] = {
          ...merged[existingIndex],
          ...newBranch,
          lastSeen: Date.now(),
        };
      } else {
        // Add new branch
        merged.push({
          ...newBranch,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
        });
      }
    }

    return merged;
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
