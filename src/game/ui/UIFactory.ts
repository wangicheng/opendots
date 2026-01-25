
import * as PIXI from 'pixi.js';
import { scale } from '../config';

export class UIFactory {

  /**
   * Creates a standardized shadow graphics object.
   * @param width Width of the shadow
   * @param height Height of the shadow
   * @param borderRadius Radius for rounded corners (0 for rectangle)
   * @param blurStrength Strength of the blur filter
   * @param alpha Opacity of the shadow
   */
  public static createShadow(width: number, height: number, borderRadius: number = 0, blurStrength: number = 8, alpha: number = 0.3): PIXI.Graphics {
    const shadow = new PIXI.Graphics();
    if (borderRadius > 0) {
      shadow.roundRect(0, 0, width, height, borderRadius);
    } else {
      shadow.rect(0, 0, width, height);
    }
    shadow.fill({ color: 0x000000, alpha });
    shadow.filters = [new PIXI.BlurFilter({ strength: scale(blurStrength), quality: 3 })];
    // Standard offset
    shadow.position.set(0, scale(4));
    return shadow;
  }

  /**
   * Creates a standardized card background.
   * @param width Width of the card
   * @param height Height of the card
   * @param color Background color (default White)
   * @param borderRadius Radius for corners
   * @param borderColor Optional border color
   */
  public static createCardBackground(width: number, height: number, color: number = 0xFFFFFF, borderRadius: number = 0, borderColor?: number): PIXI.Graphics {
    const bg = new PIXI.Graphics();
    if (borderRadius > 0) {
      bg.roundRect(0, 0, width, height, borderRadius);
    } else {
      bg.rect(0, 0, width, height);
    }
    bg.fill(color);

    if (borderColor !== undefined) {
      bg.stroke({ width: 1, color: borderColor });
    }
    return bg;
  }

  /**
   * Creates a full-screen overlay for modals.
   * @param width Canvas width
   * @param height Canvas height
   * @param alpha Opacity
   */
  public static createOverlay(width: number, height: number, alpha: number = 0.5): PIXI.Graphics {
    const overlay = new PIXI.Graphics();
    overlay.rect(0, 0, width, height);
    overlay.fill({ color: 0x000000, alpha });
    return overlay;
  }

  /**
   * Creates an avatar container with async image loading, masking, and fallback.
   * @param radius Radius of the avatar circle
   * @param url Image URL (optional)
   * @param fallbackColor Color to show if no image (default gray)
   * @param strokeColor Border color (default light gray)
   */
  public static createAvatar(radius: number, url?: string, fallbackColor: number = 0xCCCCCC, strokeColor: number = 0xE0E0E0): PIXI.Container {
    const container = new PIXI.Container();

    // 1. Placeholder / Background
    const bg = new PIXI.Graphics();
    bg.circle(0, 0, radius);
    bg.fill(fallbackColor);
    container.addChild(bg);

    // 2. Load Image if URL exists
    if (url) {
      // Use Assets.load with async loading - handles extensionless URLs via browser fetch
      PIXI.Assets.load({
        src: url,
        parser: 'loadTextures',
      }).then((texture) => {
        if (container.destroyed) return;

        if (!texture) {
          console.warn('UIFactory: Avatar texture loaded is null/undefined', url);
          return;
        }

        const sprite = new PIXI.Sprite(texture);

        // Aspect Fit/Cover Logic (Cover)
        const aspect = sprite.width / sprite.height;
        if (aspect > 1) {
          sprite.height = radius * 2;
          sprite.width = sprite.height * aspect;
        } else {
          sprite.width = radius * 2;
          sprite.height = sprite.width / aspect;
        }
        sprite.anchor.set(0.5);

        // Circular Mask
        const mask = new PIXI.Graphics();
        mask.circle(0, 0, radius);
        mask.fill(0xFFFFFF);
        sprite.mask = mask;

        container.addChild(mask);
        container.addChild(sprite);

        // Border (re-drawn on top for sharpness)
        const border = new PIXI.Graphics();
        border.circle(0, 0, radius);
        border.stroke({ width: scale(4), color: strokeColor });
        container.addChild(border);
      }).catch((err) => {
        console.warn('UIFactory: Failed to load avatar', url, err);
      });
    } else {
      // If no URL, draw border on the fallback
      const border = new PIXI.Graphics();
      border.circle(0, 0, radius);
      border.stroke({ width: scale(4), color: strokeColor });
      container.addChild(border);
    }

    return container;
  }

  /**
   * Creates a standardized bootstrap-icon text.
   * Automatically handles padding to prevent clipping and sets anchor to center.
   * @param iconChar The unicode character for the icon
   * @param fontSize Font size (already scaled if needed, or pass raw and let caller scale?) 
   *                 Usually caller passes `scale(20)`. This method assumes the value passed is the desired final size.
   * @param color Fill color
   */
  public static createIcon(iconChar: string, fontSize: number, color: string | number): PIXI.Text {
    const icon = new PIXI.Text({
      text: iconChar,
      style: {
        fontFamily: 'bootstrap-icons',
        fontSize: fontSize,
        fill: color,
        padding: scale(5) // Fix: Prevent top/bottom clipping
      }
    });
    icon.anchor.set(0.5);
    return icon;
  }


  /**
   * Creates a standardized card container with Shadow and Background pre-added.
   * @param width Width of the card
   * @param height Height of the card
   * @param color Background color
   * @param borderRadius Corner radius
   */
  public static createCard(width: number, height: number, color: number = 0xFFFFFF, borderRadius: number = 0): PIXI.Container {
    const container = new PIXI.Container();

    // Shadow
    const shadow = this.createShadow(width, height, borderRadius);
    container.addChild(shadow);

    // Background
    const bg = this.createCardBackground(width, height, color, borderRadius);
    container.addChild(bg);

    return container;
  }

  /**
   * Creates a pill-shaped graphics (fully rounded rectangle).
   * @param width Width
   * @param height Height
   * @param color Fill color
   * @param strokeColor Optional stroke color
   * @param strokeWidth Optional stroke width
   */
  public static createPill(width: number, height: number, color: number | string, strokeColor?: number | string, strokeWidth: number = 1): PIXI.Graphics {
    const g = new PIXI.Graphics();
    const radius = height / 2;
    g.roundRect(0, 0, width, height, radius);
    g.fill(color);
    if (strokeColor !== undefined) {
      g.stroke({ width: strokeWidth, color: strokeColor });
    }
    return g;
  }

  /**
   * Creates a standardized simple button with background and text.
   * @param text Button text
   * @param width Width
   * @param height Height
   * @param bgColor Background color
   * @param textColor Text color
   * @param onClick Click handler
   * @param fontSize Font size
   */
  public static createButton(text: string, width: number, height: number, bgColor: number, textColor: string | number, onClick?: () => void, fontSize: number = 18): PIXI.Container {
    const btn = new PIXI.Container();

    const bg = this.createPill(width, height, bgColor);
    btn.addChild(bg);

    const btnText = new PIXI.Text({
      text: text,
      style: {
        fontFamily: 'Arial',
        fontSize: scale(fontSize),
        fill: textColor,
        fontWeight: 'bold'
      }
    });
    btnText.anchor.set(0.5);
    btnText.position.set(width / 2, height / 2);
    btn.addChild(btnText);

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    if (onClick) {
      btn.on('pointertap', onClick);
    }
    return btn;
  }

  /**
   * Creates a standardized Top Bar Icon Button (transparent background, standard size/color).
   * Used for Navigation, Settings, etc.
   * @param iconChar Bootstrap icon character
   * @param onClick Click handler
   */
  public static createTopBarButton(iconChar: string, onClick: () => void): PIXI.Container {
    const size = scale(52);
    const container = new PIXI.Container();

    // Invisible Hit Area
    const hitArea = new PIXI.Graphics();
    hitArea.rect(0, 0, size, size);
    hitArea.fill({ color: 0xFFFFFF, alpha: 0.001 });
    container.addChild(hitArea);

    // Icon
    const icon = this.createIcon(iconChar, scale(60), '#555555');
    icon.style.stroke = { color: '#555555', width: 0.5 };
    icon.position.set(size / 2, size / 2 + scale(2)); // Centered with visual correction
    container.addChild(icon);

    container.eventMode = 'static';
    container.cursor = 'pointer';
    container.on('pointertap', onClick);

    return container;
  }
}
