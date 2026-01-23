
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../../config';
import type { LevelData } from '../../levels/LevelSchema';
import { CURRENT_USER_ID, MockLevelService } from '../../services/MockLevelService';
import { ConfirmDialog } from './ConfirmDialog';

export class UserProfileCard extends PIXI.Container {
  private onCloseCallback: () => void;
  private onViewLevelsCallback: (userId: string) => void;
  private onLikeToggleCallback?: () => void;
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
    onLikeToggle?: () => void,
    onDelete?: (levelId: string) => void,
    allowDelete: boolean = false
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
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, canvasWidth, canvasHeight);
    overlay.fill({ color: 0x000000, alpha: 0.5 });
    overlay.eventMode = 'static';
    overlay.cursor = 'pointer';
    overlay.on('pointertap', () => this.onCloseCallback());
    this.addChild(overlay);

    // --- Layout Calculations ---
    const cardWidth = scale(800);
    const padding = scale(30);

    // Preview determines the height (Master)
    // Width ~ 60% of card minus padding
    const previewWidth = (cardWidth * 0.6) - padding;
    const previewHeight = previewWidth * (9 / 16); // Fixed 16:9 ratio

    // Stats area height (reduced for single line)
    const statsHeight = scale(40);

    // Card Height is Preview Height + Stats Height + Padding * 2
    const cardHeight = previewHeight + statsHeight + (padding * 2);

    // 2. Card Container
    const card = new PIXI.Container();
    card.position.set((canvasWidth - cardWidth) / 2, (canvasHeight - cardHeight) / 2);
    this.addChild(card);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, cardWidth, cardHeight);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: scale(8), quality: 3 })];
    shadow.position.set(0, scale(4));
    card.addChild(shadow);

    // Card Body
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, cardWidth, cardHeight);
    bg.fill({ color: 0xFFFFFF });
    card.addChild(bg);

    card.eventMode = 'static';
    card.on('pointertap', (e) => e.stopPropagation());

    // 3. Level Preview (Left Side)
    const previewContainer = new PIXI.Container();
    previewContainer.position.set(padding, padding);

    // Preview Shadow
    const previewShadow = new PIXI.Graphics();
    previewShadow.rect(0, 0, previewWidth, previewHeight);
    previewShadow.fill({ color: 0x000000, alpha: 0.3 });
    previewShadow.filters = [new PIXI.BlurFilter({ strength: scale(8), quality: 3 })];
    previewShadow.position.set(0, scale(4));
    previewContainer.addChild(previewShadow);

    // Preview Background
    const previewBg = new PIXI.Graphics();
    previewBg.rect(0, 0, previewWidth, previewHeight);
    previewBg.fill(0xF5F5F5);
    previewBg.stroke({ width: 1, color: 0xEEEEEE });
    previewContainer.addChild(previewBg);

    // Mask for content
    const previewMask = new PIXI.Graphics();
    previewMask.rect(0, 0, previewWidth, previewHeight);
    previewMask.fill(0xFFFFFF);
    previewContainer.addChild(previewMask);

    // Render Level Content using callback
    const levelContent = this.getThumbnail(previewWidth, previewHeight);
    levelContent.mask = previewMask;
    previewContainer.addChild(levelContent);

    card.addChild(previewContainer);

    // 3.5 Level Stats (Below Preview)
    const statsContainer = new PIXI.Container();
    statsContainer.position.set(padding, padding + previewHeight + scale(15));
    card.addChild(statsContainer);

    const dateStr = this.levelData.createdAt
      ? new Date(this.levelData.createdAt).toLocaleDateString()
      : '-';

    const attempts = this.levelData.attempts ?? 0;
    const clears = this.levelData.clears ?? 0;

    const statLabelStyle = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: scale(16),
      fill: '#888888',
    });

    const statValueStyle = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: scale(16),
      fontWeight: 'bold',
      fill: '#555555',
    });

    // Row 1: Date
    const labelText = this.levelData.isPublished ? 'Published: ' : 'Created: ';
    const dateLabel = new PIXI.Text({ text: labelText, style: statLabelStyle });
    const dateValue = new PIXI.Text({ text: dateStr, style: statValueStyle });
    dateValue.x = dateLabel.width;

    const dateRow = new PIXI.Container();
    dateRow.addChild(dateLabel, dateValue);
    statsContainer.addChild(dateRow);

    // Row 2: Attempts & Clears

    // Attempts
    const attemptsLabel = new PIXI.Text({ text: 'Attempts: ', style: statLabelStyle });
    const attemptsValue = new PIXI.Text({ text: attempts.toString(), style: statValueStyle });
    attemptsValue.x = attemptsLabel.width;

    const attemptsContainer = new PIXI.Container();
    attemptsContainer.addChild(attemptsLabel, attemptsValue);
    attemptsContainer.position.set(scale(180), 0);
    statsContainer.addChild(attemptsContainer);

    // Clears
    const percentage = attempts > 0 ? Math.round((clears / attempts) * 100) : 0;
    const clearsText = `${clears} (${percentage}%)`;

    const clearsLabel = new PIXI.Text({ text: 'Clears: ', style: statLabelStyle });
    const clearsValue = new PIXI.Text({ text: clearsText, style: statValueStyle });
    clearsValue.x = clearsLabel.width;

    const clearsContainer = new PIXI.Container();
    clearsContainer.addChild(clearsLabel, clearsValue);
    clearsContainer.position.set(scale(310), 0);
    statsContainer.addChild(clearsContainer);

    // 4. Right Side Info Panel
    const rightPanelX = padding + previewWidth + scale(20);
    const rightPanelWidth = cardWidth - rightPanelX - padding;

    const rightPanel = new PIXI.Container();
    rightPanel.position.set(rightPanelX, padding);
    card.addChild(rightPanel);

    // --- Author Info (Right Panel Content) ---
    const avatarRadius = scale(60);
    const centerX = rightPanelWidth / 2;
    const topMargin = 0;

    // Avatar
    const avatar = new PIXI.Container();
    avatar.position.set(centerX, topMargin + avatarRadius);
    rightPanel.addChild(avatar);

    let profileColor = this.userColor;
    let profileUrl: string | undefined;

    if (this.levelData.authorId === CURRENT_USER_ID) {
      const profile = MockLevelService.getInstance().getUserProfile();
      profileColor = profile.avatarColor;
      profileUrl = profile.avatarUrl;
    }

    if (profileUrl) {
      PIXI.Assets.load(profileUrl).then((texture) => {
        if (avatar.destroyed) return;
        const sprite = new PIXI.Sprite(texture);
        const aspect = sprite.width / sprite.height;
        if (aspect > 1) {
          sprite.height = avatarRadius * 2;
          sprite.width = sprite.height * aspect;
        } else {
          sprite.width = avatarRadius * 2;
          sprite.height = sprite.width / aspect;
        }
        sprite.anchor.set(0.5);

        const mask = new PIXI.Graphics();
        mask.circle(0, 0, avatarRadius);
        mask.fill(0xFFFFFF);
        sprite.mask = mask;

        avatar.addChild(mask);
        avatar.addChild(sprite);
      });
    }

    const baseCircle = new PIXI.Graphics();
    baseCircle.circle(0, 0, avatarRadius);
    // If we have an avatar URL, use white background to support transparency
    if (profileUrl) {
      baseCircle.fill(0xFFFFFF);
    } else {
      baseCircle.fill(profileColor);
    }
    baseCircle.stroke({ width: scale(4), color: 0xE0E0E0 });
    avatar.addChildAt(baseCircle, 0);

    // Name
    // Name
    const nameStyle = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: scale(26),
      fontWeight: 'bold',
      fill: '#555555',
      align: 'center',
    });

    let nameString = this.levelData.author || 'Unknown';
    const maxNameWidth = rightPanelWidth - scale(20);

    const measureText = new PIXI.Text({ text: nameString, style: nameStyle });
    if (measureText.width > maxNameWidth) {
      let tempStr = nameString;
      while (tempStr.length > 0) {
        tempStr = tempStr.slice(0, -1);
        measureText.text = tempStr + '...';
        if (measureText.width <= maxNameWidth) {
          nameString = tempStr + '...';
          break;
        }
      }
    }
    measureText.destroy();

    const nameText = new PIXI.Text({
      text: nameString,
      style: nameStyle
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(centerX, topMargin + (avatarRadius * 2) + scale(10));
    rightPanel.addChild(nameText);

    // Stats (Below Name)
    const statsText = new PIXI.Text({
      text: 'Total Levels: 42', // Mock
      style: {
        fontFamily: 'Arial',
        fontSize: scale(16),
        fill: '#AAAAAA',
        align: 'center'
      }
    });
    statsText.anchor.set(0.5, 0);
    statsText.position.set(centerX, nameText.y + nameText.height + scale(4));
    rightPanel.addChild(statsText);

    // --- Actions (Bottom of Right Panel) ---
    // Actions should align with the bottom of the visible area
    const bottomY = previewHeight + statsHeight;

    const gap = scale(15);
    const btnWidth = (rightPanelWidth - gap) / 2;

    // View Levels Button OR Delete Button (Bottom Right of Panel)
    if (this.levelData.authorId === CURRENT_USER_ID && this.allowDelete) {
      // Only show Delete if it is my level AND we are in "Mine" mode (allowDelete=true)
      const deleteBtn = this.createDeleteButton(btnWidth);
      deleteBtn.position.set(rightPanelWidth, bottomY - scale(36));
      rightPanel.addChild(deleteBtn);
    } else {
      // Show View Levels Button (Default for others, or for Me in Latest/Popular view)
      const viewBtn = this.createViewLevelsButton(btnWidth);
      viewBtn.position.set(rightPanelWidth, bottomY - scale(36));
      rightPanel.addChild(viewBtn);
    }

    // Like Button (Bottom Left of Panel)
    const likeBtn = this.createLikeButton(this.levelData.likes || 0, btnWidth);
    // Helper draws `roundRect(0, 0, w, h)`, so origin is Top-Left.
    likeBtn.position.set(0, bottomY - scale(36));
    rightPanel.addChild(likeBtn);


    // Close Button (Top Right of Card)
    const closeBtn = new PIXI.Container();
    const closeSize = scale(40);

    // Hit Area
    const closeHit = new PIXI.Graphics();
    closeHit.rect(0, 0, closeSize, closeSize);
    closeHit.fill({ color: 0xFFFFFF, alpha: 0.001 });
    closeBtn.addChild(closeHit);

    const closeX = new PIXI.Text({
      text: '×',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(32),
        fill: '#AAAAAA'
      }
    });
    closeX.anchor.set(0.5);
    closeX.position.set(closeSize / 2, closeSize / 2);
    closeBtn.addChild(closeX);

    closeBtn.position.set(cardWidth - closeSize - scale(5), scale(5));
    closeBtn.eventMode = 'static';
    closeBtn.cursor = 'pointer';
    closeBtn.on('pointertap', () => this.onCloseCallback());

    card.addChild(closeBtn);
  }

  private createLikeButton(initialLikes: number, width: number): PIXI.Container {
    const container = new PIXI.Container();

    // Button styling
    const w = width;
    const h = scale(36);
    const r = h / 2;

    const bg = new PIXI.Graphics();
    // Default: Outline
    bg.roundRect(0, 0, w, h, r);
    bg.stroke({ width: 2, color: 0xFF6B6B });
    bg.fill({ color: 0xFFFFFF });
    container.addChild(bg);

    // Icon (Thumbs Up)
    const icon = new PIXI.Text({
      text: '\uF406', // hand-thumbs-up-fill
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(16),
        fill: '#FF6B6B',
        padding: scale(5)
      }
    });
    icon.anchor.set(0.5);
    container.addChild(icon);

    // Count
    let count = initialLikes;
    const countText = new PIXI.Text({
      text: count.toString(),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(18),
        fill: '#FF6B6B',
        fontWeight: 'bold'
      }
    });
    countText.anchor.set(0, 0.5);
    container.addChild(countText);

    const updateLayout = () => {
      const spacing = scale(8);
      // Wait for next frame or assume width is available?
      // Text width is usually available immediately after creation in V8 if font loaded.
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

    // Set initial visual state
    updateVisuals();

    container.on('pointertap', () => {
      liked = !liked;

      // Update Data
      this.levelData.isLikedByCurrentUser = liked;
      this.levelData.likes = baseCount + (liked ? 1 : 0);

      if (this.onLikeToggleCallback) this.onLikeToggleCallback();

      // Update UI
      updateVisuals();
    });

    return container;
  }

  private createViewLevelsButton(width: number): PIXI.Container {
    const w = width;
    const h = scale(36);
    const container = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.roundRect(-w, 0, w, h, h / 2); // Draw from -w to 0 to align right
    bg.fill(0x37A4E9); // Blue
    container.addChild(bg);

    const text = new PIXI.Text({
      text: 'View Levels',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: '#FFFFFF',
        fontWeight: 'bold'
      }
    });
    text.anchor.set(0.5);
    text.position.set(-w / 2, h / 2);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => {
      if (this.levelData.authorId) {
        this.onViewLevelsCallback(this.levelData.authorId);
      }
    });

    return container;
  }

  private createDeleteButton(width: number): PIXI.Container {
    const w = width;
    const h = scale(36);
    const container = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.roundRect(-w, 0, w, h, h / 2);
    bg.stroke({ width: 1, color: 0xFF6B6B }); // Red outline
    bg.fill(0xFFFFFF);
    container.addChild(bg);

    const text = new PIXI.Text({
      text: 'Delete',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: '#FF6B6B',
        fontWeight: 'bold'
      }
    });
    text.anchor.set(0.5);
    text.position.set(-w / 2, h / 2);
    container.addChild(text);

    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointertap', () => {
      if (this.onDeleteCallback) {
        const dialog = new ConfirmDialog(
          'Are you sure you want to delete this level?\nThis cannot be undone.',
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
            confirmText: 'Delete',
            cancelText: 'Cancel'
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
