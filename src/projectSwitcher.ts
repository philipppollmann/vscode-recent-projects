import * as vscode from "vscode";
import * as path from "path";
import { ProjectManager, ProjectEntry } from "./projectManager";

interface ProjectQuickPickItem extends vscode.QuickPickItem {
  projectEntry?: ProjectEntry;
  action?: "add" | "clear";
}

export async function showProjectSwitcher(
  projectManager: ProjectManager
): Promise<void> {
  const projects = projectManager.getProjects();
  const currentPath = projectManager.getCurrentProjectPath();
  const config = vscode.workspace.getConfiguration("recentProjects");
  const showFullPath = config.get<boolean>("showFullPath", true);
  const openInNewWindow = config.get<boolean>("openInNewWindow", false);

  // Build QuickPick items
  const items: ProjectQuickPickItem[] = [];

  if (projects.length === 0) {
    items.push({
      label: "$(info) No recent projects",
      description: "Add a project folder to get started",
      alwaysShow: true,
    });
  }

  for (const project of projects) {
    const isCurrent =
      currentPath &&
      path.resolve(currentPath) === path.resolve(project.path);

    const timeAgo = getRelativeTimeString(project.lastOpened);

    items.push({
      label: `${isCurrent ? "$(check) " : project.pinned ? "$(pinned) " : "$(folder) "}${project.name}`,
      description: showFullPath ? project.path : undefined,
      detail: isCurrent
        ? "Currently open"
        : `${project.pinned ? "Pinned • " : ""}Last opened ${timeAgo}`,
      projectEntry: project,
      buttons: [
        {
          iconPath: new vscode.ThemeIcon(project.pinned ? "pinned" : "pin"),
          tooltip: project.pinned ? "Unpin project" : "Pin project",
        },
        {
          iconPath: new vscode.ThemeIcon("window"),
          tooltip: "Open in new window",
        },
        {
          iconPath: new vscode.ThemeIcon("trash"),
          tooltip: "Remove from list",
        },
      ],
    });
  }

  // Separator and actions
  items.push({
    label: "",
    kind: vscode.QuickPickItemKind.Separator,
  });

  items.push({
    label: "$(add) Add Project Folder...",
    action: "add",
    alwaysShow: true,
  });

  if (projects.length > 0) {
    items.push({
      label: "$(clear-all) Clear All Projects",
      action: "clear",
      alwaysShow: true,
    });
  }

  // Create QuickPick
  const quickPick = vscode.window.createQuickPick<ProjectQuickPickItem>();
  quickPick.title = "Recent Projects";
  quickPick.placeholder = "Search projects or select one to open...";
  quickPick.matchOnDescription = true;
  quickPick.matchOnDetail = false;
  quickPick.items = items;

  // Handle button clicks (open in new window / remove)
  quickPick.onDidTriggerItemButton(async (e) => {
    const item = e.item;
    const button = e.button;

    if (!item.projectEntry) {
      return;
    }

    if (button.tooltip === "Remove from list") {
      await projectManager.removeProject(item.projectEntry.path);
      // Refresh the list
      quickPick.hide();
      await showProjectSwitcher(projectManager);
      return;
    }

    if (button.tooltip === "Pin project") {
      await projectManager.setProjectPinned(item.projectEntry.path, true);
      quickPick.hide();
      await showProjectSwitcher(projectManager);
      return;
    }

    if (button.tooltip === "Unpin project") {
      await projectManager.setProjectPinned(item.projectEntry.path, false);
      quickPick.hide();
      await showProjectSwitcher(projectManager);
      return;
    }

    if (button.tooltip === "Open in new window") {
      const folderUri = vscode.Uri.file(item.projectEntry.path);
      await projectManager.addProject(item.projectEntry.path);
      quickPick.hide();
      await vscode.commands.executeCommand("vscode.openFolder", folderUri, {
        forceNewWindow: true,
      });
      return;
    }
  });

  // Handle selection
  quickPick.onDidAccept(async () => {
    const selected = quickPick.selectedItems[0];
    if (!selected) {
      return;
    }

    quickPick.hide();

    // Handle action items
    if (selected.action === "add") {
      await addProjectViaDialog(projectManager);
      return;
    }

    if (selected.action === "clear") {
      const confirm = await vscode.window.showWarningMessage(
        "Clear all recent projects?",
        { modal: true },
        "Clear"
      );
      if (confirm === "Clear") {
        await projectManager.clearProjects();
        vscode.window.showInformationMessage("All recent projects cleared.");
      }
      return;
    }

    // Handle project selection
    if (selected.projectEntry) {
      const project = selected.projectEntry;

      // Don't re-open the current project
      if (
        currentPath &&
        path.resolve(currentPath) === path.resolve(project.path)
      ) {
        return;
      }

      const folderUri = vscode.Uri.file(project.path);
      await projectManager.addProject(project.path);
      await vscode.commands.executeCommand("vscode.openFolder", folderUri, {
        forceNewWindow: openInNewWindow,
      });
    }
  });

  quickPick.onDidHide(() => {
    quickPick.dispose();
  });

  quickPick.show();
}

/**
 * Show a folder dialog to add a new project.
 */
export async function addProjectViaDialog(
  projectManager: ProjectManager
): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Add Project",
    title: "Select a project folder to add",
  });

  if (uris && uris.length > 0) {
    const folderPath = uris[0].fsPath;
    await projectManager.addProject(folderPath, { pinned: true });
    vscode.window.showInformationMessage(
      `Added "${path.basename(folderPath)}" to recent projects.`
    );
  }
}

/**
 * Show a QuickPick to select and remove a project.
 */
export async function showRemoveProjectPicker(
  projectManager: ProjectManager
): Promise<void> {
  const projects = projectManager.getProjects();

  if (projects.length === 0) {
    vscode.window.showInformationMessage("No recent projects to remove.");
    return;
  }

  const items: ProjectQuickPickItem[] = projects.map((project) => ({
    label: `$(folder) ${project.name}`,
    description: project.path,
    projectEntry: project,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    title: "Remove Project",
    placeHolder: "Select a project to remove from the list...",
  });

  if (selected?.projectEntry) {
    await projectManager.removeProject(selected.projectEntry.path);
    vscode.window.showInformationMessage(
      `Removed "${selected.projectEntry.name}" from recent projects.`
    );
  }
}

/**
 * Convert a timestamp to a relative time string (e.g., "2 hours ago").
 */
function getRelativeTimeString(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }
  if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  }
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}
