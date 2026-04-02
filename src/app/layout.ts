/**
 * Application shell layout: left sidebar (navigation) + right panel (PixiJS canvas).
 */

export function createApplicationLayout(): {
  sidebarContainer: HTMLElement;
  canvasContainer: HTMLElement;
} {
  const applicationWrapper = document.getElementById("app")!;
  applicationWrapper.innerHTML = "";

  const sidebarContainer = document.createElement("nav");
  sidebarContainer.id = "sidebar-navigation";

  const canvasContainer = document.createElement("div");
  canvasContainer.id = "pixi-container";

  applicationWrapper.appendChild(sidebarContainer);
  applicationWrapper.appendChild(canvasContainer);

  return { sidebarContainer, canvasContainer };
}
