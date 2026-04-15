import * as vscode from "vscode";
import { ProjectManager, ProjectEntry } from "./projectManager";
import { createStatusBarItem, updateStatusBarItem } from "./statusBar";
import {
  showProjectSwitcher,
  addProjectViaDialog,
  showRemoveProjectPicker,
} from "./projectSwitcher";
import { ProjectTreeProvider } from "./projectTreeProvider";
import { WelcomePage, pickAndApplyColor, pickAndApplyIcon, assignProjectToGroup } from "./welcomePage";
import { GroupTreeItem, ProjectTreeItem } from "./projectTreeProvider";

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

  // Auto-open start page based on setting
  const config = vscode.workspace.getConfiguration("recentProjects");
  const showOnStartup = config.get<string>("showOnStartup", "always");
  if (showOnStartup === "always") {
    welcomePage.show();
  } else if (showOnStartup === "noWorkspace" && !vscode.workspace.workspaceFolders) {
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

  // Create group
  context.subscriptions.push(
    vscode.commands.registerCommand("recentProjects.createGroup", async () => {
      const name = await vscode.window.showInputBox({
        title: "New Group",
        prompt: "Enter a name for the group",
        placeHolder: "e.g. Work, Personal, Client XYZ",
        validateInput: (v) => v.trim() ? null : "Name cannot be empty",
      });
      if (name?.trim()) {
        await projectManager.createGroup(name.trim());
      }
    })
  );

  // Rename group (from tree context)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.renameGroup",
      async (item: GroupTreeItem | undefined) => {
        const group = item?.group;
        if (!group) { return; }
        const newName = await vscode.window.showInputBox({
          title: "Rename Group",
          value: group.name,
          validateInput: (v) => v.trim() ? null : "Name cannot be empty",
        });
        if (newName?.trim()) {
          await projectManager.renameGroup(group.id, newName.trim());
        }
      }
    )
  );

  // Delete group (from tree context)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.deleteGroup",
      async (item: GroupTreeItem | undefined) => {
        const group = item?.group;
        if (!group) { return; }
        const confirm = await vscode.window.showWarningMessage(
          `Delete group "${group.name}"? Projects will not be deleted, just ungrouped.`,
          { modal: true },
          "Delete"
        );
        if (confirm === "Delete") {
          await projectManager.removeGroup(group.id);
        }
      }
    )
  );

  // Assign project to group (from tree context)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.assignGroup",
      async (item: ProjectTreeItem | undefined) => {
        if (item?.entry?.path) {
          await assignProjectToGroup(projectManager, item.entry.path);
        }
      }
    )
  );

  // Remove project from group (from tree context)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "recentProjects.removeFromGroup",
      async (item: ProjectTreeItem | undefined) => {
        if (item?.entry?.path) {
          await projectManager.setProjectGroup(item.entry.path, undefined);
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
