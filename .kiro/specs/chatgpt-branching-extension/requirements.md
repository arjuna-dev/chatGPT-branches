# Requirements Document

## Introduction

The ChatGPT Branching Extension is a Chrome extension designed to enhance the visualization and navigation of ChatGPT conversation branches using an incremental, DOM-only approach. Currently, users struggle with navigating conversation branches created by editing messages, as they must scroll extensively to find divergence points and lack a clear global view of available branches. This extension will incrementally learn the branch structure as users navigate, building a tree over time by observing variant indicators (like "1/2" with navigation buttons) and tracking content changes through MutationObserver. It provides an intuitive tabbed interface for discovered branches, hover menus for sub-branches, and persistent customization options stored per conversation in localStorage.

## Requirements

### Requirement 1

**User Story:** As a ChatGPT user, I want to see discovered conversation branches as tabs at the top of the screen, so that I can easily switch between them without scrolling through the entire conversation.

#### Acceptance Criteria

1. WHEN the extension has discovered multiple branch paths THEN the system SHALL display them as rounded pill-shaped tabs at the top of the ChatGPT interface
2. WHEN there are more tabs than can fit horizontally THEN the system SHALL make the tabs smaller.
3. WHEN a user clicks on a tab THEN the system SHALL navigate to that specific branch path by programmatically clicking the appropriate variant navigation buttons
4. WHEN a user double-clicks on a tab THEN the system SHALL enable inline editing to rename the branch
5. WHEN a user right-clicks on a tab THEN the system SHALL display a context menu for selecting tab colors
6. WHEN initially loading a conversation THEN the system SHALL show only the current path until other branches are discovered through navigation

### Requirement 2

**User Story:** As a user who creates sub-branches, I want hover menus to show available sub-branches with nested sub-menus for deeper levels, so that I can quickly navigate the hierarchy without losing orientation.

#### Acceptance Criteria

1. WHEN a user hovers over a root tab THEN the system SHALL display a dropdown menu showing all sub-branches
2. WHEN a sub-branch has its own children THEN the system SHALL display a nested sub-menu when hovering over that sub-branch item
3. WHEN a user clicks on any branch or sub-branch in the menu THEN the system SHALL navigate to that specific branch in ChatGPT
4. WHEN displaying menu items THEN the system SHALL show a pencil icon for each item to enable renaming
5. WHEN a user clicks the pencil icon THEN the system SHALL enable inline editing for that branch name

### Requirement 3

**User Story:** As a user with many branches, I want to rename and color-code branches, so that I can easily distinguish and organize them for better workflow management.

#### Acceptance Criteria

1. WHEN a user renames a branch THEN the system SHALL persist the custom name using localStorage
2. WHEN a user assigns a color to a branch THEN the system SHALL persist the color assignment using localStorage
3. WHEN the user returns to the same conversation in a new session THEN the system SHALL restore all renamed branch names and color assignments
4. WHEN displaying tabs THEN the system SHALL apply the user-assigned colors to the respective tabs
5. IF no custom name is assigned THEN the system SHALL display a default branch identifier

### Requirement 4

**User Story:** As a user exploring multiple conversation paths, I want a floating button that provides access to a global branch map, so that I can understand the overall structure of my conversation.

#### Acceptance Criteria

1. WHEN the extension is active THEN the system SHALL display a fixed floating button in the top-right corner of the interface
2. WHEN a user clicks the floating button in MVP THEN the system SHALL show a modal with placeholder text "Graph view coming soon"
3. WHEN the page layout changes THEN the system SHALL maintain the floating button position without interfering with ChatGPT functionality
4. WHEN preparing for iteration 2 THEN the system SHALL be designed to support full graph visualization with pan, zoom, and search capabilities

### Requirement 5

**User Story:** As a ChatGPT user, I want the extension to incrementally learn and track conversation branches as I navigate, so that it builds an accurate branch map without requiring complex upfront parsing.

#### Acceptance Criteria

1. WHEN the extension loads THEN the system SHALL parse the current visible page to build a linear list of conversation turns
2. WHEN a turn displays variant indicators (like "1/2" with ◀ ▶ buttons) THEN the system SHALL record it as a branch point with the variant count and active variant number
3. WHEN the user navigates to different variants using next/previous buttons THEN the system SHALL capture the new variant information and content fingerprint
4. WHEN a new variant is discovered THEN the system SHALL add it as a sibling node and connect any downstream turns as children of that variant
5. WHEN tracking conversation state THEN the system SHALL use MutationObserver to detect DOM changes in the conversation container
6. WHEN storing branch data THEN the system SHALL persist nodes (with turnIndex, variantIndex, textHash, role, timestamp) and edges (parentId, childId) in localStorage using conversation ID as the key

### Requirement 8

**User Story:** As a developer implementing the extension, I want to reliably detect conversation branches using specific DOM selectors, so that the extension works consistently with ChatGPT's current interface structure.

#### Acceptance Criteria

1. WHEN detecting branch points THEN the system SHALL identify turns containing elements with `div .tabular-nums` whose textContent matches the pattern `/^\d+\/\d+$/`
2. WHEN confirming branch navigation controls THEN the system SHALL verify the presence of `button[aria-label="Previous response"]` and `button[aria-label="Next response"]` elements
3. WHEN identifying conversation turns THEN the system SHALL search for turn containers using selectors `[data-testid="conversation-turn"]`, `article`, or `li[role="listitem"]` in that priority order
4. WHEN a turn lacks variant navigation elements THEN the system SHALL treat it as a non-branching turn with only the current variant
5. WHEN parsing variant information THEN the system SHALL extract current and total variant numbers from the tabular-nums element text content
6. WHEN determining turn identity THEN the system SHALL prefer stable attributes like `data-message-id`, `data-turn-id`, or `data-testid` with index, falling back to synthesized deterministic IDs using content hash and DOM path
7. WHEN classifying turn roles THEN the system SHALL determine if a turn is user or assistant by examining DOM structure, aria-labels, or column positioning within the conversation layout

### Requirement 6

**User Story:** As a user with accessibility needs, I want to navigate the branch interface using keyboard controls, so that I can use the extension effectively without relying solely on mouse interactions.

#### Acceptance Criteria

1. WHEN using keyboard navigation THEN the system SHALL allow tabbing through all interactive elements in logical order
2. WHEN a tab or menu item has focus THEN the system SHALL provide clear visual focus indicators
3. WHEN pressing Enter on a focused branch element THEN the system SHALL navigate to that branch
4. WHEN pressing Escape THEN the system SHALL close any open hover menus or modal dialogs
5. WHEN using screen readers THEN the system SHALL provide appropriate ARIA labels and descriptions for all interactive elements

### Requirement 7

**User Story:** As a ChatGPT user, I want the extension to be lightweight and responsive, so that it doesn't interfere with my normal ChatGPT usage experience.

#### Acceptance Criteria

1. WHEN the extension is running THEN the system SHALL NOT cause noticeable performance degradation to the ChatGPT interface
2. WHEN DOM changes occur THEN the system SHALL update the branch interface within 500ms
3. WHEN multiple branches exist THEN the system SHALL handle up to 50 branches without performance issues
4. WHEN localStorage operations occur THEN the system SHALL complete them without blocking the UI thread
5. IF the extension encounters errors THEN the system SHALL fail gracefully without breaking ChatGPT functionality
