// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "AP Newswire" & Content Pool.
 * 
 * DATE: December 19, 2025.
 */

import { DayPart } from './VortexMath';

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
}

export const NEWS_WIRE: NewsStory[] = [
  // --- TECH / SPACE ---
  {
    id: "tech_starship", headline: "Starship Lands Successfully", category: "Space",
    body: "SpaceX's Starship has successfully landed on the Moon for the Artemis precursor mission. NASA confirms payload deployed.",
    intensity: 9, tags: ["space", "future"], validDayParts: [DayPart.PRIME_TIME, DayPart.MORNING],
    hostAngle: "Awestruck. This is history.", coHostAngle: "Skeptical. Did they fake it?",
    tangents: ["Moon Base Alpha", "Mars is next", "Space Tourism"]
  },
  {
    id: "tech_ai_law", headline: "Global AI Accord Signed", category: "Tech",
    body: "The 2025 Geneva Accord on AI Safety was signed today, banning autonomous agents from controlling nuclear infrastructure.",
    intensity: 8, tags: ["ai", "politics"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Relieved. Safety first.", coHostAngle: "Annoyed. They are stifling innovation.",
    tangents: ["Skynet", "Robot Rights", "My smart fridge is listening"]
  },

  // --- CULTURE / HOLIDAY ---
  {
    id: "cult_gift", headline: "The 'Holo-Pet' Craze", category: "Business",
    body: "The #1 sold-out gift this holiday is the 'Holo-Pet' AR companion. Parents are fighting in aisles for the last units.",
    intensity: 6, tags: ["holiday", "shopping"], validDayParts: [DayPart.MORNING, DayPart.AFTERNOON],
    hostAngle: "Consumer advice. Don't overpay.", coHostAngle: "I want a Holo-Dragon.",
    tangents: ["Tamagotchi nostalgia", "Scalpers", "Best Christmas gift ever"]
  },
  {
    id: "cult_slop", headline: "Word of Year: 'Slop'", category: "Culture",
    body: "Merriam-Webster defined 'Slop' as low-quality AI content. It is the 2025 Word of the Year.",
    intensity: 7, tags: ["internet"], validDayParts: [DayPart.LATE_NIGHT, DayPart.AFTERNOON],
    hostAngle: "Ask if we are slop.", coHostAngle: "Defend the content!",
    tangents: ["Dead Internet Theory", "Content Farms", "Algorithms"]
  },

  // --- WEATHER / SEASONAL ---
  {
    id: "weather_solstice", headline: "Longest Night Approaches", category: "Weather",
    body: "The Winter Solstice is in two days (Dec 21). Meteorologists predict record lows for the Midwest.",
    intensity: 3, tags: ["weather", "winter"], validDayParts: [DayPart.MORNING, DayPart.LATE_NIGHT],
    hostAngle: "Stay warm advice.", coHostAngle: "I love the dark. Spooky season part 2.",
    tangents: ["Seasonal Depression", "Hot Cocoa", "Hibernation"]
  }
];

export const FILLER_POOL = [
  { topic: "The best holiday movie", intensity: 5 },
  { topic: "Why is 2026 sounding so futuristic?", intensity: 4 },
  { topic: "New Year's Resolutions we will break", intensity: 6 },
  { topic: "Is snow actually clean?", intensity: 3 }
];