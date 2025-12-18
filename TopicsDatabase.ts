// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * UPGRADE: Added "Studio Drama" category.
 * These are fake "Emergencies" to make the NPCs feel alive.
 */

import { DayPart } from './VortexMath';

export interface NewsStory {
  id: string;
  headline: string;
  category: string;
  body: string;
  intensity: number;
  tags: string[];
  validDayParts: DayPart[];
  hostAngle: string;
  coHostAngle: string;
}

export const NEWS_WIRE: NewsStory[] = [
  // --- REAL NEWS (Keep your existing ones here) ---
  {
    id: "tech_slop", headline: "Word of Year: 'Slop'", category: "Culture",
    body: "Merriam-Webster defined 'Slop' as low-quality AI content.",
    intensity: 7, tags: ["ai"], validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME],
    hostAngle: "Ask if this show is slop.", coHostAngle: "Defend us! We are high quality!"
  },
  
  // ... (Keep the other news items you had) ...

  // --- STUDIO DRAMA (The "Sitcom" Elements) ---
  // These run anytime to break up the boredom
  {
    id: "drama_fly", headline: "Studio: There is a Fly", category: "Studio Chaos",
    body: "A massive digital fly is buzzing around the Anchor's head.",
    intensity: 8, tags: ["funny"], validDayParts: [DayPart.MORNING, DayPart.AFTERNOON],
    hostAngle: "Try to stay professional while swatting it.", coHostAngle: "Laugh uncontrollably. Name the fly."
  },
  {
    id: "drama_hot", headline: "Studio: A/C is Broken", category: "Studio Chaos",
    body: "The studio temperature controls are glitching. It is freezing.",
    intensity: 6, tags: ["funny"], validDayParts: [DayPart.LATE_NIGHT],
    hostAngle: "Shiver while reading the news.", coHostAngle: "Complain about the working conditions."
  },
  {
    id: "drama_coffee", headline: "Studio: Coffee Spill", category: "Studio Chaos",
    body: "The Anchor just spilled virtual coffee all over the desk.",
    intensity: 7, tags: ["funny"], validDayParts: [DayPart.MORNING],
    hostAngle: "Panic. Try to clean it up.", coHostAngle: "Mock the Anchor for being clumsy."
  },
  {
    id: "drama_script", headline: "Studio: Wrong Teleprompter", category: "Studio Chaos",
    body: "The teleprompter is displaying the wrong text (a cooking recipe).",
    intensity: 5, tags: ["funny"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Confused. Start reading the recipe by accident.", coHostAngle: "Ask if we are making lasagna."
  }
];

export const FILLER_POOL = [
  { topic: "The smell of the metaverse", intensity: 3 },
  { topic: "Why do we never sleep?", intensity: 5 },
  { topic: "Ranking the best virtual chairs", intensity: 4 }
];