import * as vscode from "vscode";
import * as path from "path";
import { ProjectManager, ProjectEntry, ProjectGroup } from "./projectManager";

// ── Tree item types ──────────────────────────────────────────────────────────

export class GroupTreeItem extends vscode.TreeItem {
  readonly kind = "group" as const;

  constructor(public readonly group: ProjectGroup, projectCount: number) {
    super(
      (group.icon ? `${group.icon}  ` : "") + group.name,
      vscode.TreeItemCollapsibleState.Expanded
    );
    this.contextValue = "projectGroup";
    this.iconPath = group.icon ? undefined : new vscode.ThemeIcon("folder-library");
    this.description = `${projectCount} repo${projectCount !== 1 ? "s" : ""}`;
    this.tooltip = new vscode.MarkdownString(`**${group.name}** — ${projectCount} project${projectCount !== 1 ? "s" : ""}`);
  }
}

export class ProjectTreeItem extends vscode.TreeItem {
  readonly kind = "project" as const;

  constructor(public readonly entry: ProjectEntry) {
    super("", vscode.TreeItemCollapsibleState.None);

    const icon = entry.icon || "";
    this.label = icon ? `${icon}  ${entry.name}` : entry.name;
    this.tooltip = new vscode.MarkdownString(
      `**${entry.pinned ? "Pinned " : ""}${entry.name}**\n\n\`${entry.path}\`\n\n_${getRelativeTimeString(entry.lastOpened)}_`
    );
    this.description = shortenPath(entry.path);
    if (entry.pinned && entry.groupId) {
      this.contextValue = "projectPinnedInGroup";
    } else if (entry.pinned) {
      this.contextValue = "projectPinned";
    } else {
      this.contextValue = entry.groupId ? "projectInGroup" : "project";
    }

    if (!icon) {
      this.iconPath = new vscode.ThemeIcon(entry.pinned ? "pinned" : "folder");
    }

    this.command = {
      command: "recentProjects.openProjectFromTree",
      title: "Open Project",
      arguments: [entry],
    };
  }
}

export type AnyTreeItem = GroupTreeItem | ProjectTreeItem;

// ── Provider ─────────────────────────────────────────────────────────────────

export class ProjectTreeProvider implements vscode.TreeDataProvider<AnyTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AnyTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly projectManager: ProjectManager) {
    projectManager.onDidChangeProjects(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AnyTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AnyTreeItem): AnyTreeItem[] {
    if (element instanceof GroupTreeItem) {
      // Return projects belonging to this group
      return this.projectManager
        .getProjects()
        .filter((p) => p.groupId === element.group.id)
        .map((p) => new ProjectTreeItem(p));
    }

    if (element) {
      return [];
    }

    // Root level: groups first, then ungrouped projects
    const groups = this.projectManager.getGroups();
    const projects = this.projectManager.getProjects();

    const result: AnyTreeItem[] = [];

    for (const group of groups) {
      const count = projects.filter((p) => p.groupId === group.id).length;
      result.push(new GroupTreeItem(group, count));
    }

    const ungrouped = projects.filter((p) => !p.groupId);
    for (const p of ungrouped) {
      result.push(new ProjectTreeItem(p));
    }

    return result;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortenPath(fullPath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home && fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  const parent = path.basename(path.dirname(fullPath));
  const base = path.basename(fullPath);
  return parent ? `${parent}/${base}` : base;
}

function getRelativeTimeString(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) { return "just now"; }
  if (diffMinutes < 60) { return `${diffMinutes}m ago`; }
  if (diffHours < 24) { return `${diffHours}h ago`; }
  if (diffDays < 7) { return `${diffDays}d ago`; }
  if (diffWeeks < 4) { return `${diffWeeks}w ago`; }
  return `${diffMonths}mo ago`;
}
