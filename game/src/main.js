// Deadwire — Core Run entry point. Gamified main menu (asset-forward) -> match.
import { Game } from './core/Game.js';
import { Lobby } from './ui/Lobby.js';
import { MainMenu } from './ui/MainMenu.js';

const canvas = document.getElementById('game');
const uiRoot = document.getElementById('ui');
const game = new Game(canvas, uiRoot);
if (typeof window !== 'undefined') window.__deadwire = game; // debug handle

function openMenu() {
  new MainMenu(uiRoot, {
    onPlay: (loadout, online, name) => openLobby(loadout, online, name),
  });
}

function openLobby(loadout, online, name) {
  new Lobby(uiRoot, {
    loadout,
    online,
    name,
    onDeploy: (selectedLoadout, isOnline, playerName) => {
      game.start(selectedLoadout, isOnline, playerName);
    },
    onBack: openMenu,
  });
}

game.onExitToMenu = openMenu;   // results screen "Main Menu" button
openMenu();
