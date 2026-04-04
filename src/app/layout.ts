/**
 * Application shell layout: collapsible left sidebar + right panel (PixiJS canvas).
 */

export function createApplicationLayout(): {
  sidebarContainer: HTMLElement;
  canvasContainer: HTMLElement;
  /** Register a callback fired when the sidebar collapse/expand transition ends. */
  onSidebarTransitionEnd: (callback: () => void) => void;
} {
  const applicationWrapper = document.getElementById("app")!;
  applicationWrapper.innerHTML = "";

  // --- Sidebar ---
  const sidebarContainer = document.createElement("nav");
  sidebarContainer.id = "sidebar-navigation";

  // Logo + brand header
  const sidebarHeader = document.createElement("div");
  sidebarHeader.className = "sidebar-header";

  const logoLink = document.createElement("a");
  logoLink.href = "https://lepasoft.com/en/software/ls-dialog-editor";
  logoLink.target = "_blank";
  logoLink.rel = "noopener noreferrer";
  logoLink.className = "sidebar-logo-link";

  const logoImage = document.createElement("img");
  logoImage.src = `${import.meta.env.BASE_URL}lsde-logo.webp`;
  logoImage.alt = "LSDE Logo";
  logoImage.className = "sidebar-logo";
  logoLink.appendChild(logoImage);

  const brandTitle = document.createElement("span");
  brandTitle.className = "sidebar-brand";
  brandTitle.textContent = "LSDE Playground";
  logoLink.appendChild(brandTitle);

  sidebarHeader.appendChild(logoLink);
  sidebarContainer.appendChild(sidebarHeader);

  // External links
  const linksContainer = document.createElement("div");
  linksContainer.className = "sidebar-links";

  const externalLinks = [
    {
      label: "📘 LSDE Documentation",
      href: "https://jonlepage.github.io/LS-Dialog-Editor-Engine/",
    },
    {
      label: "⚙️ Runtime Repository",
      href: "https://github.com/jonlepage/LS-Dialog-Editor-Engine",
    },
    {
      label: "🎮 Playground Repository",
      href: "https://github.com/jonlepage/LSDEDE-DEMO-TS",
    },
    {
      label: "🌐 LSDE Official Website",
      href: "https://lepasoft.com/en/software/ls-dialog-editor",
    },
  ];

  for (const link of externalLinks) {
    const anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = link.label;
    linksContainer.appendChild(anchor);
  }

  sidebarContainer.appendChild(linksContainer);

  // Demos section header (filled by navigation.ts)
  const demosSection = document.createElement("div");
  demosSection.className = "sidebar-demos";
  sidebarContainer.appendChild(demosSection);

  // --- Collapse toggle ---
  const collapseToggle = document.createElement("button");
  collapseToggle.id = "sidebar-collapse-toggle";
  collapseToggle.title = "Toggle sidebar";
  collapseToggle.innerHTML = "◀";
  collapseToggle.addEventListener("click", () => {
    const isCollapsed =
      applicationWrapper.classList.toggle("sidebar-collapsed");
    collapseToggle.innerHTML = isCollapsed ? "▶" : "◀";
  });

  // --- Canvas ---
  const canvasContainer = document.createElement("div");
  canvasContainer.id = "pixi-container";

  // --- PixiJS watermark (bottom-right) ---
  const pixiWatermark = document.createElement("a");
  pixiWatermark.id = "pixi-watermark";
  pixiWatermark.href = "https://pixijs.com";
  pixiWatermark.target = "_blank";
  pixiWatermark.rel = "noopener noreferrer";
  pixiWatermark.textContent = "rendering by PixiJS";

  applicationWrapper.appendChild(sidebarContainer);
  applicationWrapper.appendChild(collapseToggle);
  applicationWrapper.appendChild(canvasContainer);
  applicationWrapper.appendChild(pixiWatermark);

  // Return the demos section so navigation.ts populates it (not the full sidebar)
  return {
    sidebarContainer: demosSection,
    canvasContainer,
    onSidebarTransitionEnd: (callback: () => void) => {
      sidebarContainer.addEventListener("transitionend", (event) => {
        // Only react to the sidebar's own collapse/expand transition,
        // not hover transitions (background-color, color…) bubbling from children.
        if (
          event.target === sidebarContainer &&
          event.propertyName === "margin-left"
        ) {
          callback();
        }
      });
    },
  };
}
