/**
 * Choice box — organic, cloud-like bubble for selectable dialogue choices.
 * Same wobbling jelly effect as bubble-text.
 */

import { Container, Graphics, Text } from "pixi.js";
import type { Application } from "pixi.js";

const CHOICE_BOX_PADDING_HORIZONTAL = 36;
const CHOICE_BOX_PADDING_VERTICAL = 26;
const CHOICE_BOX_FILL_COLOR = 0x1a1a2e;
const CHOICE_BOX_STROKE_COLOR = 0xe0e0e0;
const CHOICE_BOX_STROKE_WIDTH = 2.5;
const CHOICE_ROW_HEIGHT = 28;
const CHOICE_ROW_GAP = 6;
const CHOICE_MAX_TEXT_WIDTH = 220;

const WOBBLE_AMPLITUDE = 3;
const WOBBLE_SPEED = 0.8;
const CONTROL_POINT_COUNT = 12;

const CHOICE_TEXT_STYLE = {
  fill: "#ffffff",
  fontSize: 13,
  wordWrap: true,
  wordWrapWidth: CHOICE_MAX_TEXT_WIDTH,
  fontFamily: "Arial, sans-serif",
};

const CHOICE_TEXT_HOVER_COLOR = "#ffcc00";

export interface ChoiceEntry {
  readonly choiceUuid: string;
  readonly text: string;
}

export type ChoiceSelectedCallback = (choiceUuid: string) => void;

export interface ChoiceBoxOptions {
  readonly pixiApplication: Application;
  readonly choiceEntries: ReadonlyArray<ChoiceEntry>;
  readonly onChoiceSelected: ChoiceSelectedCallback;
  readonly showTail?: boolean;
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
  graphics.fill(CHOICE_BOX_FILL_COLOR);
  graphics.stroke({
    color: CHOICE_BOX_STROKE_COLOR,
    width: CHOICE_BOX_STROKE_WIDTH,
  });
}

function drawAnimatedShape(
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
    drawTail(graphics, centerX, bottomY, time);
  }

  drawCloudBody(graphics, positions);
  graphics.fill(CHOICE_BOX_FILL_COLOR);
  graphics.stroke({
    color: CHOICE_BOX_STROKE_COLOR,
    width: CHOICE_BOX_STROKE_WIDTH,
  });
}

export function createChoiceBox(options: ChoiceBoxOptions): Container {
  const {
    pixiApplication,
    choiceEntries,
    onChoiceSelected,
    showTail = true,
  } = options;

  const choiceBoxContainer = new Container();
  choiceBoxContainer.label = "choice-box";

  const choiceRowContainers: Container[] = [];
  let widestRowWidth = 0;

  for (let rowIndex = 0; rowIndex < choiceEntries.length; rowIndex++) {
    const entry = choiceEntries[rowIndex];
    const rowContainer = new Container();
    rowContainer.label = `choice-row-${rowIndex}`;

    const choiceLabel = new Text({
      text: `▸ ${entry.text}`,
      style: CHOICE_TEXT_STYLE,
    });

    rowContainer.addChild(choiceLabel);
    rowContainer.position.set(
      CHOICE_BOX_PADDING_HORIZONTAL,
      CHOICE_BOX_PADDING_VERTICAL +
        rowIndex * (CHOICE_ROW_HEIGHT + CHOICE_ROW_GAP),
    );

    rowContainer.eventMode = "static";
    rowContainer.cursor = "pointer";

    rowContainer.on("pointerover", () => {
      choiceLabel.style.fill = CHOICE_TEXT_HOVER_COLOR;
    });
    rowContainer.on("pointerout", () => {
      choiceLabel.style.fill = CHOICE_TEXT_STYLE.fill;
    });
    rowContainer.on("pointerdown", (event) => {
      event.stopPropagation();
      onChoiceSelected(entry.choiceUuid);
    });

    choiceRowContainers.push(rowContainer);
    widestRowWidth = Math.max(widestRowWidth, choiceLabel.width);
  }

  const boxWidth = widestRowWidth + CHOICE_BOX_PADDING_HORIZONTAL * 2;
  const boxHeight =
    CHOICE_BOX_PADDING_VERTICAL * 2 +
    choiceEntries.length * CHOICE_ROW_HEIGHT +
    (choiceEntries.length - 1) * CHOICE_ROW_GAP;

  const centerX = boxWidth / 2;
  const centerY = boxHeight / 2;
  const radiusX = boxWidth / 2 + 6;
  const radiusY = boxHeight / 2 + 6;
  const boxBottomY = centerY + radiusY;

  const controlPoints = generateControlPoints(
    centerX,
    centerY,
    radiusX,
    radiusY,
  );

  const boxGraphics = new Graphics();
  boxGraphics.label = "choice-box-background";

  let elapsedTime = Math.PI;
  drawAnimatedShape(
    boxGraphics,
    controlPoints,
    centerX,
    boxBottomY,
    elapsedTime,
    showTail,
  );

  pixiApplication.ticker.add((time) => {
    elapsedTime += time.deltaTime * 0.05;
    drawAnimatedShape(
      boxGraphics,
      controlPoints,
      centerX,
      boxBottomY,
      elapsedTime,
      showTail,
    );
  });

  choiceBoxContainer.addChild(boxGraphics, ...choiceRowContainers);

  return choiceBoxContainer;
}

export function positionChoiceBoxAboveTarget(
  choiceBoxContainer: Container,
  targetX: number,
  targetY: number,
  verticalOffset: number = 40,
): void {
  choiceBoxContainer.position.set(
    targetX - choiceBoxContainer.width / 2,
    targetY - choiceBoxContainer.height - verticalOffset,
  );
}
