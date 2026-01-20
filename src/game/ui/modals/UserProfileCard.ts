import * as PIXI from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config';

export class UserProfileCard extends PIXI.Container {
  private onClose: () => void;

  constructor(userName: string, userId: string, color: number, onClose: () => void, onViewLevels: (userId: string) => void) {
    super();
    this.onClose = onClose;

    this.zIndex = 2000; // High zIndex to be on top

    // 1. Dimmed Background (Click to close)
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.fill({ color: 0x000000, alpha: 0.5 });
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointertap', () => this.onClose());
    this.addChild(overlay);

    // 2. Card Container
    const cardWidth = 400;
    const cardHeight = 300;
    const card = new PIXI.Container();
    card.position.set((GAME_WIDTH - cardWidth) / 2, (GAME_HEIGHT - cardHeight) / 2);
    this.addChild(card);

    // Shadow (Rect with Blur) - Matches LevelSelectionUI card shadow
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, cardWidth, cardHeight);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: 8, quality: 3 })];
    shadow.position.set(0, 4);
    card.addChild(shadow);

    // Card Body (White, sharp or minimal radius)
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, cardWidth, cardHeight);
    bg.fill({ color: 0xFFFFFF });
    card.addChild(bg);

    // Prevent clicks on card from closing (stop propagation)
    card.eventMode = 'static';
    card.on('pointertap', (e) => e.stopPropagation());

    // 3. User Avatar (Large)
    const avatarRadius = 50;
    const avatar = new PIXI.Graphics();
    avatar.circle(0, 0, avatarRadius);
    avatar.fill(color);
    avatar.stroke({ width: 4, color: 0xE0E0E0 });
    avatar.position.set(cardWidth / 2, 80);
    card.addChild(avatar);

    // 4. User Name
    const nameText = new PIXI.Text({
      text: userName,
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fontWeight: 'bold',
        fill: '#555555' // Dark grey like header
      }
    });
    nameText.anchor.set(0.5);
    nameText.position.set(cardWidth / 2, 160);
    card.addChild(nameText);

    // 5. User Stats (e.g. Created Levels, Likes)
    const statsStyle = {
      fontFamily: 'Arial',
      fontSize: 18,
      fill: '#A0A0A0' // Light grey like index text
    };

    // Fake stats
    const createdCount = Math.floor(Math.random() * 50) + 1;
    const likesCount = Math.floor(Math.random() * 1000);

    const statsText = new PIXI.Text({
      text: `Levels Created: ${createdCount}    Likes: ${likesCount}`,
      style: statsStyle
    });
    statsText.anchor.set(0.5);
    statsText.position.set(cardWidth / 2, 210);
    card.addChild(statsText);

    // 6. View Levels Button
    const btnWidth = 200;
    const btnHeight = 40;
    const btn = new PIXI.Container();
    btn.position.set((cardWidth - btnWidth) / 2, 250);

    // Transparent or weak background
    const btnBg = new PIXI.Graphics();
    btnBg.roundRect(0, 0, btnWidth, btnHeight, 4); // Slight rounding
    btnBg.stroke({ width: 1, color: 0x4ECDC4 });
    btnBg.fill({ color: 0xFFFFFF, alpha: 1 });
    btn.addChild(btnBg);

    const btnText = new PIXI.Text({
      text: 'View Levels',
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: 0x4ECDC4,
        fontWeight: 'bold'
      }
    });
    btnText.anchor.set(0.5);
    btnText.position.set(btnWidth / 2, btnHeight / 2);
    btn.addChild(btnText);

    // Button interaction
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      onViewLevels(userId);
    });

    card.addChild(btn);


    // Close Button (Top Right)
    // using bootstrap icon or simple text if font not loaded in this context (it is loaded in Game.ts)
    const closeBtn = new PIXI.Container();
    const closeSize = 40;
    const closeHit = new PIXI.Graphics();
    closeHit.rect(0, 0, closeSize, closeSize);
    closeHit.fill({ color: 0x000000, alpha: 0.001 });
    closeBtn.addChild(closeHit);


    // Fallback if font not working right in this unconnected container verify later
    // For safety, stick to 'x' or use the same as Header buttons if sure.
    // Header uses unicode f479/f604. Let's try simple Sans 'X' 
    const closeX = new PIXI.Text({
      text: '×',
      style: {
        fontFamily: 'Arial',
        fontSize: 32,
        fill: '#AAAAAA'
      }
    });

    closeX.anchor.set(0.5);
    closeX.position.set(closeSize / 2, closeSize / 2);
    closeBtn.addChild(closeX);

    closeBtn.position.set(cardWidth - 40, 0);
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => this.onClose());

    card.addChild(closeBtn);
  }
}
