// Deadwire — Core Run entry point. Gamified main menu (asset-forward) -> match.
import { Game } from './core/Game.js';
import { Lobby } from './ui/Lobby.js';
import { MainMenu } from './ui/MainMenu.js';
import { LoadingScreen } from './ui/LoadingScreen.js';

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
    onDeploy: deployWithLoading,
    onBack: openMenu,
  });
}

async function deployWithLoading(selectedLoadout, isOnline, playerName) {
  const loading = new LoadingScreen(uiRoot, { online: isOnline, name: playerName });
  try {
    await loading.intro();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    game.start(selectedLoadout, isOnline, playerName);
    await loading.finish();
  } catch (error) {
    loading.destroy();
    throw error;
  }
}

game.onExitToMenu = openMenu;   // results screen "Main Menu" button
openMenu();
