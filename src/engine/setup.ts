/**
 * LSDE Dialog Engine initialization and blueprint loading.
 */

import { DialogueEngine } from "@lsde/dialog-engine";
import type { BlueprintExport } from "@lsde/dialog-engine";

export async function loadBlueprintFromPath(
  blueprintFilePath: string,
): Promise<BlueprintExport> {
  const response = await fetch(blueprintFilePath);
  const blueprintData: BlueprintExport = await response.json();
  return blueprintData;
}

export function createDialogueEngine(): DialogueEngine {
  return new DialogueEngine();
}
