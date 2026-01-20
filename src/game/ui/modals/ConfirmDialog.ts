import * as PIXI from 'pixi.js';
import { GAME_WIDTH, GAME_HEIGHT } from '../../config';

export class ConfirmDialog extends PIXI.Container {
  constructor(
    message: string,
    onConfirm: () => void,
    onCancel: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      showCancel?: boolean;
    }
  ) {
    super();

    const confirmText = options?.confirmText || 'Confirm';
    const cancelText = options?.cancelText || 'Cancel';
    const showCancel = options?.showCancel !== false;

    this.zIndex = 2000; // High zIndex to be on top

    // 1. Dimmed Background
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    overlay.fill({ color: 0x000000, alpha: 0.3 });
    overlay.eventMode = 'static';
    this.addChild(overlay);

    // 2. Dialog Container
    const dialogWidth = 400;
    const dialogHeight = 200;
    const dialog = new PIXI.Container();
    dialog.position.set((GAME_WIDTH - dialogWidth) / 2, (GAME_HEIGHT - dialogHeight) / 2);
    this.addChild(dialog);

    // Shadow
    const shadow = new PIXI.Graphics();
    shadow.rect(0, 0, dialogWidth, dialogHeight);
    shadow.fill({ color: 0x000000, alpha: 0.3 });
    shadow.filters = [new PIXI.BlurFilter({ strength: 8, quality: 3 })];
    shadow.position.set(0, 4);
    dialog.addChild(shadow);

    // Dialog Body
    const bg = new PIXI.Graphics();
    bg.rect(0, 0, dialogWidth, dialogHeight);
    bg.fill({ color: 0xFFFFFF });
    dialog.addChild(bg);

    // Prevent clicks on dialog from closing
    dialog.eventMode = 'static';
    dialog.on('pointertap', (e) => e.stopPropagation());

    // 3. Message Text
    const messageText = new PIXI.Text({
      text: message,
      style: {
        fontFamily: 'Arial',
        fontSize: 20,
        fill: '#555555',
        align: 'center',
        wordWrap: true,
        wordWrapWidth: dialogWidth - 40
      }
    });
    messageText.anchor.set(0.5);
    messageText.position.set(dialogWidth / 2, 70);
    dialog.addChild(messageText);

    // 4. Buttons
    const btnWidth = showCancel ? 120 : 160;
    const btnHeight = 44;
    const btnY = 140;

    if (showCancel) {
      // Cancel Button (Left)
      const cancelBtn = this.createButton(
        cancelText,
        (dialogWidth / 2) - btnWidth - 10,
        btnY,
        btnWidth,
        btnHeight,
        '#555555',
        0xDDDDDD // Light Gray
      );
      cancelBtn.on('pointertap', () => {
        onCancel();
      });
      dialog.addChild(cancelBtn);
    }

    // Confirm Button (Right or Center)
    const confirmBtn = this.createButton(
      confirmText,
      showCancel ? (dialogWidth / 2) + 10 : (dialogWidth - btnWidth) / 2,
      btnY,
      btnWidth,
      btnHeight,
      '#FFFFFF',
      0x555555 // Dark Gray
    );
    confirmBtn.on('pointertap', () => {
      onConfirm();
    });
    dialog.addChild(confirmBtn);
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
        fontSize: 18,
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
