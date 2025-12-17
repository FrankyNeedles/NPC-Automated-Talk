// PromptAssembler.ts
/**
 * PromptAssembler.ts
 * Updated to include Live Studio Audience.
 */

import { NarrativeToken } from './NarrativeToken';
import { getMetadata } from './ObjectMetadata';

export interface PromptPackage {
  segment: string;
  topic?: string;
  facts: NarrativeToken[];
  
  roomVibe?: string;
  playerCount?: number;
  recentChat?: { user: string; text: string }[]; 
  
  // NEW field
  studioAudience?: string[]; 
  
  energy: string;
  lengthTarget: string;
  continuityKeys: string[];
}

export const PromptAssembler = {
  
  assemble(pkg: PromptPackage): { promptText: string; meta: any } {
    
    // 1. Refine Facts
    const refinedFacts = pkg.facts.map(fact => {
      const meta = getMetadata(fact.objectId || "");
      const label = meta ? meta.displayName : (fact.objectLabel || "an object");
      return `- FACT: Player "${fact.actor}" did "${fact.action}" with "${label}".`;
    });

    // 2. Refine Chat
    let chatBlock = "";
    if (pkg.recentChat && pkg.recentChat.length > 0) {
      chatBlock = `\nOVERHEARD CHAT (Incorporate as context, do not reply directly):\n` +
        pkg.recentChat.map(c => `- ${c.user} said: "${c.text}"`).join('\n') + `\n`;
    }

    // 3. Studio Audience Block
    let audienceBlock = "";
    if (pkg.studioAudience && pkg.studioAudience.length > 0) {
        audienceBlock = `LIVE AUDIENCE IN STUDIO: ${pkg.studioAudience.join(", ")}\n`;
    }

    // 4. Header & Instructions
    const header = 
      `ROLE: You are a popular streamer.\n` +
      `SEGMENT: ${pkg.segment}\n` +
      `ROOM VIBE: ${pkg.roomVibe || "Chill"}\n` +
      audienceBlock + // Insert audience list here
      `LENGTH: ${pkg.lengthTarget}\n`;

    let instructions = "";
    if (pkg.segment === "RANT") {
      instructions = `INSTRUCTIONS: Monologue about ${pkg.topic}. Ignore the room.\n`;
    } else {
      // THE KEY CHANGE:
      instructions = `INSTRUCTIONS: Be casual. Acknowledge the 'Live Audience' names if present (say "We've got [Name] hanging out"), but address your main stream camera. Don't have a 1-on-1 conversation with them.\n`;
    }

    let contextBlock = "";
    if (refinedFacts.length > 0) {
      contextBlock = `\nOBSERVED EVENTS:\n` + refinedFacts.join('\n') + `\n`;
    }

    const constraints = 
      `\nCONSTRAINTS:\n` +
      `- Do NOT invent facts.\n` +
      `- Avoid phrases: ${pkg.continuityKeys.join(", ")}\n`;

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