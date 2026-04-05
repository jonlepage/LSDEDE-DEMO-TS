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
	CleanupFn,
} from "@lsde/dialog-engine";
import { trackDialogueShown, trackSceneCompleted } from "../analytics/posthog";

export interface DialogueDisplayRequest {
	readonly characterId: string | undefined;
	readonly characterName: string;
	readonly blockLabel: string | undefined;
	readonly dialogueText: string;
	readonly advanceToNextBlock: () => void;
}

export interface ChoiceDisplayRequest {
	readonly characterId: string | undefined;
	readonly choices: ReadonlyArray<RuntimeChoiceItem>;
	readonly selectChoiceAndAdvance: (choiceUuid: string) => void;
}

export type OnDialogueBlockReceived = (
	request: DialogueDisplayRequest,
) => CleanupFn | void;
export type OnChoiceBlockReceived = (
	request: ChoiceDisplayRequest,
) => CleanupFn | void;
export type OnSceneCompleted = () => void;

export interface HandlerCallbacks {
	readonly onDialogueBlockReceived: OnDialogueBlockReceived;
	readonly onChoiceBlockReceived: OnChoiceBlockReceived;
	readonly onSceneCompleted: OnSceneCompleted;
}

export function registerCharacterResolver(
	dialogueEngine: DialogueEngine,
): void {
	dialogueEngine.onResolveCharacter((characters) => characters[0]);
}

export function registerGlobalHandlers(
	dialogueEngine: DialogueEngine,
	callbacks: HandlerCallbacks,
	getLocale: () => string,
): void {
	dialogueEngine.onDialog(
		({
			block,
			context,
			next,
		}: BlockHandlerArgs<DialogBlock, DialogContext>) => {
			const dialogueText = block.dialogueText?.[getLocale()] ?? "";
			const characterId = context.character?.id;
			const characterName = context.character?.name ?? "???";
			const blockLabel = block.label;

			return callbacks.onDialogueBlockReceived({
				characterId,
				characterName,
				blockLabel,
				dialogueText,
				advanceToNextBlock: next,
			});
		},
	);

	dialogueEngine.onChoice(
		({ context, next }: BlockHandlerArgs<ChoiceBlock, ChoiceContext>) => {
			const characterId = context.character?.id;

			return callbacks.onChoiceBlockReceived({
				characterId,
				choices: context.choices,
				selectChoiceAndAdvance: (choiceUuid: string) => {
					context.selectChoice(choiceUuid);
					next();
				},
			});
		},
	);

	// onBeforeBlock: honor the delay nativeProperty before dispatching each block.
	// The engine does NOT enforce delay — it's the developer's responsibility.
	// A timeout of 0ms still defers to the next microtask, keeping the flow async-safe.
	dialogueEngine.onBeforeBlock(({ block, resolve }) => {
		const delayMs = block.nativeProperties?.delay ?? 0;
		setTimeout(() => resolve(), delayMs);
	});

	// LSDEDE runtime manage this auto but we can also manualy hack and dispatch manualy
	dialogueEngine.onCondition(({ block, context, next }) => {
		const isDispatcher = !!block.nativeProperties?.enableDispatcher;

		const matched = context.conditionGroups
			.filter((c) => c.result)
			.map((c) => c.portIndex);

		const result = isDispatcher
			? matched
			: matched.at(0) ?? -1;

		context.resolve(result);
		
		next();
	});

	dialogueEngine.onAction(({ context, next }) => {
		context.resolve();
		next();
	});

	dialogueEngine.onSceneExit(() => {
		callbacks.onSceneCompleted();
	});
}
