import * as vscode from "vscode";
import * as path from "path";

export interface ProjectEntry {
  /** Absolute path to the project folder */
  path: string;
  /** Display name (folder basename) */
  name: string;
  /** Timestamp of last time this project was opened (ms since epoch) */
  lastOpened: number;
  /** Whether this project should be kept even when recent projects are trimmed */
  pinned?: boolean;
  /** Hex color for the tile, e.g. "#4A90D9" */
  color?: string;
  /** Emoji icon, e.g. "🚀" */
  icon?: string;
  /** ID of the group this project belongs to */
  groupId?: string;
}

export interface ProjectGroup {
  /** Unique ID (timestamp string) */
  id: string;
  /** Display name */
  name: string;
  /** Hex color, e.g. "#4A90D9" */
  color?: string;
  /** Emoji icon */
  icon?: string;
}

export interface AddProjectOptions {
  /** Pin the project so it is not removed by the recent-project limit */
  pinned?: boolean;
}

const STORAGE_KEY = "recentProjects.projectList";
const GROUPS_STORAGE_KEY = "recentProjects.groups";

export class ProjectManager {
  private context: vscode.ExtensionContext;

  private _onDidChangeProjects = new vscode.EventEmitter<void>();
  readonly onDidChangeProjects: vscode.Event<void> =
    this._onDidChangeProjects.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Get all tracked projects, sorted by most recently opened first.
   */
  getProjects(): ProjectEntry[] {
    const projects =
      this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    return [...projects].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) {
        return a.pinned ? -1 : 1;
      }
      return b.lastOpened - a.lastOpened;
    });
  }

  /**
   * Add or update a project. Preserves color/icon of an existing entry.
   */
  async addProject(
    projectPath: string,
    options: AddProjectOptions = {}
  ): Promise<void> {
    const normalizedPath = this.normalizePath(projectPath);
    const projects =
      this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    const config = vscode.workspace.getConfiguration("recentProjects");
    const maxProjects = config.get<number>("maxProjects", 20);

    const existing = projects.find(
      (p) => this.normalizePath(p.path) === normalizedPath
    );
    const filtered = projects.filter(
      (p) => this.normalizePath(p.path) !== normalizedPath
    );

    const entry: ProjectEntry = {
      path: normalizedPath,
      name: path.basename(normalizedPath),
      lastOpened: Date.now(),
      pinned: options.pinned ?? existing?.pinned,
      color: existing?.color,
      icon: existing?.icon,
      groupId: existing?.groupId,
    };

    filtered.unshift(entry);
    const trimmed = this.trimRecentProjects(filtered, maxProjects);

    await this.context.globalState.update(STORAGE_KEY, trimmed);
    this._onDidChangeProjects.fire();
  }

  /**
   * Remove a project from the tracked list.
   */
  async removeProject(projectPath: string): Promise<void> {
    const normalizedPath = this.normalizePath(projectPath);
    const projects = this.getProjects();
    const filtered = projects.filter(
      (p) => this.normalizePath(p.path) !== normalizedPath
    );
    await this.context.globalState.update(STORAGE_KEY, filtered);
    this._onDidChangeProjects.fire();
  }

  /**
   * Clear all tracked projects.
   */
  async clearProjects(): Promise<void> {
    await this.context.globalState.update(STORAGE_KEY, []);
    this._onDidChangeProjects.fire();
  }

  /**
   * Update metadata (color, icon) for a project without changing lastOpened.
   */
  async updateProjectMeta(
    projectPath: string,
    meta: Partial<Pick<ProjectEntry, "color" | "icon">>
  ): Promise<void> {
    const normalizedPath = this.normalizePath(projectPath);
    const projects =
      this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    const updated = projects.map((p) => {
      if (this.normalizePath(p.path) === normalizedPath) {
        return { ...p, ...meta };
      }
      return p;
    });
    await this.context.globalState.update(STORAGE_KEY, updated);
    this._onDidChangeProjects.fire();
  }

  /**
   * Pin or unpin a project without changing lastOpened.
   */
  async setProjectPinned(projectPath: string, pinned: boolean): Promise<void> {
    const normalizedPath = this.normalizePath(projectPath);
    const projects =
      this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    const updated = projects.map((p) =>
      this.normalizePath(p.path) === normalizedPath ? { ...p, pinned } : p
    );
    await this.context.globalState.update(STORAGE_KEY, updated);
    this._onDidChangeProjects.fire();
  }

  // ── Group management ────────────────────────────────────────────────────

  getGroups(): ProjectGroup[] {
    return this.context.globalState.get<ProjectGroup[]>(GROUPS_STORAGE_KEY) || [];
  }

  async createGroup(name: string): Promise<ProjectGroup> {
    const groups = this.getGroups();
    const group: ProjectGroup = { id: Date.now().toString(), name };
    groups.push(group);
    await this.context.globalState.update(GROUPS_STORAGE_KEY, groups);
    this._onDidChangeProjects.fire();
    return group;
  }

  async renameGroup(id: string, newName: string): Promise<void> {
    const groups = this.getGroups().map((g) =>
      g.id === id ? { ...g, name: newName } : g
    );
    await this.context.globalState.update(GROUPS_STORAGE_KEY, groups);
    this._onDidChangeProjects.fire();
  }

  async removeGroup(id: string): Promise<void> {
    const groups = this.getGroups().filter((g) => g.id !== id);
    await this.context.globalState.update(GROUPS_STORAGE_KEY, groups);
    // Unassign projects that belonged to this group
    const projects = this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    const updated = projects.map((p) =>
      p.groupId === id ? { ...p, groupId: undefined } : p
    );
    await this.context.globalState.update(STORAGE_KEY, updated);
    this._onDidChangeProjects.fire();
  }

  async updateGroupMeta(
    id: string,
    meta: Partial<Pick<ProjectGroup, "color" | "icon" | "name">>
  ): Promise<void> {
    const groups = this.getGroups().map((g) =>
      g.id === id ? { ...g, ...meta } : g
    );
    await this.context.globalState.update(GROUPS_STORAGE_KEY, groups);
    this._onDidChangeProjects.fire();
  }

  async setProjectGroup(projectPath: string, groupId: string | undefined): Promise<void> {
    const normalizedPath = this.normalizePath(projectPath);
    const projects = this.context.globalState.get<ProjectEntry[]>(STORAGE_KEY) || [];
    const updated = projects.map((p) =>
      this.normalizePath(p.path) === normalizedPath ? { ...p, groupId } : p
    );
    await this.context.globalState.update(STORAGE_KEY, updated);
    this._onDidChangeProjects.fire();
  }

  /**
   * Get the current workspace/project path, if any.
   */
  getCurrentProjectPath(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
      return folders[0].uri.fsPath;
    }
    return undefined;
  }

  /**
   * Get the current project name (folder basename).
   */
  getCurrentProjectName(): string | undefined {
    const projectPath = this.getCurrentProjectPath();
    if (projectPath) {
      return path.basename(projectPath);
    }
    return undefined;
  }

  /**
   * Auto-register the currently open workspace.
   */
  async registerCurrentProject(): Promise<void> {
    const projectPath = this.getCurrentProjectPath();
    if (projectPath) {
      await this.addProject(projectPath);
    }
  }

  /**
   * Normalize a path for consistent comparison.
   */
  private normalizePath(p: string): string {
    return path.resolve(p).replace(/[/\\]+$/, "");
  }

  /**
   * Keep all pinned projects and trim only ordinary recent entries.
   */
  private trimRecentProjects(
    projects: ProjectEntry[],
    maxRecentProjects: number
  ): ProjectEntry[] {
    let recentCount = 0;
    return projects.filter((project) => {
      if (project.pinned) {
        return true;
      }

      recentCount += 1;
      return recentCount <= maxRecentProjects;
    });
  }
}
