
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../config';
import { MockLevelService } from '../services/MockLevelService';

import { LanguageManager } from '../i18n/LanguageManager';

type SettingsView = 'list' | 'profile' | 'language';

export class SettingsUI extends PIXI.Container {
  private onClose: () => void;
  private currentView: SettingsView = 'list';
  private overlay: PIXI.Graphics;
  private card: PIXI.Container;
  private fileInputElement: HTMLInputElement | null = null;

  constructor(onClose: () => void) {
    super();
    this.onClose = onClose;

    this.overlay = new PIXI.Graphics();
    this.card = new PIXI.Container();

    this.addChild(this.overlay);
    this.addChild(this.card);

    this.refreshUI();

    // Resize listener
    window.addEventListener('resize', this.handleResize);

    // Language listener
    LanguageManager.getInstance().subscribe(this.handleLanguageChange);
  }

  private handleLanguageChange = (): void => {
    this.refreshUI();
  };

  private handleResize = (): void => {
    this.refreshUI();
  };

  private refreshUI(): void {
    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();

    // 1. Overlay
    this.overlay.clear();
    this.overlay.rect(0, 0, canvasWidth, canvasHeight);
    this.overlay.fill({ color: 0x000000, alpha: 0.5 });
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'default';
    this.overlay.on('pointertap', this.onClose); // Tap outside to close

    // 2. Card
    this.card.removeChildren();

    const cardWidth = scale(600);
    const cardHeight = scale(500);
    const cardX = (canvasWidth - cardWidth) / 2;
    const cardY = (canvasHeight - cardHeight) / 2;

    this.card.position.set(cardX, cardY);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, cardWidth, cardHeight);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: scale(8), quality: 3 })];
    shadow.position.set(0, scale(4));
    this.card.addChild(shadow);

    // Background
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, cardWidth, cardHeight);
    bg.fill(0xFFFFFF);
    this.card.addChild(bg);

    // Stop propagation
    this.card.eventMode = 'static';
    this.card.on('pointertap', (e) => e.stopPropagation());

    // Content based on view
    if (this.currentView === 'list') {
      this.drawListView(cardWidth);
    } else if (this.currentView === 'profile') {
      this.drawProfileView(cardWidth);
    } else if (this.currentView === 'language') {
      this.drawLanguageView(cardWidth);
    }
  }

  private drawListView(width: number): void {
    const t = (key: string) => LanguageManager.getInstance().t(key);

    // Header
    const headerParams = { title: t('settings.title'), showBack: false };
    this.drawHeader(width, headerParams);

    // List Items
    const startY = scale(100);
    const itemHeight = scale(60);
    const bgWidth = width - scale(40);
    const itemX = scale(20);

    const items = [
      { label: t('settings.profile'), onClick: () => this.setView('profile'), icon: '\uF4E1' }, // person-fill
      { label: t('settings.language'), onClick: () => this.setView('language'), icon: '\uF658' }, // globe
      // Add more settings here later, e.g. Sound, About
    ];

    items.forEach((item, index) => {
      const y = startY + (index * (itemHeight + scale(10)));
      const btn = this.createListItem(item.label, item.icon, bgWidth, itemHeight, item.onClick);
      btn.position.set(itemX, y);
      this.card.addChild(btn);
    });
  }

  private drawProfileView(width: number): void {
    const t = (key: string) => LanguageManager.getInstance().t(key);
    // Header
    this.drawHeader(width, { title: t('profile.title'), showBack: true, onBack: () => this.setView('list') });

    const profile = MockLevelService.getInstance().getUserProfile();
    const centerX = width / 2;

    // Avatar Section
    const avatarY = scale(120);
    const avatarRadius = scale(50);

    const avatarContainer = new PIXI.Container();
    avatarContainer.position.set(centerX, avatarY);
    this.card.addChild(avatarContainer);

    if (profile.avatarUrl) {
      // Image Avatar
      PIXI.Assets.load(profile.avatarUrl).then((texture) => {
        if (!this.card.parent) return; // Component destroyed

        const sprite = new PIXI.Sprite(texture);
        const aspect = sprite.width / sprite.height;
        // Cover fit logic
        if (aspect > 1) {
          sprite.height = avatarRadius * 2;
          sprite.width = sprite.height * aspect;
        } else {
          sprite.width = avatarRadius * 2;
          sprite.height = sprite.width / aspect;
        }
        sprite.anchor.set(0.5);

        // Circular Mask
        const mask = new PIXI.Graphics();
        mask.circle(0, 0, avatarRadius);
        mask.fill(0xFFFFFF);
        sprite.mask = mask;
        avatarContainer.addChild(mask);
        avatarContainer.addChild(sprite);

        // Border
        const border = new PIXI.Graphics();
        border.circle(0, 0, avatarRadius);
        border.stroke({ width: scale(4), color: 0xE0E0E0 });
        avatarContainer.addChild(border);
      });

      // Placeholder/Background (White)
      const placeholder = new PIXI.Graphics();
      placeholder.circle(0, 0, avatarRadius);
      placeholder.fill(0xFFFFFF);
      avatarContainer.addChildAt(placeholder, 0);

    } else {
      // Color Avatar (Fallback)
      const avatar = new PIXI.Graphics();
      avatar.circle(0, 0, avatarRadius);
      avatar.fill(profile.avatarColor);
      avatar.stroke({ width: scale(4), color: 0xE0E0E0 });
      avatarContainer.addChild(avatar);
    }

    // Avatar Interaction (Upload Image)
    avatarContainer.eventMode = 'static';
    avatarContainer.cursor = 'pointer';
    avatarContainer.on('pointertap', () => {
      this.triggerFileUpload();
    });

    const changeText = new PIXI.Text({
      text: t('profile.upload'),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(12),
        fill: '#AAAAAA'
      }
    });
    changeText.anchor.set(0.5);
    changeText.position.set(centerX, avatarY + avatarRadius + scale(15));
    this.card.addChild(changeText);


    // Name Section
    const nameY = avatarY + avatarRadius + scale(60);

    const nameLabel = new PIXI.Text({
      text: t('profile.name'),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: '#888888',
        fontWeight: 'bold'
      }
    });
    nameLabel.position.set(scale(40), nameY);
    this.card.addChild(nameLabel);

    // Name Display / Edit Box
    const inputBg = new PIXI.Graphics();
    const inputW = width - scale(80);
    const inputH = scale(40);
    const inputX = scale(40);
    const inputY = nameY + scale(25);

    inputBg.roundRect(0, 0, inputW, inputH, inputH / 2);
    inputBg.fill(0xF5F5F5);
    inputBg.stroke({ width: 1, color: 0xDDDDDD });
    inputBg.position.set(inputX, inputY);

    // Interaction to edit
    inputBg.eventMode = 'static';
    inputBg.cursor = 'text';
    inputBg.on('pointertap', () => {
      const MAX_NAME_LENGTH = 16;
      let result = window.prompt(t('profile.prompt'), profile.name);
      if (result !== null) {
        let trimmed = result.trim();
        if (trimmed.length > 0) {
          if (trimmed.length > MAX_NAME_LENGTH) {
            trimmed = trimmed.substring(0, MAX_NAME_LENGTH);
          }
          MockLevelService.getInstance().updateUserProfile({ name: trimmed });
          this.refreshUI();
          this.emit('profileUpdate');
        }
      }
    });
    this.card.addChild(inputBg);

    const nameText = new PIXI.Text({
      text: profile.name,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(18),
        fill: '#333333'
      }
    });
    nameText.anchor.set(0, 0.5);
    nameText.position.set(inputX + scale(10), inputY + inputH / 2);
    nameText.eventMode = 'none'; // Allow clicks to pass through to background
    this.card.addChild(nameText);

    const editIcon = new PIXI.Text({
      text: '\uF4CB', // pencil
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(16),
        fill: '#AAAAAA',
        padding: scale(5)
      }
    });
    editIcon.anchor.set(1, 0.5);
    editIcon.position.set(inputX + inputW - scale(10), inputY + inputH / 2 + scale(2));
    editIcon.eventMode = 'none'; // Allow clicks to pass through to background
    this.card.addChild(editIcon);
  }

  private drawLanguageView(width: number): void {
    const t = (key: string) => LanguageManager.getInstance().t(key);

    // Header
    this.drawHeader(width, { title: t('language.title'), showBack: true, onBack: () => this.setView('list') });

    const langs = [
      { code: 'en', label: 'English' },
      { code: 'zh-TW', label: '繁體中文' },
      { code: 'ru', label: 'Русский' }
    ];

    const startY = scale(100);
    const itemHeight = scale(60);
    const bgWidth = width - scale(40);
    const itemX = scale(20);

    const currentLang = LanguageManager.getInstance().getCurrentLanguage();

    langs.forEach((lang, index) => {
      const y = startY + (index * (itemHeight + scale(10)));
      const isSelected = lang.code === currentLang;
      const icon = isSelected ? '\uF26E' : ''; // check-lg or empty

      const btn = this.createListItem(lang.label, icon, bgWidth, itemHeight, () => {
        LanguageManager.getInstance().setLanguage(lang.code);
      });
      btn.position.set(itemX, y);

      // Highlight selected
      if (isSelected) {
        // Modify the bg created in createListItem
        const bg = btn.getChildAt(0) as PIXI.Graphics;
        bg.clear();
        bg.roundRect(0, 0, bgWidth, itemHeight, itemHeight / 2);
        bg.stroke({ width: 2, color: 0x37A4E9 });
        bg.fill(0xF0F8FF);

        // Modify icon color
        const iconTxt = btn.getChildAt(1) as PIXI.Text;
        iconTxt.style.fill = '#37A4E9';
      }

      // Remove chevron created by default in createListItem
      if (btn.children.length > 3) {
        const chevron = btn.getChildAt(3); // Based on createListItem implementation
        chevron.visible = false;
      }

      this.card.addChild(btn);
    });
  }

  private drawHeader(width: number, params: { title: string, showBack?: boolean, onBack?: () => void }): void {
    const headerH = scale(60);

    const title = new PIXI.Text({
      text: params.title,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(24),
        fill: '#333333',
        fontWeight: 'bold'
      }
    });
    title.anchor.set(0.5);
    title.position.set(width / 2, headerH / 2);
    this.card.addChild(title);

    // Back Button
    if (params.showBack && params.onBack) {
      const backBtn = new PIXI.Container();
      const hit = new PIXI.Graphics();
      hit.rect(0, 0, scale(40), scale(40));
      hit.fill({ color: 0xFFFFFF, alpha: 0.001 });
      backBtn.addChild(hit);

      const icon = new PIXI.Text({
        text: '\uF12F', // chevron-left
        style: {
          fontFamily: 'bootstrap-icons',
          fontSize: scale(24),
          fill: '#555555',
          padding: scale(5)
        }
      });
      icon.anchor.set(0.5);
      icon.position.set(scale(20), scale(20) + scale(2));
      backBtn.addChild(icon);

      backBtn.position.set(scale(10), (headerH - scale(40)) / 2);
      backBtn.eventMode = 'static';
      backBtn.cursor = 'pointer';
      backBtn.on('pointertap', params.onBack);
      this.card.addChild(backBtn);
    } else {
      // Close Button (Only on Main List)
      // If showBack is false, usually implies root level, so show Close
      if (!params.showBack) {
        const closeBtn = new PIXI.Container();
        const hit = new PIXI.Graphics();
        hit.rect(0, 0, scale(40), scale(40));
        hit.fill({ color: 0xFFFFFF, alpha: 0.001 });
        closeBtn.addChild(hit);

        const icon = new PIXI.Text({
          text: '×',
          style: {
            fontFamily: 'Arial',
            fontSize: scale(32),
            fill: '#AAAAAA'
          }
        });
        icon.anchor.set(0.5);
        icon.position.set(scale(20), scale(20) + scale(2));
        closeBtn.addChild(icon);

        closeBtn.position.set(width - scale(50), (headerH - scale(40)) / 2);
        closeBtn.eventMode = 'static';
        closeBtn.cursor = 'pointer';
        closeBtn.on('pointertap', this.onClose);
        this.card.addChild(closeBtn);
      }
    }

    // Divider
    const divider = new PIXI.Graphics();
    divider.rect(0, headerH, width, 1);
    divider.fill(0xEEEEEE);
    this.card.addChild(divider);
  }

  private createListItem(label: string, iconChar: string, w: number, h: number, onClick: () => void): PIXI.Container {
    const container = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.roundRect(0, 0, w, h, h / 2);
    bg.fill(0xF9F9F9);
    container.addChild(bg);

    // Icon
    const icon = new PIXI.Text({
      text: iconChar,
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(20),
        fill: '#555555',
        padding: scale(5)
      }
    });
    icon.anchor.set(0.5);
    icon.position.set(scale(30), h / 2 + scale(2));
    container.addChild(icon);

    // Label
    const text = new PIXI.Text({
      text: label,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(18),
        fill: '#333333'
      }
    });
    text.anchor.set(0, 0.5);
    text.position.set(scale(60), h / 2);
    container.addChild(text);

    // Chevron Right
    const arrow = new PIXI.Text({
      text: '\uF285', // chevron-right
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: scale(16),
        fill: '#CCCCCC',
        padding: scale(5)
      }
    });
    arrow.anchor.set(0.5);
    arrow.position.set(w - scale(20), h / 2 + scale(2));
    container.addChild(arrow);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onClick);

    return container;
  }

  private setView(view: SettingsView): void {
    this.currentView = view;
    // Clear Input if switching views
    this.refreshUI();
  }



  private triggerFileUpload(): void {
    if (this.fileInputElement) {
      this.removeFileInput();
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const result = readerEvent.target?.result as string;
          if (result) {
            // Process Image: Resize and Compress
            const img = new Image();
            img.onload = () => {
              const MAX_SIZE = 256;
              let w = img.width;
              let h = img.height;

              // Resize logic
              if (w > MAX_SIZE || h > MAX_SIZE) {
                if (w > h) {
                  h = Math.round(h * (MAX_SIZE / w));
                  w = MAX_SIZE;
                } else {
                  w = Math.round(w * (MAX_SIZE / h));
                  h = MAX_SIZE;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);

                // Compress to JPEG < 10KB using binary search (3 iterations)
                const MAX_BYTES = 10240;
                let minQ = 0.0;
                let maxQ = 1.0;
                let bestUrl = canvas.toDataURL('image/jpeg', 0.1); // Fallback

                for (let i = 0; i < 3; i++) {
                  const midQ = (minQ + maxQ) / 2;
                  const url = canvas.toDataURL('image/jpeg', midQ);
                  const bytes = (url.length - 23) * 0.75; // Approx binary size

                  if (bytes <= MAX_BYTES) {
                    bestUrl = url;
                    minQ = midQ;
                  } else {
                    maxQ = midQ;
                  }
                }

                MockLevelService.getInstance().updateUserProfile({ avatarUrl: bestUrl });
                this.refreshUI();
                this.emit('profileUpdate');
              }
            };
            img.src = result;
          }
        };
        reader.readAsDataURL(file);
      }
      this.removeFileInput();
    });

    // Cancel/Cleanup
    // Note: 'cancel' event support is limited, but we can try to detect focus return or just leave it attached until next open
    // Ideally we remove it after some timeout or on blur, but file inputs are tricky. 
    // We will just remove it after selection or explicitly when re-triggered.

    input.click();
    this.fileInputElement = input;
  }

  private removeFileInput(): void {
    if (this.fileInputElement) {
      if (this.fileInputElement.parentNode) {
        this.fileInputElement.parentNode.removeChild(this.fileInputElement);
      }
      this.fileInputElement = null;
    }
  }



  public destroy(options?: any): void {
    window.removeEventListener('resize', this.handleResize);
    LanguageManager.getInstance().unsubscribe(this.handleLanguageChange);
    this.removeFileInput();
    super.destroy(options);
  }
}
