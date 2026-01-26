
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

    // LevelService listener (Profile/Auth updates)
    LevelService.getInstance().subscribe(this.handleServiceUpdate);
  }

  private handleServiceUpdate = (): void => {
    this.refreshUI();
  };

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

    // Check Status
    const service = LevelService.getInstance();
    const isLoggedIn = service.isLoggedIn();
    const profile = service.getUserProfile();
    const centerX = width / 2;

    if (!isLoggedIn || !profile) {
      // --- GUEST STATE: SHOW GOOGLE LOGIN ---

      const infoText = new PIXI.Text({
        text: t('auth.signin_prompt'),
        style: {
          fontFamily: 'Arial',
          fontSize: scale(16),
          fill: '#555555',
          align: 'center',
          wordWrap: true,
          wordWrapWidth: width - scale(80)
        }
      });
      infoText.anchor.set(0.5);
      infoText.position.set(centerX, scale(150));
      this.card.addChild(infoText);

      // Render Simple Button for better-auth (redirects)
      const btnW = scale(250);
      const btnH = scale(50);
      const btnContainer = new PIXI.Container();

      const bg = new PIXI.Graphics();
      bg.roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2);
      bg.fill(0xFFFFFF);
      bg.stroke({ width: 1, color: 0xCCCCCC });

      const btnText = new PIXI.Text({
        text: t('auth.signin_google'),
        style: {
          fontFamily: 'Arial',
          fontSize: scale(18),
          fill: '#555555',
          fontWeight: 'bold'
        }
      });
      btnText.anchor.set(0.5);

      btnContainer.addChild(bg);
      btnContainer.addChild(btnText);
      btnContainer.position.set(centerX, scale(250));

      btnContainer.eventMode = 'static';
      btnContainer.cursor = 'pointer';
      btnContainer.on('pointertap', () => {
        service.loginWithGoogle(''); // Arg ignored
      });

      this.card.addChild(btnContainer);

      return;
    }

    // --- LOGGED IN STATE ---

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
    const nameY = avatarY + avatarRadius + scale(40);
    const nameText = new PIXI.Text({
      text: profile.name,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(24),
        fill: '#333333',
        fontWeight: 'bold'
      }
    });
    nameText.anchor.set(0.5);
    nameText.position.set(centerX, nameY);
    this.card.addChild(nameText);

    // Logout Button
    const logoutY = nameY + scale(60);
    const logoutBtn = new PIXI.Container();

    const btnWToken = scale(120);
    const btnHToken = scale(40);
    const btnBgToken = new PIXI.Graphics();
    btnBgToken.roundRect(-btnWToken / 2, -btnHToken / 2, btnWToken, btnHToken, btnHToken / 2);
    btnBgToken.fill(0xFFEEEE);
    btnBgToken.stroke({ width: 1, color: 0xFF0000 });

    const btnTextToken = new PIXI.Text({
      text: t('auth.logout'),
      style: {
        fontFamily: 'Arial',
        fontSize: scale(16),
        fill: '#FF0000'
      }
    });
    btnTextToken.anchor.set(0.5);

    logoutBtn.addChild(btnBgToken);
    logoutBtn.addChild(btnTextToken);
    logoutBtn.position.set(centerX, logoutY);
    logoutBtn.eventMode = 'static';
    logoutBtn.cursor = 'pointer';
    logoutBtn.on('pointertap', () => {
      service.logout();
      this.refreshUI(); // Might need reload if logout reloads page
    });

    this.card.addChild(logoutBtn);
  }

  // Removed Google DOM handling


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
    // this.removeGoogleButton(); // No longer needed
    this.currentView = view;
    // Clear Input if switching views
    this.refreshUI();
  }







  public destroy(options?: any): void {
    window.removeEventListener('resize', this.handleResize);
    LanguageManager.getInstance().unsubscribe(this.handleLanguageChange);

    // this.removeGoogleButton();
    LevelService.getInstance().unsubscribe(this.handleServiceUpdate);
    super.destroy(options);
  }
}
