/**
 * Sidebar navigation — renders a list of available demos and dispatches selection events.
 */

import type { DemoManifestEntry } from "../shared/types";

export type DemoSelectedCallback = (demoId: string) => void;

export interface NavigationHandle {
	readonly selectById: (demoId: string) => void;
}

export function renderDemoNavigation(
	sidebarContainer: HTMLElement,
	demoManifestEntries: DemoManifestEntry[],
	onDemoSelected: DemoSelectedCallback,
): NavigationHandle {
	sidebarContainer.innerHTML = "";

	const navigationTitle = document.createElement("h2");
	navigationTitle.textContent = "LSDE Demos";
	sidebarContainer.appendChild(navigationTitle);

	const navigationList = document.createElement("ul");
	const buttonsByDemoId = new Map<string, HTMLButtonElement>();

	for (const entry of demoManifestEntries) {
		const listItem = document.createElement("li");
		const button = document.createElement("button");
		button.textContent = entry.title;
		button.dataset.demoId = entry.id;
		button.addEventListener("click", () => {
			setActiveButton(buttonsByDemoId, entry.id);
			onDemoSelected(entry.id);
		});
		buttonsByDemoId.set(entry.id, button);
		listItem.appendChild(button);
		navigationList.appendChild(listItem);
	}

	sidebarContainer.appendChild(navigationList);

	return {
		selectById: (demoId: string) => setActiveButton(buttonsByDemoId, demoId),
	};
}

function setActiveButton(
	buttonsByDemoId: Map<string, HTMLButtonElement>,
	activeDemoId: string,
): void {
	for (const button of buttonsByDemoId.values()) {
		button.classList.remove("active");
	}
	buttonsByDemoId.get(activeDemoId)?.classList.add("active");
}
