import { createApplicationLayout } from "./app/layout";
import { renderDemoNavigation } from "./app/navigation";
import { createPixiApplication } from "./renderer/stage";
import { DEMO_MANIFEST as DEMO_01_MANIFEST } from "./demos/demo-01/index";
import type { DemoManifestEntry } from "./shared/types";
import type { Application } from "pixi.js";

const ALL_DEMO_MANIFESTS: DemoManifestEntry[] = [
  DEMO_01_MANIFEST,
  // Add demo-02 through demo-05 manifests here as they are created
];

(async () => {
  const { sidebarContainer, canvasContainer } = createApplicationLayout();

  const pixiApplication: Application =
    await createPixiApplication(canvasContainer);

  renderDemoNavigation(
    sidebarContainer,
    ALL_DEMO_MANIFESTS,
    (selectedDemoId: string) => {
      const selectedManifest = ALL_DEMO_MANIFESTS.find(
        (entry) => entry.id === selectedDemoId,
      );
      if (selectedManifest) {
        loadAndRunDemo(selectedManifest, pixiApplication);
      }
    },
  );
})();

async function loadAndRunDemo(
  demoManifest: DemoManifestEntry,
  pixiApplication: Application,
): Promise<void> {
  pixiApplication.stage.removeChildren();

  // Dynamic import to load only the selected demo
  const demoModule = await import(`./demos/${demoManifest.id}/index.ts`);
  await demoModule.runDemo(pixiApplication);
}
