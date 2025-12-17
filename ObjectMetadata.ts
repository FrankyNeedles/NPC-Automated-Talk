// ObjectMetadata.ts
/**
 * ObjectMetadata.ts
 * A database of "Lore" for objects in the world.
 * 
 * When a player interacts with an object (e.g., "book_ancient"), the system looks it up here
 * to find the 'shortPrompt' and 'toneHint' to feed to the AI.
 */

export interface ObjectMetadata {
  id: string;               // Matches the Entity Name or NarrativeID
  displayName: string;      // Nice name for the UI/AI (e.g. "Ancient Spellbook")
  shortPrompt: string;      // 1-3 sentences describing the object's significance
  toneHint: string;         // Adjective for the AI's reaction (e.g. "mysterious", "excited")
  importance: number;       // 0.0 to 1.0 (How much priority should this event get?)
  
  // -- Tracking Flags --
  trackRotation?: boolean;  // Should we trigger events if this is spun around?
  trackScale?: boolean;     // Should we trigger events if this is resized?
  
  // -- Optional AI Helpers --
  exampleLines?: string[];  // Sample things the Streamer might say about it
}

// The Central Database
export const OBJECT_DATABASE: Record<string, ObjectMetadata> = {
  
  "book_ancient": {
    id: "book_ancient",
    displayName: "Ancient Spellbook",
    shortPrompt: "A dusty, leather-bound tome that glows faintly purple. It looks like it belongs in a wizard's tower, not a stream setup.",
    toneHint: "mysterious",
    importance: 0.8,
    trackRotation: true,
    exampleLines: [
      "Whoa, the spellbook is glowing again.",
      "Chat, if I open this, do I get superpowers or cursed?"
    ]
  },

  "coffee_mug": {
    id: "coffee_mug",
    displayName: "Streamer's Mug",
    shortPrompt: "A ceramic mug with the text '#1 GAMER' fading off. It is currently empty.",
    toneHint: "tired but cozy",
    importance: 0.3, // Low importance, just filler
    trackRotation: false
  },

  "poster_scifi": {
    id: "poster_scifi",
    displayName: "Retro Sci-Fi Poster",
    shortPrompt: "A vintage poster showing a rocket ship landing on Mars. It represents the dream of exploration.",
    toneHint: "nostalgic",
    importance: 0.4,
    trackRotation: false
  },

  "toy_robot": {
    id: "toy_robot",
    displayName: "Mecha Figurine",
    shortPrompt: "A collectible plastic robot with articulating arms. It's a rare limited edition.",
    toneHint: "enthusiastic",
    importance: 0.6,
    trackRotation: true,
    exampleLines: [
      "Careful with the mecha, that's mint condition!",
      "Look at the detail on those servos."
    ]
  },

  "vr_controller": {
    id: "vr_controller",
    displayName: "VR Controller",
    shortPrompt: "A standard white VR controller. It glitched out earlier but seems fine now.",
    toneHint: "technical",
    importance: 0.5,
    trackRotation: true
  },

  "golden_statue": {
    id: "golden_statue",
    displayName: "Golden Llama",
    shortPrompt: "A heavy, solid gold statue of a llama. It is the ultimate prize for the community challenge.",
    toneHint: "hyped",
    importance: 0.9, // High importance!
    trackRotation: true,
    exampleLines: [
      "The Golden Llama! We finally got it!",
      "That thing shines so bright it messes with the camera exposure."
    ]
  }
};

/**
 * Helper to get metadata safely
 */
export function getMetadata(id: string): ObjectMetadata | undefined {
  return OBJECT_DATABASE[id];
}