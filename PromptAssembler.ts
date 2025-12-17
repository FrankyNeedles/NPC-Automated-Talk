// PromptAssembler.ts
/**
 * PromptAssembler.ts
 * The "Scriptwriter".
 * Combines Vibe, Facts, Chat, and Audience data into a final prompt for the AI.
 */

import { NarrativeToken } from './NarrativeToken';
import { getMetadata } from './ObjectMetadata';

export interface PromptPackage {
  segment: string;          // e.g. "RANT", "INTRO"
  topic?: string;           // Main topic
  facts: NarrativeToken[];  // Object interactions
  
  // -- Context Fields --
  roomVibe?: string;        // "Chill", "Active"
  playerCount?: number;     
  recentChat?: { user: string; text: string }[]; 
  studioAudience?: string[]; // Names of people in the trigger zone
  
  energy: string;           // Requested energy level
  lengthTarget: string;     // e.g. "20-30 words"
  continuityKeys: string[]; // Phrases to avoid
}

export const PromptAssembler = {
  
  assemble(pkg: PromptPackage): { promptText: string; meta: any } {
    
    // 1. Refine Facts (Turn Object IDs into Sentences)
    const refinedFacts = pkg.facts.map(fact => {
      const meta = getMetadata(fact.objectId || "");
      const label = meta ? meta.displayName : (fact.objectLabel || "an object");
      // Add a bit of lore if available
      const lore = meta ? `(${meta.shortPrompt})` : "";
      return `- FACT: Player "${fact.actor}" did "${fact.action}" with "${label}". ${lore}`;
    });

    // 2. Refine Chat (Treat as "Overheard")
    let chatBlock = "";
    if (pkg.recentChat && pkg.recentChat.length > 0) {
      chatBlock = `\nOVERHEARD CHAT (Incorporate if relevant, do not reply directly):\n` +
        pkg.recentChat.map(c => `- ${c.user} said: "${c.text}"`).join('\n') + `\n`;
    }

    // 3. Studio Audience Block
    let audienceBlock = "";
    if (pkg.studioAudience && pkg.studioAudience.length > 0) {
        audienceBlock = `LIVE AUDIENCE IN STUDIO: ${pkg.studioAudience.join(", ")}\n`;
    }

    // 4. Header
    const header = 
      `ROLE: You are a popular digital streamer.\n` +
      `SEGMENT: ${pkg.segment}\n` +
      `ROOM VIBE: ${pkg.roomVibe || "Chill"} (${pkg.playerCount || 0} people online)\n` +
      audienceBlock + 
      `LENGTH: ${pkg.lengthTarget}\n` +
      `ENERGY: ${pkg.energy}\n`;

    // 5. Context Block (Facts)
    let contextBlock = "";
    if (refinedFacts.length > 0) {
      contextBlock = `\nOBSERVED EVENTS:\n` + refinedFacts.join('\n') + `\n`;
    }

    // 6. Instructions based on Segment
    let instructions = "";
    if (pkg.segment === "RANT") {
      instructions = `INSTRUCTIONS: Monologue about ${pkg.topic}. Ignore the room distractions. Focus on your opinion.\n`;
    } else if (pkg.segment === "INTRO") {
      instructions = `INSTRUCTIONS: Welcome everyone. Acknowledge the 'Live Audience' if any are listed. Introduce the topic: ${pkg.topic}.\n`;
    } else {
      // General Case
      instructions = `INSTRUCTIONS: Be casual. If 'Live Audience' are listed, mention them passively (e.g. "We've got [Name] in the studio"). Address your main camera, don't have a 1-on-1 conversation.\n`;
    }

    // 7. Safety & Constraints
    const constraints = 
      `\nCONSTRAINTS:\n` +
      `- Do NOT invent facts or people.\n` +
      `- Avoid phrases: ${pkg.continuityKeys.join(", ")}\n` +
      `- Keep it safe for work (PG-13).\n`;

    // 8. Final Assembly
    const finalPrompt = 
      header + 
      contextBlock + 
      chatBlock +
      instructions + 
      constraints + 
      `\nOUTPUT:\nSpoken dialogue only.`;

    return {
      promptText: finalPrompt,
      meta: {
        segment: pkg.segment,
        vibe: pkg.roomVibe
      }
    };
  }
};