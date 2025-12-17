// NarrativeToken.ts
/**
 * NarrativeToken.ts
 * Defines the atomic units of "Reality" that the system observes.
 * This is a utility module (Type Definition + Factory Helpers).
 */

export type NarrativeTokenType = "object_interaction" | "object_state" | "player_presence" | "system_event";

export interface NarrativeToken {
  id: string;               // Unique token ID
  type: NarrativeTokenType; // Category
  timestamp: number;        // When it happened
  importance: number;       // 0.0 to 1.0 (Priority)
  
  // -- Core Data --
  objectId?: string;        // ID of the entity involved
  objectLabel?: string;     // Human-readable name (e.g. "Ancient Spellbook")
  action?: string;          // What happened? (e.g. "picked_up", "opened")
  actor?: string;           // Player Name or ID
  
  // -- Spatial Data --
  pos?: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number };
  scale?: { x: number, y: number, z: number };
  
  // -- Context --
  relatedObjects?: string[]; // IDs of other objects involved
  meta?: any;                // Extra data (animation names, specific states)
}

/**
 * Helper: Generate a unique short ID
 */
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Factory: Create an Object Interaction Token
 * (e.g. Player grabs something)
 */
export function makeObjectInteraction(
  objectId: string,
  objectLabel: string,
  action: string,
  actor: string,
  importance: number = 0.5,
  pos?: { x: number, y: number, z: number },
  rotation?: { x: number, y: number, z: number }
): NarrativeToken {
  return {
    id: generateId(),
    type: "object_interaction",
    timestamp: Date.now(),
    objectId,
    objectLabel,
    action,
    actor,
    importance,
    pos,
    rotation
  };
}

/**
 * Factory: Create an Object State Token
 * (e.g. An object animates or changes state on its own)
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
 * (e.g. Player enters the studio)
 */
export function makePlayerPresence(
  actor: string,
  action: string, // e.g., "entered_zone", "left_zone"
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