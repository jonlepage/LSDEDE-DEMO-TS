/**
 * Global LSDE handler registration.
 * Handlers translate engine dispatch events into application-level callbacks.
 * They must NOT import from renderer/ — they communicate via callback signatures.
 */

import type {
  DialogueEngine,
  BlockHandlerArgs,
  DialogBlock,
  DialogContext,
  ChoiceBlock,
  ChoiceContext,
  RuntimeChoiceItem,
} from "@lsde/dialog-engine";

export interface DialogueDisplayRequest {
  readonly characterName: string;
  readonly dialogueText: string;
  readonly advanceToNextBlock: () => void;
}

export interface ChoiceDisplayRequest {
  readonly choices: ReadonlyArray<RuntimeChoiceItem>;
  readonly selectChoiceAndAdvance: (choiceUuid: string) => void;
}

export type OnDialogueBlockReceived = (request: DialogueDisplayRequest) => void;
export type OnChoiceBlockReceived = (request: ChoiceDisplayRequest) => void;
export type OnSceneCompleted = () => void;

export interface HandlerCallbacks {
  readonly onDialogueBlockReceived: OnDialogueBlockReceived;
  readonly onChoiceBlockReceived: OnChoiceBlockReceived;
  readonly onSceneCompleted: OnSceneCompleted;
}

export function registerGlobalHandlers(
  dialogueEngine: DialogueEngine,
  callbacks: HandlerCallbacks,
  locale: string,
): void {
  dialogueEngine.onDialog(
    ({
      block,
      context,
      next,
    }: BlockHandlerArgs<DialogBlock, DialogContext>) => {
      const dialogueText = block.dialogueText?.[locale] ?? "";
      const characterName = context.character?.name ?? "???";

      callbacks.onDialogueBlockReceived({
        characterName,
        dialogueText,
        advanceToNextBlock: next,
      });
    },
  );

  dialogueEngine.onChoice(
    ({ context, next }: BlockHandlerArgs<ChoiceBlock, ChoiceContext>) => {
      callbacks.onChoiceBlockReceived({
        choices: context.choices,
        selectChoiceAndAdvance: (choiceUuid: string) => {
          context.selectChoice(choiceUuid);
          next();
        },
      });
    },
  );

  dialogueEngine.onSceneExit(() => {
    callbacks.onSceneCompleted();
  });
}
