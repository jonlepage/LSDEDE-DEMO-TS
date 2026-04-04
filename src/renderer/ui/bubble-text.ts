/**
 * Speech bubble — organic, cloud-like shape that gently wobbles like jelly.
 * Outline and shadow are handled by pixi-filters on the container,
 * not by stroke() on individual graphics.
 */

import { Container, Graphics, Text } from "pixi.js";
import type { Application, TextStyle } from "pixi.js";
import { OutlineFilter, DropShadowFilter } from "pixi-filters";
import {
  createTypewriterState,
  advanceTypewriter,
  getVisibleText,
  skipToEnd,
} from "../../shared/typewriter";
import type { TypewriterState } from "../../shared/typewriter";

const BUBBLE_PADDING_HORIZONTAL = 70;
const BUBBLE_PADDING_VERTICAL = 48;
const BUBBLE_FILL_COLOR = 0xffffff;
const BUBBLE_MAX_TEXT_WIDTH = 265;

const OUTLINE_COLOR = 0x222222;
const OUTLINE_THICKNESS = 3;
const SHADOW_OFFSET_X = 3;
const SHADOW_OFFSET_Y = 3;
const SHADOW_BLUR = 3;
const SHADOW_ALPHA = 0.7;
const SHADOW_COLOR = 0x000000;

const NAME_BACKGROUND_PADDING_HORIZONTAL = 8;
const NAME_BACKGROUND_PADDING_VERTICAL = 3;
const NAME_BACKGROUND_COLOR = 0xffffff;
const NAME_BACKGROUND_BORDER_RADIUS = 6;

const WOBBLE_AMPLITUDE = 5;
const WOBBLE_SPEED = 0.5;
const CONTROL_POINT_COUNT = 14;
const BULGE_VARIATION = 3;

const DEFAULT_SPEAKER_NAME_COLOR = "#333333";

const DIALOGUE_TEXT_STYLE: Partial<TextStyle> = {
  fill: "#222222",
  fontSize: 18,
  wordWrap: true,
  wordWrapWidth: BUBBLE_MAX_TEXT_WIDTH,
  breakWords: true,
  fontFamily: "Comic Sans MS",
  lineHeight: 18,
};

export interface BubbleTextOptions {
  readonly pixiApplication: Application;
  readonly speakerName: string;
  readonly dialogueText: string;
  readonly speakerNameColor?: string;
  readonly showTail?: boolean;
}

export interface BubbleTextHandle {
  readonly container: Container;
  readonly typewriterState: TypewriterState;
  skipTypewriter: () => void;
  destroy: () => void;
}

interface ControlPoint {
  readonly baseX: number;
  readonly baseY: number;
  readonly phase: number;
  readonly amplitudeMultiplier: number;
}

function generateControlPoints(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
): ControlPoint[] {
  const points: ControlPoint[] = [];

  for (let pointIndex = 0; pointIndex < CONTROL_POINT_COUNT; pointIndex++) {
    const angle =
      (pointIndex / CONTROL_POINT_COUNT) * Math.PI * 2 - Math.PI / 2;

    const bulgeOffset =
      Math.sin(pointIndex * 2.3 + 0.7) * BULGE_VARIATION +
      Math.cos(pointIndex * 3.1) * BULGE_VARIATION * 0.5;

    const baseX = centerX + Math.cos(angle) * (radiusX + bulgeOffset);
    const baseY = centerY + Math.sin(angle) * (radiusY + bulgeOffset * 0.7);
    const phase = pointIndex * 1.7 + pointIndex * pointIndex * 0.3;
    const amplitudeMultiplier = 0.6 + ((pointIndex * 7 + 3) % 5) / 5;

    points.push({ baseX, baseY, phase, amplitudeMultiplier });
  }

  return points;
}

function computeAnimatedPositions(
  controlPoints: ControlPoint[],
  time: number,
): { x: number; y: number }[] {
  return controlPoints.map((point) => ({
    x:
      point.baseX +
      Math.sin(time * WOBBLE_SPEED + point.phase) *
        WOBBLE_AMPLITUDE *
        point.amplitudeMultiplier,
    y:
      point.baseY +
      Math.cos(time * WOBBLE_SPEED * 0.7 + point.phase + 1.3) *
        WOBBLE_AMPLITUDE *
        point.amplitudeMultiplier,
  }));
}

function drawCloudBody(
  graphics: Graphics,
  positions: { x: number; y: number }[],
): void {
  const count = positions.length;
  const first = positions[0];
  const second = positions[1];

  graphics.moveTo((first.x + second.x) / 2, (first.y + second.y) / 2);

  for (let i = 1; i <= count; i++) {
    const current = positions[i % count];
    const next = positions[(i + 1) % count];
    graphics.quadraticCurveTo(
      current.x,
      current.y,
      (current.x + next.x) / 2,
      (current.y + next.y) / 2,
    );
  }

  graphics.closePath();
}

function drawTail(
  graphics: Graphics,
  centerX: number,
  bottomY: number,
  time: number,
  fillColor: number,
): void {
  const tailWobble = Math.sin(time * WOBBLE_SPEED * 0.5 + 2.0) * 4;
  const tailBaseLeftX = centerX - 3;
  const tailBaseRightX = centerX + 8;
  const tailAttachY = bottomY - 24;
  const tailTipX = centerX + 22 + tailWobble;
  const tailTipY = tailAttachY + 70;

  graphics.moveTo(tailBaseRightX, tailAttachY);
  graphics.bezierCurveTo(
    tailBaseRightX + 12,
    tailAttachY + 14,
    tailTipX + 4,
    tailTipY - 10,
    tailTipX,
    tailTipY,
  );
  graphics.bezierCurveTo(
    tailTipX - 6 + tailWobble * 0.3,
    tailTipY - 6,
    tailBaseLeftX + 4,
    tailAttachY + 16,
    tailBaseLeftX,
    tailAttachY,
  );
  graphics.closePath();
  graphics.fill(fillColor);
}

function drawAnimatedBubble(
  graphics: Graphics,
  controlPoints: ControlPoint[],
  centerX: number,
  bottomY: number,
  time: number,
  showTail: boolean,
): void {
  graphics.clear();

  const positions = computeAnimatedPositions(controlPoints, time);

  if (showTail) {
    drawTail(graphics, centerX, bottomY, time, BUBBLE_FILL_COLOR);
  }

  drawCloudBody(graphics, positions);
  graphics.fill(BUBBLE_FILL_COLOR);
}

export function createBubbleText(options: BubbleTextOptions): BubbleTextHandle {
  const {
    pixiApplication,
    speakerName,
    dialogueText,
    speakerNameColor = DEFAULT_SPEAKER_NAME_COLOR,
    showTail = true,
  } = options;

  const bubbleContainer = new Container();
  bubbleContainer.label = "bubble-text";

  // --- Speaker name with white background ---
  const speakerNameLabel = new Text({
    text: speakerName,
    style: {
      fill: speakerNameColor,
      fontSize: 16,
      fontWeight: "bold" as const,
      fontFamily: "comicsans, sans-serif",
    },
  });
  speakerNameLabel.label = "speaker-name";

  const nameBackgroundGraphics = new Graphics();
  nameBackgroundGraphics.label = "name-background";
  nameBackgroundGraphics
    .roundRect(
      0,
      0,
      speakerNameLabel.width + NAME_BACKGROUND_PADDING_HORIZONTAL * 2,
      speakerNameLabel.height + NAME_BACKGROUND_PADDING_VERTICAL * 2,
      NAME_BACKGROUND_BORDER_RADIUS,
    )
    .fill(NAME_BACKGROUND_COLOR);

  const nameContainer = new Container();
  nameContainer.label = "name-container";
  nameContainer.addChild(nameBackgroundGraphics, speakerNameLabel);
  speakerNameLabel.position.set(
    NAME_BACKGROUND_PADDING_HORIZONTAL,
    NAME_BACKGROUND_PADDING_VERTICAL,
  );
  nameContainer.position.set(
    BUBBLE_PADDING_HORIZONTAL - NAME_BACKGROUND_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL - NAME_BACKGROUND_PADDING_VERTICAL,
  );

  // --- Dialogue text with white background ---
  const dialogueContentLabel = new Text({
    text: dialogueText,
    style: DIALOGUE_TEXT_STYLE,
  });
  dialogueContentLabel.label = "dialogue-content";

  const dialogueBackgroundGraphics = new Graphics();
  dialogueBackgroundGraphics.label = "dialogue-background";

  const dialogueContainer = new Container();
  dialogueContainer.label = "dialogue-container";
  dialogueContainer.addChild(dialogueBackgroundGraphics, dialogueContentLabel);
  dialogueContentLabel.position.set(
    NAME_BACKGROUND_PADDING_HORIZONTAL,
    NAME_BACKGROUND_PADDING_VERTICAL,
  );
  dialogueContainer.position.set(
    BUBBLE_PADDING_HORIZONTAL - NAME_BACKGROUND_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL + speakerNameLabel.height + 10,
  );

  function redrawDialogueBackground(): void {
    dialogueBackgroundGraphics.clear();
    if (dialogueContentLabel.text) {
      dialogueBackgroundGraphics
        .roundRect(
          0,
          0,
          dialogueContentLabel.width + NAME_BACKGROUND_PADDING_HORIZONTAL * 2,
          dialogueContentLabel.height + NAME_BACKGROUND_PADDING_VERTICAL * 2,
          NAME_BACKGROUND_BORDER_RADIUS,
        )
        .fill(NAME_BACKGROUND_COLOR);
    }
  }

  // --- Bubble sizing (measured with full text) ---
  const contentWidth = Math.max(
    speakerNameLabel.width,
    dialogueContentLabel.width,
  );
  const bubbleWidth = contentWidth + BUBBLE_PADDING_HORIZONTAL * 2;
  const bubbleHeight =
    BUBBLE_PADDING_VERTICAL * 2 +
    speakerNameLabel.height +
    10 +
    dialogueContentLabel.height;

  const typewriterState = createTypewriterState(dialogueText);
  dialogueContentLabel.text = "";
  redrawDialogueBackground();

  const centerX = bubbleWidth / 2;
  const centerY = bubbleHeight / 2;
  const radiusX = bubbleWidth / 2 + 6;
  const radiusY = bubbleHeight / 2 + 6;
  const bubbleBottomY = centerY + radiusY;

  const controlPoints = generateControlPoints(
    centerX,
    centerY,
    radiusX,
    radiusY,
  );

  const bubbleGraphics = new Graphics();
  bubbleGraphics.label = "bubble-background";

  let elapsedTime = 0;
  drawAnimatedBubble(
    bubbleGraphics,
    controlPoints,
    centerX,
    bubbleBottomY,
    elapsedTime,
    showTail,
  );

  const tickerCallback = (time: { deltaTime: number }) => {
    elapsedTime += time.deltaTime * 0.05;
    drawAnimatedBubble(
      bubbleGraphics,
      controlPoints,
      centerX,
      bubbleBottomY,
      elapsedTime,
      showTail,
    );

    const nameJiggleX = Math.sin(elapsedTime * 3.0) * 0.5;
    const nameJiggleY = Math.cos(elapsedTime * 2.3) * 0.4;
    nameContainer.pivot.set(-nameJiggleX, -nameJiggleY);

    const deltaTimeInSeconds = time.deltaTime / 60;
    advanceTypewriter(typewriterState, deltaTimeInSeconds);
    dialogueContentLabel.text = getVisibleText(typewriterState);
    redrawDialogueBackground();
  };

  pixiApplication.ticker.add(tickerCallback);

  bubbleContainer.addChild(bubbleGraphics, nameContainer, dialogueContainer);

  // --- Filters: outline + drop shadow on the whole container ---
  bubbleContainer.filters = [
    new OutlineFilter({
      thickness: OUTLINE_THICKNESS,
      color: OUTLINE_COLOR,
      quality: 1,
    }),
    new DropShadowFilter({
      offset: { x: SHADOW_OFFSET_X, y: SHADOW_OFFSET_Y },
      blur: SHADOW_BLUR,
      alpha: SHADOW_ALPHA,
      color: SHADOW_COLOR,
    }),
  ];

  return {
    container: bubbleContainer,
    typewriterState,
    skipTypewriter: () => {
      skipToEnd(typewriterState);
      dialogueContentLabel.text = getVisibleText(typewriterState);
    },
    destroy: () => {
      pixiApplication.ticker.remove(tickerCallback);
      if (bubbleContainer.parent) {
        bubbleContainer.parent.removeChild(bubbleContainer);
      }
      bubbleContainer.destroy({ children: true });
    },
  };
}

export function positionBubbleAboveTarget(
  bubbleContainer: Container,
  targetX: number,
  targetY: number,
  verticalOffset: number = 45,
): void {
  bubbleContainer.position.set(
    targetX - bubbleContainer.width / 1.7,
    targetY - bubbleContainer.height - verticalOffset,
  );
}
