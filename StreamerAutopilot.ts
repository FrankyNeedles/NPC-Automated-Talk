// StreamerAutopilot.ts
/**
 * StreamerAutopilot.ts
 * The Brain of the operation.
 * 
 * Logic:
 * 1. Cycle through "Vortex" states.
 * 2. Pick a topic from TopicsDatabase.ts.
 * 3. Send prompt to NPC.
 * 4. Wait for NPC to finish speaking.
 */

import { Component, PropTypes, NetworkEvent } from 'horizon/core';
import { PromptDirector } from './PromptDirector'; 
// Corrected import to match your filename (TopicsDatabase.ts)
import { TOPIC_DATA } from './TopicsDatabase'; 

// Events
const ChatToBrainEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatToBrainEvent');
const StreamerPromptEvent = new NetworkEvent<{ prompt: string; meta?: any }>('StreamerPromptEvent');
const StreamerSpeechCompleteEvent = new NetworkEvent<{ timestamp: number }>('StreamerSpeechCompleteEvent');

class StreamerAutopilot extends Component<typeof StreamerAutopilot> {
  static propsDefinition = {
    minDelay: { type: PropTypes.Number, default: 5 },  // Seconds to wait after speaking
    maxDelay: { type: PropTypes.Number, default: 15 },
    vortexMode: { type: PropTypes.Boolean, default: true }, // True = Random order
    debugMode: { type: PropTypes.Boolean, default: false }
  };

  // State Definitions
  private readonly VORTEX_SEQUENCE = ['INTRO', 'ACTION', 'ENGAGEMENT', 'RANT', 'CHILL', 'TRANSITION'];
  private stateIndex: number = 0;

  // Runtime Data
  private chatQueue: { user: string; text: string }[] = [];
  private isWaitingForSpeech: boolean = false;
  private recoveryTimer: any = null;

  start() {
    // Listen for inputs
    this.connectNetworkBroadcastEvent(ChatToBrainEvent, this.handleChatInput.bind(this));
    
    // Listen for the NPC saying "I am done"
    this.connectNetworkBroadcastEvent(StreamerSpeechCompleteEvent, this.handleSpeechComplete.bind(this));

    if (this.props.debugMode) console.log(`[StreamerAutopilot] Started. Loaded ${TOPIC_DATA.length} topics from database.`);
    
    // Kickstart the loop
    this.async.setTimeout(() => this.triggerNextBeat(), 3000);
  }

  /**
   * 1. Handle Incoming Chat
   */
  private handleChatInput(data: { user: string; text: string; timestamp: number }) {
    this.chatQueue.push(data);
    if (this.props.debugMode) console.log(`[StreamerAutopilot] Chat queued. Queue size: ${this.chatQueue.length}`);
  }

  /**
   * 2. Handle Speech Complete
   */
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

  /**
   * 3. Trigger Next Beat
   */
  private triggerNextBeat() {
    if (this.isWaitingForSpeech) return;

    this.isWaitingForSpeech = true;

    // Safety timeout (60s)
    this.recoveryTimer = this.async.setTimeout(() => {
      console.warn('[StreamerAutopilot] Recovery: NPC took too long. Forcing next beat.');
      this.isWaitingForSpeech = false;
      this.triggerNextBeat();
    }, 60000);

    // A. Check Chat Queue
    if (this.chatQueue.length > 0) {
      const chatItem = this.chatQueue.shift();
      if (chatItem) {
        this.sendChatResponsePrompt(chatItem);
        return;
      }
    }

    // B. Pick next Vortex Topic
    this.sendNextVortexPrompt();
  }

  private sendChatResponsePrompt(chat: { user: string; text: string }) {
    const prompt = 
      `The user '${chat.user}' just said: "${chat.text}". ` +
      `Respond to them directly. Be witty or thankful. Keep it under 20 seconds.`;
    
    const meta = { user: chat.user, type: 'reply' };
    this.broadcastPrompt(prompt, meta);
  }

  private sendNextVortexPrompt() {
    // 1. Advance State
    if (this.props.vortexMode) {
      this.stateIndex = Math.floor(Math.random() * this.VORTEX_SEQUENCE.length);
    } else {
      this.stateIndex = (this.stateIndex + 1) % this.VORTEX_SEQUENCE.length;
    }
    const currentState = this.VORTEX_SEQUENCE[this.stateIndex];

    // 2. Pick Topic from our Database
    const randomTopicObj = TOPIC_DATA[Math.floor(Math.random() * TOPIC_DATA.length)];
    
    // We pass the "label" to the director
    const topicLabel = randomTopicObj.label;

    // 3. Generate Prompt
    const data = PromptDirector.expandTopicToPrompt(topicLabel, currentState, {});

    if (this.props.debugMode) console.log(`[StreamerAutopilot] Generated Prompt for [${currentState}]: ${topicLabel}`);

    this.broadcastPrompt(data.primary, data.meta);
  }

  private broadcastPrompt(prompt: string, meta: any) {
    this.sendNetworkBroadcastEvent(StreamerPromptEvent, { prompt, meta });
  }
}

Component.register(StreamerAutopilot);