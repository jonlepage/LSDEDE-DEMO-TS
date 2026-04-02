/**
 * Choice box component — manga-style bubble listing selectable dialogue choices.
 * Each choice is a clickable row inside the bubble. Built with PixiJS Graphics.
 */

import { Container, Graphics, Text } from "pixi.js";

const CHOICE_BOX_PADDING_HORIZONTAL = 16;
const CHOICE_BOX_PADDING_VERTICAL = 12;
const CHOICE_BOX_BORDER_RADIUS = 10;
const CHOICE_BOX_FILL_COLOR = "#1a1a2e";
const CHOICE_BOX_STROKE_COLOR = "#e0e0e0";
const CHOICE_BOX_STROKE_WIDTH = 2;
const CHOICE_ROW_HEIGHT = 32;
const CHOICE_ROW_GAP = 4;
const CHOICE_MAX_TEXT_WIDTH = 260;

const CHOICE_TEXT_STYLE = {
  fill: "#ffffff",
  fontSize: 13,
  wordWrap: true,
  wordWrapWidth: CHOICE_MAX_TEXT_WIDTH,
};

const CHOICE_TEXT_HOVER_COLOR = "#ffcc00";

export interface ChoiceEntry {
  readonly choiceUuid: string;
  readonly text: string;
}

export type ChoiceSelectedCallback = (choiceUuid: string) => void;

export function createChoiceBox(
  choiceEntries: ReadonlyArray<ChoiceEntry>,
  onChoiceSelected: ChoiceSelectedCallback,
): Container {
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
    rowContainer.on("pointerdown", () => {
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

  const boxBackground = new Graphics();
  boxBackground.label = "choice-box-background";
  boxBackground
    .roundRect(0, 0, boxWidth, boxHeight, CHOICE_BOX_BORDER_RADIUS)
    .fill(CHOICE_BOX_FILL_COLOR)
    .stroke({ color: CHOICE_BOX_STROKE_COLOR, width: CHOICE_BOX_STROKE_WIDTH });

  choiceBoxContainer.addChild(boxBackground, ...choiceRowContainers);

  return choiceBoxContainer;
}
