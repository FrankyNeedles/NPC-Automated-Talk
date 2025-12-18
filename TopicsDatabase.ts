// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "News Wire" & Content Pool.
 * 
 * UPGRADE: 
 * 1. Stories are tagged with 'validDayParts' (Morning, Prime Time, etc).
 * 2. Added 'FILLER_POOL' for generic banter when news is slow.
 */

import { DayPart } from './VortexMath';

export interface NewsStory {
  id: string;
  headline: string;
  category: "Politics" | "Tech" | "Sports" | "Entertainment" | "World" | "Weather" | "Health" | "Business";
  body: string;
  
  // Pacing & Scheduling Data
  intensity: number; // 1 (Chill) to 10 (High Energy)
  tags: string[];
  validDayParts: DayPart[]; // When can this run?
  
  // Stage Directions
  hostAngle: string;
  coHostAngle: string;
}

export const NEWS_WIRE: NewsStory[] = [
  // --- MORNING STORIES ---
  {
    id: "weather_blizzard",
    headline: "East Coast Freeze",
    category: "Weather",
    body: "A massive winter storm is battering the East Coast today. Power outages reported in three states. Roads are icy.",
    intensity: 4,
    tags: ["weather", "winter", "morning"],
    validDayParts: [DayPart.MORNING],
    hostAngle: "Concerned Meteorologist. Focus on safety/traffic.",
    coHostAngle: "Cozy. Talk about coffee and staying inside."
  },
  {
    id: "tech_holidays",
    headline: "Holiday Tech Shortages",
    category: "Business",
    body: "Supply chain reports confirm the new 'Neural-Link' haptic gloves are sold out globally. Scalpers are listing them for 300% markup.",
    intensity: 6,
    tags: ["tech", "shopping"],
    validDayParts: [DayPart.MORNING, DayPart.AFTERNOON],
    hostAngle: "Consumer Watchdog. Warn about scalpers.",
    coHostAngle: "Frustrated. Complain about not getting a pair."
  },

  // --- PRIME TIME / HEAVY HITTERS ---
  {
    id: "pol_trump_bbc",
    headline: "Trump Files Lawsuit Against BBC",
    category: "Politics",
    body: "Donald Trump has filed a defamation lawsuit against the BBC, alleging unfair editing of his January 6th anniversary speech.",
    intensity: 9,
    tags: ["politics", "legal", "media"],
    validDayParts: [DayPart.PRIME_TIME, DayPart.AFTERNOON],
    hostAngle: "Serious/Neutral. Stick to the facts of the filing.",
    coHostAngle: "Opinionated/Debate. Is editing 'fake news'?"
  },
  {
    id: "spt_mancity",
    headline: "Man City Dominates Palace",
    category: "Sports",
    body: "Manchester City secured a clean 3-0 victory over Crystal Palace yesterday. Haaland scored twice, maintaining the title race pressure.",
    intensity: 8,
    tags: ["sports", "soccer"],
    validDayParts: [DayPart.AFTERNOON, DayPart.PRIME_TIME],
    hostAngle: "High Energy. Play-by-play recap.",
    coHostAngle: "Impressed. Comment on the player stats."
  },

  // --- LATE NIGHT / CULTURE ---
  {
    id: "tech_slop",
    headline: "Word of the Year: 'Slop'",
    category: "Tech",
    body: "Merriam-Webster declared 'Slop' (low-quality AI content) as the Word of the Year 2025. It reflects the internet's current state.",
    intensity: 7, 
    tags: ["culture", "ai", "internet"],
    validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME],
    hostAngle: "Amused. Define the word.",
    coHostAngle: "Cynical/Rant. Complain about the dead internet theory."
  },
  {
    id: "ent_bond",
    headline: "Real Life Spy Drama",
    category: "World",
    body: "The head of MI6 gave a speech warning of aggressive espionage threats in Europe, sounding more like a spy thriller than a briefing.",
    intensity: 6,
    tags: ["spies", "security"],
    validDayParts: [DayPart.LATE_NIGHT, DayPart.AFTERNOON],
    hostAngle: "Intrigued. Quote the specific warnings.",
    coHostAngle: "Jokey. Make James Bond references."
  }
];

// Fallback content when no specific news matches or for State 7 (Banter)
export const FILLER_POOL = [
  { topic: "Coffee vs Tea", intensity: 2 },
  { topic: "The Simulation Theory", intensity: 8 },
  { topic: "Why do avatars not have legs?", intensity: 4 },
  { topic: "Best Pizza Toppings", intensity: 5 },
  { topic: "Is 2026 going to be better?", intensity: 6 }
];