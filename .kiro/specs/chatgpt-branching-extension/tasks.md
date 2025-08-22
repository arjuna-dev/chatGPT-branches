# Implementation Plan

- [x] 1. Set up Chrome extension project structure and core configuration

  - Create manifest.json with content script permissions for ChatGPT domains
  - Set up basic project directory structure with src/, styles/, and assets/ folders
  - Configure content script injection for chatgpt.com domain
  - _Requirements: 7.1, 7.2_

- [x] 2. Implement DOM detection and conversation ID extraction

  - Create utility functions to extract conversation ID from ChatGPT URL patterns
  - Implement turn container detection using priority selectors ([data-testid="conversation-turn"], article, li[role="listitem"])
  - Write functions to identify conversation container and set up DOM observation targets
  - _Requirements: 8.3, 8.6, 5.6_

- [x] 3. Build branch detection core functionality

  - Implement variant indicator detection using .tabular-nums selector with /^\d+\/\d+$/ pattern
  - Create functions to verify presence of Previous/Next response buttons using aria-label selectors
  - Write turn role classification logic to distinguish user vs assistant messages
  - Implement stable turn ID generation with fallback strategies
  - _Requirements: 8.1, 8.2, 8.4, 8.6, 8.7_

- [x] 4. Create conversation tree data structure and management

  - Implement BranchNode interface and ConversationTree data structure
  - Write methods for adding nodes, linking parent-child relationships, and updating current path
  - Create functions to identify root branches and retrieve sub-branches for any node
  - Implement tree traversal and path finding algorithms
  - _Requirements: 5.1, 5.4, 5.6_

- [x] 5. Implement localStorage persistence system

  - Create StorageManager class with save/load methods for conversation trees
  - Implement conversation-specific storage keys using conversation ID
  - Write functions to persist and retrieve user customizations (branch names, colors)
  - Add data validation and migration handling for storage schema changes
  - _Requirements: 3.1, 3.2, 3.3, 5.6_

- [x] 6. Build MutationObserver system for dynamic updates

  - Implement MutationObserver to monitor conversation container for DOM changes
  - Create event handlers for detecting new branches when users navigate variants
  - Write logic to capture variant changes and update tree structure incrementally
  - Implement throttling to prevent excessive DOM scanning during rapid changes
  - _Requirements: 5.2, 5.3, 5.5, 7.4_

- [x] 7. Create basic UI foundation and CSS integration

  - Write CSS styles that integrate with ChatGPT's design system
  - Implement base UI container injection at top of ChatGPT interface
  - Create responsive layout that doesn't interfere with ChatGPT functionality
  - Add CSS classes for tabs, menus, and floating elements
  - _Requirements: 1.1, 1.2, 7.1, 7.3_

- [x] 8. Implement root branch tab rendering system

  - Create TabRenderer class to generate and manage branch tabs
  - Implement tab click handlers for branch navigation
  - Add horizontal scrolling support for tab overflow scenarios
  - Write tab update logic to reflect current active branch
  - _Requirements: 1.1, 1.2, 1.3, 1.6_

- [x] 9. Build branch navigation controller

  - Implement NavigationController to programmatically click ChatGPT's variant buttons
  - Create path navigation logic to reach specific branches through button sequences
  - Add navigation validation to confirm reaching intended branch
  - Implement timeout and error handling for failed navigation attempts
  - _Requirements: 1.3, 2.3, 5.3_

- [ ] 10. Add branch renaming functionality

  - Create right-click context menu
  - One menu item for renaming node
  - Add persistence for custom branch names
  - Write UI feedback for successful/failed rename operations
  - _Requirements: 1.4, 2.2, 3.1, 3.5_

- [x] 12. Build hover menu system for sub-branches

  - Implement hover detection and menu positioning for root tabs
  - Create dropdown menu rendering with sub-branch items
  - Add nested sub-menu support for deeper branch hierarchies
  - Implement menu item click handlers for sub-branch navigation
  - Add buttons "<" and ">" like in the original chatgpt UI on our node buttons where clicking those take you to the next branch
  - When clicking on hover menu items we will have the same functionality mimicking clicks so we go to the correct branch. If next branch we simulate a click on either "<" or ">". If 2 places to the left we simulate to clicks on "<".
  - Clicking on the node button should scroll down to that NODE!
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 13. Add comprehensive error handling and recovery

  - Implement graceful degradation when DOM detection fails
  - Add retry logic for failed branch detection and navigation
  - Create error logging and user feedback for extension issues
  - Write fallback behaviors to maintain ChatGPT functionality if extension fails
  - _Requirements: 7.5, 8.4_

- [x] 14. Refactor monolithic content.js into modular architecture

  - Extract DOM utilities into src/utils/dom-utils.js module
  - Extract StorageManager class into src/core/storage-manager.js module
  - Extract TreeBuilder class into src/core/tree-builder.js module
  - Extract BranchDetector class into src/core/branch-detector.js module
  - Create modular main content.js that imports and coordinates all modules
  - Update manifest.json to support ES6 modules with "type": "module"
  - _Requirements: Code maintainability and organization_

- [x] 15. Implement tree visualization with floating button

  - Create sticky floating button in top-right corner with tree icon
  - Implement full-screen modal overlay for tree visualization
  - Build tree visualization showing all nodes with their variants and branches
  - Add interactive navigation from tree view to specific variants
  - Include proper styling with glass morphism design and hover effects
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 16. Enhance tree visualization with comprehensive node storage

  - Implement comprehensive tree storage that accumulates ALL discovered nodes across sessions
  - Add methods to merge new nodes with previously stored nodes in localStorage
  - Update tree visualization to show complete historical tree data
  - Add tree statistics display (total nodes, sessions, comprehensive vs current)
  - Implement automatic saving to comprehensive storage when tree is updated
  - _Requirements: 4.1, 4.4, 5.1, 5.3_
