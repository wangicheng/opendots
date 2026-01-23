import * as PIXI from 'pixi.js';
import { getCanvasWidth, getCanvasHeight, scale } from '../../config';
import { UIFactory } from '../UIFactory';
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
    const overlay = UIFactory.createOverlay(canvasWidth, canvasHeight, 0.3);
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
    const dialog = UIFactory.createCard(dialogWidth, dialogHeight, 0xFFFFFF, 0);
    dialog.position.set((canvasWidth - dialogWidth) / 2, (canvasHeight - dialogHeight) / 2);
    // Prevent clicks on dialog from triggering overlay dismissal
    dialog.eventMode = 'static';
    dialog.on('pointertap', (e) => e.stopPropagation());
    this.addChild(dialog);

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
      const cancelBtn = UIFactory.createButton(
        cancelText,
        btnWidth,
        btnHeight,
        0xDDDDDD,
        '#555555',
        () => this.onCancelCallback()
      );
      cancelBtn.position.set((dialogWidth / 2) - btnWidth - scale(10), btnY);
      dialog.addChild(cancelBtn);
    }

    // Confirm Button (Right or Center)
    const confirmBtn = UIFactory.createButton(
      confirmText,
      btnWidth,
      btnHeight,
      0x555555,
      '#FFFFFF',
      () => this.onConfirmCallback()
    );
    confirmBtn.position.set(showCancel ? (dialogWidth / 2) + scale(10) : (dialogWidth - btnWidth) / 2, btnY);
    dialog.addChild(confirmBtn);

    // 5. Close Button (X) - Top Right
    if (this.options.onDismiss) {
      const closeBtnSize = scale(30);
      const closeBtn = new PIXI.Container();
      closeBtn.position.set(dialogWidth - closeBtnSize - scale(10), scale(10));
      dialog.addChild(closeBtn);

      const closeIcon = UIFactory.createIcon('\uF622', scale(24), '#888888');
      closeIcon.position.set(closeBtnSize / 2, closeBtnSize / 2 + scale(2)); // Nudge
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


}
