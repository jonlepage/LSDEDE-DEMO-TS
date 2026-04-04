/**
 * PostHog analytics — single init point + typed event helpers.
 *
 * PostHog autocapture & session recording handle mouse tracking, clicks,
 * rage-clicks, dead-clicks, page views and DOM interactions automatically.
 * This module adds LSDE-specific custom events on top.
 */

import posthog from "posthog-js";

let initialized = false;

/**
 * Initialise PostHog. Call once at application startup.
 * Does nothing if the project token is missing (local dev without analytics).
 */
export function initAnalytics(projectToken: string, apiHost: string): void {
  if (initialized) return;
  if (!projectToken) {
    console.warn("[Analytics] No PostHog project token — analytics disabled.");
    return;
  }

  posthog.init(projectToken, {
    api_host: apiHost,
    ui_host: "https://us.posthog.com", // PostHog app UI (toolbar, surveys)

    /* ── Silence errors when blocked by ad blockers ──── */
    on_request_error: () => {},

    /* ── Autocapture ─────────────────────────────────── */
    autocapture: true, // clicks, inputs, form submits
    capture_pageview: true, // SPA page views
    capture_pageleave: true, // tab close / navigation away

    /* ── Session Recording (mouse tracking + heatmaps) ─ */
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: false, // no sensitive inputs in this demo
      maskTextSelector: "", // show all text (educational content)
    },

    /* ── Heatmaps ────────────────────────────────────── */
    enable_heatmaps: true,

    /* ── Scroll depth ────────────────────────────────── */
    capture_dead_clicks: true,

    /* ── Privacy ─────────────────────────────────────── */
    persistence: "localStorage+cookie",
    respect_dnt: true, // honour Do-Not-Track header
  });

  initialized = true;
}

/* ================================================================
 *  LSDE-specific custom events
 * ================================================================ */

/** User navigated to a demo scene via the sidebar. */
export function trackSceneSelected(
  sceneUuid: string,
  sceneLabel: string,
): void {
  posthog.capture("scene_selected", {
    scene_uuid: sceneUuid,
    scene_label: sceneLabel,
  });
}

/** A DIALOG block was displayed to the user. */
export function trackDialogueShown(
  sceneLabel: string,
  blockUuid: string,
  characterId: string | undefined,
): void {
  posthog.capture("dialogue_shown", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
    character_id: characterId,
  });
}

/** User clicked / pressed Enter to advance dialogue. */
export function trackDialogueAdvanced(
  sceneLabel: string,
  blockUuid: string,
): void {
  posthog.capture("dialogue_advanced", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
  });
}

/** A CHOICE block was presented. */
export function trackChoicesPresented(
  sceneLabel: string,
  blockUuid: string,
  choiceCount: number,
): void {
  posthog.capture("choices_presented", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
    choice_count: choiceCount,
  });
}

/** User selected a specific choice. */
export function trackChoiceSelected(
  sceneLabel: string,
  blockUuid: string,
  choiceUuid: string,
  choiceIndex: number,
): void {
  posthog.capture("choice_selected", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
    choice_uuid: choiceUuid,
    choice_index: choiceIndex,
  });
}

/** A CONDITION block was evaluated. */
export function trackConditionEvaluated(
  sceneLabel: string,
  blockUuid: string,
  result: boolean | number | number[] | object,
): void {
  posthog.capture("condition_evaluated", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
    result: typeof result === "boolean" ? result : JSON.stringify(result),
  });
}

/** An ACTION block was executed. */
export function trackActionExecuted(
  sceneLabel: string,
  blockUuid: string,
  actionIds: string[],
): void {
  posthog.capture("action_executed", {
    scene_label: sceneLabel,
    block_uuid: blockUuid,
    action_ids: actionIds,
  });
}

/** Player interacted with an NPC (proximity trigger). */
export function trackNpcInteraction(
  sceneLabel: string,
  characterId: string,
  interactionType: "proximity_enter" | "dialogue_trigger" | "recruitment",
): void {
  posthog.capture("npc_interaction", {
    scene_label: sceneLabel,
    character_id: characterId,
    interaction_type: interactionType,
  });
}

/** Player clicked on the PixiJS canvas (world click). */
export function trackCanvasClick(
  sceneLabel: string,
  worldX: number,
  worldY: number,
): void {
  posthog.capture("canvas_click", {
    scene_label: sceneLabel,
    world_x: Math.round(worldX),
    world_y: Math.round(worldY),
  });
}

/** An inventory item was picked up. */
export function trackItemPickedUp(sceneLabel: string, itemKey: string): void {
  posthog.capture("item_picked_up", {
    scene_label: sceneLabel,
    item_key: itemKey,
  });
}

/** A party member was recruited. */
export function trackPartyMemberRecruited(
  sceneLabel: string,
  characterId: string,
): void {
  posthog.capture("party_member_recruited", {
    scene_label: sceneLabel,
    character_id: characterId,
  });
}

/** Scene completed (engine reached end of scene flow). */
export function trackSceneCompleted(sceneLabel: string): void {
  posthog.capture("scene_completed", {
    scene_label: sceneLabel,
  });
}
