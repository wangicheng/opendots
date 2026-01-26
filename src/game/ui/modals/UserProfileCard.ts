
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../../config';
import type { LevelData } from '../../levels/LevelSchema';
import { LevelService } from '../../services/LevelService';
import { ConfirmDialog } from './ConfirmDialog';
import { UIFactory } from '../UIFactory';
import { LanguageManager, type TranslationKey } from '../../i18n/LanguageManager';

export class UserProfileCard extends PIXI.Container {
  private onCloseCallback: () => void;
  private onViewLevelsCallback: (userId: string) => void;
  private onLikeToggleCallback?: () => void;
  private onDeleteCallback?: (levelId: string) => void;
  private allowDelete: boolean;
  private levelData: LevelData;
  private userColor: number;
  private getThumbnail: (width: number, height: number) => PIXI.Container;
  private authorLevelCount: number;

  constructor(
    levelData: LevelData,
    userColor: number,
    getThumbnail: (width: number, height: number) => PIXI.Container,
    onClose: () => void,
    onViewLevels: (userId: string) => void,
    onLikeToggle?: () => void,
    onDelete?: (levelId: string) => void,
    allowDelete: boolean = false,
    authorLevelCount: number = 0
  ) {
    super();
    this.levelData = levelData;
    this.userColor = userColor;
    this.getThumbnail = getThumbnail;
    this.onCloseCallback = onClose;
    this.onViewLevelsCallback = onViewLevels;
    this.onLikeToggleCallback = onLikeToggle;
    this.onDeleteCallback = onDelete;
    this.allowDelete = allowDelete;
    this.authorLevelCount = authorLevelCount;

    this.refreshUI();

    // Listen for resize
    window.addEventListener('resize', this.handleResize);

    // Listen for profile updates
    LevelService.getInstance().subscribe(this.handleProfileUpdate);
  }

  private handleProfileUpdate = (): void => {
    this.refreshUI();
  };

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

    const statsAreaHeight = scale(80);
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

    // 2a. Text Stats (Vertical List)
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

    const attempts = this.levelData.attempts ?? 0;
    textStats.addChild(createStatRow(t('level.attempts'), attempts.toString(), scale(25)));

    const clears = this.levelData.clears ?? 0;
    const percentage = attempts > 0 ? Math.round((clears / attempts) * 100) : 0;
    textStats.addChild(createStatRow(t('level.clears'), `${clears} (${percentage}%)`, scale(50)));

    // 2b. Like Button (Right of Stats)
    const likeBtnWidth = scale(100);
    const likeBtnHeight = scale(36);
    const likeBtn = this.createLikeButton(this.levelData.likes || 0, likeBtnWidth, likeBtnHeight);

    // Position Like button at the right edge of the left column
    // Vertically center with the text stats block (roughly 75px height)
    likeBtn.position.set(previewWidth - likeBtnWidth, (scale(75) - likeBtnHeight) / 2);
    infoContainer.addChild(likeBtn);

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
    const avatarRadius = scale(70);
    let topY = scale(30);

    let profileColor = this.userColor;
    let profileUrl: string | undefined;

    // Check dynamic ID
    const currentUserId = LevelService.getInstance().getUserProfile()?.id;

    if (currentUserId && this.levelData.authorId === currentUserId) {
      const profile = LevelService.getInstance().getUserProfile();
      if (profile) {
        profileColor = profile.avatarColor;
        profileUrl = profile.avatarUrl;
      }
    }

    const avatar = UIFactory.createAvatar(avatarRadius, profileUrl, profileColor);
    avatar.position.set(centerX, topY + avatarRadius);
    rightCol.addChild(avatar);

    topY += (avatarRadius * 2) + scale(15);

    // Name
    const nameString = this.levelData.author || LanguageManager.getInstance().t('common.unknown');
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
      text: t('profile.total_levels') + this.authorLevelCount.toString(),
      style: { fontFamily: 'Arial', fontSize: scale(14), fill: '#AAAAAA', align: 'center' }
    });
    statsText.anchor.set(0.5, 0);
    statsText.position.set(centerX, topY);
    rightCol.addChild(statsText);

    // View Levels / Delete Button
    // Check dynamic ID again
    // View Levels / Delete Button
    // reuse currentUserId from above
    const isLocalAuthor = currentUserId && this.levelData.authorId === currentUserId;

    const actionBtn = (isLocalAuthor && this.allowDelete)
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

  private createLikeButton(initialLikes: number, width: number, height?: number): PIXI.Container {
    const container = new PIXI.Container();

    // Button styling
    const w = width;
    const h = height || scale(36);
    const r = h / 2; // Fully rounded (Pill shape)

    // Default: Outline
    const bg = UIFactory.createPill(w, h, 0xFFFFFF, 0xFF6B6B, 2);
    container.addChild(bg);

    // Icon (Thumbs Up)
    const icon = UIFactory.createIcon('\uF406', scale(20), '#FF6B6B');
    // Position set later in updateLayout
    container.addChild(icon);

    // Count
    let count = initialLikes;
    const countText = new PIXI.Text({
      text: count.toString(),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(24),
        fill: '#FF6B6B',
        fontWeight: 'bold'
      }
    });
    countText.anchor.set(0, 0.5);
    container.addChild(countText);

    const updateLayout = () => {
      const spacing = scale(12);
      const totalW = icon.width + spacing + countText.width;
      const startX = (w - totalW) / 2;

      icon.position.set(startX + icon.width / 2, h / 2 + scale(2));
      countText.position.set(startX + icon.width + spacing, h / 2);
    };

    updateLayout();

    // Interaction
    container.eventMode = 'static';
    container.cursor = 'pointer';

    let liked = !!this.levelData.isLikedByCurrentUser;
    const baseCount = liked ? (initialLikes - 1) : initialLikes;

    const updateVisuals = () => {
      const currentCount = baseCount + (liked ? 1 : 0);
      countText.text = currentCount.toString();
      updateLayout();

      if (liked) {
        bg.clear();
        bg.roundRect(0, 0, w, h, r);
        bg.fill({ color: 0xFF6B6B });
        icon.style.fill = '#FFFFFF';
        countText.style.fill = '#FFFFFF';
      } else {
        bg.clear();
        bg.roundRect(0, 0, w, h, r);
        bg.stroke({ width: 2, color: 0xFF6B6B });
        bg.fill({ color: 0xFFFFFF });
        icon.style.fill = '#FF6B6B';
        countText.style.fill = '#FF6B6B';
      }
    };

    updateVisuals();

    container.on('pointertap', () => {
      liked = !liked;
      this.levelData.isLikedByCurrentUser = liked;
      this.levelData.likes = baseCount + (liked ? 1 : 0);
      if (this.onLikeToggleCallback) this.onLikeToggleCallback();
      updateVisuals();
    });

    return container;
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
    LevelService.getInstance().unsubscribe(this.handleProfileUpdate);
    super.destroy(options);
  }
}
