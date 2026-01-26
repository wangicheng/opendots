
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale, DESIGN_WIDTH, DESIGN_HEIGHT } from '../config';
import type { LevelData } from '../levels/LevelSchema';
import { Ball } from '../objects/Ball';
import { Obstacle } from '../objects/Obstacle';
import { FallingObject } from '../objects/FallingObject';
import { Net } from '../objects/Net';
import { IceBlock } from '../objects/IceBlock';
import { Laser } from '../objects/Laser';
import { Seesaw } from '../objects/Seesaw';
import { ConveyorBelt } from '../objects/ConveyorBelt';
import { Button } from '../objects/Button';
import { PenSelectionUI } from './PenSelectionUI';
import { SettingsUI } from './SettingsUI';
import { type Pen } from '../data/PenData';
import { UserProfileCard } from './modals/UserProfileCard';
import { LevelService } from '../services/LevelService';
import { UIFactory } from './UIFactory';
import { LanguageManager, type TranslationKey } from '../i18n/LanguageManager';

export class LevelSelectionUI extends PIXI.Container {
  private levels: LevelData[];
  private onSelect: (level: LevelData) => void;
  private onCreate: () => void;
  private currentPage: number = 0;
  private totalPages: number = 0;
  private laserTexture?: PIXI.Texture;
  private gridContainer: PIXI.Container;
  private headerContainer: PIXI.Container;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartPageX: number = 0;
  private dragDistance: number = 0; // Cumulative or max displacement to distinguish tap from swipe
  private scrollTweenId: number = 0;

  private penSelectionUI: PenSelectionUI | null = null;
  private settingsUI: SettingsUI | null = null;
  private userProfileCard: UserProfileCard | null = null;
  private onPenSelect?: (pen: Pen) => void;
  private currentPenId: string = 'pen_default';

  // Sorting and Filtering
  // Sorting and Filtering
  private sortMode: 'latest' | 'popular' = 'latest';
  private filterAuthorId: string | null = null;
  private visibleLevels: LevelData[] = [];
  private filterAuthorName: string | null = null;
  private filterAuthorColor: number = 0x888888;

  // UI Elements
  private latestBtnText?: PIXI.Text;
  private popularBtnText?: PIXI.Text;
  private mineBtnText?: PIXI.Text;

  private filterFilterTagContainer?: PIXI.Container;
  private createLevelBtn?: PIXI.Container;

  // Constants for Layout (as ratios of canvas height)
  private readonly HEADER_HEIGHT_RATIO = 1 / 5;
  private readonly COLS = 3;
  private readonly ROWS = 2;
  private readonly ITEMS_PER_PAGE = 6;
  private readonly CARD_ASPECT_RATIO = 16 / 9;

  // Cached layout values
  private backgroundHitArea: PIXI.Graphics | null = null;

  constructor(
    levels: LevelData[],
    onSelect: (level: LevelData) => void,
    onCreate: () => void,
    laserTexture?: PIXI.Texture,
    onPenSelect?: (pen: Pen) => void,
    initialPenId?: string
  ) {
    super();
    this.levels = levels;
    this.onSelect = onSelect;
    this.onCreate = onCreate;
    this.laserTexture = laserTexture;
    this.onPenSelect = onPenSelect;
    if (initialPenId) this.currentPenId = initialPenId;
    this.totalPages = Math.ceil(levels.length / this.ITEMS_PER_PAGE);

    // Create Main Containers
    this.headerContainer = new PIXI.Container();
    this.gridContainer = new PIXI.Container();

    this.addChild(this.gridContainer);
    this.addChild(this.headerContainer);

    this.setupHeader();

    // Initial sort/filter and grid setup
    this.refreshVisibleLevels();

    this.setupInteraction();

    // Listen for language changes
    LanguageManager.getInstance().subscribe(() => {
      this.headerContainer.removeChildren();
      this.setupHeader();
      this.setupGrid();
    });

    // Listen for Profile/Auth changes
    LevelService.getInstance().subscribe(this.handleProfileUpdate);
  }

  private handleProfileUpdate = (): void => {
    // 1. Update Header (Mine button, Create Level button)
    this.updateSortButtons();

    // 2. Refresh Levels (re-render cards with avatars)
    this.refreshVisibleLevels();
  };

  private setupHeader(): void {
    const t = (key: TranslationKey) => LanguageManager.getInstance().t(key);
    const canvasWidth = getCanvasWidth();
    const headerHeight = this.getHeaderHeight();

    // 2. Branding (Left)
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'Arial',
      fontSize: scale(60),
      fontWeight: 'bold',
      fill: '#555555',
    });
    const title = new PIXI.Text({ text: t('app.title'), style: titleStyle });
    title.position.set(scale(60), (headerHeight - title.height) / 2);
    this.headerContainer.addChild(title);

    // 2.5 Sorting / Filtering UI (Center-Right)
    const sortY = (headerHeight + scale(10)) / 2;

    // Create buttons first to measure them
    // "Latest" Button
    this.latestBtnText = this.createSortButton(t('sort.latest'), 0, sortY, 'latest');
    this.headerContainer.addChild(this.latestBtnText);

    // "Popular" Button
    this.popularBtnText = this.createSortButton(t('sort.popular'), 0, sortY, 'popular');
    this.headerContainer.addChild(this.popularBtnText);

    // "Mine" Button
    this.mineBtnText = this.createHeaderInteractiveText(t('sort.mine'), 0, sortY, () => {
      const currentUserId = LevelService.getInstance().getUserProfile()?.id;
      if (!currentUserId) return; // Should not happen if button is hidden/disabled, or handle gracefully

      if (this.filterAuthorId === currentUserId) {
        this.setFilterAuthor(null);
      } else {
        this.setFilterAuthor(currentUserId);
      }
    });
    this.headerContainer.addChild(this.mineBtnText);

    // Dynamic Layout Calculation
    const gap = scale(40);
    const totalWidth = this.latestBtnText.width + gap + this.popularBtnText.width + gap + this.mineBtnText.width;
    const startX = (canvasWidth - totalWidth) / 2;

    this.latestBtnText.x = startX;
    this.popularBtnText.x = startX + this.latestBtnText.width + gap;
    this.mineBtnText.x = startX + this.latestBtnText.width + gap + this.popularBtnText.width + gap;

    // Filter Tag Component (Initially hidden/empty)
    this.filterFilterTagContainer = new PIXI.Container();
    // Position will be set in updateFilterTag or updateLayout, but let's init it here relative to sort buttons or right aligned
    // Filter Tag Component (Initially hidden/empty)
    this.filterFilterTagContainer = new PIXI.Container();
    this.headerContainer.addChild(this.filterFilterTagContainer);
    this.updateFilterTag();



    // 3. Action Area (Right)
    const btnY = scale(36);
    const btnSize = scale(52);
    const btnSpacing = scale(20);

    // List Icon (Rightmost)
    const listBtn = this.createHeaderButton('\uF479');
    const listX = canvasWidth - scale(20) - btnSize;
    listBtn.position.set(listX, btnY);
    listBtn.on('pointertap', () => this.showSettings());
    this.headerContainer.addChild(listBtn);

    // Pen Icon (Left of List)
    const penBtn = this.createHeaderButton('\uF604');
    const penX = listX - btnSpacing - btnSize;
    penBtn.position.set(penX, btnY);
    penBtn.on('pointertap', () => this.showPenSelection());
    this.headerContainer.addChild(penBtn);

    // 4. Floating Action Button (Create Level) - Bottom Right
    this.createLevelBtn = this.createFloatingActionButton();
    this.createLevelBtn.visible = false;
    this.addChild(this.createLevelBtn);

    this.updateSortButtons();
  }

  /**
   * Get current header height based on canvas size
   */
  private getHeaderHeight(): number {
    return getCanvasHeight() * this.HEADER_HEIGHT_RATIO;
  }

  private createFloatingActionButton(): PIXI.Container {
    const size = scale(64);
    const container = new PIXI.Container();

    // Button Circle
    const circle = new PIXI.Graphics();
    circle.circle(0, 0, size / 2);
    circle.fill(0x555555);
    container.addChild(circle);

    // Plus Icon
    const plus = new PIXI.Text({
      text: '+',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(40),
        fill: '#FFFFFF',
        fontWeight: 'bold'
      }
    });
    plus.anchor.set(0.5);
    plus.position.set(0, 0);
    container.addChild(plus);

    // Position (Bottom Right, with padding)
    container.position.set(getCanvasWidth() - scale(50), getCanvasHeight() - scale(50));

    // Interaction
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => {
      console.log('Create Level Attempt');
      this.onCreate();
    });

    return container;
  }

  private createSortButton(text: string, x: number, y: number, mode: 'latest' | 'popular'): PIXI.Text {
    return this.createHeaderInteractiveText(text, x, y, () => {
      this.setSortMode(mode);
    });
  }

  private createHeaderInteractiveText(text: string, x: number, y: number, onClick: () => void): PIXI.Text {
    const btn = new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(24),
        fill: '#AAAAAA',
        fontWeight: 'normal'
      }
    });
    btn.anchor.set(0, 0.5);
    btn.position.set(x, y);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', onClick);
    return btn;
  }

  private updateSortButtons(): void {
    const currentUserId = LevelService.getInstance().getUserProfile()?.id;
    const isMine = this.filterAuthorId === currentUserId && !!currentUserId;

    if (this.latestBtnText) {
      const isSelected = this.sortMode === 'latest' && !isMine;
      this.latestBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.latestBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }
    if (this.popularBtnText) {
      const isSelected = this.sortMode === 'popular' && !isMine;
      this.popularBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.popularBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }
    if (this.mineBtnText) {
      // Mine is selected solely based on the filter
      const isSelected = isMine;
      this.mineBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.mineBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }

    // Toggle FAB visibility based on "Mine" filter or just Logged In status?
    // Requirement: "Login to add". So show FAB only if Logged In? 
    // And ideally only if "Mine" is selected? Or always allow adding?
    // Usually "Create" is available always if logged in.
    if (this.createLevelBtn) {
      this.createLevelBtn.visible = !!currentUserId;
    }
  }

  private createHeaderButton(iconChar: string): PIXI.Container {
    const size = scale(52);
    const container = new PIXI.Container();

    // Invisible Hit Area
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 0, size, size);
    hitArea.fill({ color: 0xFFFFFF, alpha: 0.001 });
    container.addChild(hitArea);

    // Icon Text
    // Icon Text
    const text = UIFactory.createIcon(iconChar, scale(60), '#555555');
    text.style.stroke = { color: '#555555', width: 0.5 };

    // Position
    text.position.set(size / 2, size / 2 + scale(2)); // Added nudge
    container.addChild(text);

    // Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';

    return container;
  }

  private setupGrid(): void {
    // Clear existing grid children first (for re-render)
    this.gridContainer.removeChildren();
    const canvasWidth = getCanvasWidth();

    // Render all pages horizontally
    for (let p = 0; p < this.totalPages; p++) {
      const pageContainer = new PIXI.Container();
      pageContainer.x = p * canvasWidth;
      this.gridContainer.addChild(pageContainer);

      const startIndex = p * this.ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + this.ITEMS_PER_PAGE, this.visibleLevels.length);

      this.renderPage(pageContainer, startIndex, endIndex);
    }
  }

  private renderPage(container: PIXI.Container, startIndex: number, endIndex: number): void {
    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();
    const headerHeight = this.getHeaderHeight();
    const areaWidth = canvasWidth;
    const areaHeight = canvasHeight - headerHeight;

    const maxCardWidth = (areaWidth * 0.7) / this.COLS;
    const cardWidth = Math.floor(maxCardWidth);
    const cardHeight = Math.floor(cardWidth / this.CARD_ASPECT_RATIO);

    const hGap = (areaWidth - (cardWidth * this.COLS)) / (this.COLS + 1);
    const vGap = (areaHeight - (cardHeight * this.ROWS)) / (this.ROWS + 1);

    const startY = headerHeight + vGap;

    for (let i = startIndex; i < endIndex; i++) {
      const localIndex = i - startIndex;
      const row = Math.floor(localIndex / this.COLS);
      const col = localIndex % this.COLS;

      const x = hGap + col * (cardWidth + hGap);
      const y = startY + row * (cardHeight + vGap);

      const card = this.createLevelCard(i, this.visibleLevels[i], cardWidth, cardHeight);
      card.position.set(x, y);
      container.addChild(card);
    }
  }

  private createLevelCard(_index: number, levelData: LevelData, width: number, height: number): PIXI.Container {
    const container = new PIXI.Container();

    // 1. Shadow (Rect with Blur)
    const shadow = UIFactory.createShadow(width, height, 0, 8, 0.3);
    container.addChild(shadow);

    // 2. Card Body
    const bg = UIFactory.createCardBackground(width, height, 0xFFFFFF);
    container.addChild(bg);

    // 3. Viewport (Masked Area)
    // Thumbnail Layer
    const thumbnail = this.createLevelThumbnail(levelData, width, height);

    // Mask for thumbnail
    const mask = new PIXI.Graphics();
    mask.rect(0, 0, width, height);
    mask.fill(0xFFFFFF);
    thumbnail.mask = mask;
    container.addChild(mask);
    container.addChild(thumbnail);

    // Designer Avatar rendering moved to the end to ensure it's on top of any status overlay

    // 4.5 Published/Draft Status Overlay
    const currentUserId = LevelService.getInstance().getUserProfile()?.id;
    if (currentUserId && levelData.authorId === currentUserId && levelData.isPublished === false) {
      // 1. Dark Mask (Always for unpublished)
      const darkOverlay = new PIXI.Graphics();
      darkOverlay.rect(0, 0, width, height);
      darkOverlay.fill({ color: 0x000000, alpha: 0.2 });
      container.addChild(darkOverlay);

      // 2. Status Tag (Top Left) - Visual difference
      const tagContainer = new PIXI.Container();
      const tagBg = new PIXI.Graphics();

      let labelText = '';
      let labelColor = 0x000000;
      let textColor = '#FFFFFF';

      if (levelData.authorPassed) {
        labelText = LanguageManager.getInstance().t('status.draft');
        labelColor = 0x888888; // Medium Gray for "Ready but not public"
        textColor = '#FFFFFF';
      } else {
        labelText = LanguageManager.getInstance().t('status.untested');
        labelColor = 0xEEEEEE; // Very Light Gray for "Not passed"
        textColor = '#888888'; // Gray text
      }


      const tagH = scale(24);
      const tagRadius = scale(12);
      const tagPadding = scale(20);

      const tagText = new PIXI.Text({
        text: labelText,
        style: {
          fontFamily: 'Arial',
          fontSize: scale(12),
          fill: textColor,
          fontWeight: 'bold'
        }
      });
      // Measure dynamic width
      const tagW = Math.max(scale(60), tagText.width + tagPadding);

      tagBg.roundRect(0, 0, tagW, tagH, tagRadius);
      tagBg.fill(labelColor);

      tagText.anchor.set(0.5);
      tagText.position.set(tagW / 2, tagH / 2); // Center of bg

      tagContainer.addChild(tagBg);
      tagContainer.addChild(tagText);
      tagContainer.position.set(scale(10), scale(10));

      container.addChild(tagContainer);
    } else {
      // Published Level - Show Likes (Top Left)
      const likesCount = levelData.likes || 0;

      const likesContainer = new PIXI.Container();

      // Calculate width first
      const numText = new PIXI.Text({
        text: likesCount.toString(),
        style: {
          fontFamily: 'Arial',
          fontSize: scale(12),
          fill: '#FFFFFF',
          fontWeight: 'bold'
        }
      });

      const padding = scale(10);
      const iconSize = scale(14);
      const gap = scale(4);
      const totalWidth = padding + iconSize + gap + numText.width + padding;
      const pillHeight = scale(24);
      const pillRadius = scale(12);

      // Background pill (semitransparent black)
      const bg = new PIXI.Graphics();
      bg.roundRect(0, 0, totalWidth, pillHeight, pillRadius);
      bg.fill({ color: 0x000000, alpha: 0.4 });
      likesContainer.addChild(bg);

      // Likes Icon (Thumb Up)
      const thumbIcon = UIFactory.createIcon('\uF406', iconSize, '#FFFFFF');
      thumbIcon.position.set(padding + iconSize / 2, pillHeight / 2 + scale(2)); // Nudged
      likesContainer.addChild(thumbIcon);

      // Likes Number
      numText.anchor.set(0, 0.5); // Left align
      numText.position.set(padding + iconSize + gap, pillHeight / 2);
      likesContainer.addChild(numText);

      likesContainer.position.set(scale(12), scale(12));
      container.addChild(likesContainer);
    }

    // Designer Avatar (Bottom Right)
    // Always show an avatar to allow access to User Profile Card (Delete/Like)
    // Placed HERE (end of function) to ensure it is above the dark overlay for unpublished levels

    // Mocking a user avatar with a colored circle
    const avatarRadius = scale(25);
    // Hash authorId to get consistent color
    const colors = [0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0xFFBE76, 0xFF7979, 0xBADC58];
    const authorKey = levelData.authorId || levelData.author || 'unknown';
    let hash = 0;
    for (let i = 0; i < authorKey.length; i++) {
      hash = authorKey.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    let color = colors[colorIndex]; // Default color

    // Check if it's CURRENT USER and use their profile
    let profileUrl: string | undefined;
    if (currentUserId && levelData.authorId === currentUserId) {
      const profile = LevelService.getInstance().getUserProfile();
      if (profile) {
        color = profile.avatarColor; // Override color
        profileUrl = profile.avatarUrl;
      }
    }

    // Use UIFactory to create avatar
    const avatar = UIFactory.createAvatar(avatarRadius, profileUrl, color, 0xFFFFFF); // White border

    // Position to slightly protrude from the corner (center closer to the corner)
    avatar.position.set(width - scale(4), height - scale(4));

    // Interaction for avatar
    avatar.eventMode = 'static';
    avatar.cursor = 'pointer';
    avatar.on('pointertap', (e) => {
      e.stopPropagation();
      this.showUserProfile(levelData, color);
    });

    container.addChild(avatar);

    container.addChild(avatar);


    // 6. Interaction
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => {
      // Use a small threshold (e.g., 10px) to distinguish a legitimate tap from a swipe
      if (this.dragDistance < 10) {
        // Use visibleLevels!
        this.onSelect(levelData);
      }
    });

    return container;
  }

  private createLevelThumbnail(levelData: LevelData, width: number, height: number): PIXI.Container {
    const container = new PIXI.Container();

    // Scale Factor - use DESIGN dimensions for consistent level layout
    const thumbnailScale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
    container.scale.set(thumbnailScale);

    // Card background is white, so we don't need to clear.

    // 1. Obstacles
    if (levelData.obstacles) {
      levelData.obstacles.forEach(config => container.addChild(Obstacle.createVisual(config)));
    }

    // 2. Falling Objects
    if (levelData.fallingObjects) {
      levelData.fallingObjects.forEach(config => container.addChild(FallingObject.createVisual(config)));
    }

    // 3. Nets
    if (levelData.nets) {
      levelData.nets.forEach(config => container.addChild(Net.createVisual(config)));
    }

    // 4. Ice Blocks
    if (levelData.iceBlocks) {
      levelData.iceBlocks.forEach(config => container.addChild(IceBlock.createVisual(config)));
    }

    // 5. Lasers
    if (levelData.lasers && this.laserTexture) {
      levelData.lasers.forEach(config => container.addChild(Laser.createVisual(config, this.laserTexture!, 14)));
    }

    // 6. Seesaws
    if (levelData.seesaws) {
      levelData.seesaws.forEach(config => container.addChild(Seesaw.createVisual(config)));
    }

    // 7. Conveyor Belts
    if (levelData.conveyors) {
      levelData.conveyors.forEach(config => container.addChild(ConveyorBelt.createVisual(config)));
    }

    // 8. Buttons
    if (levelData.buttons) {
      levelData.buttons.forEach(config => container.addChild(Button.createVisual(config)));
    }

    // 9. Balls
    if (levelData.balls) {
      const blue = Ball.createVisual(levelData.balls.blue.x, levelData.balls.blue.y, 'blue');
      const pink = Ball.createVisual(levelData.balls.pink.x, levelData.balls.pink.y, 'pink');
      container.addChild(blue);
      container.addChild(pink);
    }

    return container;
  }

  private setupInteraction(): void {
    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();
    const headerHeight = this.getHeaderHeight();

    // Swipe Logic on the Grid Container or Main Container
    this.backgroundHitArea = new PIXI.Graphics();
    this.backgroundHitArea.rect(0, headerHeight, canvasWidth, canvasHeight - headerHeight);
    this.backgroundHitArea.fill({ color: 0x000000, alpha: 0 });
    this.addChildAt(this.backgroundHitArea, 0);

    this.eventMode = 'static';

    this.on('pointerdown', (e) => {
      if (this.penSelectionUI || this.userProfileCard || this.settingsUI) return;

      // Prevent dragging if clicking in header area
      const headerHeight = this.getHeaderHeight();
      const localY = this.toLocal(e.global).y;
      if (localY < headerHeight) return;

      this.isDragging = true;
      this.dragStartX = e.global.x;
      this.dragDistance = 0;
      this.dragStartPageX = this.gridContainer.x;
    });

    this.on('pointermove', (e) => {
      if (!this.isDragging) return;
      const currentX = e.global.x;
      const diff = currentX - this.dragStartX;

      this.dragDistance = Math.max(this.dragDistance, Math.abs(diff));
      this.gridContainer.x = this.dragStartPageX + diff;
    });

    this.on('pointerup', (e) => this.endDrag(e));
    this.on('pointerupoutside', (e) => this.endDrag(e));
  }

  private endDrag(e: PIXI.FederatedPointerEvent): void {
    if (!this.isDragging) return;
    this.isDragging = false;

    const currentX = e.global.x;
    const diff = currentX - this.dragStartX;

    // Determine swipe
    if (Math.abs(diff) > 50) {
      if (diff > 0 && this.currentPage > 0) {
        this.currentPage--;
      } else if (diff < 0 && this.currentPage < this.totalPages - 1) {
        this.currentPage++;
      }
    }

    // Snap to page
    this.scrollToPage(this.currentPage);
  }

  private scrollToPage(pageIndex: number): void {
    const canvasWidth = getCanvasWidth();
    const targetX = -pageIndex * canvasWidth;

    // Simple tween
    // Since we don't have a tween engine installed (probably), let's just slide using a ticker or CSS-like transition?
    // Pixi doesn't have built-in tween. 
    // Simple tween
    // Pixi doesn't have built-in tween. 
    // Snapping is acceptable for MVP, smooth slide is better.

    // Manual rudimentary tween
    const startX = this.gridContainer.x;
    const distance = targetX - startX;
    const duration = 0.3; // seconds
    const startTime = Date.now();
    const myTweenId = ++this.scrollTweenId;

    const animate = () => {
      if (this.scrollTweenId !== myTweenId) return;

      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - progress, 3); // Cubic out

      this.gridContainer.x = startX + (distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    animate();
  }

  private showPenSelection(): void {
    if (this.penSelectionUI) {
      this.removeChild(this.penSelectionUI);
      this.penSelectionUI.destroy();
      this.penSelectionUI = null;
    }

    this.penSelectionUI = new PenSelectionUI(
      (pen) => {
        if (this.onPenSelect) this.onPenSelect(pen);
        this.currentPenId = pen.id;
        this.closePenSelection();
      },
      () => this.closePenSelection(),
      this.currentPenId
    );

    this.penSelectionUI.zIndex = 1000;
    this.addChild(this.penSelectionUI);
  }

  private closePenSelection(): void {
    if (this.penSelectionUI) {
      this.removeChild(this.penSelectionUI);
      this.penSelectionUI.destroy();
      this.penSelectionUI = null;
    }
  }

  private showSettings(): void {
    if (this.settingsUI) {
      this.removeChild(this.settingsUI);
      this.settingsUI.destroy();
      this.settingsUI = null;
    }

    this.settingsUI = new SettingsUI(() => this.closeSettings());
    this.settingsUI.zIndex = 2000;

    this.addChild(this.settingsUI);
  }

  private closeSettings(): void {
    if (this.settingsUI) {
      this.removeChild(this.settingsUI);
      this.settingsUI.destroy();
      this.settingsUI = null;

      // Refresh to update avatar and name
      LevelService.getInstance().getLevelList().then(levels => {
        this.levels = levels;
        this.refreshVisibleLevels();
      });
    }
  }

  private showUserProfile(levelData: LevelData, color: number): void {
    if (this.userProfileCard) {
      this.removeChild(this.userProfileCard);
      this.userProfileCard.destroy();
      this.userProfileCard = null;
    }

    // Count levels by this author
    const authorLevelCount = this.levels.filter(
      l => l.authorId === levelData.authorId && l.isPublished
    ).length;

    this.userProfileCard = new UserProfileCard(levelData, color,
      (w, h) => this.createLevelThumbnail(levelData, w, h),
      () => this.closeUserProfile(),
      (id) => {
        this.closeUserProfile();
        this.setFilterAuthor(id, levelData.author || '', color);
      },
      () => {
        LevelService.getInstance().toggleLike(levelData.id);
        this.setupGrid();
      },
      (levelId) => {
        LevelService.getInstance().deleteLevel(levelId);
        this.closeUserProfile();
        // Remove locally to update UI immediately without re-fetching
        this.levels = this.levels.filter(l => l.id !== levelId);
        this.refreshVisibleLevels();
      },
      LevelService.getInstance().getUserProfile()?.id === levelData.authorId, // allowDelete
      authorLevelCount
    );
    this.addChild(this.userProfileCard);
  }

  private closeUserProfile(): void {
    if (this.userProfileCard) {
      this.removeChild(this.userProfileCard);
      this.userProfileCard.destroy();
      this.userProfileCard = null;
    }
  }

  public setPen(penId: string): void {
    this.currentPenId = penId;
  }

  // --- Logic for Sorting and Filtering ---

  private setSortMode(mode: 'latest' | 'popular'): void {
    const currentUserId = LevelService.getInstance().getUserProfile()?.id;
    // If currently in "Mine" mode, clicking a sort button should exit "Mine" mode (Tab switching behavior)
    if (this.filterAuthorId && this.filterAuthorId === currentUserId) {
      this.setFilterAuthor(null);
      // We continue to set the sort mode below, so it becomes "Global + [Mode]"
    }

    if (this.sortMode === mode && this.filterAuthorId === null) {
      // 如果已經在該模式，且是全域檢視，但不在第一頁，則回到第一頁
      if (this.currentPage !== 0) {
        this.currentPage = 0;
        this.scrollToPage(0);
      }
      return;
    }
    this.sortMode = mode;
    this.updateSortButtons();
    // Maintain current filter (unless we just cleared Mine above)
    this.refreshVisibleLevels();
  }

  private setFilterAuthor(authorId: string | null, authorName?: string, authorColor?: number): void {
    if (this.filterAuthorId === authorId) return;
    this.filterAuthorId = authorId;

    if (authorId) {
      this.filterAuthorName = authorName || `User ${authorId.slice(0, 4)}`;
      this.filterAuthorColor = authorColor || 0x888888;

      const currentUserId = LevelService.getInstance().getUserProfile()?.id;
      if (currentUserId && authorId === currentUserId) {
        this.sortMode = 'latest';
      }
    } else {
      this.filterAuthorName = null;
    }

    this.updateSortButtons(); // To update 'Mine' button state
    this.updateFilterTag();
    this.refreshVisibleLevels();
  }

  private updateFilterTag(): void {
    if (!this.filterFilterTagContainer) return;

    this.filterFilterTagContainer.removeChildren();

    const currentUserId = LevelService.getInstance().getUserProfile()?.id;

    // Only show if filtered and NOT filtering by ME
    if (!this.filterAuthorId || (currentUserId && this.filterAuthorId === currentUserId)) {
      this.filterFilterTagContainer.visible = false;
      return;
    }

    this.filterFilterTagContainer.visible = true;

    // --- Configuration ---
    const tagHeight = scale(40); // Slightly taller for better touch target
    const paddingLeft = scale(6); // Space for avatar
    const paddingRight = scale(12); // Space after x
    const gap = scale(8); // Gap between elements
    const avatarSize = scale(28);
    const fontSize = scale(16);
    const iconSize = scale(14);

    // Theme Colors
    const chipBgColor = 0xFFFFFF;
    const chipBorderColor = 0xE0E0E0;
    const textColor = 0x333333;
    const iconColor = 0x999999;
    const hoverColor = 0xF5F5F5;

    // --- Components ---

    // 1. Container Background (Pill)
    const bg = new PIXI.Graphics();
    // We'll draw it at the end when we know the width

    // 2. Avatar (Left)
    const avatar = new PIXI.Graphics();
    avatar.circle(0, 0, avatarSize / 2);
    avatar.fill(this.filterAuthorColor);
    avatar.position.set(paddingLeft + avatarSize / 2, tagHeight / 2);

    // 3. Name Text
    const nameText = new PIXI.Text({
      text: this.filterAuthorName || 'Unknown',
      style: {
        fontFamily: 'Arial',
        fontSize: fontSize,
        fill: textColor,
        fontWeight: 'bold'
      }
    });
    nameText.anchor.set(0, 0.5);
    nameText.position.set(paddingLeft + avatarSize + gap, tagHeight / 2);

    // 4. Close Icon (Right)
    const closeIcon = new PIXI.Text({
      text: '✕', // Multiplication X or similar
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: iconColor,
        fontWeight: 'bold'
      }
    });
    closeIcon.anchor.set(0.5);
    // Position set after text measurement

    // --- Layout Calculation ---
    const contentWidth = paddingLeft + avatarSize + gap + nameText.width + gap + iconSize + paddingRight;

    // Draw Background
    bg.roundRect(0, 0, contentWidth, tagHeight, tagHeight / 2);
    bg.fill(chipBgColor);
    bg.stroke({ width: 1, color: chipBorderColor }); // Subtle border

    // Position Close Icon
    closeIcon.position.set(contentWidth - paddingRight - iconSize / 2, tagHeight / 2);

    // Assemble
    this.filterFilterTagContainer.addChild(bg);
    this.filterFilterTagContainer.addChild(avatar);
    this.filterFilterTagContainer.addChild(nameText);
    this.filterFilterTagContainer.addChild(closeIcon);

    // --- Positioning the entire Tag ---
    // Place it to the right of the "Mine" button (?) or align Right on screen?
    // Previous logic was right-aligned. Let's keep it right-aligned but with some margin.
    // Ideally, it shouldn't overlap with the "Edit/List" buttons on the far right.
    // The "Edit/List" buttons are at: canvasWidth - scale(20) - btnSize ... roughly canvasWidth - 100
    // "Mine" button is at center + 220. 
    // Let's place this Tag to the LEFT of the "Edit/List" buttons to avoid overlap, 
    // OR center it if there's space.
    // Given the sort buttons take up center space, let's put it to the Right of "Mine".

    // Let's calc "Mine" button position roughly:
    const canvasWidth = getCanvasWidth();
    const headerHeight = getCanvasHeight() * this.HEADER_HEIGHT_RATIO;
    const sortY = (headerHeight + scale(10)) / 2;
    // Let's place it at mineBtnX + mineBtnWidth + spacing
    if (this.mineBtnText) {
      this.filterFilterTagContainer.x = this.mineBtnText.x + this.mineBtnText.width + scale(30);
    } else {
      // Fallback
      const sortX = canvasWidth / 2;
      this.filterFilterTagContainer.x = sortX + scale(200);
    }
    this.filterFilterTagContainer.y = sortY - tagHeight / 2;

    // --- Interaction ---
    this.filterFilterTagContainer.eventMode = 'static';
    this.filterFilterTagContainer.cursor = 'pointer';

    this.filterFilterTagContainer.on('pointerover', () => {
      bg.clear();
      bg.roundRect(0, 0, contentWidth, tagHeight, tagHeight / 2);
      bg.fill(hoverColor);
      bg.stroke({ width: 1, color: chipBorderColor });
    });

    this.filterFilterTagContainer.on('pointerout', () => {
      bg.clear();
      bg.roundRect(0, 0, contentWidth, tagHeight, tagHeight / 2);
      bg.fill(chipBgColor);
      bg.stroke({ width: 1, color: chipBorderColor });
    });

    this.filterFilterTagContainer.on('pointertap', () => {
      this.setFilterAuthor(null);
    });
  }

  private refreshVisibleLevels(): void {
    // 1. Filter
    let list = this.levels;
    const filterId = this.filterAuthorId;

    const currentUserId = LevelService.getInstance().getUserProfile()?.id;

    // Default: Filter out unpublished levels (Drafts)
    // Only show drafts if we are explicitly filtering by CURRENT_USER_ID ("Mine")
    if (currentUserId && filterId === currentUserId) {
      list = list.filter(l => l.authorId === filterId);
    } else if (filterId) {
      // Filtering by another user -> Match author AND must be published
      list = list.filter(l => {
        const isAuthor = l.authorId === filterId || (!l.authorId && filterId.startsWith('mock_user'));
        return isAuthor && l.isPublished !== false;
      });
    } else {
      // Global list (Latest/Popular) -> Must be published
      list = list.filter(l => l.isPublished !== false);
    }

    // 2. Sort
    // Create a shallow copy to sort
    list = [...list];
    if (this.sortMode === 'popular') {
      list.sort((a, b) => (b.likes || 0) - (a.likes || 0));
    } else {
      // Latest (default sort by date)
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }

    this.visibleLevels = list;

    // 3. Reset Pagination
    this.scrollTweenId++; // 取消任何進行中的動畫
    this.currentPage = 0;
    this.totalPages = Math.ceil(this.visibleLevels.length / this.ITEMS_PER_PAGE);
    if (this.totalPages === 0) this.totalPages = 1; // Show at least one empty page if no results

    // 4. Re-render
    this.gridContainer.x = 0;
    this.setupGrid();
  }

  /**
   * Update entire layout on resize
   */
  public updateLayout(): void {
    // 1. Clear Containers
    this.headerContainer.removeChildren();

    // Remove legacy FAB to prevent ghosting
    if (this.createLevelBtn) {
      this.removeChild(this.createLevelBtn);
      this.createLevelBtn.destroy({ children: true });
      this.createLevelBtn = undefined;
    }

    if (this.backgroundHitArea) {
      this.removeChild(this.backgroundHitArea);
      this.backgroundHitArea.destroy();
      this.backgroundHitArea = null;
    }

    // 2. Re-setup
    this.setupHeader();
    this.setupGrid();
    this.setupInteraction();

    // 3. Reset pagination if out of bounds
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }
    this.gridContainer.x = -this.currentPage * getCanvasWidth();

    // 4. Update children if visible
    if (this.penSelectionUI) {
      // PenSelectionUI handles its own layout on resize if we pass it, 
      // but usually we just re-instantiate or it handles it.
      // Let's check PenSelectionUI later.
    }
    if (this.userProfileCard) {
      // similar
    }
  }

  /**
   * Update the level list and refresh the display
   */
  public updateLevels(levels: LevelData[]): void {
    this.levels = levels;
    this.refreshVisibleLevels();
  }

  destroy(options?: any): void {
    LevelService.getInstance().unsubscribe(this.handleProfileUpdate);
    super.destroy(options);
  }
}
