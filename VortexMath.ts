// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock" and Pacing Engine.
 * 
 * UPGRADE: Added "Day Part" logic and Pacing Multipliers.
 * This ensures the show feels different at 8 AM vs 8 PM.
 */

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",     // 1: Quick Intro
  HEADLINES = "HEADLINES",       // 2: Fast Paced News
  AUDIENCE = "AUDIENCE_Q_A",     // 4: Interaction
  DEEP_DIVE = "DEEP_DIVE",       // 8: The Main Event
  BANTER = "BANTER",             // 7: Color Commentary
  COMMERCIAL = "COMMERCIAL"      // 5: Reset
}

export enum DayPart {
  MORNING = "Morning Show",      // High Energy, Fast
  AFTERNOON = "Mid-Day Block",   // Balanced
  PRIME_TIME = "Prime Time",     // Dramatic, Intense
  LATE_NIGHT = "Late Night"      // Relaxed, Loose
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

  /**
   * Calculates segment length based on type AND Time of Day.
   * e.g. Prime Time Deep Dives are longer than Morning ones.
   */
  calculateSegmentDuration(segment: BroadcastSegment, dayPart: DayPart): number {
    let base = 60;

    switch (segment) {
      case BroadcastSegment.STATION_ID: base = 30; break;
      case BroadcastSegment.HEADLINES: base = 90; break;
      case BroadcastSegment.AUDIENCE: base = 90; break;
      case BroadcastSegment.DEEP_DIVE: base = 180; break;
      case BroadcastSegment.BANTER: base = 60; break;
      case BroadcastSegment.COMMERCIAL: base = 20; break;
    }

    // Time of Day Modifiers
    if (dayPart === DayPart.MORNING) return base * 0.8; // Faster segments
    if (dayPart === DayPart.PRIME_TIME) return base * 1.2; // Longer, deeper segments
    
    return base;
  },

  /**
   * distinct pacing style based on time of day.
   */
  getPacingStyle(dayPart: DayPart): string {
    switch (dayPart) {
      case DayPart.MORNING: return "Rapid";
      case DayPart.PRIME_TIME: return "Debate";
      case DayPart.LATE_NIGHT: return "Relaxed";
      default: return "Casual";
    }
  },

  /**
   * Converts 0-23 hour into a DayPart enum.
   */
  getDayPart(hour: number): DayPart {
    if (hour >= 5 && hour < 11) return DayPart.MORNING;
    if (hour >= 11 && hour < 17) return DayPart.AFTERNOON;
    if (hour >= 17 && hour < 23) return DayPart.PRIME_TIME;
    return DayPart.LATE_NIGHT;
  }
};