/**
 * Open Dots - Main Entry Point
 */

import './style.css';

async function main(): Promise<void> {
  try {
    console.log('Loading Game module...');
    // Use dynamic import to identify if there are issues with loading dependencies (e.g. planck)
    const { Game } = await import('./game/Game');

    console.log('Initializing Game...');

    // Initialize Localization
    const { LanguageManager } = await import('./game/i18n/LanguageManager');
    const { en } = await import('./game/i18n/locales/en');
    const { zhTW } = await import('./game/i18n/locales/zh-TW');
    const { ru } = await import('./game/i18n/locales/ru');

    const langMgr = LanguageManager.getInstance();
    langMgr.registerLocale('en', en);
    langMgr.registerLocale('zh-TW', zhTW);
    langMgr.registerLocale('ru', ru);

    const game = new Game();
    await game.init();

    console.log('🎮 Open Dots Demo loaded!');
    console.log('Draw lines with your mouse - they will become physics objects!');
  } catch (err: any) {
    console.error('Failed to start game:', err);

    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '0';
    div.style.left = '0';
    div.style.width = '100%';
    div.style.height = '100%';
    div.style.backgroundColor = 'rgba(0,0,0,0.8)';
    div.style.color = '#ff5555';
    div.style.padding = '20px';
    div.style.whiteSpace = 'pre-wrap';
    div.style.fontFamily = 'monospace';
    div.style.zIndex = '9999';
    div.textContent = `⚠️ Game Error: ${err.message}\n\n${err.stack || ''}`;
    document.body.appendChild(div);
  }
}

main();
