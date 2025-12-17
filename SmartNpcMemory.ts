// SmartNpcMemory.ts
// The "Master Brain" - Final Polish & Import Fix
// Features:
// 1. Vortex Mathematics Engine (Internal logic ONLY - Hidden from AI text)
// 2. Persistent Player Profiles (NPC:Memory)
// 3. Context Injection (Feeds past history to AI so it "remembers")
// 4. Robust Initialization

import { Component, PropTypes, Player, Entity, World } from 'horizon/core';
import { Npc, NpcConversation, NpcPlayer } from 'horizon/npc';

// --- DATA STRUCTURES ---

enum AiConnectionState {
    OFFLINE = 'OFFLINE',
    CONNECTING = 'CONNECTING',
    ONLINE = 'ONLINE',
    ERROR = 'ERROR'
}

type MemEvent = {
    ts: number;
    source: string;
    text: string;
    sentiment: number;
};

type PlayerProfile = {
    id: string;
    name: string;
    visits: number;
    lastSeen: number;
    reputation: number;       
    vortexSeed: number;       
    events: MemEvent[];       
    summary: string;
};

const DEFAULT_MAX_EVENTS = 10;
const PERSIST_VAR_NAME = 'NPC:Memory'; 

export class SmartNpcMemory extends Component<typeof SmartNpcMemory> {
    static propsDefinition = {
        npcGizmo: { 
            type: PropTypes.Entity, 
            label: "NPC Gizmo (Required)", 
            description: "Drag the NPC entity here." 
        },
        npcPersonalityContext: {
            type: PropTypes.String,
            default: "You are a helpful, observant character. You remember people you have met before. Be friendly but professional.",
            label: "Personality Context"
        },
        variableGroupName: {
            type: PropTypes.String,
            default: "NPC",
            label: "Var Group Name"
        },
        persistenceVariableName: {
            type: PropTypes.String,
            default: "Memory",
            label: "Player Var Name"
        },
        enableDebug: { type: PropTypes.Boolean, default: true, label: "Debug Logs" },
        enablePersistence: { type: PropTypes.Boolean, default: true, label: "Save Data" }
    };

    private npc: Npc | undefined;
    private npcPlayer: NpcPlayer | undefined;
    private connectionState: AiConnectionState = AiConnectionState.OFFLINE;
    private profiles: Map<string, PlayerProfile> = new Map();
    private static instances: SmartNpcMemory[] = []; 

    private globalVortexState: number = 1;

    // --- LIFECYCLE ---

    start() {
        SmartNpcMemory.instances.push(this); 

        if (!this.props.npcGizmo) {
            this.logError('NPC Gizmo slot is empty! Memory cannot start.');
            return;
        }

        this.log("Starting Memory System...");
        this.initializeNpcConnection();
    }

    dispose() {
        const idx = SmartNpcMemory.instances.indexOf(this);
        if (idx >= 0) SmartNpcMemory.instances.splice(idx, 1);
    }

    // --- ROBUST INITIALIZATION ---
    
    private async initializeNpcConnection() {
        if (this.connectionState === AiConnectionState.ONLINE) return;
        if (!this.props.npcGizmo) return;

        this.connectionState = AiConnectionState.CONNECTING;
        
        try {
            const rawNpc = this.props.npcGizmo.as(Npc);
            if (!rawNpc) throw new Error("Waiting for NPC Component...");
            
            const validNpc = rawNpc!;
            this.npc = validNpc;

            try {
                this.npcPlayer = await validNpc.tryGetPlayer();
            } catch (e) {
                throw new Error("Waiting for NPC Player Interface...");
            }

            const isAiReady = await NpcConversation.isAiAvailable();
            if (!isAiReady) throw new Error("Waiting for AI Service...");

            // Don't mention Math/Vortex in the core persona context
            await validNpc.conversation.setDynamicContext(
                'npc_behavior', 
                this.props.npcPersonalityContext
            );

            this.connectionState = AiConnectionState.ONLINE;
            this.log("SUCCESS: Brain Online.");

        } catch (e: any) {
            this.async.setTimeout(() => this.initializeNpcConnection(), 2000);
        }
    }

    // --- VORTEX ENGINE (Internal Logic Only) ---

    public advanceVortexState(): number {
        let next = (this.globalVortexState * 2) % 9;
        if (next === 0) next = 9;
        this.globalVortexState = next;
        return this.globalVortexState;
    }

    public getVortexState(): number {
        return this.globalVortexState;
    }

    // --- PUBLIC API ---

    public getNpcId(): string | undefined {
        return this.npcPlayer ? this.npcPlayer.id.toString() : undefined;
    }

    public async enableHearingForPlayer(player: Player) {
        if (this.connectionState !== AiConnectionState.ONLINE || !this.npc || !this.npcPlayer) return;

        const pid = player.id.toString();
        if (pid === this.getNpcId()) return;

        this.npcPlayer.addAttentionTarget(player);
        this.npc.conversation.registerParticipant(player);

        const prof = await this.loadOrCreateProfile(player);
        this.registerVisit(player, prof);
        
        // Clean Context Injection (Hidden Logic)
        // We format previous events into natural language for the AI to read.
        const historyStr = this.formatHistoryForContext(prof);
        const repStr = this.getReputationLabel(prof.reputation);
        
        const contextStr = `Player ${prof.name} has entered. You know them as a ${repStr}. They have visited ${prof.visits} times. ${historyStr}`;
        
        await this.npc.conversation.setDynamicContext(`player_${pid}_status`, contextStr);
        
        this.log(`Enabled hearing for ${prof.name}. Injected History: "${historyStr}"`);
    }

    public async disableHearingForPlayer(player: Player) {
        if (!this.npcPlayer || !this.npc) return;
        this.npcPlayer.removeAttentionTarget(player);
        try { this.npc.conversation.unregisterParticipant(player); } catch(e){}
    }

    public async updatePlayerInteraction(player: Player, action: string = "interaction") {
        const prof = await this.loadOrCreateProfile(player);
        
        prof.reputation = Math.min(1.0, prof.reputation + 0.05);
        prof.lastSeen = Date.now();
        
        // Internal Logic Update (Hidden from AI text)
        let next = (prof.vortexSeed * 2) % 9;
        if (next === 0) next = 9;
        prof.vortexSeed = next;

        // Save event for history
        this.addEvent(prof, "action", `Player performed: ${action}`);
        this.saveProfile(player, prof);
    }

    public async addEventPerception(text: string) {
        if (this.connectionState !== AiConnectionState.ONLINE || !this.npc) return;
        try { 
            await this.npc.conversation.addEventPerception(text);
        } catch(e){}
    }

    // --- HELPERS ---

    private formatHistoryForContext(prof: PlayerProfile): string {
        if (prof.events.length === 0) return "This is your first meeting.";
        
        // Get last 2 significant events
        const recent = prof.events.slice(-2);
        const lines = recent.map(e => {
            return e.text;
        });
        
        return "Last interactions: " + lines.join(". ");
    }

    // --- PERSISTENCE ---

    private getPersistenceKey(): string {
        return `${this.props.variableGroupName}:${this.props.persistenceVariableName}`;
    }

    private async loadOrCreateProfile(player: Player): Promise<PlayerProfile> {
        const pid = player.id.toString();
        
        if (this.profiles.has(pid)) {
            return this.profiles.get(pid)!;
        }

        let loadedData: any = null;
        if (this.props.enablePersistence) {
            try {
                const storage = (this.world as any).persistentStorage;
                if (storage) {
                    const key = this.getPersistenceKey();
                    const json = await storage.getPlayerVariable(player, key);
                    if (json && typeof json === 'string') {
                        loadedData = JSON.parse(json);
                    }
                }
            } catch (e) { }
        }

        const name = player.name.get();
        const prof: PlayerProfile = loadedData || {
            id: pid,
            name: name,
            visits: 0,
            lastSeen: Date.now(),
            reputation: 0,
            vortexSeed: Math.floor(Math.random() * 9) + 1,
            events: [],
            summary: ""
        };

        prof.name = name;
        this.profiles.set(pid, prof);
        return prof;
    }

    private async saveProfile(player: Player, prof: PlayerProfile) {
        SmartNpcMemory.instances.forEach(inst => {
            if (inst !== this) inst.profiles.set(prof.id, prof);
        });

        if (this.props.enablePersistence) {
            try {
                const storage = (this.world as any).persistentStorage;
                if (storage) {
                    if (prof.events.length > DEFAULT_MAX_EVENTS) {
                        prof.events = prof.events.slice(prof.events.length - DEFAULT_MAX_EVENTS);
                    }
                    const key = this.getPersistenceKey();
                    await storage.setPlayerVariable(player, key, JSON.stringify(prof));
                }
            } catch (e: any) {
                this.logError(`Save Failed: ${e.message}`);
            }
        }
    }

    private registerVisit(player: Player, prof: PlayerProfile) {
        prof.visits++;
        prof.lastSeen = Date.now();
        // Don't add a text event for every visit to save space, relies on counter
        this.saveProfile(player, prof);
    }

    private addEvent(prof: PlayerProfile, source: string, text: string) {
        const ev: MemEvent = {
            ts: Date.now(),
            source: source,
            text: text,
            sentiment: 0
        };
        prof.events.push(ev);
    }

    private getReputationLabel(rep: number): string {
        if (rep > 0.5) return "Trusted Friend";
        if (rep > 0.1) return "Acquaintance";
        if (rep < -0.5) return "Hostile";
        return "Neutral";
    }

    private log(msg: string) {
        if (this.props.enableDebug) console.log(`[SmartNpcMemory] ${msg}`);
    }
    private logError(msg: string) {
        console.error(`[SmartNpcMemory] ERROR: ${msg}`);
    }
}

Component.register(SmartNpcMemory);