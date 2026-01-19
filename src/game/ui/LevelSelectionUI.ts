
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

export class LevelSelectionUI extends PIXI.Container {
  private levels: LevelData[];
  private onSelect: (index: number) => void;
  private currentPage: number = 0;
  private totalPages: number = 0;
  private laserTexture?: PIXI.Texture;
  private gridContainer: PIXI.Container;
  private headerContainer: PIXI.Container;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartPageX: number = 0;
  private dragDistance: number = 0; // Cumulative or max displacement to distinguish tap from swipe

  // Constants for Layout
  private readonly HEADER_HEIGHT = GAME_HEIGHT / 5;
  private readonly COLS = 3;
  private readonly ROWS = 2;
  private readonly ITEMS_PER_PAGE = 6;
  private readonly CARD_ASPECT_RATIO = 16 / 9;

  constructor(levels: LevelData[], onSelect: (index: number) => void, laserTexture?: PIXI.Texture) {
    super();
    this.levels = levels;
    this.onSelect = onSelect;
    this.laserTexture = laserTexture;
    this.totalPages = Math.ceil(levels.length / this.ITEMS_PER_PAGE);

    this.sortableChildren = true;

    // Create Main Containers
    this.headerContainer = new PIXI.Container();
    this.gridContainer = new PIXI.Container();

    this.addChild(this.gridContainer);
    this.addChild(this.headerContainer);

    this.setupHeader();
    this.setupGrid();
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

    // 3. Action Area (Right)
    // Create some dummy icon buttons
    const buttonConfigs = ['\uF604', '\uF479']; // vector-pen, list
    let btnX = GAME_WIDTH - 40;

    buttonConfigs.reverse().forEach(iconChar => {
      const btn = this.createHeaderButton(iconChar);
      btn.position.set(btnX - btn.width, (this.HEADER_HEIGHT - btn.height) / 2);
      this.headerContainer.addChild(btn);
      btnX -= (btn.width + 20); // Spacing
    });
  }

  private createHeaderButton(iconChar: string): PIXI.Container {
    const size = 60;
    const container = new PIXI.Container();

    // Circle Outline
    const circle = new PIXI.Graphics();
    circle.circle(size / 2, size / 2, size / 2);
    circle.stroke({ width: 3, color: 0x555555 });
    container.addChild(circle);

    // Icon Text
    const text = new PIXI.Text({
      text: iconChar,
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: 40,
        fill: '#555555',
        padding: 10 // Prevent clipping of icon glyphs
      }
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, size / 2 + 6); // Center and slightly offset for visual balance
    container.addChild(text);

    // Interactive
    container.eventMode = 'static';
    container.cursor = 'pointer';

    return container;
  }

  private setupGrid(): void {
    // Render all pages horizontally
    for (let p = 0; p < this.totalPages; p++) {
      const pageContainer = new PIXI.Container();
      pageContainer.x = p * GAME_WIDTH;
      this.gridContainer.addChild(pageContainer);

      const startIndex = p * this.ITEMS_PER_PAGE;
      const endIndex = Math.min(startIndex + this.ITEMS_PER_PAGE, this.levels.length);

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

      const card = this.createLevelCard(i, this.levels[i], cardWidth, cardHeight);
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

    // 4. Index (Top Left)
    const indexStr = (index + 1).toString();
    const indexText = new PIXI.Text({
      text: indexStr,
      style: {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: '#A0A0A0'
      }
    });
    indexText.position.set(12, 8);
    container.addChild(indexText);

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
        this.onSelect(index);
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

    const animate = () => {
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
}
