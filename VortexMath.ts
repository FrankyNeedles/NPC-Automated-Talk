// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock" and Pacing Engine.
 * 
 * UPGRADE: Now provides definitive durations for segments,
 * removing the need for manual Inspector adjustments.
 */

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",     // 1: Quick Intro (30s)
  HEADLINES = "HEADLINES",       // 2: Fast Paced (60s)
  AUDIENCE = "AUDIENCE_Q_A",     // 4: Interaction (90s)
  DEEP_DIVE = "DEEP_DIVE",       // 8: The Main Event (180s - 3 mins)
  BANTER = "BANTER",             // 7: Color Commentary (60s)
  COMMERCIAL = "COMMERCIAL"      // 5: Reset (15s)
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
   * Returns the exact duration (in seconds) for a segment.
   * The Director uses this to tell the Scheduler when to cut to commercial.
   */
  calculateSegmentDuration(segment: BroadcastSegment): number {
    switch (segment) {
      case BroadcastSegment.STATION_ID: return 30;  // Tight intro
      case BroadcastSegment.HEADLINES: return 90;   // Rapid fire news
      case BroadcastSegment.AUDIENCE: return 90;    // Give time for Q&A
      case BroadcastSegment.DEEP_DIVE: return 180;  // 3 minutes of discussion
      case BroadcastSegment.BANTER: return 60;      // Short joke break
      case BroadcastSegment.COMMERCIAL: return 20;  // Quick reset
      default: return 60;
    }
  }
};