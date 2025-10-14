# Selected Text Analyzer

A Chrome Manifest V3 extension that allows you to analyze selected text or full page text with detailed character, word, and line counts.

## Features

- **Analyze Selected Text**: Right-click on selected text and choose "Analyze selected text" from the context menu
- **Analyze Full Page**: Click the extension icon to analyze all text on the current page
- **Detailed Analysis**: Get counts for:
  - Total characters
  - Characters (excluding spaces)
  - Words
  - Lines
- **Copy Functionality**: Copy analyzed text to clipboard with one click
- **Clean UI**: Modern, user-friendly interface with text preview

## Installation

1. Clone this repository or download the extension files
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `extensions/selected-text-analyzer` directory
6. The extension is now installed and ready to use!

## Usage

### Analyzing Selected Text

1. Select any text on a webpage
2. Right-click on the selected text
3. Choose "Analyze selected text" from the context menu
4. The extension popup will open with text information
5. Click "Run Analysis" to see detailed counts
6. Click "Copy Text" to copy the text to clipboard

### Analyzing Full Page Text

1. Click the extension icon in the Chrome toolbar
2. The extension popup will open with all page text captured
3. Click "Run Analysis" to see detailed counts
4. Click "Copy Text" to copy the text to clipboard

## Files Structure

- `manifest.json` - Extension manifest with permissions and configuration
- `background.js` - Service worker handling context menus and actions
- `popup.html` - Popup UI with styled interface
- `popup.js` - Popup logic for analysis and user interactions
- `README.md` - This documentation file

## Permissions

- `activeTab` - Access to the active tab for text extraction
- `scripting` - Ability to inject scripts to get page text
- `contextMenus` - Create context menu items
- `storage` - Store analyzed text between popup opens

## Technical Details

- Built with Chrome Manifest V3
- Uses Service Worker instead of background pages
- Implements modern Chrome Extensions API
- Vanilla JavaScript (no external dependencies)
- Responsive and accessible UI design

## Testing

To test the extension:

1. Install the extension following the installation steps
2. Navigate to any webpage with text
3. Test context menu: Select text → Right-click → Choose "Analyze selected text"
4. Test action click: Click extension icon to analyze full page
5. Verify analysis results show correct counts
6. Test copy functionality

## License

Part of the LLM repository project.
