// ============================================================================
// TREE BUILDER CLASS
// ============================================================================

export class TreeBuilder {
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
    const processedTurns = new Set();

    for (const [nodeId, node] of this.nodes) {
      // Skip if we've already processed this turn
      const baseTurnId = node.turnId || nodeId.split("_v")[0];
      if (processedTurns.has(baseTurnId)) {
        continue;
      }

      // Find all variants for this turn
      const turnVariants = [];
      for (const [variantId, variantNode] of this.nodes) {
        const variantBaseTurnId =
          variantNode.turnId || variantId.split("_v")[0];
        if (variantBaseTurnId === baseTurnId) {
          turnVariants.push(variantNode);
        }
      }

      // Check if this turn has multiple variants (is a branch point)
      if (
        turnVariants.length > 1 ||
        (turnVariants.length === 1 && turnVariants[0].totalVariants > 1)
      ) {
        // Check if it's a root branch (no parent or parent is not a branch)
        const hasParent = turnVariants.some((variant) => variant.parent);

        if (!hasParent) {
          // This is a root branch - add all its variants
          for (const variant of turnVariants) {
            rootBranches.push(variant.id);
            variant.isRoot = true;
          }
        } else {
          // Check if parent is a branching turn
          const parentNode = this.nodes.get(turnVariants[0].parent);
          if (parentNode) {
            const parentBaseTurnId =
              parentNode.turnId || parentNode.id.split("_v")[0];
            const parentVariants = Array.from(this.nodes.values()).filter(
              (n) => {
                const nBaseTurnId = n.turnId || n.id.split("_v")[0];
                return nBaseTurnId === parentBaseTurnId;
              }
            );

            // If parent is not a branch, this is effectively a root branch
            if (
              parentVariants.length === 1 &&
              parentVariants[0].totalVariants === 1
            ) {
              for (const variant of turnVariants) {
                if (!rootBranches.includes(variant.id)) {
                  rootBranches.push(variant.id);
                  variant.isRoot = true;
                }
              }
            }
          }
        }
      }

      processedTurns.add(baseTurnId);
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
   * Get current path
   * @returns {string[]} Current path as array of node IDs
   */
  getCurrentPath() {
    return [...this.currentPath];
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
    console.log("Building conversation tree from branches:", branches);

    // Clear existing tree
    this.clear();

    // New architecture: Group by conversation turns, not individual branches
    const conversationTurns = this.groupBranchesByTurn(branches);

    console.log("Grouped into conversation turns:", conversationTurns);

    // Add turn nodes to the tree
    for (const turn of conversationTurns) {
      this.addConversationTurn(turn);
    }

    // Build relationships between conversation turns
    this.linkConversationTurns(conversationTurns);

    // Identify root turns (turns with no parent)
    this.findRootTurns();

    console.log("Conversation tree built successfully:", this.getTreeSummary());

    // Notify callbacks
    this.notifyTreeUpdated();
  }

  /**
   * Group detected branches by conversation turn
   * @param {Object[]} branches - Array of branch data
   * @returns {Object[]} Array of conversation turn objects
   */
  groupBranchesByTurn(branches) {
    const turnMap = new Map();

    for (const branch of branches) {
      const turnIndex = branch.turnIndex;
      const baseTurnId = branch.baseTurnId || branch.turnId;

      if (!turnMap.has(turnIndex)) {
        turnMap.set(turnIndex, {
          turnId: baseTurnId,
          turnIndex: turnIndex,
          role: branch.role,
          variants: [],
          activeVariantIndex: branch.currentVariant || 1,
          totalVariants: branch.totalVariants || 1,
          element: branch.element,
          timestamp: branch.timestamp,
        });
      }

      const turn = turnMap.get(turnIndex);

      // Add variants from the comprehensive branch data
      if (branch.variants && Array.isArray(branch.variants)) {
        turn.variants = branch.variants;
      } else {
        // Fallback: create single variant
        turn.variants.push({
          id: `${baseTurnId}_v${branch.currentVariant || 1}`,
          variantIndex: branch.currentVariant || 1,
          preview: branch.preview || "",
          textHash: branch.textHash,
          isActive: true,
        });
      }
    }

    // Convert to array and sort by turn index
    return Array.from(turnMap.values()).sort(
      (a, b) => a.turnIndex - b.turnIndex
    );
  }

  /**
   * Add a conversation turn to the tree
   * @param {Object} turnData - Conversation turn data
   */
  addConversationTurn(turnData) {
    const turnId = turnData.turnId;

    // Create turn node
    const turnNode = {
      id: turnId,
      type: "turn",
      turnIndex: turnData.turnIndex,
      role: turnData.role,
      variants: turnData.variants,
      activeVariantIndex: turnData.activeVariantIndex,
      totalVariants: turnData.totalVariants,
      children: [], // Next conversation turns
      parent: null,
      isRoot: false,
      depth: 0,
      timestamp: turnData.timestamp,
    };

    this.nodes.set(turnId, turnNode);
    console.log("Added conversation turn:", turnId);
  }

  /**
   * Link conversation turns based on their sequence
   * @param {Object[]} conversationTurns - Array of conversation turns
   */
  linkConversationTurns(conversationTurns) {
    for (let i = 1; i < conversationTurns.length; i++) {
      const currentTurn = conversationTurns[i];
      const previousTurn = conversationTurns[i - 1];

      // Link current turn to previous turn
      this.linkNodes(previousTurn.turnId, currentTurn.turnId);
    }
  }

  /**
   * Find root turns (turns with no parent - typically the first turn)
   */
  findRootTurns() {
    const rootTurns = [];

    for (const [turnId, turnNode] of this.nodes) {
      if (!turnNode.parent && turnNode.type === "turn") {
        rootTurns.push(turnId);
        turnNode.isRoot = true;
      }
    }

    this.rootBranches = rootTurns; // Keep same property name for compatibility
    console.log("Found root turns:", rootTurns);
    return rootTurns;
  }

  /**
   * Add a variant node to the tree
   * @param {Object} variantData - Variant node data
   * @returns {string} The variant node ID
   */
  addVariantNode(variantData) {
    const nodeId = variantData.id;

    // Create enhanced node with tree-specific properties
    const treeNode = {
      ...variantData,
      children: [],
      parent: null,
      isRoot: false,
      depth: 0,
    };

    this.nodes.set(nodeId, treeNode);
    console.log("Added variant node to tree:", nodeId);

    return nodeId;
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
    console.log("Importing tree data:", data);
    this.clear();

    try {
      // Handle nodes - data.nodes is already an array of [key, value] pairs
      if (Array.isArray(data.nodes)) {
        this.nodes = new Map(data.nodes);
        console.log(`Imported ${this.nodes.size} nodes`);
      }

      // Handle edges - data.edges is already an array of [key, value] pairs
      if (Array.isArray(data.edges)) {
        this.edges = new Map(data.edges);
        console.log(`Imported ${this.edges.size} edges`);
      }

      // Handle current path
      if (Array.isArray(data.currentPath)) {
        this.currentPath = [...data.currentPath];
        console.log(`Imported current path:`, this.currentPath);
      }

      // Handle root branches
      if (Array.isArray(data.rootBranches)) {
        this.rootBranches = [...data.rootBranches];
        console.log(`Imported ${this.rootBranches.length} root branches`);
      }

      console.log("Successfully imported tree data:", this.getTreeSummary());

      // Notify that tree was updated
      this.notifyTreeUpdated();
    } catch (error) {
      console.error("Error importing tree data:", error);
      this.clear(); // Reset to clean state on error
    }
  }
}
