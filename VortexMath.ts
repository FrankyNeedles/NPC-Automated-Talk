// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock".
 * 
 * UPGRADE: Added "Show Formats".
 * Defines the structure of full episodes (News, Talk, Game, Drama).
 */

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",
  HEADLINES = "HEADLINES",
  AUDIENCE = "AUDIENCE_Q_A",
  DEEP_DIVE = "DEEP_DIVE",
  BANTER = "BANTER",
  COMMERCIAL = "COMMERCIAL",
  GAME_SHOW = "GAME_SHOW",       // NEW
  INTERVIEW = "INTERVIEW"        // NEW
}

export enum DayPart {
  MORNING = "Morning Show",
  AFTERNOON = "Mid-Day Block",
  PRIME_TIME = "Prime Time",
  LATE_NIGHT = "Late Night"
}

// NEW: Show Templates
export enum ShowType {
  NEWS_HOUR = "The News Hour",         // Formal, Info-heavy
  MORNING_ZOO = "The Morning Zoo",     // High Energy, Pranks, Games
  LATE_NIGHT = "Late Night Live",      // Loose, Banter, Philosophy
  THE_DEBATE = "The Arena",            // 100% Conflict
  VARIETY = "Variety Hour"             // Mix of everything
}

export const VortexMath = {

  getNextState(currentState: number, audienceEngagement: number = 0.5, showType: ShowType = ShowType.NEWS_HOUR): number {
    const idx = VORTEX_CYCLE.indexOf(currentState);
    if (idx === -1) return 1;

    // Dynamic scheduling based on audience engagement and show type
    let nextIdx = (idx + 1) % VORTEX_CYCLE.length;

    // If audience is highly engaged, extend interactive segments
    if (audienceEngagement > 0.8 && currentState === 4) { // AUDIENCE segment
      return 4; // Stay in audience interaction longer
    }

    // For debate shows, prioritize conflict segments
    if (showType === ShowType.THE_DEBATE && currentState === 8) { // DEEP_DIVE
      return 8; // Extend debate time
    }

    // For morning shows, keep energy high with rapid transitions
    if (showType === ShowType.MORNING_ZOO) {
      nextIdx = (idx + 2) % VORTEX_CYCLE.length; // Skip some segments for faster pace
    }

    return VORTEX_CYCLE[nextIdx];
  },

  getSegmentLabel(state: number): BroadcastSegment {
    switch (state) {
      case 1: return BroadcastSegment.STATION_ID;
      case 2: return BroadcastSegment.HEADLINES;
      case 4: return BroadcastSegment.AUDIENCE;
      case 8: return BroadcastSegment.DEEP_DIVE;
      case 7: return BroadcastSegment.BANTER;
      case 5: return BroadcastSegment.COMMERCIAL;
      default: return BroadcastSegment.STATION_ID;
    }
  },

  calculateSegmentDuration(segment: BroadcastSegment, dayPart: DayPart, audienceSize: number = 0, showType: ShowType = ShowType.NEWS_HOUR): number {
    let base = 60;

    // Base durations with Hollywood timing
    switch (segment) {
      case BroadcastSegment.STATION_ID: base = 30; break; // Snappy intro
      case BroadcastSegment.HEADLINES: base = 90; break; // News crawl
      case BroadcastSegment.AUDIENCE: base = Math.min(120, 60 + audienceSize * 10); break; // Scales with audience
      case BroadcastSegment.DEEP_DIVE: base = 180; break; // In-depth analysis
      case BroadcastSegment.BANTER: base = 60; break; // Light interaction
      case BroadcastSegment.GAME_SHOW: base = 150; break; // Interactive entertainment
      case BroadcastSegment.INTERVIEW: base = 240; break; // Guest segments
      case BroadcastSegment.COMMERCIAL: base = 20; break; // Ad breaks
    }

    // Show type modifiers for Hollywood pacing
    switch (showType) {
      case ShowType.MORNING_ZOO:
        base *= 0.7; // Faster pace for morning energy
        break;
      case ShowType.LATE_NIGHT:
        base *= 1.3; // More relaxed, conversational
        break;
      case ShowType.THE_DEBATE:
        if (segment === BroadcastSegment.DEEP_DIVE) base *= 1.5; // Longer debates
        break;
      case ShowType.VARIETY:
        base *= 1.1; // Slightly extended for entertainment value
        break;
    }

    // Day part adjustments
    switch (dayPart) {
      case DayPart.MORNING: return Math.round(base * 0.8); // Quick and energetic
      case DayPart.AFTERNOON: return Math.round(base * 0.9); // Steady pace
      case DayPart.PRIME_TIME: return Math.round(base * 1.2); // Extended for maximum impact
      case DayPart.LATE_NIGHT: return Math.round(base * 1.1); // Comfortable, lingering
    }

    return Math.round(base);
  },

  getPacingStyle(dayPart: DayPart, showType: ShowType, audienceEnergy: number = 0.5): string {
    // Advanced pacing based on multiple factors
    if (showType === ShowType.THE_DEBATE) return "Debate";
    if (showType === ShowType.MORNING_ZOO) return "Rapid";
    if (showType === ShowType.LATE_NIGHT) return "Relaxed";

    // Dynamic pacing based on audience energy
    if (audienceEnergy > 0.8) return "HighEnergy";
    if (audienceEnergy < 0.3) return "SlowBuild";

    // Default fallback with day part consideration
    switch (dayPart) {
      case DayPart.MORNING: return "Rapid";
      case DayPart.PRIME_TIME: return "Debate";
      case DayPart.LATE_NIGHT: return "Relaxed";
      case DayPart.AFTERNOON: return "Casual";
      default: return "Balanced";
    }
  },

  getDayPart(hour: number): DayPart {
    if (hour >= 5 && hour < 11) return DayPart.MORNING;
    if (hour >= 11 && hour < 17) return DayPart.AFTERNOON;
    if (hour >= 17 && hour < 23) return DayPart.PRIME_TIME;
    return DayPart.LATE_NIGHT;
  },

  // NEW: Advanced scheduling features
  shouldExtendSegment(segment: BroadcastSegment, audienceEngagement: number, timeRemaining: number): boolean {
    // Hollywood decision-making for segment extension
    if (audienceEngagement > 0.9 && segment === BroadcastSegment.AUDIENCE && timeRemaining > 30) {
      return true; // Keep the audience engaged longer
    }
    if (segment === BroadcastSegment.DEEP_DIVE && audienceEngagement > 0.7 && timeRemaining > 60) {
      return true; // Deep dives are working, extend them
    }
    return false;
  },

  getCommercialBreakTiming(showType: ShowType, segmentPosition: number): number {
    // Strategic commercial placement for maximum impact
    switch (showType) {
      case ShowType.MORNING_ZOO: return segmentPosition % 3 === 0 ? 15 : 10; // Frequent short breaks
      case ShowType.LATE_NIGHT: return segmentPosition % 2 === 0 ? 25 : 20; // Longer breaks for reflection
      case ShowType.THE_DEBATE: return 30; // Extended breaks to let debates sink in
      default: return 20; // Standard commercial timing
    }
  },

  calculateShowIntensity(showType: ShowType, dayPart: DayPart, audienceSize: number): number {
    // Calculate overall show energy level (1-10)
    let intensity = 5;

    // Base intensity by show type
    switch (showType) {
      case ShowType.MORNING_ZOO: intensity = 8; break;
      case ShowType.LATE_NIGHT: intensity = 6; break;
      case ShowType.THE_DEBATE: intensity = 9; break;
      case ShowType.VARIETY: intensity = 7; break;
      case ShowType.NEWS_HOUR: intensity = 7; break;
    }

    // Day part modifiers
    switch (dayPart) {
      case DayPart.MORNING: intensity += 1; break;
      case DayPart.PRIME_TIME: intensity += 2; break;
      case DayPart.LATE_NIGHT: intensity -= 1; break;
    }

    // Audience size impact
    intensity += Math.min(2, audienceSize / 10);

    return Math.max(1, Math.min(10, intensity));
  }
};
