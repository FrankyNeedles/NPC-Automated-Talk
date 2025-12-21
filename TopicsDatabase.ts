// TopicsDatabase.ts
/**
 * TopicsDatabase.ts
 * The Fluid Topic Library & Content Pool.
 *
 * FEATURES:
 * - Fluid topic management for player-driven content.
 * - Scene metrics integration.
 * - Memory context awareness.
 * - Fallback to static news wire when needed.
 */

import { Component, PropTypes } from 'horizon/core';
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

export interface TopicTemplate {
  id: string;
  category: string;
  title: string;
  description: string;
  stance: string;
  instructions: string;
  backupLine: string;
}

export interface SceneMetrics {
  playerCount: number;
  energy: string;
  recentActivity: string[];
  timestamp: number;
}

export class TopicsDatabase extends Component<typeof TopicsDatabase> {
  static propsDefinition = {
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private staticNewsWire: NewsStory[] = [];
  private fluidTopics: TopicTemplate[] = [];
  private sceneMetrics: SceneMetrics = {
    playerCount: 0,
    energy: "Normal",
    recentActivity: [],
    timestamp: 0
  };
  private playerInputs: Map<string, string[]> = new Map();
  private memoryContext: string = "";
  private topicUsageHistory: Map<string, number> = new Map();

  start() {
    // Initialize with static news wire as fallback
    this.initializeStaticNewsWire();
  }

  // --- FLUID TOPIC MANAGEMENT ---

  public addFluidTopic(topic: TopicTemplate) {
    // Add or update fluid topic
    const existingIndex = this.fluidTopics.findIndex(t => t.id === topic.id);
    if (existingIndex >= 0) {
      this.fluidTopics[existingIndex] = topic;
    } else {
      this.fluidTopics.push(topic);
    }

    // Limit fluid topics to prevent overflow
    if (this.fluidTopics.length > 50) {
      this.fluidTopics.shift();
    }

    if (this.props.debugMode) console.log(`[TopicsDB] Added fluid topic: ${topic.id}`);
  }

  public getFluidTopicById(id: string): TopicTemplate | undefined {
    return this.fluidTopics.find(t => t.id === id);
  }

  public getFluidTopicsByCategory(category: string): TopicTemplate[] {
    return this.fluidTopics.filter(t => t.category === category);
  }

  public getRelevantFluidTopic(context: string, playerName?: string): TopicTemplate | undefined {
    // Prioritize fluid topics based on context and player
    const contextLower = context.toLowerCase();

    // First, try player-specific topics
    if (playerName) {
      const playerTopics = this.playerInputs.get(playerName) || [];
      for (const input of playerTopics) {
        if (input.toLowerCase().includes(contextLower)) {
          // Generate a fluid topic from player input
          return this.generateFluidTopicFromInput(input, playerName);
        }
      }
    }

    // Then, try existing fluid topics
    for (const topic of this.fluidTopics) {
      if (topic.title.toLowerCase().includes(contextLower) ||
          topic.description.toLowerCase().includes(contextLower)) {
        return topic;
      }
    }

    return undefined;
  }

  // --- SCENE METRICS INTEGRATION ---

  public updateSceneMetrics(metrics: { playerCount: number; energy: string; recentActivity: string[] }) {
    this.sceneMetrics = {
      ...metrics,
      timestamp: Date.now()
    };
    if (this.props.debugMode) console.log(`[TopicsDB] Updated scene metrics: ${JSON.stringify(metrics)}`);
  }

  public getSceneMetrics(): SceneMetrics {
    return { ...this.sceneMetrics };
  }

  // --- PLAYER INPUT MANAGEMENT ---

  public addPlayerInput(playerName: string, input: string) {
    const inputs = this.playerInputs.get(playerName) || [];
    inputs.push(input);

    // Keep last 10 inputs per player
    if (inputs.length > 10) {
      inputs.shift();
    }

    this.playerInputs.set(playerName, inputs);

    // Generate fluid topic from input
    const fluidTopic = this.generateFluidTopicFromInput(input, playerName);
    this.addFluidTopic(fluidTopic);
  }

  public getPlayerInputs(playerName: string): string[] {
    return this.playerInputs.get(playerName) || [];
  }

  // --- MEMORY CONTEXT ---

  public setMemoryContext(context: string) {
    this.memoryContext = context;
  }

  public getMemoryContext(): string {
    return this.memoryContext;
  }

  // --- STATIC NEWS WIRE API (Fallbacks) ---

  public getNewsStoryById(id: string): NewsStory | undefined {
    return this.staticNewsWire.find(story => story.id === id);
  }

  public getNewsStoriesByCategory(category: string): NewsStory[] {
    return this.staticNewsWire.filter(story => story.category === category);
  }

  public getNewsStoriesByDayPart(dayPart: DayPart): NewsStory[] {
    return this.staticNewsWire.filter(story => story.validDayParts.includes(dayPart));
  }

  public getRandomNewsStory(): NewsStory | undefined {
    if (this.staticNewsWire.length === 0) return undefined;
    const randomIndex = Math.floor(Math.random() * this.staticNewsWire.length);
    return this.staticNewsWire[randomIndex];
  }

  public getNewsStoryForContext(context: string): NewsStory | undefined {
    // Simple context matching - in production, use AI for better matching
    const contextLower = context.toLowerCase();

    for (const story of this.staticNewsWire) {
      if (story.headline.toLowerCase().includes(contextLower) ||
          story.body.toLowerCase().includes(contextLower) ||
          story.tags.some(tag => tag.toLowerCase().includes(contextLower))) {
        return story;
      }
    }

    return this.getRandomNewsStory();
  }

  // --- HYBRID TOPIC SELECTION (Primary Method) ---

  public getBestTopic(context: string, playerName?: string): TopicTemplate | undefined {
    // 1. Try fluid topics first (player-driven)
    const fluidTopic = this.getRelevantFluidTopic(context, playerName);
    if (fluidTopic) {
      this.recordTopicUsage(fluidTopic.id);
      if (this.props.debugMode) console.log(`[TopicsDB] Using fluid topic: ${fluidTopic.id}`);
      return fluidTopic;
    }

    // 2. Fall back to static topics
    const staticTopic = this.getTopicForContext(context);
    if (staticTopic) {
      this.recordTopicUsage(staticTopic.id);
      if (this.props.debugMode) console.log(`[TopicsDB] Using static topic: ${staticTopic.id}`);
      return staticTopic;
    }

    // 3. Generate dynamic topic from context
    const dynamicTopic = this.generateDynamicTopic(context, playerName);
    this.recordTopicUsage(dynamicTopic.id);
    return dynamicTopic;
  }

  // --- TOPIC USAGE TRACKING ---

  private recordTopicUsage(topicId: string) {
    const currentUsage = this.topicUsageHistory.get(topicId) || 0;
    this.topicUsageHistory.set(topicId, currentUsage + 1);
  }

  public getTopicUsage(topicId: string): number {
    return this.topicUsageHistory.get(topicId) || 0;
  }

  // --- PRIVATE HELPERS ---

  private initializeStaticNewsWire() {
    this.staticNewsWire = [
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
  }

  private generateFluidTopicFromInput(input: string, playerName: string): TopicTemplate {
    const id = `fluid_${playerName}_${Date.now()}`;
    return {
      id: id,
      category: "player_generated",
      title: `Topic from ${playerName}`,
      description: input,
      stance: "Engaged and responsive",
      instructions: `Discuss and build upon: ${input}`,
      backupLine: "That's interesting!"
    };
  }

  private generateDynamicTopic(context: string, playerName?: string): TopicTemplate {
    const id = `dynamic_${Date.now()}`;
    const title = playerName ? `${playerName}'s Topic` : "Current Discussion";

    return {
      id: id,
      category: "dynamic",
      title: title,
      description: `Discussion about: ${context}`,
      stance: "Conversational and natural",
      instructions: `Engage with the current context: ${context}`,
      backupLine: "Let's talk about that!"
    };
  }

  // Legacy compatibility - convert news story to topic template
  private getTopicForContext(context: string): TopicTemplate | undefined {
    const story = this.getNewsStoryForContext(context);
    if (!story) return undefined;

    return {
      id: story.id,
      category: story.category,
      title: story.headline,
      description: story.body,
      stance: story.hostAngle,
      instructions: `Discuss: ${story.body}`,
      backupLine: story.coHostAngle
    };
  }
}

Component.register(TopicsDatabase);

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