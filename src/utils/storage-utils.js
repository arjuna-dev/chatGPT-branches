// ============================================================================
// STORAGE UTILITIES
// ============================================================================

/**
 * Get storage statistics
 * @returns {Object} Storage statistics
 */
export function getStorageStatistics() {
  if (!extensionState.storageManager) {
    return { error: "Storage manager not available" };
  }

  return extensionState.storageManager.getStorageStats();
}

/**
 * Clear conversation data
 * @param {string} conversationId - Conversation ID to clear
 * @returns {Promise<boolean>} Success status
 */
export async function clearConversationData(conversationId) {
  if (!extensionState.storageManager) {
    console.error("Storage manager not available");
    return false;
  }

  return await extensionState.storageManager.clearConversation(conversationId);
}

/**
 * Export conversation data for backup
 * @param {string} conversationId - Conversation ID to export
 * @returns {Promise<Object|null>} Exported data or null if failed
 */
export async function exportConversationData(conversationId) {
  if (!extensionState.storageManager) {
    console.error("Storage manager not available");
    return null;
  }

  try {
    const treeData = await extensionState.storageManager.loadConversationTree(
      conversationId
    );
    const customizations =
      await extensionState.storageManager.loadCustomizations(conversationId);

    return {
      conversationId,
      exportTimestamp: Date.now(),
      treeData,
      customizations,
    };
  } catch (error) {
    console.error("Failed to export conversation data:", error);
    return null;
  }
}

/**
 * Import conversation data from backup
 * @param {Object} data - Data to import
 * @returns {Promise<boolean>} Success status
 */
export async function importConversationData(data) {
  if (!extensionState.storageManager) {
    console.error("Storage manager not available");
    return false;
  }

  try {
    const { conversationId, treeData, customizations } = data;

    if (!conversationId) {
      console.error("Invalid import data: missing conversation ID");
      return false;
    }

    // Import tree data
    if (treeData) {
      await extensionState.storageManager.saveConversationTree(
        conversationId,
        treeData
      );
    }

    // Import customizations
    if (customizations) {
      await extensionState.storageManager.saveCustomizations(
        conversationId,
        customizations
      );
    }

    console.log(
      `Successfully imported data for conversation ${conversationId}`
    );
    return true;
  } catch (error) {
    console.error("Failed to import conversation data:", error);
    return false;
  }
}
