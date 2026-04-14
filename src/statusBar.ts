import * as vscode from "vscode";
import { ProjectManager } from "./projectManager";

export function createStatusBarItem(
  projectManager: ProjectManager
): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    10000 // Very high priority to push it as far left as possible
  );

  statusBarItem.command = "recentProjects.switchProject";
  statusBarItem.tooltip = "Switch Project (Ctrl+Alt+P)";

  updateStatusBarItem(statusBarItem, projectManager);

  return statusBarItem;
}

export function updateStatusBarItem(
  statusBarItem: vscode.StatusBarItem,
  projectManager: ProjectManager
): void {
  const config = vscode.workspace.getConfiguration("recentProjects");
  const textStyle = config.get<string>("statusBarText", "short");

  const currentPath = projectManager.getCurrentProjectPath();
  const currentName = projectManager.getCurrentProjectName();

  if (currentName) {
    const displayText =
      textStyle === "full" && currentPath ? currentPath : currentName;
    statusBarItem.text = `$(folder-opened) ${displayText}`;
    statusBarItem.tooltip = currentPath
      ? `${currentName}\n${currentPath}\n\nClick to switch project`
      : `${currentName}\n\nClick to switch project`;
  } else {
    statusBarItem.text = "$(folder) Open Project";
    statusBarItem.tooltip = "Click to open a recent project";
  }

  statusBarItem.show();
}
