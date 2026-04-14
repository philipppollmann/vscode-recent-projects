import * as vscode from "vscode";
import { ProjectManager, ProjectEntry } from "./projectManager";
import { createStatusBarItem, updateStatusBarItem } from "./statusBar";
import {
  showProjectSwitcher,
  addProjectViaDialog,
  showRemoveProjectPicker,
} from "./projectSwitcher";
import { ProjectTreeProvider } from "./projectTreeProvider";
import { WelcomePage, pickAndApplyColor, pickAndApplyIcon } from "./welcomePage";

let statusBarItem: vscode.StatusBarItem;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const projectManager = new ProjectManager(context);

  // Auto-register the current workspace
  await projectManager.registerCurrentProject();

  // ── Status bar ──────────────────────────────────────────────────────────
  statusBarItem = createStatusBarItem(projectManager);
  context.subscriptions.push(statusBarItem);

  // ── Sidebar tree view ────────────────────────────────────────────────────
  const treeProvider = new ProjectTreeProvider(projectManager);
  const treeView = vscode.window.createTreeView("recentProjectsView", {
    treeDataProvider: treeProvider,
    showCollapseAll: false,
  });
  context.subscriptions.push(treeView);

  // ── Welcome page ─────────────────────────────────────────────────────────
  const welcomePage = new WelcomePage(context, projectManager);

  // Show welcome page on startup when no workspace is open
  if (!vscode.workspace.workspaceFolders) {
    welcomePage.show();
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  // Legacy QuickPick switcher (keyboard shortcut / status bar)
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.switchProject", () => {
      showProjectSwitcher(projectManager);
    })
  );

  // Open welcome/start page
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.openWelcomePage", () => {
      welcomePage.show();
    })
  );

  // Open project from tree (new window)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.openProjectFromTree",
      async (entry: ProjectEntry) => {
        const folderUri = vscode.Uri.file(entry.path);
        await projectManager.addProject(entry.path);
        await vscode.commands.executeCommand("vscode.openFolder", folderUri, {
          forceNewWindow: true,
        });
      }
    )
  );

  // Refresh tree manually
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.refreshProjects", () => {
      treeProvider.refresh();
    })
  );

  // Add project (dialog)
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.addProject", () => {
      addProjectViaDialog(projectManager);
    })
  );

  // Remove project (picker)
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.removeProject", async (arg?: ProjectEntry | undefined) => {
      if (arg && arg.path) {
        await projectManager.removeProject(arg.path);
      } else {
        await showRemoveProjectPicker(projectManager);
      }
    })
  );

  // Edit color (from tree context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.editProjectColor",
      async (item: { entry?: ProjectEntry } | ProjectEntry | undefined) => {
        // Handles both raw ProjectEntry and ProjectTreeItem (which has .entry)
        const entry =
          item && "entry" in item && item.entry ? item.entry : (item as ProjectEntry | undefined);
        if (entry?.path) {
          await pickAndApplyColor(projectManager, entry.path);
        }
      }
    )
  );

  // Edit icon (from tree context menu)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.editProjectIcon",
      async (item: { entry?: ProjectEntry } | ProjectEntry | undefined) => {
        const entry =
          item && "entry" in item && item.entry ? item.entry : (item as ProjectEntry | undefined);
        if (entry?.path) {
          await pickAndApplyIcon(projectManager, entry.path);
        }
      }
    )
  );

  // Clear all projects
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.clearProjects",
      async () => {
        const confirm = await vscode.window.showWarningMessage(
          "Are you sure you want to clear all recent projects?",
          { modal: true },
          "Clear All"
        );
        if (confirm === "Clear All") {
          await projectManager.clearProjects();
          updateStatusBarItem(statusBarItem, projectManager);
          vscode.window.showInformationMessage("All recent projects cleared.");
        }
      }
    )
  );

  // ── Workspace / config change listeners ──────────────────────────────────
  context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async () => {
      await projectManager.registerCurrentProject();
      updateStatusBarItem(statusBarItem, projectManager);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("recentProjects")) {
        updateStatusBarItem(statusBarItem, projectManager);
      }
    })
  );
}

export function deactivate(): void {
  if (statusBarItem) {
    statusBarItem.dispose();
  }
}
