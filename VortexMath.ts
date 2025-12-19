// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock" and Pacing Engine.
 * 
 * FIX: Added GAME_SHOW to the Enum to resolve TypeScript error.
 */

// Re-export DayPart if defined in TopicsDatabase, or define here if circular dependency issues arise.
// For safety in Horizon, we define it here to avoid circular imports.
export enum DayPart {
  MORNING = "Morning",
  AFTERNOON = "Afternoon",
  PRIME_TIME = "PrimeTime",
  LATE_NIGHT = "LateNight",
  ANY = "Any"
}

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",
  HEADLINES = "HEADLINES",
  AUDIENCE = "AUDIENCE_Q_A",
  DEEP_DIVE = "DEEP_DIVE",
  BANTER = "BANTER",
  COMMERCIAL = "COMMERCIAL",
  GAME_SHOW = "GAME_SHOW", // Fix: Added missing member
  INTERVIEW = "INTERVIEW"
}

export enum ShowType {
  NEWS_HOUR = "The News Hour",
  MORNING_ZOO = "The Morning Zoo",
  LATE_NIGHT = "Late Night Live",
  THE_DEBATE = "The Arena",
  VARIETY = "Variety Hour"
}

export const VortexMath = {
  
  getNextState(currentState: number): number {
    const idx = VORTEX_CYCLE.indexOf(currentState);
    if (idx === -1) return 1; 
    return VORTEX_CYCLE[(idx + 1) % VORTEX_CYCLE.length];
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

  calculateSegmentDuration(segment: BroadcastSegment, dayPart: DayPart): number {
    let base = 60;
    switch (segment) {
      case BroadcastSegment.STATION_ID: base = 30; break;
      case BroadcastSegment.HEADLINES: base = 90; break;
      case BroadcastSegment.AUDIENCE: base = 90; break;
      case BroadcastSegment.DEEP_DIVE: base = 180; break;
      case BroadcastSegment.BANTER: base = 60; break;
      case BroadcastSegment.GAME_SHOW: base = 120; break; 
      case BroadcastSegment.COMMERCIAL: base = 30; break;
    }
    if (dayPart === DayPart.MORNING) return base * 0.8; 
    if (dayPart === DayPart.PRIME_TIME) return base * 1.2; 
    return base;
  },

  getPacingStyle(dayPart: DayPart, showType: ShowType): string {
    if (showType === ShowType.THE_DEBATE) return "Debate";
    if (showType === ShowType.MORNING_ZOO) return "Rapid";
    if (showType === ShowType.LATE_NIGHT) return "Relaxed";
    
    switch (dayPart) {
      case DayPart.MORNING: return "Rapid";
      case DayPart.PRIME_TIME: return "Debate";
      case DayPart.LATE_NIGHT: return "Relaxed";
      default: return "Casual";
    }
  },

  getDayPart(hour: number): DayPart {
    if (hour >= 5 && hour < 11) return DayPart.MORNING;
    if (hour >= 11 && hour < 17) return DayPart.AFTERNOON;
    if (hour >= 17 && hour < 23) return DayPart.PRIME_TIME;
    return DayPart.LATE_NIGHT;
  }
};