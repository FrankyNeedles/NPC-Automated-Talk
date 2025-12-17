// NarrativeToken.ts
/**
 * NarrativeToken.ts
 * Defines atomic units of "Reality".
 * 
 * UPGRADE: Added 'breaking_news' type to allow world events to 
 * inject themselves into the Broadcast flow.
 */

export type NarrativeTokenType = "object_interaction" | "object_state" | "player_presence" | "breaking_news";

export interface NarrativeToken {
  id: string;
  type: NarrativeTokenType;
  timestamp: number;
  importance: number; // 0.0 to 1.0
  
  // -- Core Data --
  objectId?: string;
  objectLabel?: string;
  action?: string;
  actor?: string;
  
  // -- Broadcast Data (New) --
  headline?: string;  // If this token represents news
  body?: string;      // The details
  
  // -- Spatial --
  pos?: { x: number, y: number, z: number };
  rotation?: { x: number, y: number, z: number };
  
  meta?: any;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// --- Factories ---

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
 * Creates a "Breaking News" token.
 * Use this when a script wants to interrupt the broadcast.
 */
export function makeBreakingNews(
  headline: string,
  body: string,
  importance: number = 1.0
): NarrativeToken {
  return {
    id: generateId(),
    type: "breaking_news",
    timestamp: Date.now(),
    headline,
    body,
    importance,
    action: "broadcast_interrupt"
  };
}