// VortexMath.ts
/**
 * VortexMath.ts
 * The "Master Clock" for the Broadcast Automation System.
 * 
 * Maps the 1-2-4-8-7-5 cycle to specific TV Broadcast Segments.
 * Used by the StationDirector to pace the show and decide segment types.
 */

export const VORTEX_CYCLE = [1, 2, 4, 8, 7, 5];

export enum BroadcastSegment {
  STATION_ID = "STATION_ID",     // 1: Intro / Welcome / High Energy
  HEADLINES = "HEADLINES",       // 2: Fast Ping-Pong News Reading
  AUDIENCE = "AUDIENCE_Q_A",     // 4: Interaction with Studio Trigger
  DEEP_DIVE = "DEEP_DIVE",       // 8: Long-form Debate/Discussion (The "Meat")
  BANTER = "BANTER",             // 7: Chill / Color Commentary / Fluff
  COMMERCIAL = "COMMERCIAL"      // 5: Transition / Reset / "Word from sponsors"
}

export const VortexMath = {
  
  /**
   * Advances the show to the next segment in the cycle.
   */
  getNextState(currentState: number): number {
    const idx = VORTEX_CYCLE.indexOf(currentState);
    if (idx === -1) return 1; // Default to start
    return VORTEX_CYCLE[(idx + 1) % VORTEX_CYCLE.length];
  },

  /**
   * Maps the Math Number to a Broadcast Format.
   */
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
   * Calculates how long this segment should last (in seconds).
   * This drives the ShowScheduler's timing.
   * 
   * @param state - Current Vortex State
   * @param basePacing - A global speed modifier (default 1.0)
   */
  calculateSegmentDuration(state: number, basePacing: number = 1.0): number {
    let baseSeconds = 30;

    switch (state) {
      case 1: baseSeconds = 20; break;  // Intro is quick
      case 2: baseSeconds = 60; break;  // Headlines take a minute to read through
      case 4: baseSeconds = 45; break;  // Audience Q&A
      case 8: baseSeconds = 120; break; // Deep Dive is long (2 mins+)
      case 7: baseSeconds = 40; break;  // Banter is medium
      case 5: baseSeconds = 15; break;  // Commercial is a short break
    }

    return baseSeconds * basePacing;
  }
};