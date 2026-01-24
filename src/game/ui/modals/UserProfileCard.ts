
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../../config';
import type { LevelData } from '../../levels/LevelSchema';
import { CURRENT_USER_ID, LevelService } from '../../services/LevelService';
import { ConfirmDialog } from './ConfirmDialog';
import { UIFactory } from '../UIFactory';
import { LanguageManager, type TranslationKey } from '../../i18n/LanguageManager';

export class UserProfileCard extends PIXI.Container {
  private onCloseCallback: () => void;
  private onViewLevelsCallback: (userId: string) => void;
  // private onLikeToggleCallback?: () => void; // Unused for now
  private onDeleteCallback?: (levelId: string) => void;
  private allowDelete: boolean;
  private levelData: LevelData;
  private userColor: number;
  private getThumbnail: (width: number, height: number) => PIXI.Container;

  constructor(
    levelData: LevelData,
    userColor: number,
    getThumbnail: (width: number, height: number) => PIXI.Container,
    onClose: () => void,
    onViewLevels: (userId: string) => void,
    // onLikeToggle?: () => void,
    onDelete?: (levelId: string) => void,
    allowDelete: boolean = false
  ) {
    super();
    this.levelData = levelData;
    this.userColor = userColor;
    this.getThumbnail = getThumbnail;
    this.onCloseCallback = onClose;
    this.onViewLevelsCallback = onViewLevels;
    // this.onLikeToggleCallback = onLikeToggle;
    this.onDeleteCallback = onDelete;
    this.allowDelete = allowDelete;

    this.refreshUI();

    // Listen for resize
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.refreshUI();
  };

  private refreshUI(): void {
    this.removeChildren();

    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();

    this.zIndex = 2000;

    // 1. Dimmed Background (Click to close)
    const overlay = UIFactory.createOverlay(canvasWidth, canvasHeight, 0.5);
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointertap', () => this.onCloseCallback());
    this.addChild(overlay);

    // --- Layout Calculations ---
    const cardWidth = scale(800);
    const padding = scale(40);

    // Left (Level Content) 60%, Right (Author) 40%
    const gap = scale(20);
    const availableWidth = cardWidth - (padding * 2) - gap;
    const finalLeftWidth = availableWidth * 0.6;
    const finalRightWidth = availableWidth * 0.4;

    const previewWidth = finalLeftWidth;
    const previewHeight = previewWidth * (9 / 16);

    const statsAreaHeight = scale(40); // Reduced: only published date now
    const cardHeight = previewHeight + statsAreaHeight + (padding * 2);

    // 2. Card Container
    const card = UIFactory.createCard(cardWidth, cardHeight, 0xFFFFFF);
    card.position.set((canvasWidth - cardWidth) / 2, (canvasHeight - cardHeight) / 2);
    this.addChild(card);

    card.eventMode = 'static';
    card.on('pointertap', (e) => e.stopPropagation());

    // --- LEFT COLUMN ---
    const leftCol = new PIXI.Container();
    leftCol.position.set(padding, padding);
    card.addChild(leftCol);

    // 1. Preview
    const previewContainer = new PIXI.Container();

    const previewShadow = UIFactory.createShadow(previewWidth, previewHeight, 0, 8, 0.3);
    previewContainer.addChild(previewShadow);

    const previewBg = new PIXI.Graphics();
    previewBg.rect(0, 0, previewWidth, previewHeight);
    previewBg.fill(0xF5F5F5);
    previewBg.stroke({ width: 1, color: 0xEEEEEE });
    previewContainer.addChild(previewBg);

    const previewMask = new PIXI.Graphics();
    previewMask.rect(0, 0, previewWidth, previewHeight);
    previewMask.fill(0xFFFFFF);
    previewContainer.addChild(previewMask);

    const levelContent = this.getThumbnail(previewWidth, previewHeight);
    levelContent.mask = previewMask;
    previewContainer.addChild(levelContent);

    leftCol.addChild(previewContainer);

    // 2. Info Area (Stats + Like)
    const infoContainer = new PIXI.Container();
    infoContainer.position.set(0, previewHeight + scale(15));
    leftCol.addChild(infoContainer);

    // 2a. Text Stats (Only Published Date)
    const textStats = new PIXI.Container();
    infoContainer.addChild(textStats);

    const t = (key: TranslationKey) => LanguageManager.getInstance().t(key);
    const statLabelStyle = new PIXI.TextStyle({
      fontFamily: 'Arial', fontSize: scale(14), fill: '#888888'
    });
    const statValueStyle = new PIXI.TextStyle({
      fontFamily: 'Arial', fontSize: scale(14), fontWeight: 'bold', fill: '#555555'
    });

    const createStatRow = (label: string, value: string, yPos: number) => {
      const row = new PIXI.Container();
      const l = new PIXI.Text({ text: label, style: statLabelStyle });
      const v = new PIXI.Text({ text: value, style: statValueStyle });
      v.x = l.width + scale(5);
      row.addChild(l, v);
      row.y = yPos;
      return row;
    };

    const dateStr = this.levelData.isPublished
      ? new Date(this.levelData.createdAt || Date.now()).toLocaleDateString()
      : (this.levelData.createdAt ? new Date(this.levelData.createdAt).toLocaleDateString() : '-');
    const labelText = this.levelData.isPublished ? t('level.published') : t('level.created');

    textStats.addChild(createStatRow(labelText, dateStr, 0));

    // --- RIGHT COLUMN (Author) ---
    const rightCol = new PIXI.Container();
    rightCol.position.set(padding + finalLeftWidth + gap, padding);
    card.addChild(rightCol);

    // Create Sub-Card for Author Info
    // Height should match previewHeight + statsAreaHeight roughly
    // Or just be enough to contain the content with some padding.
    // Let's make it match the Left Column height for visual balance? 
    // Left Column Height = previewHeight + scale(15) + scale(80) (stats area)
    const subCardHeight = previewHeight + statsAreaHeight;
    const subCardWidth = finalRightWidth;

    // Sub-Card (Shadow + Background)
    const subCard = UIFactory.createCard(subCardWidth, subCardHeight, 0xFFFFFF);
    rightCol.addChild(subCard);

    const centerX = subCardWidth / 2;

    // Avatar
    const avatarRadius = scale(60);
    let topY = scale(30);

    let profileColor = this.userColor;
    let profileUrl: string | undefined;
    if (this.levelData.authorId === CURRENT_USER_ID) {
      const profile = LevelService.getInstance().getUserProfile();
      profileColor = profile.avatarColor;
      profileUrl = profile.avatarUrl;
    } else {
      // Remote User - Construct GitHub Avatar URL (use avatars subdomain for CORS support)
      profileUrl = `https://avatars.githubusercontent.com/${this.levelData.authorId}`;
    }

    const avatar = UIFactory.createAvatar(avatarRadius, profileUrl, profileColor);
    avatar.position.set(centerX, topY + avatarRadius);
    rightCol.addChild(avatar);

    topY += (avatarRadius * 2) + scale(15);

    // Name
    const nameString = this.levelData.author || 'Unknown';
    const nameText = new PIXI.Text({
      text: nameString,
      style: { fontFamily: 'Arial', fontSize: scale(20), fontWeight: 'bold', fill: '#555555', align: 'center', wordWrap: true, wordWrapWidth: subCardWidth - scale(20) }
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(centerX, topY);
    rightCol.addChild(nameText);

    topY += nameText.height + scale(5);

    // User Stats (Total Levels)
    const statsText = new PIXI.Text({
      text: t('profile.total_levels') + '42',
      style: { fontFamily: 'Arial', fontSize: scale(14), fill: '#AAAAAA', align: 'center' }
    });
    statsText.anchor.set(0.5, 0);
    statsText.position.set(centerX, topY);
    rightCol.addChild(statsText);

    // View Levels / Delete Button
    const actionBtn = (this.levelData.authorId === CURRENT_USER_ID && this.allowDelete)
      ? this.createDeleteButton(subCardWidth - scale(40))
      : this.createViewLevelsButton(subCardWidth - scale(40));

    // Align near bottom of sub-card
    actionBtn.position.set(centerX, subCardHeight - scale(30)); // 30px padding from bottom

    rightCol.addChild(actionBtn);

    // Close Button
    const closeBtn = new PIXI.Container();
    const closeSize = scale(40);
    const closeHit = new PIXI.Graphics();
    closeHit.rect(0, 0, closeSize, closeSize);
    closeHit.fill({ color: 0xFFFFFF, alpha: 0.001 });
    closeBtn.addChild(closeHit);
    const closeX = new PIXI.Text({ text: '×', style: { fontFamily: 'Arial', fontSize: scale(32), fill: '#AAAAAA' } });
    closeX.anchor.set(0.5);
    closeX.position.set(closeSize / 2, closeSize / 2);
    closeBtn.addChild(closeX);
    closeBtn.position.set(cardWidth - closeSize - scale(5), scale(5));
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => this.onCloseCallback());
    card.addChild(closeBtn);
  }



  private createViewLevelsButton(width: number): PIXI.Container {
    const w = width;
    const h = scale(36);

    // Use factory
    const btn = UIFactory.createButton(
      LanguageManager.getInstance().t('profile.view_levels'),
      w,
      h,
      0x37A4E9,
      '#FFFFFF',
      () => {
        if (this.levelData.authorId) {
          this.onViewLevelsCallback(this.levelData.authorId);
        }
      },
      14 // Font size
    );

    btn.pivot.set(w / 2, h / 2);

    return btn;
  }

  private createDeleteButton(width: number): PIXI.Container {
    const w = width;
    const h = scale(36);
    const container = new PIXI.Container();

    const bg = UIFactory.createPill(w, h, 0xFFFFFF, 0xFF6B6B, 1);
    bg.position.set(-w / 2, -h / 2);
    container.addChild(bg);

    const text = new PIXI.Text({
      text: LanguageManager.getInstance().t('level.delete'),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: '#FF6B6B',
        fontWeight: 'bold'
      }
    });
    text.anchor.set(0.5);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointertap', () => {
      if (this.onDeleteCallback) {
        const dialog = new ConfirmDialog(
          LanguageManager.getInstance().t('level.delete_confirm'),
          () => {
            if (this.onDeleteCallback) this.onDeleteCallback(this.levelData.id);
            this.removeChild(dialog);
            dialog.destroy();
          },
          () => {
            this.removeChild(dialog);
            dialog.destroy();
          },
          {
            confirmKey: 'level.delete',
            cancelKey: 'common.cancel'
          }
        );
        this.addChild(dialog);
      }
    });

    return container;
  }

  destroy(options?: any): void {
    window.removeEventListener('resize', this.handleResize);
    super.destroy(options);
  }
}
