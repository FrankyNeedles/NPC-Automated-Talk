// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "AP Newswire".
 * 
 * UPGRADE: "Real News 2025"
 * - Realistic headlines for Dec 19, 2025.
 * - Categories mapped to TV Network Blocks.
 * - Added 'tangents' for natural conversation drift.
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
  bridgeTags?: string[];
}

export const NEWS_WIRE: NewsStory[] = [
  // --- TECH / SCIFI (The big stories) ---
  {
    id: "tech_ai_act_2025",
    headline: "Global AI Safety Accord Signed",
    category: "Tech News",
    body: "World leaders met in Geneva today to sign the 2025 AI Safety Accord, limiting autonomous agent capabilities in financial markets.",
    intensity: 8,
    tags: ["tech", "politics", "future"],
    validDayParts: [DayPart.PRIME_TIME, DayPart.MORNING],
    hostAngle: "Analyze the impact on the economy. Be serious.",
    coHostAngle: "Be skeptical. Will it actually stop anything?",
    tangents: ["Robot Stock Traders", "The 2024 Flash Crash", "Can you jail an AI?"]
  },
  {
    id: "tech_vr_haptics",
    headline: "Haptic Suits: The Holiday Sellout",
    category: "Consumer Tech",
    body: "The 'OmniSkin' haptic suit is the #1 gift this holiday season, despite reports of it tickling people uncontrollably due to a bug.",
    intensity: 5,
    tags: ["gaming", "holiday", "funny"],
    validDayParts: [DayPart.MORNING, DayPart.AFTERNOON],
    hostAngle: "Consumer warning about the glitch.",
    coHostAngle: "Laugh about it. Admit you want one.",
    tangents: ["VR Fails", "Holiday Shopping Chaos", "Tickle Torture"]
  },

  // --- WORLD / POLITICS ---
  {
    id: "world_mars_water",
    headline: "Liquid Water Confirmed Under Mars Surface",
    category: "Science",
    body: "The Artemis rover has confirmed a massive subterranean lake beneath the Martian equator.",
    intensity: 9,
    tags: ["space", "science", "wonder"],
    validDayParts: [DayPart.PRIME_TIME, DayPart.LATE_NIGHT],
    hostAngle: "Awestruck. This changes history.",
    coHostAngle: "Paranoid. What lives in the water?",
    tangents: ["Aliens", "Underwater Cities", "The cost of space travel"]
  },

  // --- CULTURE / ENTERTAINMENT ---
  {
    id: "ent_award_snub",
    headline: "The Game Awards Controversy",
    category: "Entertainment",
    body: "Fans are rioting online after 'Generic Shooter 5' won Game of the Year over the indie darling 'Cat Simulator 2'.",
    intensity: 7,
    tags: ["gaming", "culture"],
    validDayParts: [DayPart.AFTERNOON, DayPart.LATE_NIGHT],
    hostAngle: "Play devil's advocate for the shooter.",
    coHostAngle: "Outraged. Justice for the Cat.",
    tangents: ["Award Shows are rigged", "Indie vs AAA", "Video Game Movies"]
  },
  {
    id: "ent_music_hologram",
    headline: "The Elvis Hologram Tour",
    category: "Entertainment",
    body: "The Elvis Presley hologram tour kicked off in Vegas last night to mixed reviews. Some say it's uncanny, others call it ghostly.",
    intensity: 6,
    tags: ["music", "tech"],
    validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME],
    hostAngle: "Is this respectful to the dead?",
    coHostAngle: "It's cool! Bring back everyone!",
    tangents: ["Digital Immortality", "Who would you see live?", "Uncanny Valley"]
  },

  // --- LIFESTYLE / FILLER ---
  {
    id: "life_coffee",
    headline: "Coffee Shortage of 2025",
    category: "Lifestyle",
    body: "Climate shifts have caused a 30% spike in Arabica bean prices. Hipsters are panicking.",
    intensity: 4,
    tags: ["food", "money"],
    validDayParts: [DayPart.MORNING],
    hostAngle: "Give practical tips on saving money.",
    coHostAngle: "Panic. I cannot live without caffeine.",
    tangents: ["Tea drinkers", "Energy drinks", "Morning routines"]
  }
];

export const FILLER_POOL = [
  { topic: "The color of the sky today", intensity: 2 },
  { topic: "Why do we never see baby pigeons?", intensity: 5 },
  { topic: "Ranking the best fast food fries", intensity: 6 },
  { topic: "If you could teleport anywhere right now", intensity: 4 },
  { topic: "Is 2026 going to be the year of the flying car?", intensity: 5 }
];