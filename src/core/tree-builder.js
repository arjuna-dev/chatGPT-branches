// ============================================================================
// TREE BUILDER CLASS
// ============================================================================

class TreeBuilder {
  constructor() {
    this.nodes = new Map(); // nodeId -> BranchNode
    this.currentPath = []; // [nodeId1, nodeId2, ...] - active conversation path
    this.rootBranches = []; // [nodeId1, nodeId2, ...] - top-level branch points
    this.lean = null; // current lean structure
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
      // Add branches property for hierarchical structure
      branches: nodeData.variants
        ? this.createBranchesFromVariants(nodeData.variants, nodeData)
        : [],
    };

    this.nodes.set(nodeId, treeNode);

    return nodeId;
  }

  /**
   * Link two nodes with parent-child relationship
   * @param {string} parentId - Parent node ID
   * @param {string} childId - Child node ID
   */
  linkNodes(parentId, childId) {
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
  }

  /**
   * Update the current conversation path
   * @param {string[]} path - Array of node IDs representing the active path
   */
  updateCurrentPath(path) {
    const oldPath = [...this.currentPath];
    this.currentPath = [...path];

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
      const id = node.turnId || nodeId.split("_v")[0];
      if (processedTurns.has(id)) {
        continue;
      }

      // Find all variants for this turn
      const turnVariants = [];
      for (const [variantId, variantNode] of this.nodes) {
        const variantId = variantNode.turnId || variantId.split("_v")[0];
        if (variantId === id) {
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
            const parentId = parentNode.turnId || parentNode.id.split("_v")[0];
            const parentVariants = Array.from(this.nodes.values()).filter(
              (n) => {
                const nId = n.turnId || n.id.split("_v")[0];
                return nId === parentId;
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

      processedTurns.add(id);
    }

    this.rootBranches = rootBranches;
    return this.rootBranches;
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
    // Clear existing tree
    this.clear();

    for (const branch of branches) {
      const nodeId = branch.id;
      this.nodes.set(nodeId, branch);
    }

    // Build lean structure before scheduling save so it persists correctly
    try {
      this.buildLeanStructure(branches);
    } catch (e) {
      console.warn("Failed to build lean structure:", e);
    }

    // Load stored lean tree and merge (variantId uniqueness) asynchronously
    if (
      typeof extensionState !== "undefined" &&
      extensionState?.conversationId &&
      extensionState.storageManager
    ) {
      const convId = extensionState.conversationId;
      extensionState.storageManager.loadLeanTree(convId).then((storedLean) => {
        if (!storedLean || !storedLean.nodes) return;
        try {
          this.mergeStoredLeanWithCurrent(storedLean);
          this.saveToComprehensiveStorage(convId).catch((err) =>
            console.error("Failed to save merged lean tree", err)
          );
          this.notifyTreeUpdated();
        } catch (err) {
          console.warn("VariantId merge failed", err);
        }
      });
    }

    // Save to comprehensive storage (async, non-blocking)
    if (
      typeof extensionState !== "undefined" &&
      extensionState?.conversationId
    ) {
      setTimeout(() => {
        this.saveToComprehensiveStorage(extensionState.conversationId).catch(
          (error) => {
            console.error("Failed to save to comprehensive storage:", error);
          }
        );
      }, 0);
    }

    // Notify callbacks AFTER lean build
    this.notifyTreeUpdated();
  }

  /** Merge stored lean (array form) into current lean using variantId as unique key */
  mergeStoredLeanWithCurrent(storedLean) {
    if (!this.lean || !this.lean.nodes) return;
    const currentMap = this.lean.nodes; // Map id->node (id will become variantId)
    const byVariant = new Map();
    const storedTurnIds = new Set();

    // Track variants per turn for stored & incoming
    const storedVariantsByTurn = new Map(); // turnId -> [nodes]
    const incomingVariantsByTurn = new Map(); // turnId -> [nodes]

    const normalizeNode = (n) => {
      // Ensure variantId present
      const vid = n.variantId || n.id;
      return { ...n, id: vid, variantId: vid };
    };

    // Seed with stored nodes (normalize old text-based ids)
    for (const sn of storedLean.nodes || []) {
      const node = normalizeNode(sn);
      if (!byVariant.has(node.variantId)) byVariant.set(node.variantId, node);
      if (node.turnId) {
        storedTurnIds.add(node.turnId);
        if (!storedVariantsByTurn.has(node.turnId))
          storedVariantsByTurn.set(node.turnId, []);
        storedVariantsByTurn.get(node.turnId).push(node);
      }
    }
    // Merge current nodes
    for (const node of currentMap.values()) {
      const cur = normalizeNode(node);
      if (cur.turnId) {
        if (!incomingVariantsByTurn.has(cur.turnId))
          incomingVariantsByTurn.set(cur.turnId, []);
        incomingVariantsByTurn.get(cur.turnId).push(cur);
      }
    }

    // For each incoming turnId, decide which variants to include
    for (const [turnId, variants] of incomingVariantsByTurn.entries()) {
      const isNewTurn = !storedTurnIds.has(turnId);
      // If it's a brand-new turn (not previously stored), only add active or discovered variants.
      const filtered = isNewTurn
        ? variants.filter((v) => v.isActive || v.isDiscovered)
        : variants;
      for (const cur of filtered) {
        const existing = byVariant.get(cur.variantId);
        if (!existing) {
          byVariant.set(cur.variantId, cur);
        } else {
          if (!existing.isDiscovered && cur.isDiscovered) {
            byVariant.set(cur.variantId, {
              ...existing,
              ...cur,
              isDiscovered: true,
            });
          } else if (existing.isDiscovered && !cur.isDiscovered) {
            // keep existing
          } else if (!existing.isDiscovered && !cur.isDiscovered) {
            // keep earlier
          } else {
            if ((cur.timestamp || 0) > (existing.timestamp || 0)) {
              byVariant.set(cur.variantId, { ...existing, ...cur });
            }
          }
        }
      }
    }

    // Consolidate duplicates across different turnIds for same (turnIndex, variantIndex)
    const nodesArrRaw = Array.from(byVariant.values());
    const pickMap = new Map(); // key: ti:vi -> node
    const isPlaceholder = (txt) => {
      if (txt == null) return true;
      const t = String(txt).trim();
      if (!t) return true;
      if (/^[0-9]{1,3}$/.test(t)) return true;
      if (t.length <= 3) return true;
      return false;
    };
    for (const n of nodesArrRaw) {
      const key = `${n.turnIndex || 0}:${n.variantIndex || 0}`;
      const existing = pickMap.get(key);
      if (!existing) {
        pickMap.set(key, n);
        continue;
      }
      // Decide replacement rules
      const ePh = isPlaceholder(existing.text);
      const nPh = isPlaceholder(n.text);
      const eDisc = !!existing.isDiscovered;
      const nDisc = !!n.isDiscovered;
      let takeNew = false;
      if (!eDisc && nDisc) takeNew = true;
      else if (eDisc && !nDisc) takeNew = false;
      else if (ePh && !nPh) takeNew = true;
      else if (!ePh && nPh) takeNew = false;
      else if ((n.timestamp || 0) > (existing.timestamp || 0)) takeNew = true;
      if (takeNew) pickMap.set(key, { ...existing, ...n });
    }
    const nodesArr = Array.from(pickMap.values());
    const turnGroups = new Map(); // turnIndex -> [variants]
    for (const n of nodesArr) {
      n.children = [];
      n.parentId = null;
      const ti = n.turnIndex || 0;
      if (!turnGroups.has(ti)) turnGroups.set(ti, []);
      turnGroups.get(ti).push(n);
    }
    const orderedTurnIndexes = Array.from(turnGroups.keys()).sort(
      (a, b) => a - b
    );
    const root = { id: "ROOT", children: [] };
    let prevActive = null;
    for (let i = 0; i < orderedTurnIndexes.length; i++) {
      const group = turnGroups.get(orderedTurnIndexes[i]);
      if (i === 0) {
        for (const n of group) {
          n.parentId = root.id;
          root.children.push(n.id);
        }
      } else if (prevActive) {
        for (const n of group) {
          n.parentId = prevActive.id;
          prevActive.children.push(n.id);
        }
      }
      prevActive = group.find((n) => n.isActive) || group[0];
    }
    const newMap = new Map();
    for (const n of nodesArr) newMap.set(n.id, n);
    this.lean = { root, nodes: newMap };
  }

  /**
   * Build a lean in-memory structure: variant-only chain.
   * Schema:
   *   this.lean = {
   *     root: { id: 'ROOT', children: [variantNodeIds] },
   *     nodes: Map<id, { id, role, text, turnIndex, variantIndex, children: [] }>
   *   }
   * Each turn's variants become sibling nodes. Children of the active variant of a turn
   * are the variants of the next turn (forming a chain). No duplicate heavy fields.
   */
  buildLeanStructure(branches) {
    const priorMap =
      this.lean?.nodes instanceof Map ? this.lean.nodes : new Map();
    const turns = this.groupBranchesByTurn(branches || []);
    const variantMap = new Map(); // variantId -> node
    const placeholder = (txt) => {
      if (txt == null) return true;
      const t = String(txt).trim();
      if (!t) return true;
      if (/^[0-9]{1,3}$/.test(t)) return true;
      if (t.length <= 3) return true;
      return false;
    };

    const safe = (s) => {
      if (s == null) return "";
      if (typeof s === "string") return s.replace(/\s+/g, " ").trim();
      return String(s).replace(/\s+/g, " ").trim();
    };

    const perTurn = [];
    const dedupePerTurn = new Map(); // turnIndex -> variantIndex -> node
    for (const turn of turns) {
      const list = [];
      for (const v of turn.variants || []) {
        if (!v || !v.id) continue;
        const vid = v.id; // stable variant id
        const text = safe(v.preview || v.userPrompt || v.id);
        const existing = priorMap.get(vid);
        let node;
        if (existing) {
          // Upgrade discovery if new variant now has meaningful text
          const upgraded =
            (!existing.isDiscovered && v.isDiscovered) ||
            (existing.isDiscovered &&
              v.isDiscovered &&
              !placeholder(text) &&
              placeholder(existing.text));
          if (upgraded) {
            existing.text = text;
            existing.textHash = v.textHash || existing.textHash;
            existing.isDiscovered = true;
          }
          existing.isActive = !!v.isActive;
          existing.timestamp = v.timestamp || existing.timestamp;
          existing.turnIndex = turn.turnIndex;
          existing.variantIndex = v.variantIndex;
          existing.role = turn.role;
          node = existing;
        } else {
          node = {
            id: vid,
            variantId: vid,
            role: turn.role,
            text,
            turnIndex: turn.turnIndex,
            variantIndex: v.variantIndex,
            turnId: turn.turnId || turn.id,
            children: [],
            parentId: null,
            isDiscovered: !!v.isDiscovered && !placeholder(text),
            isActive: !!v.isActive,
            textHash: v.textHash || null,
            timestamp: v.timestamp,
          };
        }
        // Consolidate by (turnIndex, variantIndex) possibly across differing turnIds
        const key = `${turn.turnIndex}:${v.variantIndex}`;
        let chosen = dedupePerTurn.get(key);
        if (!chosen) {
          dedupePerTurn.set(key, node);
          variantMap.set(vid, node);
          list.push(node);
        } else {
          // Decide upgrade rules between chosen and node
          const chosenPh = placeholder(chosen.text);
          const nodePh = placeholder(node.text);
          const chosenDisc = !!chosen.isDiscovered;
          const nodeDisc = !!node.isDiscovered;
          let takeNode = false;
          if (!chosenDisc && nodeDisc) takeNode = true;
          else if (chosenDisc && !nodeDisc) takeNode = false;
          else if (chosenPh && !nodePh) takeNode = true;
          else if (!chosenPh && nodePh) takeNode = false;
          else if ((node.timestamp || 0) > (chosen.timestamp || 0))
            takeNode = true;
          if (takeNode) {
            // Replace chosen
            dedupePerTurn.set(key, node);
            // Remove old from list & variantMap
            const idx = list.indexOf(chosen);
            if (idx >= 0) list.splice(idx, 1, node);
            else list.push(node);
            variantMap.delete(chosen.id);
            variantMap.set(vid, node);
          }
        }
      }
      if (list.length)
        perTurn.push({ turnIndex: turn.turnIndex, variants: list });
    }

    // Rebuild hierarchy
    perTurn.sort((a, b) => a.turnIndex - b.turnIndex);
    const root = { id: "ROOT", children: [] };
    let prevActive = null;
    for (let i = 0; i < perTurn.length; i++) {
      const group = perTurn[i].variants;
      if (i === 0) {
        for (const n of group) {
          n.parentId = root.id;
          root.children.push(n.id);
        }
      } else if (prevActive) {
        for (const n of group) {
          n.parentId = prevActive.id;
          prevActive.children.push(n.id);
        }
      }
      prevActive = group.find((n) => n.isActive) || group[0];
    }

    this.lean = { root, nodes: variantMap };
  }

  /** Return lean state shaped similarly to previous getTreeState for compatibility */
  getLeanState() {
    if (!this.lean) return { nodeCount: 0, nodes: [], rootChildren: [] };
    return {
      nodeCount: this.lean.nodes.size,
      nodes: Array.from(this.lean.nodes.values()), // plain node objects
      rootChildren: [...this.lean.root.children],
    };
  }

  /** Return lean tree snapshot */
  getLeanTree() {
    if (!this.lean) return null;
    return {
      root: { ...this.lean.root },
      nodes: Array.from(this.lean.nodes.values()).map((n) => ({ ...n })),
    };
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
      const id = branch.id || branch.turnId;

      if (!turnMap.has(turnIndex)) {
        turnMap.set(turnIndex, {
          turnId: id,
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
          id: `${id}_v${branch.currentVariant || 1}`,
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
   * Create branches array from variants data
   * @param {Array} variants - Array of variant data
   * @param {Object} branchData - Original branch data
   * @returns {Array} Array of branch objects with userPrompt and nodes
   */
  createBranchesFromVariants(variants, branchData) {
    const branches = [];

    variants.forEach((variant, index) => {
      // Extract user prompt from the previous turn or context
      const userPrompt = this.extractUserPromptForVariant(variant, branchData);

      branches.push({
        id: variant.id,
        variantIndex: variant.variantIndex,
        userPrompt: userPrompt,
        preview: variant.preview,
        isActive: variant.isActive,
        nodes: [], // Can contain sub-nodes which can have their own branches
        timestamp: variant.timestamp || branchData.timestamp,
        textHash: variant.textHash,
      });
    });

    return branches;
  }

  /**
   * Extract user prompt that led to this variant
   * @param {Object} variant - Variant data
   * @param {Object} branchData - Branch data
   * @returns {string} User prompt or fallback text
   */
  extractUserPromptForVariant(variant, branchData) {
    // Try to find the user prompt from the conversation context
    // This would typically be the previous user message that led to this assistant response

    if (branchData.role === "assistant") {
      // For assistant responses, try to find the preceding user message
      const userPrompt = this.findPrecedingUserMessage(branchData);
      if (userPrompt) {
        return `"${userPrompt}" → Variant ${variant.variantIndex}`;
      }
      return `Response variant ${variant.variantIndex}`;
    } else if (branchData.role === "user") {
      // For user messages, use the actual content as the prompt
      const content =
        variant.preview || branchData.element?.textContent?.trim();
      if (content && content.length > 3) {
        const truncated =
          content.length > 50 ? content.substring(0, 47) + "..." : content;
        return truncated;
      }
      return `User input ${variant.variantIndex}`;
    }

    return `${branchData.role} variant ${variant.variantIndex}`;
  }

  /**
   * Find the preceding user message for an assistant response
   * @param {Object} branchData - Branch data for assistant response
   * @returns {string|null} User message text or null if not found
   */
  findPrecedingUserMessage(branchData) {
    try {
      // Look for the previous conversation turn in the DOM
      const currentElement = branchData.element;
      if (!currentElement) return null;

      // Find all conversation turns
      const allTurns = Array.from(
        document.querySelectorAll(
          '[data-testid="conversation-turn"], article, .group\\/conversation-turn'
        )
      );
      const currentIndex = allTurns.indexOf(currentElement);

      if (currentIndex > 0) {
        // Look at the previous turn
        const previousTurn = allTurns[currentIndex - 1];

        // Extract text content, avoiding navigation elements
        const textContent = previousTurn.textContent?.trim();
        if (textContent) {
          // Clean up and truncate
          let cleanText = textContent
            .replace(/\d+\/\d+/g, "")
            .replace(/Previous response|Next response/gi, "")
            .trim();
          cleanText = cleanText.replace(/\s+/g, " ");

          if (cleanText.length > 60) {
            cleanText = cleanText.substring(0, 57) + "...";
          }

          return cleanText || null;
        }
      }
    } catch (error) {
      console.warn("Error finding preceding user message:", error);
    }

    return null;
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

      // Notify callbacks
      this.notifyTreeUpdated();
    }
  }

  /**
   * Clear the entire tree
   */
  clear() {
    this.nodes.clear();
    this.currentPath = [];
    this.rootBranches = [];
  }

  /**
   * Get tree summary for debugging
   * @returns {Object} Tree summary
   */
  getTreeSummary() {
    return {
      nodeCount: this.nodes.size,
      rootBranches: this.rootBranches.length,
      currentPathLength: this.currentPath.length,
      nodes: Array.from(this.nodes.keys()),
    };
  }

  /**
   * Export tree data for storage
   * @returns {Object} Serializable tree data
   */
  exportData() {
    // Legacy heavy export retained only if needed; prefer lean
    const lean = this.getLeanTree();
    if (lean) return { version: "lean-1", lean };
    return { version: "lean-1", lean: null };
  }

  /** Export only lean minimal structure explicitly */
  exportLean() {
    return this.getLeanTree();
  }

  /**
   * Get tree state for callbacks (compatible with StorageManager)
   * @returns {Object} Tree state data
   */
  getTreeState() {
    return {
      nodeCount: this.nodes.size,
      rootBranches: this.rootBranches,
      currentPath: this.currentPath,
      nodes: Array.from(this.nodes.entries()),
    };
  }

  /**
   * Get comprehensive tree state (includes all historical nodes)
   * @param {string} conversationId - Conversation ID for loading stored data
   * @returns {Promise<Object>} Complete tree state with all discovered nodes
   */
  async getComprehensiveTreeState(conversationId) {
    try {
      const storedLean = await extensionState.storageManager?.loadLeanTree(
        conversationId
      );
      console.log("Loaded stored lean tree:", storedLean);
      return storedLean;
    } catch (e) {
      console.error("Lean comprehensive retrieval fallback:", e);
      // return this.getLeanState();
    }
  }

  /**
   * Save current tree state to comprehensive storage
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<boolean>} Success status
   */
  async saveToComprehensiveStorage(conversationId) {
    try {
      if (!extensionState.storageManager) return false;
      if (!this.lean) return false;
      return await extensionState.storageManager.saveLeanTree(
        conversationId,
        this.getLeanState()
      );
    } catch (e) {
      console.error("Error saving lean tree:", e);
      return false;
    }
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

    try {
      // Handle nodes - data.nodes is already an array of [key, value] pairs
      if (Array.isArray(data.nodes)) {
        const nodesMap = new Map();
        for (const [nodeId, nodeData] of data.nodes) {
          // Ensure branches property exists, create it if missing
          if (!nodeData.branches && nodeData.variants) {
            nodeData.branches = this.createBranchesFromVariants(
              nodeData.variants,
              nodeData
            );
          }
          nodesMap.set(nodeId, nodeData);
        }
        this.nodes = nodesMap;
      }

      // Handle current path
      if (Array.isArray(data.currentPath)) {
        this.currentPath = [...data.currentPath];
      }

      // Handle root branches
      if (Array.isArray(data.rootBranches)) {
        this.rootBranches = [...data.rootBranches];
      }

      // Notify that tree was updated
      this.notifyTreeUpdated();
    } catch (error) {
      console.error("Error importing tree data:", error);
      this.clear(); // Reset to clean state on error
    }
  }
}
