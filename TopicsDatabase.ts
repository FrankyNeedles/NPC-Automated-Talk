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
  },

  // --- ENTERTAINMENT / CELEBRITY ---
  {
    id: "ent_celebrity", headline: "Celebrity AI Clone Scandal", category: "Entertainment",
    body: "A viral video of a celebrity's AI clone endorsing a controversial product has sparked debates on digital rights.",
    intensity: 7, tags: ["celebrity", "ai"], validDayParts: [DayPart.PRIME_TIME, DayPart.LATE_NIGHT],
    hostAngle: "Ethical concerns.", coHostAngle: "It's just marketing.",
    tangents: ["Deepfakes", "Celebrity Endorsements", "AI Ethics"]
  },

  // --- POLITICS / GLOBAL ---
  {
    id: "pol_global", headline: "Global Climate Summit Breakthrough", category: "Politics",
    body: "World leaders agree on new carbon reduction targets at the 2025 Paris Climate Accord extension.",
    intensity: 8, tags: ["politics", "environment"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Hopeful for the planet.", coHostAngle: "Too little, too late?",
    tangents: ["Climate Change", "International Agreements", "Renewable Energy"]
  },

  // --- SPORTS / GAMING ---
  {
    id: "sports_gaming", headline: "Esports World Championship", category: "Sports",
    body: "The 2025 Esports World Championship concludes with a record-breaking viewership of 500 million.",
    intensity: 6, tags: ["sports", "gaming"], validDayParts: [DayPart.AFTERNOON, DayPart.PRIME_TIME],
    hostAngle: "Gaming is mainstream.", coHostAngle: "Still not real sports.",
    tangents: ["Esports", "Virtual Reality", "Professional Gaming"]
  },

  // --- HEALTH / SCIENCE ---
  {
    id: "health_science", headline: "Breakthrough in Longevity Research", category: "Health",
    body: "Scientists announce a new gene therapy that could extend human lifespan by 20 years.",
    intensity: 9, tags: ["health", "science"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Exciting possibilities.", coHostAngle: "Overpopulation concerns.",
    tangents: ["Aging", "Gene Therapy", "Medical Ethics"]
  },

  // --- BUSINESS / ECONOMY ---
  {
    id: "bus_economy", headline: "Cryptocurrency Regulation Update", category: "Business",
    body: "Governments worldwide implement unified cryptocurrency regulations to stabilize markets.",
    intensity: 7, tags: ["business", "crypto"], validDayParts: [DayPart.PRIME_TIME, DayPart.AFTERNOON],
    hostAngle: "Market stability.", coHostAngle: "Innovation stifled.",
    tangents: ["Cryptocurrency", "Regulation", "Financial Markets"]
  },

  // --- CULTURE / SOCIAL ---
  {
    id: "cult_social", headline: "Social Media Addiction Study", category: "Culture",
    body: "A new study reveals 70% of users experience withdrawal symptoms when offline for 24 hours.",
    intensity: 5, tags: ["social", "internet"], validDayParts: [DayPart.AFTERNOON, DayPart.LATE_NIGHT],
    hostAngle: "Time to unplug.", coHostAngle: "It's just connection.",
    tangents: ["Social Media", "Mental Health", "Digital Detox"]
  },

  // --- TRAVEL / EXPLORATION ---
  {
    id: "travel_exploration", headline: "Mars Colony Milestone", category: "Travel",
    body: "The first permanent Mars colony reaches 100 inhabitants, marking a new era of space exploration.",
    intensity: 8, tags: ["space", "travel"], validDayParts: [DayPart.PRIME_TIME, DayPart.MORNING],
    hostAngle: "Humanity's future.", coHostAngle: "Expensive vacation.",
    tangents: ["Space Travel", "Mars", "Colonization"]
  }
];

export const FILLER_POOL = [
  { topic: "The best holiday movie", intensity: 5 },
  { topic: "Why is 2026 sounding so futuristic?", intensity: 4 },
  { topic: "New Year's Resolutions we will break", intensity: 6 },
  { topic: "Is snow actually clean?", intensity: 3 }
];