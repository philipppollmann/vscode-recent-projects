# Recent Projects Switcher for VS Code

A JetBrains-inspired project switcher for Visual Studio Code. Quickly switch between your recent projects with a single click or keyboard shortcut.

## Features

- **📂 Status Bar Project Indicator** — Shows your current project name in the status bar (left side). Click to open the project switcher.
- **🔍 Quick Search** — Filter through your recent projects by name or path.
- **🪟 Flexible Opening** — Open projects in the current window or a new window (inline button).
- **🕐 Recent Tracking** — Automatically tracks projects as you open them. Shows how long ago each project was last opened.
- **📌 Pinned Projects** — Keep important projects in the list even when the recent-project limit is reached.
- **⌨️ Keyboard Shortcut** — `Ctrl+Alt+P` (macOS: `Cmd+Alt+P`) to instantly open the switcher.

## Installation

### From the VS Code Marketplace

1. Open VS Code.
2. Press `Ctrl+Shift+X` (macOS: `Cmd+Shift+X`) to open the Extensions panel.
3. Search for **"Recent Projects"** by `philipppollmann`.
4. Click **Install**.

### From a .vsix File (manual)

1. **Prerequisites:** [Node.js](https://nodejs.org) (v18+) and npm.
2. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/philipppollmann/vscode-recent-projects.git
   cd vscode-recent-projects
   npm install
   ```
3. Build and package the extension:
   ```bash
   npm run package
   ```
   This generates a `recent-projects-switcher-*.vsix` file in the project root.
4. Install the `.vsix` in VS Code:
   - Open the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).
   - Click the **`...`** menu (top-right of the panel) → **Install from VSIX…**
   - Select the generated `.vsix` file.
5. Reload VS Code when prompted.

## Usage

1. **Click the project name** in the status bar (bottom-left) to open the project switcher.
2. **Search** for a project by typing its name or path.
3. **Click** a project to open it in the current window.
4. **Use the window icon** (right side of each item) to open in a new window.
5. **Use the pin icon** to keep a project in the list.
6. **Use the trash icon** to remove a project from the list.

## Commands

| Command | Description |
|---------|-------------|
| `Recent Projects: Switch Project` | Open the project switcher dropdown |
| `Recent Projects: Add Project to List` | Add a project folder manually |
| `Recent Projects: Remove Project from List` | Remove a project from the list |
| `Recent Projects: Pin Project` | Keep a project in the list |
| `Recent Projects: Unpin Project` | Allow a project to be trimmed by the recent-project limit |
| `Recent Projects: Clear All Projects` | Clear the entire project list |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `recentProjects.maxProjects` | `20` | Maximum number of recent projects to remember |
| `recentProjects.openInNewWindow` | `false` | Open projects in a new window by default |
| `recentProjects.showFullPath` | `true` | Show the full path in the project switcher dropdown |
| `recentProjects.statusBarText` | `"short"` | Show `"short"` (folder name) or `"full"` (full path) in the status bar |

## Keyboard Shortcuts

| Shortcut | Command |
|----------|---------|
| `Ctrl+Alt+P` / `Cmd+Alt+P` | Open the project switcher |

## Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package as .vsix
npm run package
```

Press **F5** in VS Code to launch the Extension Development Host for testing.

## License

MIT
