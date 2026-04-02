/**
 * Sidebar navigation — renders a list of available demos and dispatches selection events.
 */

import type { DemoManifestEntry } from "../shared/types";

export type DemoSelectedCallback = (demoId: string) => void;

export function renderDemoNavigation(
  sidebarContainer: HTMLElement,
  demoManifestEntries: DemoManifestEntry[],
  onDemoSelected: DemoSelectedCallback,
): void {
  sidebarContainer.innerHTML = "";

  const navigationTitle = document.createElement("h2");
  navigationTitle.textContent = "LSDE Demos";
  sidebarContainer.appendChild(navigationTitle);

  const navigationList = document.createElement("ul");

  for (const entry of demoManifestEntries) {
    const listItem = document.createElement("li");
    const button = document.createElement("button");
    button.textContent = entry.title;
    button.dataset.demoId = entry.id;
    button.addEventListener("click", () => onDemoSelected(entry.id));
    listItem.appendChild(button);
    navigationList.appendChild(listItem);
  }

  sidebarContainer.appendChild(navigationList);
}
