/**
 * Shared condition evaluator — bridges LSDE condition keys to game facade lookups.
 *
 * Each condition from the blueprint has: { key, operator, value }
 *   - key:      a dot-separated path like "inventory.carrot", "party.l1", or "variables.score"
 *   - operator: a comparison string like ">=", "==", "!=", "="
 *   - value:    the expected value as a string (always string in the export)
 *
 * The first segment of the key identifies the dictionary group (inventory, party,
 * variables). The second segment is the item/variable name.
 *
 * Supported dictionary groups:
 *   - "party"     → boolean membership check via gameActions.isInParty()
 *   - "inventory" → numeric quantity check via gameActions.getItemQuantity()
 *   - default     → numeric variable check via gameActions.getVariable()
 */

import type { GameActionFacade } from "../../game/game-actions";
import type { ExportCondition } from "../../../public/blueprints/blueprint.types";

function compareNumeric(currentValue: number, operator: string, targetValue: number): boolean | null {
	switch (operator) {
	case "=":
	case "==":
		return currentValue === targetValue;
	case "!=":
		return currentValue !== targetValue;
	case ">=":
		return currentValue >= targetValue;
	case "<=":
		return currentValue <= targetValue;
	case ">":
		return currentValue > targetValue;
	case "<":
		return currentValue < targetValue;
	default:
		return null;
	}
}

export function evaluateGameCondition(
	condition: ExportCondition,
	gameActions: GameActionFacade,
): boolean {
	const { key, operator, value } = condition;
	const dotIndex = key.indexOf(".");
	const dictionaryGroup = dotIndex !== -1 ? key.slice(0, dotIndex) : "";
	const itemKey = dotIndex !== -1 ? key.slice(dotIndex + 1) : key;

	switch (dictionaryGroup) {
	case "party": {
		const isMember = gameActions.isInParty(itemKey);
		const expectedTrue = value === "true" || value === "1";
		switch (operator) {
		case "=":
		case "==":
			return isMember === expectedTrue;
		case "!=":
			return isMember !== expectedTrue;
		default:
			console.warn(`[evaluate-condition] Unknown party operator: "${operator}"`);
			return false;
		}
	}
	case "inventory": {
		const result = compareNumeric(gameActions.getItemQuantity(itemKey), operator, Number(value));
		if (result === null) {
			console.warn(`[evaluate-condition] Unknown inventory operator: "${operator}" in key "${key}"`);
			return false;
		}
		return result;
	}
	default: {
		const result = compareNumeric(gameActions.getVariable(key), operator, Number(value));
		if (result === null) {
			console.warn(`[evaluate-condition] Unknown operator: "${operator}" in key "${key}"`);
			return false;
		}
		return result;
	}
	}
}
