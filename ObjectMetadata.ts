// ObjectMetadata.ts
/**
 * ObjectMetadata.ts
 * "Lore" definitions for interactive objects.
 * The system looks up object IDs here to find out how to describe them to the AI.
 */

export interface ObjectMetadata {
  id: string;                 // Matches Entity Name or NarrativeID
  displayName: string;        // Human-friendly name
  shortPrompt: string;        // 1-3 sentences describing the object (Used verbatim in prompts)
  toneHint?: string;          // e.g. "mysterious", "cheerful", "technical"
  importance?: number;        // 0.0 to 1.0 (Default 0.5)
  
  // -- Tracking Flags --
  trackRotation?: boolean;    // Should we emit events when rotated?
  trackScale?: boolean;       // Should we emit events when resized?
  
  // -- Optional Extras --
  animationMap?: { [key: string]: string }; // Map logical actions to animation names
  exampleLines?: string[];    // Seed phrases the NPC might use
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
    importance: 0.3,
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
    importance: 0.9,
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