// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The "AP Newswire" feed for the Broadcast System.
 * 
 * Contains structured News Stories for December 17, 2025.
 * Used by StationDirector to build the run-of-show.
 */

export interface NewsStory {
  id: string;
  headline: string;
  category: "Politics" | "Tech" | "Sports" | "Entertainment" | "World" | "Weather";
  body: string;       // The core facts of the story
  hostAngle: string;  // Hint for the Anchor (Professional/Lead)
  coHostAngle: string;// Hint for the Co-Host (Color/Reaction)
}

export const NEWS_WIRE: NewsStory[] = [
  {
    id: "tech_slop",
    headline: "Word of the Year 2025: 'Slop'",
    category: "Tech",
    body: "Merriam-Webster has officially declared 'Slop' as the 2025 Word of the Year. Defined as 'untidy, messy, or low-quality material', it specifically refers to the flood of AI-generated spam clogging the internet.",
    hostAngle: "Professional. Define the word clearly.",
    coHostAngle: "Cynical/Rant. Complain about how you can't find 'real' human content anymore."
  },
  {
    id: "pol_trump_bbc",
    headline: "Trump Files Lawsuit Against BBC",
    category: "Politics",
    body: "Donald Trump has filed a defamation lawsuit against the BBC. The suit alleges the broadcaster unfairly edited his speech regarding the January 6th anniversary, misrepresenting his stance.",
    hostAngle: "Neutral/Serious. Just the facts of the filing.",
    coHostAngle: "Opinionated. Debate whether editing is 'fake news' or just standard journalism."
  },
  {
    id: "spt_mancity",
    headline: "Man City Dominates Palace",
    category: "Sports",
    body: "Manchester City secured a clean 3-0 victory over Crystal Palace yesterday, keeping the pressure high on Arsenal in the title race. Haaland scored twice.",
    hostAngle: "High Energy. Play-by-play style recap.",
    coHostAngle: "Impressed. Comment on Haaland's unstoppable form."
  },
  {
    id: "world_chile",
    headline: "Shift in South America: Kast Wins Chile",
    category: "World",
    body: "José Antonio Kast has claimed victory in the Chilean presidential election. This marks a significant shift towards the political right for the nation.",
    hostAngle: "Formal. Discuss the geopolitical implication.",
    coHostAngle: "Curious. Ask what this means for international relations."
  },
  {
    id: "tech_holidays",
    headline: "Holiday Tech Shortages Update",
    category: "Tech",
    body: "Supply chain reports confirm that the new 'Neural-Link' haptic gloves are sold out globally until February 2026. Scalpers are listing them for 300% markup.",
    hostAngle: "Consumer Watchdog. Warn viewers about scalpers.",
    coHostAngle: "Frustrated gamer. Complain that you still haven't managed to buy a pair."
  },
  {
    id: "weather_blizzard",
    headline: "East Coast Freeze",
    category: "Weather",
    body: "A massive winter storm is battering the East Coast today. Power outages reported in three states. Internet traffic is at an all-time high as people stay inside.",
    hostAngle: "Concerned Meteorologist. Safety warnings.",
    coHostAngle: "Cozy. Talk about hot cocoa and gaming during a blizzard."
  },
  {
    id: "ent_bond",
    headline: "Real Life James Bond?",
    category: "World",
    body: "The head of MI6 gave a rare public speech warning of aggressive espionage threats in Europe, sounding more like a spy thriller than a briefing.",
    hostAngle: "Intrigued. Quote the specific warnings.",
    coHostAngle: "Jokey. Make James Bond references or ask where the gadgets are."
  }
];