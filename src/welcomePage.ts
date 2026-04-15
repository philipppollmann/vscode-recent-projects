import * as vscode from "vscode";
import * as path from "path";
import { ProjectManager, ProjectEntry, ProjectGroup } from "./projectManager";

const PRESET_COLORS = [
  { label: "Blue", color: "#4A90D9" },
  { label: "Green", color: "#5FAD41" },
  { label: "Purple", color: "#7B5EA7" },
  { label: "Orange", color: "#E07B39" },
  { label: "Red", color: "#D94A4A" },
  { label: "Teal", color: "#3DA1A1" },
  { label: "Pink", color: "#D94A8E" },
  { label: "Yellow", color: "#D9B84A" },
  { label: "Gray", color: "#6B7280" },
];

const PRESET_ICONS = [
  "🚀", "💻", "🌐", "📱", "🎮", "🔧", "⚙️", "📦", "🎯", "🔬",
  "📊", "🎨", "🏗️", "🔐", "📝", "🛠️", "🌟", "💡", "🔥", "🌈",
  "🐍", "🦀", "☕", "🎭", "🏠", "🌿", "⚡", "🔮", "🦄", "🐳",
];

export class WelcomePage {
  private panel: vscode.WebviewPanel | undefined;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly projectManager: ProjectManager
  ) {
    projectManager.onDidChangeProjects(() => this.updateContent());
  }

  show(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      "recentProjectsWelcome",
      "Projects",
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.onDidDispose(() => {
      this.panel = undefined;
    }, null, this.context.subscriptions);

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.context.subscriptions
    );

    this.updateContent();
  }

  private updateContent(): void {
    if (!this.panel) {
      return;
    }
    const projects = this.projectManager.getProjects();
    const groups = this.projectManager.getGroups();
    this.panel.webview.html = this.getHtml(projects, groups);
  }

  private async handleMessage(message: {
    command: string;
    path?: string;
    entry?: ProjectEntry;
    groupId?: string;
    name?: string;
  }): Promise<void> {
    switch (message.command) {
      case "openProject": {
        if (!message.entry) { return; }
        const folderUri = vscode.Uri.file(message.entry.path);
        await this.projectManager.addProject(message.entry.path);
        await vscode.commands.executeCommand("vscode.openFolder", folderUri, {
          forceNewWindow: true,
        });
        break;
      }
      case "addProject": {
        const uris = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          openLabel: "Add Project",
          title: "Select a project folder",
        });
        if (uris && uris.length > 0) {
          await this.projectManager.addProject(uris[0].fsPath);
        }
        break;
      }
      case "removeProject": {
        if (!message.path) { return; }
        const name = path.basename(message.path);
        const confirm = await vscode.window.showWarningMessage(
          `Remove "${name}" from the project list?`,
          { modal: true },
          "Remove"
        );
        if (confirm === "Remove") {
          await this.projectManager.removeProject(message.path);
        }
        break;
      }
      case "editColor": {
        if (!message.path) { return; }
        await pickAndApplyColor(this.projectManager, message.path);
        break;
      }
      case "editIcon": {
        if (!message.path) { return; }
        await pickAndApplyIcon(this.projectManager, message.path);
        break;
      }
      case "createGroup": {
        const groupName = await vscode.window.showInputBox({
          title: "New Group",
          prompt: "Enter a name for the group",
          placeHolder: "e.g. Work, Personal, Client XYZ",
          validateInput: (v) => v.trim() ? null : "Name cannot be empty",
        });
        if (groupName?.trim()) {
          await this.projectManager.createGroup(groupName.trim());
        }
        break;
      }
      case "renameGroup": {
        if (!message.groupId) { return; }
        const groups = this.projectManager.getGroups();
        const group = groups.find((g) => g.id === message.groupId);
        if (!group) { return; }
        const newName = await vscode.window.showInputBox({
          title: "Rename Group",
          prompt: "Enter a new name",
          value: group.name,
          validateInput: (v) => v.trim() ? null : "Name cannot be empty",
        });
        if (newName?.trim()) {
          await this.projectManager.renameGroup(message.groupId, newName.trim());
        }
        break;
      }
      case "deleteGroup": {
        if (!message.groupId) { return; }
        const groups = this.projectManager.getGroups();
        const group = groups.find((g) => g.id === message.groupId);
        const confirm = await vscode.window.showWarningMessage(
          `Delete group "${group?.name ?? message.groupId}"? Projects will not be deleted, just ungrouped.`,
          { modal: true },
          "Delete"
        );
        if (confirm === "Delete") {
          await this.projectManager.removeGroup(message.groupId);
        }
        break;
      }
      case "assignGroup": {
        if (!message.path) { return; }
        await assignProjectToGroup(this.projectManager, message.path);
        break;
      }
      case "removeFromGroup": {
        if (!message.path) { return; }
        await this.projectManager.setProjectGroup(message.path, undefined);
        break;
      }
    }
  }

  private getHtml(projects: ProjectEntry[], groups: ProjectGroup[]): string {
    const currentPath = this.projectManager.getCurrentProjectPath();

    const enriched = projects.map((p) => ({
      path: p.path,
      name: p.name,
      lastOpened: p.lastOpened,
      color: p.color || "#4A90D9",
      icon: p.icon || "",
      groupId: p.groupId || null,
      isCurrent:
        !!currentPath &&
        path.resolve(currentPath) === path.resolve(p.path),
    }));

    const groupsJson = JSON.stringify(groups);
    const dataJson = JSON.stringify(enriched);

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https: http: data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Projects</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 32px 40px;
      min-height: 100vh;
    }

    .top-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 32px;
    }
    .top-bar h1 {
      font-size: 22px;
      font-weight: 600;
      color: var(--vscode-foreground);
      letter-spacing: -0.3px;
      flex: 1;
    }
    .top-bar .count {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }

    /* ── Group section ─────────────────────────────────────────────── */
    .group-section {
      margin-bottom: 28px;
    }

    .group-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.2));
    }

    .group-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .group-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-foreground);
      flex: 1;
    }

    .group-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-right: 4px;
    }

    .group-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 100ms ease;
    }
    .group-header:hover .group-actions { opacity: 1; }

    .ungrouped-header {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.15));
    }

    /* ── Grid / tiles ──────────────────────────────────────────────── */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 14px;
    }

    .tile {
      position: relative;
      background: var(--vscode-editorWidget-background,
        var(--vscode-sideBar-background, #1e1e1e));
      border: 1px solid var(--vscode-widget-border,
        var(--vscode-editorWidget-border, transparent));
      border-radius: 6px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 80ms ease, box-shadow 80ms ease;
      display: flex;
      flex-direction: column;
    }
    .tile:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0,0,0,0.25);
    }
    .tile.current {
      outline: 2px solid var(--vscode-focusBorder, #007fd4);
      outline-offset: -1px;
    }

    .tile-stripe {
      height: 5px;
      width: 100%;
      flex-shrink: 0;
    }

    .tile-body {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 14px 10px;
      flex: 1;
    }

    .tile-icon {
      font-size: 28px;
      line-height: 1;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .tile-icon.default {
      font-size: 22px;
      opacity: 0.6;
    }
    .tile-icon-img {
      width: 28px;
      height: 28px;
      object-fit: contain;
      border-radius: 4px;
    }

    .tile-info { min-width: 0; flex: 1; }
    .tile-name {
      font-weight: 600;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--vscode-foreground);
      margin-bottom: 3px;
    }
    .tile-path {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 4px;
    }
    .tile-time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.75;
    }
    .tile-time.active {
      color: var(--vscode-gitDecoration-addedResourceForeground, #73c991);
      opacity: 1;
    }

    .tile-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      padding: 6px 10px 8px;
      border-top: 1px solid var(--vscode-widget-border,
        rgba(128,128,128,0.15));
      opacity: 0;
      transition: opacity 100ms ease;
      flex-wrap: wrap;
    }
    .tile:hover .tile-actions { opacity: 1; }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 24px;
      padding: 0 8px;
      border: none;
      border-radius: 4px;
      font-size: 11px;
      font-family: inherit;
      cursor: pointer;
      background: var(--vscode-button-secondaryBackground,
        rgba(128,128,128,0.15));
      color: var(--vscode-button-secondaryForeground,
        var(--vscode-foreground));
      white-space: nowrap;
    }
    .btn:hover {
      background: var(--vscode-button-secondaryHoverBackground,
        rgba(128,128,128,0.25));
    }
    .btn.primary {
      background: var(--vscode-button-background, #007acc);
      color: var(--vscode-button-foreground, #fff);
      margin-right: auto;
    }
    .btn.primary:hover {
      background: var(--vscode-button-hoverBackground, #0062a3);
    }
    .btn.danger:hover {
      background: var(--vscode-inputValidation-errorBackground,
        rgba(210,60,60,0.3));
      color: var(--vscode-errorForeground, #f48771);
    }

    /* Add-new tile */
    .tile-add {
      border: 2px dashed var(--vscode-widget-border,
        rgba(128,128,128,0.3));
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 110px;
      cursor: pointer;
      border-radius: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      transition: border-color 80ms ease, color 80ms ease;
    }
    .tile-add:hover {
      border-color: var(--vscode-focusBorder, #007fd4);
      color: var(--vscode-focusBorder, #007fd4);
    }
    .tile-add-icon { font-size: 24px; opacity: 0.7; }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 80px 20px;
      gap: 16px;
      text-align: center;
      color: var(--vscode-descriptionForeground);
    }
    .empty-state .big-icon { font-size: 48px; opacity: 0.4; }
    .empty-state p { font-size: 13px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="top-bar">
    <h1>Projects</h1>
    <span class="count" id="count"></span>
    <button class="btn" id="btn-create-group" title="Create a new project group">＋ New Group</button>
    <button class="btn" id="btn-add-project" title="Add a project folder">＋ Add Project</button>
  </div>
  <div id="root"></div>

  <script id="project-data" type="application/json">${dataJson}</script>
  <script id="group-data" type="application/json">${groupsJson}</script>
  <script>
    const vscode = acquireVsCodeApi();
    const projects = JSON.parse(document.getElementById('project-data').textContent);
    const groups   = JSON.parse(document.getElementById('group-data').textContent);

    function relativeTime(ts) {
      const diff = Date.now() - ts;
      const m = Math.floor(diff / 60000);
      const h = Math.floor(m / 60);
      const d = Math.floor(h / 24);
      const w = Math.floor(d / 7);
      const mo = Math.floor(d / 30);
      if (m < 1)  return 'just now';
      if (m < 60) return m + 'm ago';
      if (h < 24) return h + 'h ago';
      if (d < 7)  return d + 'd ago';
      if (w < 4)  return w + 'w ago';
      return mo + 'mo ago';
    }

    function shortenPath(p) {
      try {
        const parts = p.replace(/\\\\/g, '/').split('/');
        if (parts.length > 3) { return '…/' + parts.slice(-2).join('/'); }
        return p;
      } catch(e) { return p; }
    }

    function esc(s) {
      return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function isUrl(s) {
      return typeof s === 'string' && (s.startsWith('http://') || s.startsWith('https://'));
    }

    function renderTile(p, idx, inGroup) {
      const icon = p.icon
        ? isUrl(p.icon)
          ? \`<span class="tile-icon"><img src="\${esc(p.icon)}" class="tile-icon-img" alt="" onerror="this.parentElement.innerHTML='📁';this.parentElement.className='tile-icon default'"></span>\`
          : \`<span class="tile-icon">\${esc(p.icon)}</span>\`
        : \`<span class="tile-icon default">📁</span>\`;

      const timeLabel = p.isCurrent
        ? \`<span class="tile-time active">● Currently open</span>\`
        : \`<span class="tile-time">\${relativeTime(p.lastOpened)}</span>\`;

      const groupBtn = inGroup
        ? \`<button class="btn" data-action="removeFromGroup" data-idx="\${idx}" title="Remove from group">⊖ Ungroup</button>\`
        : \`<button class="btn" data-action="assignGroup" data-idx="\${idx}" title="Add to a group">⊕ Group</button>\`;

      return \`
        <div class="tile\${p.isCurrent ? ' current' : ''}" data-idx="\${idx}">
          <div class="tile-stripe" style="background:\${esc(p.color)}"></div>
          <div class="tile-body" data-action="open" data-idx="\${idx}">
            \${icon}
            <div class="tile-info">
              <div class="tile-name" title="\${esc(p.name)}">\${esc(p.name)}</div>
              <div class="tile-path" title="\${esc(p.path)}">\${esc(shortenPath(p.path))}</div>
              \${timeLabel}
            </div>
          </div>
          <div class="tile-actions">
            <button class="btn primary" data-action="open" data-idx="\${idx}">Open</button>
            <button class="btn" data-action="editColor" data-idx="\${idx}" title="Change color">🎨</button>
            <button class="btn" data-action="editIcon" data-idx="\${idx}" title="Change icon">😀</button>
            \${groupBtn}
            <button class="btn danger" data-action="remove" data-idx="\${idx}" title="Remove">✕</button>
          </div>
        </div>
      \`;
    }

    function renderAddTile() {
      return \`
        <div class="tile-add" data-action="add">
          <span class="tile-add-icon">＋</span>
          <span>Add Project</span>
        </div>
      \`;
    }

    function renderGroupSection(group) {
      const groupProjects = projects
        .map((p, i) => ({ p, i }))
        .filter(({ p }) => p.groupId === group.id);

      const dot = group.color
        ? \`<span class="group-dot" style="background:\${esc(group.color)}"></span>\`
        : '';
      const icon = group.icon ? esc(group.icon) + ' ' : '';

      return \`
        <div class="group-section">
          <div class="group-header">
            \${dot}
            <span class="group-title">\${icon}\${esc(group.name)}</span>
            <span class="group-count">\${groupProjects.length} repo\${groupProjects.length !== 1 ? 's' : ''}</span>
            <div class="group-actions">
              <button class="btn" data-action="renameGroup" data-group-id="\${esc(group.id)}" title="Rename group">Rename</button>
              <button class="btn danger" data-action="deleteGroup" data-group-id="\${esc(group.id)}" title="Delete group">Delete</button>
            </div>
          </div>
          <div class="grid">
            \${groupProjects.map(({ p, i }) => renderTile(p, i, true)).join('')}
          </div>
        </div>
      \`;
    }

    function render() {
      const root     = document.getElementById('root');
      const countEl  = document.getElementById('count');
      countEl.textContent = projects.length + ' project' + (projects.length !== 1 ? 's' : '');

      if (projects.length === 0 && groups.length === 0) {
        root.innerHTML = \`
          <div class="empty-state">
            <span class="big-icon">📂</span>
            <p>No projects yet</p>
            <button class="btn primary" data-action="add">Add your first project</button>
          </div>
        \`;
        return;
      }

      let html = '';

      // Render groups
      for (const group of groups) {
        html += renderGroupSection(group);
      }

      // Render ungrouped projects
      const ungrouped = projects.map((p, i) => ({ p, i })).filter(({ p }) => !p.groupId);
      if (ungrouped.length > 0) {
        const header = groups.length > 0
          ? '<div class="ungrouped-header">Other Projects</div>'
          : '';
        html += \`
          <div class="group-section">
            \${header}
            <div class="grid">
              \${ungrouped.map(({ p, i }) => renderTile(p, i, false)).join('')}
              \${renderAddTile()}
            </div>
          </div>
        \`;
      } else if (groups.length > 0) {
        html += \`
          <div class="group-section">
            <div class="grid">\${renderAddTile()}</div>
          </div>
        \`;
      }

      root.innerHTML = html;
    }

    document.getElementById('btn-create-group').addEventListener('click', () => {
      vscode.postMessage({ command: 'createGroup' });
    });
    document.getElementById('btn-add-project').addEventListener('click', () => {
      vscode.postMessage({ command: 'addProject' });
    });

    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) { return; }

      const action  = target.dataset.action;
      const idx     = target.dataset.idx !== undefined ? parseInt(target.dataset.idx, 10) : -1;
      const project = idx >= 0 ? projects[idx] : null;
      const groupId = target.dataset.groupId;

      if (action === 'open' && project) {
        vscode.postMessage({ command: 'openProject', entry: project });
      } else if (action === 'add') {
        vscode.postMessage({ command: 'addProject' });
      } else if (action === 'remove' && project) {
        vscode.postMessage({ command: 'removeProject', path: project.path });
      } else if (action === 'editColor' && project) {
        vscode.postMessage({ command: 'editColor', path: project.path });
      } else if (action === 'editIcon' && project) {
        vscode.postMessage({ command: 'editIcon', path: project.path });
      } else if (action === 'assignGroup' && project) {
        vscode.postMessage({ command: 'assignGroup', path: project.path });
      } else if (action === 'removeFromGroup' && project) {
        vscode.postMessage({ command: 'removeFromGroup', path: project.path });
      } else if (action === 'renameGroup' && groupId) {
        vscode.postMessage({ command: 'renameGroup', groupId });
      } else if (action === 'deleteGroup' && groupId) {
        vscode.postMessage({ command: 'deleteGroup', groupId });
      }
    });

    render();
  </script>
</body>
</html>`;
  }
}

// ---------- shared pickers (reused by tree context commands) ----------

export async function pickAndApplyColor(
  projectManager: ProjectManager,
  projectPath: string
): Promise<void> {
  const items = [
    ...PRESET_COLORS.map((c) => ({
      label: `$(circle-filled) ${c.label}`,
      description: c.color,
      color: c.color,
    })),
    { label: "$(edit) Custom hex…", description: "Enter any #RRGGBB", color: "custom" },
    { label: "$(close) Remove color", description: "Reset to default blue", color: "" },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Choose a tile color",
    placeHolder: "Select a color for this project",
    matchOnDescription: true,
  });
  if (!picked) { return; }

  let color: string | undefined = picked.color;
  if (color === "custom") {
    const input = await vscode.window.showInputBox({
      title: "Custom Color",
      prompt: "Enter a hex color",
      placeHolder: "#RRGGBB",
      validateInput: (v) =>
        /^#[0-9a-fA-F]{6}$/.test(v) ? null : "Enter a valid hex like #FF5733",
    });
    if (input === undefined) { return; }
    color = input;
  }

  await projectManager.updateProjectMeta(projectPath, {
    color: color || undefined,
  });
}

export async function pickAndApplyIcon(
  projectManager: ProjectManager,
  projectPath: string
): Promise<void> {
  const items = [
    ...PRESET_ICONS.map((e) => ({ label: e, description: "" })),
    { label: "$(link) Enter image URL…", description: "Use any https:// image as icon" },
    { label: "$(close) Remove icon", description: "Reset to default folder icon" },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Choose a project icon",
    placeHolder: "Select an emoji or enter an image URL",
  });
  if (!picked) { return; }

  let icon: string | undefined;
  if (picked.label === "$(link) Enter image URL…") {
    const url = await vscode.window.showInputBox({
      title: "Icon Image URL",
      prompt: "Enter the URL of the image to use as the project icon",
      placeHolder: "https://example.com/icon.png",
      validateInput: (v) =>
        v.startsWith("https://") || v.startsWith("http://")
          ? null
          : "Please enter a valid URL starting with https:// or http://",
    });
    if (url === undefined) { return; }
    icon = url;
  } else if (picked.label.startsWith("$(")) {
    icon = undefined;
  } else {
    icon = picked.label;
  }

  await projectManager.updateProjectMeta(projectPath, { icon });
}

export async function assignProjectToGroup(
  projectManager: ProjectManager,
  projectPath: string
): Promise<void> {
  const groups = projectManager.getGroups();

  const items: vscode.QuickPickItem[] = [
    ...groups.map((g) => ({
      label: (g.icon ? g.icon + "  " : "") + g.name,
      description: g.id,
    })),
    { label: "$(add) Create new group…", description: "__new__" },
    { label: "$(close) Remove from group", description: "__none__" },
  ];

  const picked = await vscode.window.showQuickPick(items, {
    title: "Assign to Group",
    placeHolder: "Select a group for this project",
  });
  if (!picked) { return; }

  if (picked.description === "__new__") {
    const groupName = await vscode.window.showInputBox({
      title: "New Group",
      prompt: "Enter a name for the new group",
      placeHolder: "e.g. Work, Personal, Client XYZ",
      validateInput: (v) => v.trim() ? null : "Name cannot be empty",
    });
    if (!groupName?.trim()) { return; }
    const group = await projectManager.createGroup(groupName.trim());
    await projectManager.setProjectGroup(projectPath, group.id);
  } else if (picked.description === "__none__") {
    await projectManager.setProjectGroup(projectPath, undefined);
  } else {
    await projectManager.setProjectGroup(projectPath, picked.description);
  }
}
