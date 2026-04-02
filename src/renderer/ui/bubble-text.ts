/**
 * Speech bubble — organic, cloud-like shape that gently wobbles like jelly.
 * Control points around the perimeter oscillate with sine waves at different
 * phases, redrawn each frame for a living, breathing effect.
 * Text reveals letter by letter via the typewriter engine.
 */

import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";
import {
  createTypewriterState,
  advanceTypewriter,
  getVisibleText,
  skipToEnd,
} from "../../shared/typewriter";
import type { TypewriterState } from "../../shared/typewriter";

const BUBBLE_PADDING_HORIZONTAL = 36;
const BUBBLE_PADDING_VERTICAL = 26;
const BUBBLE_FILL_COLOR = 0xffffff;
const BUBBLE_STROKE_COLOR = 0x222222;
const BUBBLE_STROKE_WIDTH = 2.5;
const BUBBLE_MAX_TEXT_WIDTH = 220;

const WOBBLE_AMPLITUDE = 3;
const WOBBLE_SPEED = 0.8;
const CONTROL_POINT_COUNT = 12;

const DEFAULT_SPEAKER_NAME_COLOR = "#333333";

const DIALOGUE_TEXT_STYLE = {
  fill: "#222222",
  fontSize: 13,
  wordWrap: true,
  wordWrapWidth: BUBBLE_MAX_TEXT_WIDTH,
  fontFamily: "Arial, sans-serif",
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
    const baseX = centerX + Math.cos(angle) * radiusX;
    const baseY = centerY + Math.sin(angle) * radiusY;
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
  strokeColor: number,
  strokeWidth: number,
): void {
  const tailWobble = Math.sin(time * WOBBLE_SPEED * 0.5 + 2.0) * 4;
  const tailBaseLeftX = centerX - 3;
  const tailBaseRightX = centerX + 8;
  const tailAttachY = bottomY - 4;
  const tailTipX = centerX + 22 + tailWobble;
  const tailTipY = tailAttachY + 44;

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
  graphics.stroke({ color: strokeColor, width: strokeWidth });
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
    drawTail(
      graphics,
      centerX,
      bottomY,
      time,
      BUBBLE_FILL_COLOR,
      BUBBLE_STROKE_COLOR,
      BUBBLE_STROKE_WIDTH,
    );
  }

  drawCloudBody(graphics, positions);
  graphics.fill(BUBBLE_FILL_COLOR);
  graphics.stroke({ color: BUBBLE_STROKE_COLOR, width: BUBBLE_STROKE_WIDTH });
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

  const speakerNameLabel = new Text({
    text: speakerName,
    style: {
      fill: speakerNameColor,
      fontSize: 14,
      fontWeight: "bold" as const,
      fontFamily: "Arial, sans-serif",
    },
  });
  speakerNameLabel.label = "speaker-name";
  speakerNameLabel.position.set(
    BUBBLE_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL,
  );

  const dialogueContentLabel = new Text({
    text: dialogueText,
    style: DIALOGUE_TEXT_STYLE,
  });
  dialogueContentLabel.label = "dialogue-content";
  dialogueContentLabel.position.set(
    BUBBLE_PADDING_HORIZONTAL,
    BUBBLE_PADDING_VERTICAL + speakerNameLabel.height + 6,
  );

  // Measure full text for bubble sizing, then start empty for typewriter
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

  const typewriterState = createTypewriterState(dialogueText);
  dialogueContentLabel.text = "";

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

    const deltaTimeInSeconds = time.deltaTime / 60;
    advanceTypewriter(typewriterState, deltaTimeInSeconds);
    dialogueContentLabel.text = getVisibleText(typewriterState);
  };

  pixiApplication.ticker.add(tickerCallback);

  bubbleContainer.addChild(
    bubbleGraphics,
    speakerNameLabel,
    dialogueContentLabel,
  );

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
  verticalOffset: number = 40,
): void {
  bubbleContainer.position.set(
    targetX - bubbleContainer.width / 2,
    targetY - bubbleContainer.height - verticalOffset,
  );
}
