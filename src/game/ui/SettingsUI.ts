
import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../config';
import { LevelService } from '../services/LevelService';
import { UIFactory } from './UIFactory';

import { LanguageManager, type TranslationKey } from '../i18n/LanguageManager';

// Constants
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

    // Name Section
    const nameY = avatarY + avatarRadius + scale(10);

    // 1. Display Name (Main, Large) - Centered
    const displayName = new PIXI.Text({
      text: profile.name,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(24),
        fill: '#333333',
        fontWeight: 'bold',
        align: 'center'
      }
    });
    displayName.anchor.set(0.5, 0);
    displayName.position.set(centerX, nameY);
    this.card.addChild(displayName);

    // 2. GitHub Integration Section
    const inputY = nameY + scale(55);
    const inputW = width - scale(80);
    const inputH = scale(50);
    const inputX = scale(40);

    // Instructions / Label
    const instructionText = new PIXI.Text({
      text: t('settings.github'),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: '#888888'
      }
    });
    instructionText.anchor.set(0.5, 1);
    instructionText.position.set(centerX, inputY - scale(5));
    this.card.addChild(instructionText);

    // GitHub Input Box (Pill shape)
    const inputBg = UIFactory.createPill(inputW, inputH, 0xF5F5F5, 0xDDDDDD, 1);
    inputBg.position.set(inputX, inputY);

    // Interaction to edit
    inputBg.eventMode = 'static';
    inputBg.cursor = 'pointer';
    inputBg.on('pointertap', () => {
      const current = profile.githubUsername || '';
      const result = window.prompt('Enter GitHub Username', current);
      if (result !== null) {
        const username = result.trim();
        if (username.length > 0 && username !== current) {
          this.fetchGitHubProfile(username);
        }
      }
    });
    this.card.addChild(inputBg);

    // Text Inside Pill: GitHub Username or "Connect"
    const pillTextValue = profile.githubUsername ? `@${profile.githubUsername}` : 'Connect GitHub Account';
    const pillTextColor = profile.githubUsername ? '#333333' : '#888888';

    const pillText = new PIXI.Text({
      text: pillTextValue,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(16),
        fill: pillTextColor
      }
    });
    pillText.anchor.set(0.5);
    pillText.position.set(inputX + inputW / 2, inputY + inputH / 2);
    pillText.eventMode = 'none';
    this.card.addChild(pillText);

    // Edit Icon (Right side of pill)
    const editIcon = UIFactory.createIcon('\uF4CB', scale(16), '#AAAAAA');
    editIcon.anchor.set(1, 0.5);
    editIcon.position.set(inputX + inputW - scale(15), inputY + inputH / 2 + scale(2));
    editIcon.eventMode = 'none';
    this.card.addChild(editIcon);
  }

  private async fetchGitHubProfile(username: string): Promise<void> {
    try {
      // Show loading? (Optional)
      const res = await fetch(`https://api.github.com/users/${username}`);
      if (res.ok) {
        const data = await res.json();
        LevelService.getInstance().updateUserProfile({
          githubUsername: username,
          name: data.name || data.login,
          avatarUrl: data.avatar_url, // Save URL, not blob
          // We don't save avatarColor, we could potentially derive it from avatar if needed, but keeping existing is fine.
        });
        this.refreshUI();
        this.emit('profileUpdate');
      } else {
        alert('GitHub user not found');
      }
    } catch (e) {
      console.error('Failed to fetch GitHub profile', e);
      alert('Network error');
    }
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







  public destroy(options?: any): void {
    window.removeEventListener('resize', this.handleResize);
    LanguageManager.getInstance().unsubscribe(this.handleLanguageChange);
    // this.removeFileInput();

    super.destroy(options);
  }
}
