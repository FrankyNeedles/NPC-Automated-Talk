// NarrativeToken.ts
/**
 * NarrativeToken.ts
 * Defines the structure of "facts" that the world sends to the Brain.
 * This file is a utility module, not a component.
 */

export type NarrativeTokenType = "object_interaction" | "object_state" | "player_presence" | "system_event";

export interface NarrativeToken {
  id: string;               // Unique ID for this specific event instance
  type: NarrativeTokenType; // What kind of event is this?
  timestamp: number;        // When did it happen?
  
  // -- Core Data --
  objectId?: string;        // ID of the object involved (e.g., "ancient_book")
  objectLabel?: string;     // Human-readable name (e.g., "Ancient Spellbook")
  action?: string;          // What happened? (e.g., "picked_up", "dropped", "opened")
  actor?: string;           // Who did it? (Player Name or ID)
  
  // -- Spatial Data (Optional) --
  pos?: { x: number, y: number, z: number };
  
  // -- Context --
  importance: number;       // 0.0 to 1.0 (How interesting is this?)
  meta?: any;               // Any extra data (e.g., animation name, specific state)
}

/**
 * Helper to generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Factory: Create an Object Interaction Token
 * Used when a player grabs, drops, or uses an item.
 */
export function makeObjectInteraction(
  objectId: string,
  objectLabel: string,
  action: string,
  actor: string,
  importance: number = 0.5,
  pos?: { x: number, y: number, z: number }
): NarrativeToken {
  return {
    id: generateId(),
    type: "object_interaction",
    timestamp: Date.now(),
    objectId,
    objectLabel,
    action,
    actor,
    pos,
    importance
  };
}

/**
 * Factory: Create an Object State Token
 * Used when an object changes on its own (animation plays, machine turns on).
 */
export function makeObjectState(
  objectId: string,
  objectLabel: string,
  action: string,
  importance: number = 0.5,
  meta?: any
): NarrativeToken {
  return {
    id: generateId(),
    type: "object_state",
    timestamp: Date.now(),
    objectId,
    objectLabel,
    action,
    importance,
    meta
  };
}

/**
 * Factory: Create a Player Presence Token
 * Used when a player enters a zone or emotes.
 */
export function makePlayerPresence(
  actor: string,
  action: string, // e.g., "entered_zone", "waved"
  importance: number = 0.3,
  pos?: { x: number, y: number, z: number }
): NarrativeToken {
  return {
    id: generateId(),
    type: "player_presence",
    timestamp: Date.now(),
    actor,
    action,
    pos,
    importance
  };
}