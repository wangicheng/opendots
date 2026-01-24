
import * as PIXI from 'pixi.js';
import { scale } from '../../config';

export class LinearControl extends PIXI.Container {
  private _value: number;
  private radius: number;
  private onChange: (value: number) => void;
  private stepPerTurn: number;
  private tickCount: number;
  private onDragStateChange?: (active: boolean) => void;

  private bg: PIXI.Graphics;
  private knob: PIXI.Graphics;
  private valueText: PIXI.Text;
  private textBg: PIXI.Graphics;

  private _isDragging: boolean = false;
  get IsDragging(): boolean {
    return this._isDragging;
  }
  private lastAngle: number = 0;

  constructor(radius: number, initialValue: number, onChange: (value: number) => void, options: { stepPerTurn?: number, tickCount?: number, onDragStateChange?: (active: boolean) => void } = {}) {
    super();
    this.radius = scale(radius);
    this._value = initialValue;
    this.onChange = onChange;
    this.stepPerTurn = options.stepPerTurn || 100;
    this.tickCount = options.tickCount || 10;
    this.onDragStateChange = options.onDragStateChange;

    // Setup Visuals
    this.bg = new PIXI.Graphics();
    this.addChild(this.bg);

    // Value Label Background
    this.textBg = new PIXI.Graphics();
    this.addChild(this.textBg);

    // Value Label
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
    this._value = val;
    this.render();
  }

  private render(displayVal?: number) {
    const valToRender = displayVal !== undefined ? displayVal : this._value;
    // 1. Background Ring
    this.bg.clear();
    this.bg.circle(0, 0, this.radius);
    this.bg.stroke({ width: scale(4), color: 0x555555 });
    this.bg.fill({ color: 0x222222, alpha: 0.8 });

    // Ticks
    const tickCount = this.tickCount;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2 - Math.PI / 2;
      const rStart = this.radius - scale(5);
      const rEnd = this.radius - scale(15);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      this.bg.moveTo(cos * rStart, sin * rStart);
      this.bg.lineTo(cos * rEnd, sin * rEnd);
      this.bg.stroke({ width: scale(2), color: 0x888888 });
    }

    // 2. Knob / Pointer
    this.knob.clear();

    // Calculate angle based on value within the step cycle
    // We want the knob to rotate as value changes.
    // angle = (value % step) / step * 2PI
    // But value can be negative.

    let cycleProgress = (valToRender % this.stepPerTurn) / this.stepPerTurn;
    if (cycleProgress < 0) cycleProgress += 1;

    const currentAngle = cycleProgress * Math.PI * 2 - Math.PI / 2;

    const kR = this.radius - scale(10);
    const kX = Math.cos(currentAngle) * kR;
    const kY = Math.sin(currentAngle) * kR;

    // Draw line from center
    // this.knob.moveTo(0, 0).lineTo(kX, kY).stroke({ width: scale(2), color: 0x00FF88 }); 
    // Just draw the head? Or distinct color for Linear.
    // DialControl uses 0x00AAFF (Blue). Let's use 0xFFCC00 (Yellow/Orange) for Linear to distinguish?
    // Or maybe Green. Let's stick to theme or distinct. The request didn't specify color.
    // I'll use a distinct color: 0x44DD88 (Greenish)
    const color = 0x44DD88;

    this.knob.moveTo(0, 0).lineTo(kX, kY).stroke({ width: scale(2), color });
    this.knob.circle(kX, kY, scale(6)).fill(color);

    // 3. Text
    this.valueText.text = valToRender.toFixed(1);

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

    // Map 2PI -> stepPerTurn
    const valueDelta = (delta / (Math.PI * 2)) * this.stepPerTurn;

    this._value += valueDelta;
    this.lastAngle = currentAngle;

    let outValue = this._value;
    if (dist < this.radius) {
      // Snap to ticks
      const step = this.stepPerTurn / this.tickCount;
      outValue = Math.round(this._value / step) * step;
    }

    this.onChange(outValue);
    this.render(outValue);
  }

  private onDragEnd() {
    this._isDragging = false;
    this.off('globalpointermove', this.onDragMove, this);
    this.off('pointerup', this.onDragEnd, this);
    this.off('pointerupoutside', this.onDragEnd, this);
    this.onDragStateChange?.(false);
  }
}
