
import * as PIXI from 'pixi.js';
import { scale } from '../../config';

export class DialControl extends PIXI.Container {
  private radius: number;
  private onChange: (value: number) => void;
  private onDragStateChange?: (active: boolean) => void;

  private bg: PIXI.Graphics;
  private knob: PIXI.Graphics;
  private exponentText: PIXI.Text;
  private valueText: PIXI.Text;
  private textBg: PIXI.Graphics;

  private _isDragging: boolean = false;

  get IsDragging(): boolean {
    return this._isDragging;
  }
  private lastAngle: number = 0;

  // Scientific notation parts
  private mantissa: number = 1; // [1, 10)
  private exponent: number = 0; // Integer

  constructor(radius: number, initialValue: number, onChange: (value: number) => void, options?: { onDragStateChange?: (active: boolean) => void }) {
    super();
    this.radius = scale(radius);
    this.onChange = onChange;
    this.onDragStateChange = options?.onDragStateChange;

    this.decomposeValue(initialValue);

    // Setup Visuals
    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    // Center Label (10^n)
    this.exponentText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(16),
        fill: 0xAAAAAA,
        align: 'center',
        fontWeight: 'bold'
      }
    });
    this.exponentText.anchor.set(0.5);
    this.addChild(this.exponentText);

    // Value Label Background
    this.textBg = new PIXI.Graphics();
    this.addChild(this.textBg);

    // Value Label (Current Value)
    this.valueText = new PIXI.Text({
      text: '',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(14),
        fill: 0xFFFFFF,
        align: 'center'
      }
    });
    this.valueText.anchor.set(0.5);
    this.valueText.position.set(0, this.radius + scale(25));
    this.addChild(this.valueText);

    this.knob = new PIXI.Graphics();
    this.addChild(this.knob);

    // Interaction
    this.eventMode = 'static';
    this.cursor = 'grab';
    this.on('pointerdown', this.onDragStart, this);

    this.render();
  }

  public setValue(val: number) {
    if (this._isDragging) return; // Don't fight user input
    this.decomposeValue(val);
    this.render();
  }

  private decomposeValue(val: number) {
    if (val === 0) {
      this.mantissa = 1;
      this.exponent = 0;
      return;
    }
    const absVal = Math.abs(val);
    const log = Math.log10(absVal);
    this.exponent = Math.floor(log);
    this.mantissa = absVal / Math.pow(10, this.exponent);

    // Safety clamp
    if (this.mantissa < 1) {
      this.mantissa = 1;
    } else if (this.mantissa >= 10) {
      this.mantissa = 1;
      this.exponent++;
    }
  }

  private render(visualMantissa?: number, visualExponent?: number) {
    const m = visualMantissa !== undefined ? visualMantissa : this.mantissa;
    const e = visualExponent !== undefined ? visualExponent : this.exponent;

    // 1. Background Ring
    this.bg.clear();
    this.bg.circle(0, 0, this.radius);
    this.bg.stroke({ width: scale(4), color: 0x555555 });
    this.bg.fill({ color: 0x222222, alpha: 0.8 });

    // Ticks
    for (let i = 1; i <= 9; i++) {
      // Map 1 -> -PI/2, 10 -> 3PI/2
      // Fraction (i - 1) / 9
      // Wait, 1 to 9 are the numbers displayed.
      // Range 1..10. 1 is start, 10 is (wraps to 1).
      // Angle = (val - 1) / 9 * 2PI - PI/2 ??
      // Let's say: 1 is top (-90deg). 5.5 is bottom (90deg). 10 is top again.

      const val = i;
      const fraction = (val - 1) / 9;
      const angle = fraction * Math.PI * 2 - Math.PI / 2;

      const rStart = this.radius - scale(5);
      const rEnd = this.radius - scale(15);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      this.bg.moveTo(cos * rStart, sin * rStart);
      this.bg.lineTo(cos * rEnd, sin * rEnd);
      this.bg.stroke({ width: scale(2), color: 0x888888 });

      // Numbers? Too small maybe, draw standard 1, 5, 9?
      // Let's just draw ticks.
    }

    // 2. Knob / Pointer
    this.knob.clear();
    const currentFraction = (m - 1) / 9;
    const currentAngle = currentFraction * Math.PI * 2 - Math.PI / 2;

    const kR = this.radius - scale(10);
    const kX = Math.cos(currentAngle) * kR;
    const kY = Math.sin(currentAngle) * kR;

    // Draw line from center
    this.knob.moveTo(0, 0).lineTo(kX, kY).stroke({ width: scale(2), color: 0x00AAFF });
    // Draw knob head
    this.knob.circle(kX, kY, scale(6)).fill(0x00AAFF);

    // 3. Text
    // 10^n
    // Use superscript logic if possible? or just ^
    // "10" then small n?
    // Let's just use "10^n" format or clean "e+n"
    this.exponentText.text = `10^${e}`;

    // Value
    // Format to 2 decimal places?
    // If n is large, use scientific? 
    // The components are a=... n=...
    // Let's show "a * 10^n" format basically?
    // Or just the raw number if it fits.
    const val = m * Math.pow(10, e);
    if (Math.abs(val) < 1000 && Math.abs(val) > 0.01) {
      this.valueText.text = val.toPrecision(3);
    } else {
      this.valueText.text = val.toExponential(2);
    }

    // Update Text Background
    this.textBg.clear();
    const width = this.valueText.width;
    const height = this.valueText.height;
    const pad = scale(4);
    this.textBg.roundRect(
      -width / 2 - pad,
      this.radius + scale(25) - height / 2 - pad,
      width + pad * 2,
      height + pad * 2,
      pad
    );
    this.textBg.fill({ color: 0x000000, alpha: 0.6 });
  }

  private onDragStart(e: PIXI.FederatedPointerEvent) {
    this._isDragging = true;
    const local = this.toLocal(e.global);
    this.lastAngle = Math.atan2(local.y, local.x);

    // Using global listeners for drag
    this.on('globalpointermove', this.onDragMove, this);
    this.on('pointerup', this.onDragEnd, this);
    this.on('pointerupoutside', this.onDragEnd, this);
    this.onDragStateChange?.(true);
  }

  private onDragMove(e: PIXI.FederatedPointerEvent) {
    if (!this._isDragging) return;

    const local = this.toLocal(e.global);
    const dist = Math.sqrt(local.x * local.x + local.y * local.y);


    const currentAngle = Math.atan2(local.y, local.x);

    let delta = currentAngle - this.lastAngle;

    // Normalize Delta (-PI to PI)
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    // Detect Wraps
    // We update mantissa based on delta
    // Map: 2PI radians = 9 units of mantissa
    // mantissa += (delta / (2PI)) * 9

    const mantissaDelta = (delta / (Math.PI * 2)) * 9;

    let newMantissa = this.mantissa + mantissaDelta;

    // Handle wrap (cross 10 -> 1 or 1 -> 10)
    // Actually we implemented linear mapping [1, 10).
    // If newMantissa >= 10:
    //   exponent++;
    //   newMantissa -= 9; (wrap back to 1. Something -> 1.something)
    //   Wait, 10 maps to 1.
    //   If I am at 9.9 and add 0.2 -> 10.1. Should be 1.1 with exp+1.
    //   So newMantissa = 1 + (10.1 - 10) = 1.1.
    //   General: if > 10 => val = 1 + (val - 10), exp++

    if (newMantissa >= 10) {
      newMantissa = 1 + (newMantissa - 10);
      this.exponent++;
    } else if (newMantissa < 1) {
      // e.g. 1.1 - 0.2 = 0.9.
      // Should wrap to 9.9 with exp--.
      // 0.9 -> 10 - (1 - 0.9) = 9.9.
      newMantissa = 10 - (1 - newMantissa);
      this.exponent--;
    }

    this.mantissa = newMantissa;
    this.lastAngle = currentAngle;

    // Snapping logic for output/render
    let outMantissa = this.mantissa;
    if (dist < this.radius) {
      // Snap to integer (ticks)
      outMantissa = Math.round(this.mantissa);
      // Clamp to valid range if needed (though round handles it roughly)
      if (outMantissa < 1) outMantissa = 1;
      if (outMantissa > 10) outMantissa = 10;
    }

    const outValue = outMantissa * Math.pow(10, this.exponent);
    this.onChange(outValue);
    this.render(outMantissa, this.exponent);
  }

  private onDragEnd() {
    this._isDragging = false;
    this.off('globalpointermove', this.onDragMove, this);
    this.off('pointerup', this.onDragEnd, this);
    this.off('pointerupoutside', this.onDragEnd, this);
    this.onDragStateChange?.(false);
  }
}
