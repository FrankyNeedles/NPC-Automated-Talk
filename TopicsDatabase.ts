// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "News Wire".
 * Contains News Stories tagged by Intensity and DayPart.
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
  tangents?: string[]; // Sub-topics for middle of segment
}

export const NEWS_WIRE: NewsStory[] = [
  {
    id: "tech_slop", headline: "Word of Year: 'Slop'", category: "Culture",
    body: "Merriam-Webster defined 'Slop' as low-quality AI content.",
    intensity: 7, tags: ["ai", "culture"], validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME],
    hostAngle: "Ask if we (the NPCs) are slop.", coHostAngle: "Defend AI rights!",
    tangents: ["Dead Internet Theory", "Spam", "Bad Art"]
  },
  {
    id: "pol_trump_bbc", headline: "Trump vs BBC", category: "Politics",
    body: "Trump sues BBC over edited speech footage.",
    intensity: 9, tags: ["politics"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Analyze legal standing.", coHostAngle: "Rant about fake news.",
    tangents: ["Deepfakes", "Journalism Ethics"]
  },
  {
    id: "spt_mancity", headline: "Man City Wins", category: "Sports",
    body: "Man City beats Palace 3-0. Haaland unstoppable.",
    intensity: 8, tags: ["sports"], validDayParts: [DayPart.AFTERNOON, DayPart.PRIME_TIME],
    hostAngle: "Read scores with hype.", coHostAngle: "Claim league is rigged.",
    tangents: ["Fantasy League", "Referee calls"]
  },
  {
    id: "weather_blizzard", headline: "East Coast Freeze", category: "Weather",
    body: "Massive winter storm battering the East Coast.",
    intensity: 4, tags: ["weather"], validDayParts: [DayPart.MORNING],
    hostAngle: "Safety warnings.", coHostAngle: "Cozy vibes.",
    tangents: ["Hot Cocoa", "Traffic Jams"]
  },
  // Add more stories here...
];

export const FILLER_POOL = [
  { topic: "Coffee vs Tea", intensity: 3 },
  { topic: "Simulation Theory", intensity: 8 },
  { topic: "Best Pizza Toppings", intensity: 5 },
  { topic: "Is a hotdog a sandwich?", intensity: 4 }
];