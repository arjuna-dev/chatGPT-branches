# ChatGPT Branching Extension

A Chrome extension that enhances the visualization and navigation of ChatGPT conversation branches.

## Features

- **Branch Tabs**: Display conversation branches as tabs at the top of the interface
- **Hover Menus**: Navigate sub-branches through intuitive hover menus
- **Customization**: Rename branches and assign colors for better organization
- **Incremental Learning**: Builds branch tree as you navigate, no complex parsing required
- **Persistent Storage**: Saves customizations per conversation using localStorage

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension directory
5. Navigate to ChatGPT and start using branches!

## Development

### Project Structure

```
├── manifest.json          # Extension configuration
├── src/
│   ├── content.js         # Main content script
│   └── background.js      # Service worker
├── styles/
│   └── extension.css      # Extension styles
├── assets/
│   └── (icons)           # Extension icons
└── README.md
```

### Implementation Status

This extension is built incrementally following the spec-driven development approach:

- [x] Task 1: Project structure and configuration
- [ ] Task 2: DOM detection and conversation ID extraction
- [ ] Task 3: Branch detection core functionality
- [ ] Task 4: Conversation tree data structure
- [ ] Task 5: localStorage persistence system
- [ ] ... (see tasks.md for complete list)

## Architecture

The extension uses a DOM-only approach to detect conversation branches by:

1. **Observing** ChatGPT's interface for variant indicators (like "1/2" counters)
2. **Learning** the branch structure incrementally as users navigate
3. **Building** a conversation tree without requiring API access
4. **Persisting** branch data and customizations in localStorage

## Requirements

- Chrome browser (Manifest V3 compatible)
- Access to ChatGPT (chatgpt.com or chat.openai.com)

## License

MIT License - see LICENSE file for details
