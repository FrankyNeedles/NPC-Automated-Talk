// StreamerAutopilot.ts
/**
 * StreamerAutopilot.ts
 * The "Heartbeat" of the system.
 * 
 * Logic:
 * 1. Listen for Chat -> Send to Scheduler.
 * 2. Manage the Timer (The Beat).
 * 3. When the timer fires, tell Scheduler to "Execute Beat".
 * 4. Wait for "Speech Complete" signal, then restart timer.
 */

import { Component, PropTypes, NetworkEvent, Entity } from 'horizon/core';
import { PromptScheduler } from './PromptScheduler'; // Import the new Brain

// Events
const ChatToBrainEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatToBrainEvent');
const StreamerSpeechCompleteEvent = new NetworkEvent<{ timestamp: number }>('StreamerSpeechCompleteEvent');

class StreamerAutopilot extends Component<typeof StreamerAutopilot> {
  static propsDefinition = {
    schedulerEntity: { type: PropTypes.Entity, default: null }, // Reference to the Scheduler
    minDelay: { type: PropTypes.Number, default: 5 },
    maxDelay: { type: PropTypes.Number, default: 15 },
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  private scheduler: PromptScheduler | undefined;
  private isWaitingForSpeech: boolean = false;
  private recoveryTimer: any = null;

  start() {
    // 1. Find the Scheduler
    if (this.props.schedulerEntity) {
      const ent = this.props.schedulerEntity as Entity;
      this.scheduler = ent.as(PromptScheduler as any) as any;
    } else {
      this.scheduler = this.entity.as(PromptScheduler as any) as any;
    }

    if (!this.scheduler) {
      console.error('[StreamerAutopilot] CRITICAL: PromptScheduler not found!');
      return;
    }

    // 2. Connect Events
    this.connectNetworkBroadcastEvent(ChatToBrainEvent, this.handleChatInput.bind(this));
    this.connectNetworkBroadcastEvent(StreamerSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    if (this.props.debugMode) console.log('[StreamerAutopilot] System Online. Starting loop...');
    
    // 3. Kickstart
    this.async.setTimeout(() => this.triggerNextBeat(), 3000);
  }

  private handleChatInput(data: { user: string; text: string; timestamp: number }) {
    if (!this.scheduler) return;
    
    // Let the Scheduler decide if we should interrupt
    const handled = this.scheduler.handleChatInterrupt(data.user, data.text);
    
    if (handled && this.props.debugMode) {
      console.log('[StreamerAutopilot] Chat interrupt handled by Scheduler.');
    }
  }

  private handleSpeechComplete() {
    if (!this.isWaitingForSpeech) return;

    this.isWaitingForSpeech = false;
    
    if (this.recoveryTimer) {
      this.async.clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    const delay = this.props.minDelay + Math.random() * (this.props.maxDelay - this.props.minDelay);
    if (this.props.debugMode) console.log(`[StreamerAutopilot] Speech done. Waiting ${delay.toFixed(1)}s...`);

    this.async.setTimeout(() => this.triggerNextBeat(), delay * 1000);
  }

  private triggerNextBeat() {
    if (this.isWaitingForSpeech || !this.scheduler) return;

    this.isWaitingForSpeech = true;

    // Safety timeout
    this.recoveryTimer = this.async.setTimeout(() => {
      console.warn('[StreamerAutopilot] Recovery: NPC took too long. Forcing next beat.');
      this.isWaitingForSpeech = false;
      this.triggerNextBeat();
    }, 60000);

    // DELEGATE: Tell the Scheduler to do the thinking
    this.scheduler.executeBeat();
  }
}

Component.register(StreamerAutopilot);