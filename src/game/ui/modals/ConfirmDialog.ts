import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../../config';
import { LanguageManager, type TranslationKey } from '../../i18n/LanguageManager';

export class ConfirmDialog extends PIXI.Container {
  private message: string;
  private onConfirmCallback: () => void;
  private onCancelCallback: () => void;
  private options: {
    confirmText?: string;
    cancelText?: string;
    confirmKey?: TranslationKey;
    cancelKey?: TranslationKey;
    showCancel?: boolean;
    onDismiss?: () => void;
  };

  constructor(
    message: string,
    onConfirm: () => void,
    onCancel: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      confirmKey?: TranslationKey;
      cancelKey?: TranslationKey;
      showCancel?: boolean;
      onDismiss?: () => void;
    }
  ) {
    super();
    this.message = message;
    this.onConfirmCallback = onConfirm;
    this.onCancelCallback = onCancel;
    this.options = options || {};

    this.refreshUI();

    // Listen for resize
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    this.refreshUI();
  };

  private refreshUI(): void {
    this.removeChildren();

    const confirmText = this.options.confirmText ||
      (this.options.confirmKey ? LanguageManager.getInstance().t(this.options.confirmKey) : LanguageManager.getInstance().t('common.confirm'));
    const cancelText = this.options.cancelText ||
      (this.options.cancelKey ? LanguageManager.getInstance().t(this.options.cancelKey) : LanguageManager.getInstance().t('common.cancel'));
    const showCancel = this.options.showCancel !== false;

    const canvasWidth = getCanvasWidth();
    const canvasHeight = getCanvasHeight();

    this.zIndex = 2000;

    // 1. Dimmed Background (Overlay)
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, canvasWidth, canvasHeight);
    overlay.fill({ color: 0x000000, alpha: 0.3 });
    overlay.eventMode = 'static';
    // Dismiss on clicking background if onDismiss is provided
    if (this.options.onDismiss) {
      overlay.cursor = 'pointer';
      overlay.on('pointertap', () => {
        this.options.onDismiss?.();
      });
    }
    this.addChild(overlay);

    // 2. Dialog Container
    const dialogWidth = scale(400);
    const dialogHeight = scale(200);
    const dialog = new PIXI.Container();
    dialog.position.set((canvasWidth - dialogWidth) / 2, (canvasHeight - dialogHeight) / 2);
    // Prevent clicks on dialog from triggering overlay dismissal
    dialog.eventMode = 'static';
    dialog.on('pointertap', (e) => e.stopPropagation());
    this.addChild(dialog);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, dialogWidth, dialogHeight);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: scale(8), quality: 3 })];
    shadow.position.set(0, scale(4));
    dialog.addChild(shadow);

    // Dialog Body
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, dialogWidth, dialogHeight);
    bg.fill({ color: 0xFFFFFF });
    dialog.addChild(bg);

    // 3. Message Text
    const messageText = new PIXI.Text({
      text: this.message,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(20),
        fill: '#555555',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: dialogWidth - scale(40)
      }
    });
    messageText.anchor.set(0.5);
    messageText.position.set(dialogWidth / 2, scale(70));
    dialog.addChild(messageText);

    // 4. Buttons
    const btnWidth = showCancel ? scale(120) : scale(160);
    const btnHeight = scale(44);
    const btnY = scale(140);

    if (showCancel) {
      // Cancel Button (Left)
      const cancelBtn = this.createButton(
        cancelText,
        (dialogWidth / 2) - btnWidth - scale(10),
        btnY,
        btnWidth,
        btnHeight,
        '#555555',
        0xDDDDDD
      );
      cancelBtn.on('pointertap', () => {
        this.onCancelCallback();
      });
      dialog.addChild(cancelBtn);
    }

    // Confirm Button (Right or Center)
    const confirmBtn = this.createButton(
      confirmText,
      showCancel ? (dialogWidth / 2) + scale(10) : (dialogWidth - btnWidth) / 2,
      btnY,
      btnWidth,
      btnHeight,
      '#FFFFFF',
      0x555555
    );
    confirmBtn.on('pointertap', () => {
      this.onConfirmCallback();
    });
    dialog.addChild(confirmBtn);

    // 5. Close Button (X) - Top Right
    if (this.options.onDismiss) {
      const closeBtnSize = scale(30);
      const closeBtn = new PIXI.Container();
      closeBtn.position.set(dialogWidth - closeBtnSize - scale(10), scale(10));
      dialog.addChild(closeBtn);

      const closeIcon = new PIXI.Text({
        text: '\uF622', // Bootstrap-icons X (plain)
        style: {
          fontFamily: 'bootstrap-icons',
          fontSize: scale(24),
          fill: '#888888',
          padding: scale(10)
        }
      });
      closeIcon.anchor.set(0.5);
      closeIcon.position.set(closeBtnSize / 2, closeBtnSize / 2);
      closeBtn.addChild(closeIcon);

      closeBtn.eventMode = 'static';
      closeBtn.cursor = 'pointer';
      closeBtn.on('pointertap', (e) => {
        e.stopPropagation();
        this.options.onDismiss?.();
      });
    }
  }

  destroy(options?: any): void {
    window.removeEventListener('resize', this.handleResize);
    super.destroy(options);
  }

  private createButton(
    text: string,
    x: number,
    y: number,
    width: number,
    height: number,
    textColor: string,
    bgColor: number
  ): PIXI.Container {
    const btn = new PIXI.Container();
    btn.position.set(x, y);

    const btnBg = new PIXI.Graphics();
    btnBg.roundRect(0, 0, width, height, Math.min(width, height) / 2);
    btnBg.fill({ color: bgColor });
    btn.addChild(btnBg);

    const btnText = new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(18),
        fill: textColor,
        fontWeight: 'bold'
      }
    });
    btnText.anchor.set(0.5);
    btnText.position.set(width / 2, height / 2);
    btn.addChild(btnText);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';

    return btn;
  }
}
