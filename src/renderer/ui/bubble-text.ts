/**
 * Speech bubble — organic, cloud-like shape that gently wobbles like jelly.
 * Control points around the perimeter oscillate with sine waves at different
 * phases, redrawn each frame for a living, breathing effect.
 */

import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";

const BUBBLE_PADDING_HORIZONTAL = 36;
const BUBBLE_PADDING_VERTICAL = 26;
const BUBBLE_FILL_COLOR = 0xffffff;
const BUBBLE_STROKE_COLOR = 0x222222;
const BUBBLE_STROKE_WIDTH = 2.5;
const BUBBLE_MAX_TEXT_WIDTH = 220;

const WOBBLE_AMPLITUDE = 3;
const WOBBLE_SPEED = 0.8;
const CONTROL_POINT_COUNT = 12;

const SPEAKER_NAME_STYLE = {
  fill: "#333333",
  fontSize: 14,
  fontWeight: "bold" as const,
  fontFamily: "Arial, sans-serif",
};

const DIALOGUE_TEXT_STYLE = {
  fill: "#222222",
  fontSize: 13,
  wordWrap: true,
  wordWrapWidth: BUBBLE_MAX_TEXT_WIDTH,
  fontFamily: "Arial, sans-serif",
  lineHeight: 18,
};

export interface BubbleTextOptions {
  readonly speakerName: string;
  readonly dialogueText: string;
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

function drawAnimatedBubble(
  graphics: Graphics,
  controlPoints: ControlPoint[],
  centerX: number,
  bottomY: number,
  time: number,
): void {
  graphics.clear();

  const positions = computeAnimatedPositions(controlPoints, time);
  const tailWobble = Math.sin(time * WOBBLE_SPEED * 0.5 + 2.0) * 4;

  const tailBaseLeftX = centerX - 3;
  const tailBaseRightX = centerX + 8;

  // --- Tail: drawn first, body covers junction ---
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
  graphics.fill(BUBBLE_FILL_COLOR);
  graphics.stroke({ color: BUBBLE_STROKE_COLOR, width: BUBBLE_STROKE_WIDTH });

  // --- Body: drawn on top, covers tail attachment ---
  drawCloudBody(graphics, positions);
  graphics.fill(BUBBLE_FILL_COLOR);
  graphics.stroke({ color: BUBBLE_STROKE_COLOR, width: BUBBLE_STROKE_WIDTH });
}

export function createBubbleText(
  options: BubbleTextOptions,
  pixiApplication: Application,
): Container {
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

  const centerX = bubbleWidth / 2;
  const centerY = bubbleHeight / 2;
  const radiusX = bubbleWidth / 2 + 6;
  const radiusY = bubbleHeight / 2 + 6;

  const controlPoints = generateControlPoints(
    centerX,
    centerY,
    radiusX,
    radiusY,
  );

  const bubbleGraphics = new Graphics();
  bubbleGraphics.label = "bubble-background";

  const bubbleBottomY = centerY + radiusY;

  let elapsedTime = 0;
  drawAnimatedBubble(
    bubbleGraphics,
    controlPoints,
    centerX,
    bubbleBottomY,
    elapsedTime,
  );

  pixiApplication.ticker.add((time) => {
    elapsedTime += time.deltaTime * 0.05;
    drawAnimatedBubble(
      bubbleGraphics,
      controlPoints,
      centerX,
      bubbleBottomY,
      elapsedTime,
    );
  });

  bubbleContainer.addChild(
    bubbleGraphics,
    speakerNameLabel,
    dialogueContentLabel,
  );

  return bubbleContainer;
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
