import * as vscode from "vscode";
import * as path from "path";
import { ProjectManager, ProjectEntry } from "./projectManager";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(public readonly entry: ProjectEntry) {
    super("", vscode.TreeItemCollapsibleState.None);

    const icon = entry.icon || "";
    this.label = icon ? `${icon}  ${entry.name}` : entry.name;
    this.tooltip = new vscode.MarkdownString(
      `**${entry.name}**\n\n\`${entry.path}\`\n\n_${getRelativeTimeString(entry.lastOpened)}_`
    );
    this.description = shortenPath(entry.path);
    this.contextValue = "project";

    if (!icon) {
      this.iconPath = new vscode.ThemeIcon("folder");
    }

    this.command = {
      command: "recentProjects.openProjectFromTree",
      title: "Open Project",
      arguments: [entry],
    };
  }
}

export class ProjectTreeProvider
  implements vscode.TreeDataProvider<ProjectTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    ProjectTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly projectManager: ProjectManager) {
    projectManager.onDidChangeProjects(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: ProjectTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectTreeItem): ProjectTreeItem[] {
    if (element) {
      return [];
    }
    return this.projectManager.getProjects().map((p) => new ProjectTreeItem(p));
  }
}

function shortenPath(fullPath: string): string {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  if (home && fullPath.startsWith(home)) {
    return "~" + fullPath.slice(home.length);
  }
  // Show only parent + basename
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

  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}
