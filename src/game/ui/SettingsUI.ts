
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../config';
import { LevelService } from '../services/LevelService';
import { UIFactory } from './UIFactory';

import { LanguageManager, type TranslationKey } from '../i18n/LanguageManager';

// Constants
const MAX_NAME_LENGTH = 16;
const MAX_AVATAR_SIZE = 256;
const MAX_AVATAR_BYTES = 10240;

// Type for list item with named children
interface ListItemResult {
  container: PIXI.Container;
  bg: PIXI.Graphics;
  icon: PIXI.Text;
  label: PIXI.Text;
  chevron: PIXI.Text;
}

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
    // Fix memory leak: remove old listener before adding new one
    this.overlay.off('pointertap', this.onClose);
    this.overlay.on('pointertap', this.onClose); // Tap outside to close

    // 2. Card
    this.card.removeChildren();

    const cardWidth = scale(600);
    const cardHeight = scale(500);
    const cardX = (canvasWidth - cardWidth) / 2;
    const cardY = (canvasHeight - cardHeight) / 2;

    // Card with Shadow and Background
    this.card = UIFactory.createCard(cardWidth, cardHeight, 0xFFFFFF, 0);
    this.card.position.set(cardX, cardY);
    this.addChild(this.card);

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
    const t = (key: TranslationKey) => LanguageManager.getInstance().t(key);

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
      { label: t('settings.github'), onClick: () => { window.open('https://github.com/wangicheng/opendots', '_blank'); }, icon: '\uF3ED' }, // github
      // Add more settings here later, e.g. Sound, About
    ];

    items.forEach((item, index) => {
      const y = startY + (index * (itemHeight + scale(10)));
      const listItem = this.createListItem(item.label, item.icon, bgWidth, itemHeight, item.onClick);
      listItem.container.position.set(itemX, y);
      this.card.addChild(listItem.container);
    });
  }

  private drawProfileView(width: number): void {
    const t = (key: TranslationKey) => LanguageManager.getInstance().t(key);
    // Header
    this.drawHeader(width, { title: t('profile.title'), showBack: true, onBack: () => this.setView('list') });

    const profile = LevelService.getInstance().getUserProfile();
    const centerX = width / 2;

    // Avatar Section
    const avatarY = scale(120);
    const avatarRadius = scale(50);

    const avatarContainer = UIFactory.createAvatar(
      avatarRadius,
      profile.avatarUrl,
      profile.avatarColor,
      0xE0E0E0
    );
    avatarContainer.position.set(centerX, avatarY);
    this.card.addChild(avatarContainer);

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

    // Name Display / Edit Box (Pill shape)
    const inputW = width - scale(80);
    const inputH = scale(40);
    const inputX = scale(40);
    const inputY = nameY + scale(25);

    // used roundRect... but wait, createPill uses full radius.
    // original: inputH / 2. Yes, it is a pill.
    const inputBg = UIFactory.createPill(inputW, inputH, 0xF5F5F5, 0xDDDDDD, 1);
    inputBg.position.set(inputX, inputY);

    // Interaction to edit
    inputBg.eventMode = 'static';
    inputBg.cursor = 'text';
    inputBg.on('pointertap', () => {
      let result = window.prompt(t('profile.prompt'), profile.name);
      if (result !== null) {
        let trimmed = result.trim();
        if (trimmed.length > 0) {
          if (trimmed.length > MAX_NAME_LENGTH) {
            trimmed = trimmed.substring(0, MAX_NAME_LENGTH);
          }
          LevelService.getInstance().updateUserProfile({ name: trimmed });
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

    const editIcon = UIFactory.createIcon('\uF4CB', scale(16), '#AAAAAA');
    editIcon.anchor.set(1, 0.5); // Override anchor for specific layout
    editIcon.position.set(inputX + inputW - scale(10), inputY + inputH / 2 + scale(2));
    editIcon.eventMode = 'none'; // Allow clicks to pass through to background
    this.card.addChild(editIcon);
  }

  private drawLanguageView(width: number): void {
    const t = (key: TranslationKey) => LanguageManager.getInstance().t(key);

    // Header
    this.drawHeader(width, { title: t('language.title'), showBack: true, onBack: () => this.setView('list') });

    // Dynamic Language List
    const availableLangs = LanguageManager.getInstance().getAvailableLanguages();

    const langs = availableLangs.map(code => ({
      code,
      label: t(`language.${code}` as TranslationKey)
    }));

    const startY = scale(100);
    const itemHeight = scale(60);
    const bgWidth = width - scale(40);
    const itemX = scale(20);

    const currentLang = LanguageManager.getInstance().getCurrentLanguage();

    langs.forEach((lang, index) => {
      const y = startY + (index * (itemHeight + scale(10)));
      const isSelected = lang.code === currentLang;
      const icon = isSelected ? '\uF26E' : ''; // check-lg or empty

      const item = this.createListItem(lang.label, icon, bgWidth, itemHeight, () => {
        LanguageManager.getInstance().setLanguage(lang.code);
      });
      item.container.position.set(itemX, y);

      // Highlight selected
      if (isSelected) {
        // Modify the bg using named reference
        // Clear and redraw as pill
        item.bg.clear();
        const radius = itemHeight / 2;
        item.bg.roundRect(0, 0, bgWidth, itemHeight, radius);
        item.bg.stroke({ width: 2, color: 0x37A4E9 });
        item.bg.fill(0xF0F8FF);

        // Modify icon color using named reference
        item.icon.style.fill = '#37A4E9';
      }

      // Remove chevron using named reference
      item.chevron.visible = false;

      this.card.addChild(item.container);
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

      const icon = UIFactory.createIcon('\uF12F', scale(24), '#555555');
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

  private createListItem(label: string, iconChar: string, w: number, h: number, onClick: () => void): ListItemResult {
    const container = new PIXI.Container();

    const bg = UIFactory.createPill(w, h, 0xF9F9F9);
    container.addChild(bg);

    // Icon
    const icon = UIFactory.createIcon(iconChar, scale(20), '#555555');
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
    const chevron = UIFactory.createIcon('\uF285', scale(16), '#CCCCCC');
    chevron.anchor.set(0.5);
    chevron.position.set(w - scale(20), h / 2 + scale(2));
    container.addChild(chevron);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onClick);

    return { container, bg, icon, label: text, chevron };
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
            img.onerror = () => {
              console.error('Failed to load uploaded image');
            };
            img.onload = () => {
              let w = img.width;
              let h = img.height;

              // Resize logic
              if (w > MAX_AVATAR_SIZE || h > MAX_AVATAR_SIZE) {
                if (w > h) {
                  h = Math.round(h * (MAX_AVATAR_SIZE / w));
                  w = MAX_AVATAR_SIZE;
                } else {
                  w = Math.round(w * (MAX_AVATAR_SIZE / h));
                  h = MAX_AVATAR_SIZE;
                }
              }

              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);

                // Compress to JPEG using binary search (3 iterations)
                let minQ = 0.0;
                let maxQ = 1.0;
                let bestUrl = canvas.toDataURL('image/jpeg', 0.1); // Fallback

                for (let i = 0; i < 3; i++) {
                  const midQ = (minQ + maxQ) / 2;
                  const url = canvas.toDataURL('image/jpeg', midQ);
                  // More accurate byte calculation
                  const base64Data = url.split(',')[1] || '';
                  const bytes = base64Data.length * 0.75;

                  if (bytes <= MAX_AVATAR_BYTES) {
                    bestUrl = url;
                    minQ = midQ;
                  } else {
                    maxQ = midQ;
                  }
                }

                LevelService.getInstance().updateUserProfile({ avatarUrl: bestUrl });
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
