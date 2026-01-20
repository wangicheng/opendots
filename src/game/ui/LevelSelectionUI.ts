
import * as PIXI from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';
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
import { type Pen } from '../data/PenData';
import { UserProfileCard } from './modals/UserProfileCard';
import { CURRENT_USER_ID } from '../services/MockLevelService';

export class LevelSelectionUI extends PIXI.Container {
  private levels: LevelData[];
  private onSelect: (level: LevelData) => void;
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
  private userProfileCard: UserProfileCard | null = null;
  private onPenSelect?: (pen: Pen) => void;
  private currentPenId: string = 'pen_default';

  // Sorting and Filtering
  // Sorting and Filtering
  private sortMode: 'latest' | 'popular' = 'latest';
  private filterAuthorId: string | null = null;
  private visibleLevels: LevelData[] = [];

  // UI Elements
  private latestBtnText?: PIXI.Text;
  private popularBtnText?: PIXI.Text;
  private mineBtnText?: PIXI.Text;

  private filterFilterTagContainer?: PIXI.Container;
  private createLevelBtn?: PIXI.Container;

  // Constants for Layout
  private readonly HEADER_HEIGHT = GAME_HEIGHT / 5;
  private readonly COLS = 3;
  private readonly ROWS = 2;
  private readonly ITEMS_PER_PAGE = 6;
  private readonly CARD_ASPECT_RATIO = 16 / 9;

  constructor(
    levels: LevelData[],
    onSelect: (level: LevelData) => void,
    laserTexture?: PIXI.Texture,
    onPenSelect?: (pen: Pen) => void,
    initialPenId?: string
  ) {
    super();
    this.levels = levels;
    this.onSelect = onSelect;
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
  }

  private setupHeader(): void {
    // 1. Background for Header? (Transparent as per requirement, buttons float)
    // Actually requirement says "Background Layer: Graph Paper Pattern" covers full screen.
    // So Header sits on top.

    // 2. Branding (Left)
    const titleStyle = new PIXI.TextStyle({
      fontFamily: 'Arial', // Or a handwritten font if available
      fontSize: 60,
      fontWeight: 'bold',
      fill: '#555555',
    });
    const title = new PIXI.Text({ text: 'Brain Dots', style: titleStyle });
    title.position.set(60, (this.HEADER_HEIGHT - title.height) / 2); // Vertically centered
    this.headerContainer.addChild(title);

    // 2.5 Sorting / Filtering UI (Center-Right)
    const sortY = (this.HEADER_HEIGHT + 10) / 2;
    // Shift sort buttons left to make room for filter tag
    const sortX = GAME_WIDTH / 2 - 140;

    // "Latest" Button
    this.latestBtnText = this.createSortButton('Latest', sortX, sortY, 'latest');
    this.headerContainer.addChild(this.latestBtnText);

    // "Popular" Button
    this.popularBtnText = this.createSortButton('Popular', sortX + 100, sortY, 'popular');
    this.headerContainer.addChild(this.popularBtnText);

    // "Mine" Button
    this.mineBtnText = this.createHeaderInteractiveText('Mine', sortX + 220, sortY, () => {
      // Toggle "Mine" filter
      if (this.filterAuthorId === CURRENT_USER_ID) {
        this.setFilterAuthor(null);
      } else {
        this.setFilterAuthor(CURRENT_USER_ID);
      }
    });
    this.headerContainer.addChild(this.mineBtnText);

    // Filter Tag Component (Initially hidden/empty)
    this.filterFilterTagContainer = new PIXI.Container();
    // Position closer to the action buttons (Pen is at ~1100)
    this.filterFilterTagContainer.position.set(GAME_WIDTH - 220, sortY);
    this.headerContainer.addChild(this.filterFilterTagContainer);
    // Render initial empty state
    this.updateFilterTag();

    this.updateSortButtons();

    // 3. Action Area (Right)
    const btnY = 36;

    // List Icon (Rightmost, matching Restart button position in Game.ts)
    const listBtn = this.createHeaderButton('\uF479');
    const listX = GAME_WIDTH - 20 - 70;
    listBtn.position.set(listX, btnY);
    this.headerContainer.addChild(listBtn);

    // Pen Icon (Left of List, matching Pen button position in Game.ts)
    const penBtn = this.createHeaderButton('\uF604');
    const penX = listX - 20 - 70;
    penBtn.position.set(penX, btnY);
    penBtn.on('pointertap', () => this.showPenSelection());

    this.headerContainer.addChild(penBtn);

    // 4. Floating Action Button (Create Level) - Bottom Right
    this.createLevelBtn = this.createFloatingActionButton();
    this.createLevelBtn.visible = false; // Hidden by default
    this.addChild(this.createLevelBtn);
  }

  private createFloatingActionButton(): PIXI.Container {
    const size = 64;
    const container = new PIXI.Container();

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.circle(0, 0, size / 2);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: 4 })];
    shadow.position.set(0, 4);
    container.addChild(shadow);

    // Button Circle
    const circle = new PIXI.Graphics();
    circle.circle(0, 0, size / 2);
    circle.fill(0x555555); // Dark Gray
    container.addChild(circle);

    // Plus Icon
    const plus = new PIXI.Text({
      text: '+',
      style: {
        fontFamily: 'Arial',
        fontSize: 40,
        fill: '#FFFFFF',
        fontWeight: 'bold'
      }
    });
    plus.anchor.set(0.5);
    plus.position.set(0, 0); // Reset to center
    container.addChild(plus);

    // Position (Bottom Right, with padding)
    container.position.set(GAME_WIDTH - 50, GAME_HEIGHT - 50);

    // Interaction
    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', () => {
      console.log('Create Level Attempt');
      // Logic for creating level will go here
      // For now, maybe show a toast or log
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
        fontSize: 24,
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
    if (this.latestBtnText) {
      const isSelected = this.sortMode === 'latest';
      this.latestBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.latestBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }
    if (this.popularBtnText) {
      const isSelected = this.sortMode === 'popular';
      this.popularBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.popularBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }
    if (this.mineBtnText) {
      const isSelected = this.filterAuthorId === CURRENT_USER_ID;
      this.mineBtnText.style.fill = isSelected ? '#555555' : '#AAAAAA';
      this.mineBtnText.style.fontWeight = isSelected ? 'bold' : 'normal';
    }

    // Toggle FAB visibility based on "Mine" filter
    if (this.createLevelBtn) {
      this.createLevelBtn.visible = this.filterAuthorId === CURRENT_USER_ID;
    }
  }

  private createHeaderButton(iconChar: string): PIXI.Container {
    const size = 52;
    const container = new PIXI.Container();

    // Invisible Hit Area
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 0, size, size);
    hitArea.fill({ color: 0xFFFFFF, alpha: 0.001 }); // Almost invisible but interactive
    container.addChild(hitArea);

    // Icon Text
    const text = new PIXI.Text({
      text: iconChar,
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: 60,
        fill: '#555555',
        stroke: { color: '#555555', width: 0.5 },
        align: 'center',
        padding: 10 // Prevent clipping of icon glyphs
      }
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, size / 2);
    container.addChild(text);

    // Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';

    return container;
  }

  private setupGrid(): void {
    // Clear existing grid children first (for re-render)
    this.gridContainer.removeChildren();

    // Render all pages horizontally
    for (let p = 0; p < this.totalPages; p++) {
      const pageContainer = new PIXI.Container();
      pageContainer.x = p * GAME_WIDTH;
      this.gridContainer.addChild(pageContainer);

      const startIndex = p * this.ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + this.ITEMS_PER_PAGE, this.visibleLevels.length);

      this.renderPage(pageContainer, startIndex, endIndex);
    }
  }

  private renderPage(container: PIXI.Container, startIndex: number, endIndex: number): void {
    // Calculate Card Size and Spacing
    const areaWidth = GAME_WIDTH;
    const areaHeight = GAME_HEIGHT - this.HEADER_HEIGHT;

    // Layout Logic
    // We want 3 columns, 2 rows. 
    // Gaps: Let's aim for equal gaps. 4 gaps horizontal, 3 gaps vertical.

    const maxCardWidth = (areaWidth * 0.7) / this.COLS; // 70% width usage
    const cardWidth = Math.floor(maxCardWidth);
    const cardHeight = Math.floor(cardWidth / this.CARD_ASPECT_RATIO);

    const hGap = (areaWidth - (cardWidth * this.COLS)) / (this.COLS + 1);
    const vGap = (areaHeight - (cardHeight * this.ROWS)) / (this.ROWS + 1);

    const startY = this.HEADER_HEIGHT + vGap;

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

  private createLevelCard(index: number, levelData: LevelData, width: number, height: number): PIXI.Container {
    const container = new PIXI.Container();

    // 1. Shadow (Rect with Blur)
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, width, height);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: 8, quality: 3 })];
    shadow.position.set(0, 4);
    container.addChild(shadow);

    // 2. Card Body
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, width, height);
    bg.fill({ color: 0xFFFFFF });
    container.addChild(bg);

    // 3. Viewport (Masked Area)
    // viewWidth and viewHeight removed as unused
    // Requirement says: "Index Placeholder: Top Left", "Status: Top Right", "Content Viewport: Center". 
    // Let's make the thumbnail fill the whole card but put UI on top, 
    // OR have a dedicated area. "internal layout... Center - Content Viewport... design allows thumbnail to fill card width".
    // I will put thumbnail filling the card (with rounded corners) and put text on top.

    // Thumbnail Layer
    const thumbnail = this.createLevelThumbnail(levelData, width, height);

    // Mask for thumbnail
    const mask = new PIXI.Graphics();
    mask.rect(0, 0, width, height);
    mask.fill(0xFFFFFF);
    thumbnail.mask = mask;
    container.addChild(mask); // Mask needs to be in display list? In v7/v8 sometimes yes/no. Usually no need if assigned to .mask.
    // Wait, pixi mask property. If using Graphics as mask, it should be in the parent usually or just exist.
    // Safest is to add it and set renderable=false or just assign. 
    container.addChild(thumbnail);

    // Designer Avatar (Bottom Right)
    // Only show avatar if NOT viewing "My Levels" (filtering by current user)
    if (this.filterAuthorId !== CURRENT_USER_ID) {
      // Mocking a user avatar with a colored circle
      const avatarRadius = 25;
      const avatar = new PIXI.Graphics();
      const colors = [0xFF6B6B, 0x4ECDC4, 0x45B7D1, 0xFFBE76, 0xFF7979, 0xBADC58];
      const color = colors[index % colors.length];

      avatar.circle(0, 0, avatarRadius);
      avatar.fill(color);
      avatar.stroke({ width: 3, color: 0xFFFFFF });

      // Position to slightly protrude from the corner (center closer to the corner)
      avatar.position.set(width - 4, height - 4);

      // Interaction for avatar
      avatar.eventMode = 'static';
      avatar.cursor = 'pointer';
      avatar.on('pointertap', (e) => {
        e.stopPropagation();
        const authorName = levelData.author || `User ${index + 1}`;
        // Use levelData.authorId if available, otherwise mock one for the demo or use levelData.author
        const authorId = levelData.authorId || `mock_user_${index}`;

        this.showUserProfile(authorName, authorId, color);
      });

      container.addChild(avatar);
    }

    // 4.5 Published/Draft Status Overlay
    if (levelData.authorId === CURRENT_USER_ID && levelData.isPublished === false) {
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
        labelText = 'Draft';
        labelColor = 0x888888; // Medium Gray for "Ready but not public"
        textColor = '#FFFFFF';
      } else {
        labelText = 'Untested';
        labelColor = 0xEEEEEE; // Very Light Gray for "Not passed"
        textColor = '#888888'; // Gray text
      }

      tagBg.roundRect(0, 0, 80, 24, 12);
      tagBg.fill(labelColor);

      const tagText = new PIXI.Text({
        text: labelText,
        style: {
          fontFamily: 'Arial',
          fontSize: 12,
          fill: textColor,
          fontWeight: 'bold'
        }
      });
      tagText.anchor.set(0.5);
      tagText.position.set(40, 12); // Center of bg

      tagContainer.addChild(tagBg);
      tagContainer.addChild(tagText);
      tagContainer.position.set(10, 10);

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
          fontSize: 12,
          fill: '#FFFFFF',
          fontWeight: 'bold'
        }
      });

      const padding = 10;
      const iconSize = 14;
      const gap = 4;
      const totalWidth = padding + iconSize + gap + numText.width + padding;

      // Background pill (semitransparent black)
      const bg = new PIXI.Graphics();
      bg.roundRect(0, 0, totalWidth, 24, 12);
      bg.fill({ color: 0x000000, alpha: 0.4 });
      likesContainer.addChild(bg);

      // Heart Icon
      const heartText = new PIXI.Text({
        text: '\uF406', // Heart Fill
        style: {
          fontFamily: 'bootstrap-icons',
          fontSize: 16,
          fill: '#FFFFFF',
        }
      });
      heartText.anchor.set(0.5);
      heartText.position.set(padding + iconSize / 2, 12);
      likesContainer.addChild(heartText);

      // Likes Number
      numText.anchor.set(0, 0.5); // Left align
      numText.position.set(padding + iconSize + gap, 12);
      likesContainer.addChild(numText);

      likesContainer.position.set(10, 10);
      container.addChild(likesContainer);
    }

    // 5. Status (Top Right)
    // Placeholder circle
    // const statusCircle = new PIXI.Graphics();
    // statusCircle.circle(0, 0, 10);
    // statusCircle.fill(0xEEEEEE);
    // statusCircle.position.set(width - 20, 20);
    // container.addChild(statusCircle);

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

    // Scale Factor
    // Game is GAME_WIDTH x GAME_HEIGHT. We need to fit into width x height.
    const scale = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    container.scale.set(scale);

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
      levelData.lasers.forEach(config => container.addChild(Laser.createVisual(config, this.laserTexture!)));
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
    // Swipe Logic on the Grid Container or Main Container
    // We need a hit area for the whole screen
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, this.HEADER_HEIGHT, GAME_WIDTH, GAME_HEIGHT - this.HEADER_HEIGHT);
    hitArea.fill({ color: 0x000000, alpha: 0 }); // Invisible
    this.addChildAt(hitArea, 0); // Behind everything but captures clicks background of grid

    this.eventMode = 'static';

    this.on('pointerdown', (e) => {
      // If PenSelectionUI or UserProfileCard is open, do not handle background swipes
      if (this.penSelectionUI || this.userProfileCard) return;

      this.isDragging = true;
      this.dragStartX = e.global.x;
      this.dragDistance = 0; // Reset distance on every new touch
      this.dragStartPageX = this.gridContainer.x;
    });

    this.on('pointermove', (e) => {
      if (!this.isDragging) return;
      const currentX = e.global.x;
      const diff = currentX - this.dragStartX;

      // Update max displacement
      this.dragDistance = Math.max(this.dragDistance, Math.abs(diff));

      // Drag the grid
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
    const targetX = -pageIndex * GAME_WIDTH;

    // Simple tween
    // Since we don't have a tween engine installed (probably), let's just slide using a ticker or CSS-like transition?
    // Pixi doesn't have built-in tween. 
    // We can just snap for now, or use a simple ticker hook if passed.
    // Let's implement a simple slide loop or just snap.
    // User requested "Swipe ... can switch page". 
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

  private showUserProfile(userName: string, userId: string, color: number): void {
    if (this.userProfileCard) {
      this.removeChild(this.userProfileCard);
      this.userProfileCard.destroy();
      this.userProfileCard = null;
    }

    this.userProfileCard = new UserProfileCard(userName, userId, color,
      () => this.closeUserProfile(),
      (id) => {
        this.closeUserProfile();
        this.setFilterAuthor(id);
      }
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

  // --- Logic for Sorting and Filtering ---

  // --- Logic for Sorting and Filtering ---

  private setSortMode(mode: 'latest' | 'popular'): void {
    if (this.sortMode === mode) {
      // 如果已經在該模式，但不在第一頁，則回到第一頁
      if (this.currentPage !== 0) {
        this.currentPage = 0;
        this.scrollToPage(0);
      }
      return;
    }
    this.sortMode = mode;
    this.updateSortButtons();
    // Maintain current filter
    this.refreshVisibleLevels();
  }

  private setFilterAuthor(authorId: string | null): void {
    if (this.filterAuthorId === authorId) return;
    this.filterAuthorId = authorId;
    this.updateSortButtons(); // To update 'Mine' button state
    this.updateFilterTag();
    this.refreshVisibleLevels();
  }

  private updateFilterTag(): void {
    if (!this.filterFilterTagContainer) return;

    this.filterFilterTagContainer.removeChildren();

    // Only show if filtered and NOT filtering by ME (since ME has its own tab button highlights)
    if (!this.filterAuthorId || this.filterAuthorId === CURRENT_USER_ID) {
      this.filterFilterTagContainer.visible = false;
      return;
    }

    this.filterFilterTagContainer.visible = true;

    const labelText = `User: ${this.filterAuthorId}`;

    const tagHeight = 32;
    const padding = 16;
    const iconSize = 14;

    const bg = new PIXI.Graphics();
    // Will draw later after text measurement

    const text = new PIXI.Text({
      text: labelText,
      style: {
        fontFamily: 'Arial',
        fontSize: 14,
        fill: '#4ECDC4', // Teal text
        fontWeight: 'bold'
      }
    });

    // Close Icon (X)
    const closeIcon = new PIXI.Text({
      text: 'x', // Simple x or use icon font if available
      style: {
        fontFamily: 'Arial',
        fontSize: 16,
        fill: '#4ECDC4',
        fontWeight: 'bold'
      }
    });

    // Layout
    const textWidth = text.width;
    const totalWidth = padding + textWidth + 10 + iconSize + padding;

    // Draw Pill Background
    bg.roundRect(0, -tagHeight / 2, totalWidth, tagHeight, tagHeight / 2);
    bg.stroke({ width: 1, color: 0x4ECDC4 });
    bg.fill({ color: 0xFFFFFF }); // White background

    text.position.set(padding, -text.height / 2);
    closeIcon.position.set(padding + textWidth + 10, -closeIcon.height / 2 - 1); // Adjust vertical alignment

    this.filterFilterTagContainer.addChild(bg);
    this.filterFilterTagContainer.addChild(text);
    this.filterFilterTagContainer.addChild(closeIcon);

    // Right Align the whole container to roughly where the old text was (GAME_WIDTH - 200 is center of it?)
    // Let's align right edge to some margin
    this.filterFilterTagContainer.pivot.x = totalWidth;
    // x is already set to GAME_WIDTH - 250 or similar

    // Interaction for the whole tag to close
    this.filterFilterTagContainer.eventMode = 'static';
    this.filterFilterTagContainer.cursor = 'pointer';
    this.filterFilterTagContainer.removeAllListeners(); // Safety
    this.filterFilterTagContainer.on('pointertap', () => {
      this.setFilterAuthor(null);
    });
  }

  private refreshVisibleLevels(): void {
    // 1. Filter
    let list = this.levels;
    const filterId = this.filterAuthorId;

    // Default: Filter out unpublished levels (Drafts)
    // Only show drafts if we are explicitly filtering by CURRENT_USER_ID ("Mine")
    if (filterId === CURRENT_USER_ID) {
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
}
