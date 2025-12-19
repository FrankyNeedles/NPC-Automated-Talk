// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "AP Newswire" & Content Pool.
 * 
 * UPGRADE: Added robust metadata for the advanced scoring system.
 * Includes 'intensity', 'tags', and 'validDayParts' for the Director.
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
  tangents?: string[]; // For middle of segment
}

export const NEWS_WIRE: NewsStory[] = [
  // --- REAL NEWS ---
  {
    id: "tech_slop", headline: "Word of Year: 'Slop'", category: "Culture",
    body: "Merriam-Webster defined 'Slop' as low-quality AI content.",
    intensity: 7, tags: ["ai", "culture"], validDayParts: [DayPart.LATE_NIGHT, DayPart.PRIME_TIME, DayPart.ANY],
    hostAngle: "Ask if we (the NPCs) are slop.", coHostAngle: "Defend AI rights!",
    tangents: ["Dead Internet Theory", "Spam Emails", "My favorite bad movie"]
  },
  {
    id: "pol_trump_bbc", headline: "Trump vs BBC", category: "Politics",
    body: "Trump sues BBC over edited speech footage.",
    intensity: 9, tags: ["politics"], validDayParts: [DayPart.PRIME_TIME],
    hostAngle: "Analyze the legal standing.", coHostAngle: "Rant about fake news.",
    tangents: ["Deepfakes", "Media Bias", "The definition of 'Truth'"]
  },
  {
    id: "spt_mancity", headline: "Man City Wins", category: "Sports",
    body: "Man City beats Palace 3-0. Haaland unstoppable.",
    intensity: 8, tags: ["sports"], validDayParts: [DayPart.AFTERNOON, DayPart.PRIME_TIME, DayPart.ANY],
    hostAngle: "Read the scores with hype.", coHostAngle: "Claim the league is rigged.",
    tangents: ["Fantasy League Stats", "Overpaid Athletes", "Stadium Food prices"]
  },

  // --- TIMELESS DEBATES ---
  {
    id: "deb_pizza", headline: "The Pineapple Pizza Crisis", category: "Food",
    body: "The internet is fighting again about fruit on pizza.",
    intensity: 8, tags: ["food", "humor"], validDayParts: [DayPart.LATE_NIGHT, DayPart.AFTERNOON, DayPart.ANY],
    hostAngle: "Act like a food snob. It's wrong.", coHostAngle: "It's delicious. Fight me.",
    tangents: ["Anchovies vs Pepperoni", "Italian Grandma reactions", "Worst pizza I ever ate"]
  },
  {
    id: "deb_sim", headline: "Are We In A Simulation?", category: "Tech",
    body: "Scientists claim there is a 50% chance this world is code.",
    intensity: 6, tags: ["tech", "philosophy"], validDayParts: [DayPart.LATE_NIGHT, DayPart.ANY],
    hostAngle: "Existential dread. Are we real?", coHostAngle: "If this is a sim, I want better graphics.",
    tangents: ["Glitches in the Matrix", "NPCs becoming sentient", "Speedrunning Life"]
  },
  
  // --- STUDIO DRAMA ---
  {
    id: "drama_fly", headline: "Studio: There is a Fly", category: "Studio Chaos",
    body: "A massive digital fly is buzzing around the Anchor's head.",
    intensity: 8, tags: ["funny"], validDayParts: [DayPart.MORNING, DayPart.AFTERNOON, DayPart.ANY],
    hostAngle: "Try to stay professional.", coHostAngle: "Laugh uncontrollably.",
    tangents: ["Hygiene standards", "Robot bugs", "Swatting techniques"]
  }
];

export const FILLER_POOL = [
  { topic: "Why cats rule the internet", intensity: 3 },
  { topic: "The worst movie ever made", intensity: 7 },
  { topic: "Teleportation vs Flight", intensity: 5 },
  { topic: "Is a hotdog a sandwich?", intensity: 8 },
  { topic: "Reviewing the 'texture' of this room", intensity: 4 }
];