# ◉ L.O.S.T. — Peer-to-Peer Virtual Tabletop (VTT)

**L.O.S.T.** is a serverless, browser-based multiplayer Virtual Tabletop (VTT) and campaign manager built in vanilla JavaScript, HTML5, and CSS3. Built specifically for my own custom tabletop RPG system and personal campaign, it turns the Game Master's browser into an authoritative host that syncs character sheets, combat state, and dice rolls in real time via WebRTC.

> **Note:** Because this app powers a custom, homebrew RPG ruleset, some game-specific mechanics and terminology may not be immediately obvious without the campaign rulebook—this README highlights the technical architecture and core system features.

▸ **[Live Demo](https://warpedlgr.github.io/Lost-p2p-vtt/)**
![Pretty cool, right?](https://imgur.com/j2zEvWM.png)
---

## ✦ Key Features

### ◎ Serverless P2P Multiplayer (WebRTC)
* **Host-Authoritative Architecture:** Powered by `PeerJS` with custom STUN/TURN fallback routing so players can connect across different networks without requiring a dedicated backend server.
* **Role-Based Access & Data Privacy:** Game Masters (Authors) retain the full campaign locally and can lock specific players to assigned characters. Private GM libraries and loot tables are stripped from network payloads, and session data is automatically wiped from player browsers upon disconnect.
* **One-Click Room Invites:** Generates shareable URLs with pre-filled room codes for instant player onboarding.

### ⚔ Custom System & Automated Rules Engine
* **Homebrew Stats & Dual-Form Sheets:** Tracks custom attributes (`STR`, `DEX`, `CON`, `SPD`, `INT`, `LCK`, `SAN`), Sanity regeneration, cybernetic/gear **Implants**, and dual-sided **"Mirror"** characters that swap active forms mid-session.
* **Tiered Weapons & Charge Attributes:** Supports customizable weapon tiers (`Basic`, `Special`, `Unique`, `Eclipse`), charge capacities, and modular elemental/code attributes (`Blood`, `Soul`, `Mass`, `Order`, `Chance`, `Awareness`, `Art`, `Code`).
* **Initiative & Status Automation:** Automatically rolls and sorts turn order across party members and multi-turn bosses, shifting the UI into a red **Battle Mode**. Tracks 18+ status conditions with stack counters and automated state escalations (e.g., *Bleed* → *Hemorrhage* at 4 stacks, *Fire* → *Combustion*, and *Wet* neutralizing *Fire* or doubling *Shocked* damage).
* **Custom Dice & Formula Parser:** Supports standard `NdS+B` notation with automated stat modifiers, unbiased Web Crypto RNG, critical hit/fail detection, and a synchronized live roll log.

### ▤ Campaign & Audio Tools
* **JSON State Persistence:** Full campaign export and import via local `.json` files for offline backups and multi-session continuity.
* **Synthesized Retro Audio:** Uses the native Web Audio API (`AudioContext`) to generate UI and dice-roll sound effects with zero external audio assets.

---

## ⚙ Tech Stack
* **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (Custom Properties, CSS Grid, CRT scanline styling)
* **Networking:** WebRTC via [PeerJS](https://peerjs.com)
* **APIs:** Web Audio API, Web Crypto API, LocalStorage

---

## ► How to Run Locally or Host a Session

1. **Clone the repository:**
   ```bash
   git clone https://github.com
   ```
2. **Open `index.html`** in any modern web browser (or visit the [GitHub Pages link](https://warpedlgr.github.io/Lost-p2p-vtt/)).
3. **To Host (Game Master):** Optionally load a saved campaign `.json` file, enter your name and a custom Room Code, and click **HOST SESSION (AUTHOR)**.
4. **To Join (Player):** Enter your name and the host's Room Code, then click **JOIN SESSION**.
