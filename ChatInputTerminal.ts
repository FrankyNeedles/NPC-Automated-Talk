// ChatInputTerminal.ts
/**
 * ChatInputTerminal.ts
 * Diegetic in-world object (like a keyboard or screen) that a player Grabs to start typing.
 * It sends the typed message to the StreamChatManager.
 */

import { Component, PropTypes, CodeBlockEvents, Player, NetworkEvent } from 'horizon/core';

// This event matches the one listened to by StreamChatManager
const ChatMessageEvent = new NetworkEvent<{ user: string; text: string; timestamp: number }>('ChatMessageEvent');

class ChatInputTerminal extends Component<typeof ChatInputTerminal> {
  static propsDefinition = {
    debugMode: { type: PropTypes.Boolean, default: false },
    label: { type: PropTypes.String, default: "Send a message to the Streamer" }
  };

  private isBusy: boolean = false;

  start() {
    // When the player grabs this object, we trigger the keyboard
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, this.onGrabStart.bind(this));
  }

  private onGrabStart(isRightHand: boolean, player: Player) {
    const local = this.world.getLocalPlayer();
    
    // Safety check: Only the player who actually initiated the grab on their client should see the UI
    if (!local || player.id !== local.id) return;

    if (this.isBusy) return;
    this.isBusy = true;

    if (this.props.debugMode) console.log('[ChatInputTerminal] Opening keyboard for local player.');

    // Show the standard Horizon text input UI
    (this.world.ui as any).showStringInput({
      label: this.props.label,
      placeholder: 'Type a message...',
      maxLength: 140, // Twitter/Twitch style short limits
      onSubmit: (text: string) => {
        this.handleInputSubmit(player, text);
        this.isBusy = false;
      },
      onCancel: () => {
        if (this.props.debugMode) console.log('[ChatInputTerminal] Input cancelled.');
        this.isBusy = false;
      }
    });
  }

  private handleInputSubmit(player: Player, rawText: string) {
    // 1. Clean the text (remove crazy characters)
    const cleanText = rawText.replace(/[^\w\s!?.,'":;()-]/g, '').trim();

    if (!cleanText) return;

    // 2. Get a display name (fallback to 'Viewer' if name isn't loaded)
    let userName = 'Viewer';
    if (player.name && typeof player.name.get === 'function') {
      userName = player.name.get();
    }

    // 3. Broadcast the message to the whole server (so the ChatManager sees it)
    this.sendNetworkBroadcastEvent(ChatMessageEvent, {
      user: userName,
      text: cleanText,
      timestamp: Date.now()
    });

    if (this.props.debugMode) {
      console.log(`[ChatInputTerminal] Broadcasted: ${userName}: ${cleanText}`);
    }
  }
}

Component.register(ChatInputTerminal);