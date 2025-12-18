// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock" and Pacing Engine.
 */

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",
  HEADLINES = "HEADLINES",
  AUDIENCE = "AUDIENCE_Q_A",
  DEEP_DIVE = "DEEP_DIVE",
  BANTER = "BANTER",
  COMMERCIAL = "COMMERCIAL"
}

// MAKE SURE THIS IS EXPORTED
export enum DayPart {
  MORNING = "Morning Show",
  AFTERNOON = "Mid-Day Block",
  PRIME_TIME = "Prime Time",
  LATE_NIGHT = "Late Night"
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
      case BroadcastSegment.COMMERCIAL: base = 20; break;
    }
    if (dayPart === DayPart.MORNING) return base * 0.8; 
    if (dayPart === DayPart.PRIME_TIME) return base * 1.2; 
    return base;
  },

  getPacingStyle(dayPart: DayPart): string {
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