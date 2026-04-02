/**
 * Typewriter engine — reveals text letter by letter at a configurable speed.
 * Pure business logic: no rendering, no PixiJS dependency.
 * Call `advanceTypewriter()` each frame with deltaTime to progress the reveal.
 */

const DEFAULT_CHARACTERS_PER_SECOND = 30;

export interface TypewriterState {
  readonly fullText: string;
  visibleCharacterCount: number;
  accumulatedTime: number;
  readonly charactersPerSecond: number;
  isComplete: boolean;
}

export function createTypewriterState(
  fullText: string,
  charactersPerSecond: number = DEFAULT_CHARACTERS_PER_SECOND,
): TypewriterState {
  return {
    fullText,
    visibleCharacterCount: 0,
    accumulatedTime: 0,
    charactersPerSecond,
    isComplete: fullText.length === 0,
  };
}

export function advanceTypewriter(
  typewriterState: TypewriterState,
  deltaTimeInSeconds: number,
): void {
  if (typewriterState.isComplete) return;

  typewriterState.accumulatedTime += deltaTimeInSeconds;

  const targetCharacterCount = Math.floor(
    typewriterState.accumulatedTime * typewriterState.charactersPerSecond,
  );

  if (targetCharacterCount >= typewriterState.fullText.length) {
    typewriterState.visibleCharacterCount = typewriterState.fullText.length;
    typewriterState.isComplete = true;
  } else {
    typewriterState.visibleCharacterCount = targetCharacterCount;
  }
}

export function getVisibleText(typewriterState: TypewriterState): string {
  return typewriterState.fullText.slice(
    0,
    typewriterState.visibleCharacterCount,
  );
}

export function skipToEnd(typewriterState: TypewriterState): void {
  typewriterState.visibleCharacterCount = typewriterState.fullText.length;
  typewriterState.isComplete = true;
}

export function resetTypewriter(
  typewriterState: TypewriterState,
  newText?: string,
): void {
  if (newText !== undefined) {
    (typewriterState as { fullText: string }).fullText = newText;
  }
  typewriterState.visibleCharacterCount = 0;
  typewriterState.accumulatedTime = 0;
  typewriterState.isComplete = typewriterState.fullText.length === 0;
}
