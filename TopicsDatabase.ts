// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "AP Newswire" & Content Pool.
 * 
 * UPGRADE: "Broadcast Quality"
 * - Added 'bridgeTags' for smoother transitions.
 * - Refined 'hostAngle' to be more TV-style.
 * - Added 'tangents' that are actual conversation pivots.
 */

export enum DayPart {
  MORNING = "Morning",
  AFTERNOON = "Afternoon",
  PRIME_TIME = "PrimeTime",
  LATE_NIGHT = "LateNight",
  ANY = "Any"
}

export interface NewsStory {
  id: string;
  headline: string;
  category: string;
  body: string;
  intensity: number; // 1-10
  tags: string[];
  validDayParts: DayPart[];
  hostAngle: string;
  coHostAngle: string;
  tangents?: string[];
  bridgeTags?: string[]; // New: Keywords to link FROM
}

export const NEWS_WIRE: NewsStory[] = [
  // --- CULTURE / VIRAL ---
  {
    id: "cult_bad_movies", headline: "Why We Love Bad Movies", category: "Culture",
    body: "Psychologists claim watching 'so bad it's good' movies increases social bonding. 'Birdemic' cited as a prime example.",
    intensity: 6, tags: ["movies", "fun"], validDayParts: [DayPart.LATE_NIGHT, DayPart.AFTERNOON],
    hostAngle: "Ask why we torture ourselves with bad cinema.", coHostAngle: "Defend the art of the flop.",
    tangents: ["Cult Classics", "Waste of Money", "The worst ending ever"],
    bridgeTags: ["entertainment", "money", "social"]
  },
  {
    id: "cult_slop", headline: "Word of Year: 'Slop'", category: "Culture",
    body: "Merriam-Webster defined 'Slop' as low-quality, mass-produced digital content.",
    intensity: 7, tags: ["ai", "internet"], validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME],
    hostAngle: "Ask if this show counts as slop.", coHostAngle: "Defend our high standards.",
    tangents: ["Dead Internet Theory", "Content Farms", "Quality vs Quantity"],
    bridgeTags: ["tech", "media", "social"]
  },

  // --- MYSTERY / CONSPIRACY ---
  {
    id: "mys_funding", headline: "The 'Missing' Trillions", category: "Mystery",
    body: "A new audit report claims 2 trillion dollars in government funding is 'unaccounted for' in the Pentagon budget.",
    intensity: 9, tags: ["politics", "money"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Serious. Ask where the money went.", coHostAngle: "Conspiracy. Aliens? Secret bunkers?",
    tangents: ["Black Budgets", "Invisible Tech", "Taxpayer Rage"],
    bridgeTags: ["government", "money", "secrecy"]
  },
  {
    id: "mys_signal", headline: "The Signal from Space", category: "Science",
    body: "Astronomers detected a repeating radio burst from Proxima Centauri that follows a prime number sequence.",
    intensity: 8, tags: ["space", "aliens"], validDayParts: [DayPart.PRIME_TIME, DayPart.LATE_NIGHT],
    hostAngle: "Scientific excitement. Is it proof?", coHostAngle: "Panic. They are coming.",
    tangents: ["First Contact Protocol", "Are we alone?", "Sending a reply"],
    bridgeTags: ["science", "future", "mystery"]
  },

  // --- DEBATES ---
  {
    id: "deb_hotdog", headline: "The Hot Dog Classification", category: "Debate",
    body: "The culinary institute finally ruled: A Hot Dog is a Taco, not a Sandwich. The internet is furious.",
    intensity: 5, tags: ["food", "humor"], validDayParts: [DayPart.MORNING, DayPart.AFTERNOON],
    hostAngle: "Accept the ruling scientifically.", coHostAngle: "Reject it emotionally.",
    tangents: ["Ingredient Purism", "Food Rules", "Is Cereal a Soup?"],
    bridgeTags: ["food", "culture", "rules"]
  },
  {
    id: "deb_sim", headline: "Simulation Theory Update", category: "Tech",
    body: "A physicist claims pixelation at the quantum level proves we are in a simulation.",
    intensity: 7, tags: ["tech", "philosophy"], validDayParts: [DayPart.LATE_NIGHT],
    hostAngle: "Existential dread. Are we NPCs?", coHostAngle: "If so, I want cheat codes.",
    tangents: ["Glitches", "Respawning", "The Admin"],
    bridgeTags: ["science", "tech", "reality"]
  }
];

export const FILLER_POOL = [
  { topic: "The history of coffee", intensity: 3 },
  { topic: "Why time feels faster as you age", intensity: 6 },
  { topic: "The weirdest thing I saw today", intensity: 4 }
];