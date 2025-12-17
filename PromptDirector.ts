// PromptDirector.ts
/**
 * PromptDirector.ts
 * A utility module that generates the specific instructions (prompts) for the AI
 * based on the current "Vibe" (Vortex State) and the Topic.
 */

export type PromptData = {
  primary: string;   // The main prompt sent to the AI
  meta: any;         // Extra data we pass along (like the user who triggered it)
};

// We define our "Vibes" here so they are easy to read and edit.
const VORTEX_STATES: Record<string, string> = {
  INTRO: "High Energy, Hype, welcoming new viewers.",
  ACTION: "Fast-paced, shouting out events, exciting.",
  ENGAGEMENT: "Inquisitive, asking the chat questions, curious.",
  RANT: "Deep dive, opinionated, slightly controversial but safe, 45 seconds long.",
  CHILL: "Low energy, lo-fi beats vibe, relaxing, reflective.",
  TRANSITION: "Checking the vibe, changing topics, smooth."
};

export const PromptDirector = {
  /**
   * expandTopicToPrompt
   * Combines the Topic, the Vibe, and Context into a full instruction paragraph for the AI.
   */
  expandTopicToPrompt(topic: string, vortexStateKey: string, context: any = {}): PromptData {
    
    // 1. Get the description of the current state, fallback to 'Chill' if unknown
    const vibeDescription = VORTEX_STATES[vortexStateKey] || VORTEX_STATES['CHILL'];

    // 2. Determine target length based on the vibe
    const isRant = vortexStateKey === 'RANT';
    const durationInstruction = isRant 
      ? "Keep this monologue around 45-60 seconds." 
      : "Keep this short and punchy (15-25 seconds).";

    // 3. Build the System Prompt
    // We explicitly tell the AI who it is and what constraints to follow.
    const primary = 
      `ROLE: You are a popular, charismatic streamer. You are currently live.` +
      `\nCURRENT TOPIC: ${topic}` +
      `\nCURRENT VIBE: ${vibeDescription}` +
      `\nCONTEXT: ${JSON.stringify(context)}` +
      `\n\nINSTRUCTIONS:` +
      `\n1. ${durationInstruction}` +
      `\n2. Do not start with "Hey guys" every time. Vary your openers.` +
      `\n3. If the topic is boring, make a joke about it.` +
      `\n4. If this is a reply to a user, mention their name.` +
      `\n5. SAFETY: No hate speech, no sexual content, no self-harm. Keep it PG-13 but edgy.` +
      `\n\nOUTPUT:` +
      `\nWrite only the spoken dialogue. Do not include stage directions like *waves*.`;

    // 4. metadata for debugging
    const meta = {
      topic,
      vortexState: vortexStateKey,
      stateDescription: vibeDescription,
      timestamp: Date.now()
    };

    return {
      primary,
      meta
    };
  }
};