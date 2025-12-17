📡 Broadcast Automation System (ATS)
Version: 2.0 (Dual-Host Update)
Platform: Horizon Worlds (Internal API)
Framework: TypeScript / Horizon GenAI
📖 Overview
The Broadcast Automation System (ATS) transforms your Horizon World into a 24/7 automated TV station. Moving beyond simple looping NPCs, this system acts as a "Showrunner," managing two distinct AI hosts (Anchor & Co-Host) who banter, interview the audience, and debate news stories based on a structured run-of-show.
It utilizes Vortex Math (1-2-4-8-7-5 cycle) to determine pacing and segment types, and Horizon’s Internal AI to generate unique, context-aware dialogue every time.
✨ Features
Feature	Description
🎙️ Dual-Host Banter	Orchestrates turn-taking between an Anchor and a Co-Host. They listen to each other and react to previous statements naturally.
🎬 AI Producer	A hidden "Director" NPC analyzes the room vibe (Chill vs. Chaotic) and selects the best news story from the database.
🌀 Vortex Pacing	Cycles through TV formats automatically: Station ID → Headlines → Audience Q&A → Deep Dive Debate → Banter → Commercial.
👁️ Context Awareness	Hosts acknowledge players standing in the "Studio" trigger zone and answer chat questions directly via the Teleprompter.
💾 Persistence	Remembers the current "Episode" state and prevents story repetition using World Persistent Variables.
📂 File Architecture
The Core Logic
StationDirector.ts — The Producer. Runs on a hidden NPC. Uses AI to plan the segment and sends "Cue Cards" to the Scheduler.
ShowScheduler.ts — The Floor Manager. Receives the plan and cues Host A, then Host B, ensuring smooth turn-taking.
AutomatedHost.ts — The Actor. Attached to visible NPCs. Receives a cue, speaks via AI, and signals when done.
The Brain & Senses
SmartNpcMemory.ts — The Memory. Stores variables, tracks who spoke last, and monitors the audience list.
NpcContextAgent.ts — The Sensor. Tracks player count (Vibe) and detects who is in the Studio Trigger.
Data & Utilities
VortexMath.ts — The Clock. Utility library for the pacing cycle and segment duration calculations.
TopicsDatabase.ts — The News Wire. A structured list of stories, intensity ratings, and stage directions.
ChatInputTerminal.ts — The Keyboard. Diegetic object for player input.
StreamChatManager.ts — The Monitor. Displays chat text in-world.
🛠️ Installation Guide
1. Variables Setup
In the Horizon World Editor, open the Variables panel and create the following:
Name	Scope	Type	Group (Optional)
Storyline	World	String	-
LastPrompts	World	String	-
PlayerRoles	Player	String	-
Data	Player	Object	NPC
Prefs	Player	Object	NPC
2. Scene Hierarchy Setup
Create the following objects in your world.
🧠 Object A: The Brain
Create a Cube (or Empty Object) named Broadcast_System. Keep it hidden or out of the way.
Attach Scripts: SmartNpcMemory, ShowScheduler, NpcContextAgent.
Configure Slots:
ShowScheduler: Set Avg Segment Time to 60. Set Turn Delay to 1.5.
🎬 Object B: The Hidden Director
Create an NPC named Director_NPC. Hide this object inside a wall or under the floor.
Attach Script: StationDirector.
Configure Slots:
Memory Link → Drag in Object A (Broadcast_System).
🎤 Object C & D: The Talent
Create two visible NPCs on your set.
Anchor NPC:
Attach Script: AutomatedHost.
Host ID → Type: HostA.
Co-Host NPC:
Attach Script: AutomatedHost.
Host ID → Type: HostB.
🚨 Object E: Studio Trigger
Create a Trigger Gizmo covering the audience area.
Select Object A (Broadcast_System).
In the NpcContextAgent script slots:
Studio Trigger → Drag in the Trigger Gizmo.
3. Final Wiring
Select Object A (Broadcast_System) and configure the ShowScheduler script slots:
Director Link → Drag in Object B (Director_NPC).
Memory Link → Drag in Object A (Broadcast_System).
⚙️ Configuration
Adding Content (TopicsDatabase.ts)
To add new stories, edit the NEWS_WIRE array in the script:
code
TypeScript
{
  id: "story_unique_id",
  headline: "Title of Story",
  category: "Tech", // or Politics, Sports, etc.
  body: "The main facts the AI should reference...",
  intensity: 8, // 1 (Chill) to 10 (High Energy)
  hostAngle: "Instruction for Anchor (e.g. Be serious)",
  coHostAngle: "Instruction for CoHost (e.g. Make a joke)"
}
Tuning Pacing (Inspector)
You can adjust the speed of the show without code changes by selecting Broadcast_System:
Avg Segment Time: Increase (e.g., to 120) for longer, deeper discussions.
Turn Delay: Increase (e.g., to 2.0) for longer pauses between speakers.
🐛 Troubleshooting
Issue	Solution
Show doesn't start	Wait 5 seconds after Play. Ensure ShowScheduler is attached to the Brain object.
NPCs don't speak	Check if World AI is enabled in World Settings. Ensure Director_NPC is an actual NPC entity, not a shape.
"AI Unavailable" Error	Horizon AI services might be down or region-locked. Check the console for logs.
Hosts talk over each other	Increase Turn Delay in the Inspector.