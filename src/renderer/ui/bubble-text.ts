/**
 * Speech bubble component — Dragon Ball / manga-style balloon built with PixiJS Graphics.
 * The bubble height adapts to the text content. A tail points toward the speaking character.
 */

import { Container, Graphics, Text } from "pixi.js";

const BUBBLE_PADDING_HORIZONTAL = 16;
const BUBBLE_PADDING_VERTICAL = 12;
const BUBBLE_BORDER_RADIUS = 12;
const BUBBLE_FILL_COLOR = "#ffffff";
const BUBBLE_STROKE_COLOR = "#000000";
const BUBBLE_STROKE_WIDTH = 2;
const BUBBLE_TAIL_WIDTH = 14;
const BUBBLE_TAIL_HEIGHT = 18;
const BUBBLE_MAX_TEXT_WIDTH = 260;

const SPEAKER_NAME_STYLE = {
  fill: "#222222",
  fontSize: 13,
  fontWeight: "bold" as const,
};

const DIALOGUE_TEXT_STYLE = {
  fill: "#111111",
  fontSize: 12,
  wordWrap: true,
  wordWrapWidth: BUBBLE_MAX_TEXT_WIDTH,
};

export interface BubbleTextOptions {
  readonly speakerName: string;
  readonly dialogueText: string;
}

export function createBubbleText(options: BubbleTextOptions): Container {
  const bubbleContainer = new Container();
  bubbleContainer.label = "bubble-text";

  const speakerNameLabel = new Text({
    text: options.speakerName,
    style: SPEAKER_NAME_STYLE,
  });
  speakerNameLabel.label = "speaker-name";
  speakerNameLabel.position.set(
    BUBBLE_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL,
  );

  const dialogueContentLabel = new Text({
    text: options.dialogueText,
    style: DIALOGUE_TEXT_STYLE,
  });
  dialogueContentLabel.label = "dialogue-content";
  dialogueContentLabel.position.set(
    BUBBLE_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL + speakerNameLabel.height + 6,
  );

  const contentWidth = Math.max(
    speakerNameLabel.width,
    dialogueContentLabel.width,
  );
  const bubbleWidth = contentWidth + BUBBLE_PADDING_HORIZONTAL * 2;
  const bubbleHeight =
    BUBBLE_PADDING_VERTICAL * 2 +
    speakerNameLabel.height +
    6 +
    dialogueContentLabel.height;

  const bubbleBackground = new Graphics();
  bubbleBackground.label = "bubble-background";

  bubbleBackground
    .roundRect(0, 0, bubbleWidth, bubbleHeight, BUBBLE_BORDER_RADIUS)
    .fill(BUBBLE_FILL_COLOR)
    .stroke({ color: BUBBLE_STROKE_COLOR, width: BUBBLE_STROKE_WIDTH });

  const tailCenterX = bubbleWidth / 2;
  bubbleBackground
    .moveTo(tailCenterX - BUBBLE_TAIL_WIDTH / 2, bubbleHeight)
    .lineTo(tailCenterX, bubbleHeight + BUBBLE_TAIL_HEIGHT)
    .lineTo(tailCenterX + BUBBLE_TAIL_WIDTH / 2, bubbleHeight)
    .closePath()
    .fill(BUBBLE_FILL_COLOR)
    .stroke({ color: BUBBLE_STROKE_COLOR, width: BUBBLE_STROKE_WIDTH });

  bubbleContainer.addChild(
    bubbleBackground,
    speakerNameLabel,
    dialogueContentLabel,
  );

  return bubbleContainer;
}

export function updateBubbleText(
  bubbleContainer: Container,
  speakerName: string,
  dialogueText: string,
): void {
  bubbleContainer.removeChildren();
  const updatedBubble = createBubbleText({ speakerName, dialogueText });
  for (const child of updatedBubble.children) {
    bubbleContainer.addChild(child);
  }
}

export function positionBubbleAboveTarget(
  bubbleContainer: Container,
  targetX: number,
  targetY: number,
  verticalOffset: number = 60,
): void {
  bubbleContainer.position.set(
    targetX - bubbleContainer.width / 2,
    targetY - bubbleContainer.height - verticalOffset,
  );
}
