
import * as PIXI from 'pixi.js';
import { scale } from '../../config';
import { UIFactory } from '../UIFactory';
import type { EditorObject } from './ObjectSelector';
import { DialControl } from './DialControl';
import { LinearControl } from './LinearControl';

type PropDef = {
  key: string,
  label: string,
  type: 'number' | 'enum' | 'boolean',
  options?: string[],
  controlType?: 'dial' | 'linear',
  step?: number;
  tickCount?: number;
  getValue?: (data: any) => any;
  setValue?: (data: any, val: any) => void;
};

export class PropertyInspector extends PIXI.Container {
  private panelWidth: number;
  private panelHeight: number;
  private target: EditorObject;
  private onUpdate: () => void; // Call when property changes so Game can re-render
  private onInteractionStateChange?: (active: boolean) => void;

  private paramListContainer: PIXI.Container;
  private bg: PIXI.Container;
  private title: PIXI.Text;
  private adjusterContainer: PIXI.Container;
  private activeProp: PropDef | null = null;
  private activeControl: LinearControl | DialControl | null = null;

  private static lastActivePropMap: Record<string, string> = {};

  constructor(width: number, height: number, target: EditorObject, onUpdate: () => void, onInteractionStateChange?: (active: boolean) => void) {
    super();
    this.panelWidth = width;
    this.panelHeight = height;
    this.target = target;
    this.onUpdate = onUpdate;
    this.onInteractionStateChange = onInteractionStateChange;

    // Background
    const bg = UIFactory.createCardBackground(width, height, 0x333333, scale(12));
    bg.alpha = 0.8;
    this.addChild(bg);
    this.bg = bg;


    // Title
    const title = new PIXI.Text({
      text: 'Properties',
      style: {
        fontFamily: 'Arial',
        fontSize: scale(18),
        fill: 0xFFFFFF,
        fontWeight: 'bold'
      }
    });
    title.position.set(scale(20), scale(15));
    title.position.set(scale(20), scale(15));
    this.addChild(title);
    this.title = title;


    // Layout
    this.paramListContainer = new PIXI.Container();
    this.paramListContainer.position.set(scale(10), scale(50));
    this.addChild(this.paramListContainer);

    this.adjusterContainer = new PIXI.Container();
    this.adjusterContainer.position.set(width / 2, height - scale(150)); // Bottom area
    this.addChild(this.adjusterContainer);

    this.refreshParams();
  }

  private getProperties(): PropDef[] {
    const data = this.target.data;
    const type = this.target.type; // internal type string e.g. 'obstacle', 'falling'

    const props: PropDef[] = [
      { key: 'x', label: 'X', type: 'number', controlType: 'linear', step: 100 },
      { key: 'y', label: 'Y', type: 'number', controlType: 'linear', step: 100 }
    ];

    if (data.angle !== undefined) {
      props.push({ key: 'angle', label: 'Angle', type: 'number', controlType: 'linear', step: 360, tickCount: 24 });
    }

    if (data.radius !== undefined) {
      props.push({ key: 'radius', label: 'Radius', type: 'number' });
    }

    if (data.width !== undefined) {
      props.push({ key: 'width', label: 'Width', type: 'number' });
    }

    if (data.height !== undefined) {
      props.push({ key: 'height', label: 'Height', type: 'number' });
    }

    if (data.thickness !== undefined) {
      props.push({ key: 'thickness', label: 'Thick', type: 'number' });
    }

    if (data.meltTime !== undefined) {
      props.push({ key: 'meltTime', label: 'Melt Time', type: 'number', controlType: 'dial' });
    }

    if (data.acceleration !== undefined) {
      // Magnitude control
      props.push({
        key: 'acceleration',
        label: 'Accel',
        type: 'number',
        controlType: 'dial',
        getValue: (d) => Math.abs(d.acceleration || 0),
        setValue: (d, v) => {
          const sign = d.acceleration >= 0 ? 1 : -1;
          d.acceleration = v * sign;
        }
      });
      // Direction control
      props.push({
        key: 'accelDirection',
        label: 'Dir',
        type: 'enum',
        options: ['CW', 'CCW'],
        getValue: (d) => (d.acceleration || 0) >= 0 ? 'CW' : 'CCW',
        setValue: (d, v) => {
          const mag = Math.abs(d.acceleration || 0);
          d.acceleration = v === 'CW' ? mag : -mag;
        }
      });
    }

    // Enums
    if (type === 'obstacle' && (data.type === 'c_shape' || data.type === 'bezier')) {
      props.push({ key: 'cap', label: 'Cap', type: 'enum', options: ['round', 'butt'] });
    }

    return props;
  }

  private refreshParams() {
    this.paramListContainer.removeChildren();
    const props = this.getProperties();

    let x = 0;
    let y = 0;
    const btnWidth = this.panelWidth - scale(20);
    const btnHeight = scale(30);
    const gap = scale(10);

    props.forEach((prop) => {
      const isSelected = this.activeProp && this.activeProp.key === prop.key;
      const color = isSelected ? 0x00AAFF : 0x555555;

      const btn = new PIXI.Container();
      btn.position.set(x, y);

      const bg = new PIXI.Graphics();
      bg.roundRect(0, 0, btnWidth, btnHeight, 5);
      bg.fill({ color });

      if (!isSelected) {
        bg.stroke({ width: scale(1.5), color: 0xFFFFFF, alpha: 0.4 });
      }

      btn.addChild(bg);

      const text = new PIXI.Text({
        text: prop.label,
        style: { fontFamily: 'Arial', fontSize: 14, fill: 0xFFFFFF }
      });
      text.anchor.set(0.5);
      text.position.set(btnWidth / 2, btnHeight / 2);
      btn.addChild(text);

      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn.on('pointertap', () => {
        this.selectProp(prop);
      });

      this.paramListContainer.addChild(btn);

      y += btnHeight + gap;
    });

    // If no active prop, try to restore from history or select first
    if (!this.activeProp && props.length > 0) {
      const storageKey = this.getStorageKey();
      const savedPropKey = PropertyInspector.lastActivePropMap[storageKey];
      const savedProp = savedPropKey ? props.find(p => p.key === savedPropKey) : null;

      this.selectProp(savedProp || props[0]);
    } else if (this.activeProp) {
      // Re-render adjuster if prop already active
      this.renderAdjuster();
    }
  }

  private getStorageKey(): string {
    const type = this.target.type;
    const subType = this.target.data.type || '';
    return `${type}_${subType}`;
  }

  private selectProp(prop: PropDef) {
    this.activeProp = prop;

    // Save to history
    const storageKey = this.getStorageKey();
    PropertyInspector.lastActivePropMap[storageKey] = prop.key;

    this.refreshParams(); // To update selection visuals
    this.renderAdjuster();
  }

  private renderAdjuster() {
    this.adjusterContainer.removeChildren();
    this.activeControl = null;

    if (!this.activeProp) return;

    if (this.activeProp.type === 'number') {
      // Render Dial
      // Render Adjuster based on controlType
      const val = this.activeProp.getValue
        ? this.activeProp.getValue(this.target.data)
        : (this.target.data[this.activeProp.key] || 0);

      const onChange = (newVal: number) => {
        if (this.activeProp && this.target.data) {
          if (this.activeProp.setValue) {
            this.activeProp.setValue(this.target.data, newVal);
          } else {
            this.target.data[this.activeProp.key] = newVal;
          }
          this.onUpdate();
        }
      };

      if (this.activeProp.controlType === 'linear') {
        const linear = new LinearControl(50, val, onChange, {
          stepPerTurn: this.activeProp.step,
          tickCount: this.activeProp.tickCount,
          onDragStateChange: this.onInteractionStateChange
        });
        this.adjusterContainer.addChild(linear);
        this.activeControl = linear;
      } else {
        // Default to Dial
        const dial = new DialControl(50, val, onChange, {
          onDragStateChange: this.onInteractionStateChange
        });
        this.adjusterContainer.addChild(dial);
        this.activeControl = dial;
      }
    } else if (this.activeProp.type === 'enum' && this.activeProp.options) {
      // Render Enum Buttons
      let y = 0;
      const width = this.panelWidth - scale(40);
      const height = scale(30);

      this.activeProp.options.forEach(opt => {
        const currentVal = this.activeProp!.getValue
          ? this.activeProp!.getValue(this.target.data)
          : this.target.data[this.activeProp!.key];

        const isSelected = currentVal === opt;
        const color = isSelected ? 0x00AAFF : 0x555555;

        const btn = UIFactory.createButton(opt, width, height, color, 0xFFFFFF, () => {
          if (this.activeProp!.setValue) {
            this.activeProp!.setValue(this.target.data, opt);
          } else {
            this.target.data[this.activeProp!.key] = opt;
          }
          this.onUpdate();
          this.renderAdjuster(); // Re-render to update highlight
        }, 14);
        btn.position.set(-width / 2, y); // Centered
        this.adjusterContainer.addChild(btn);

        y += height + scale(10);
      });

      // Center vertically based on content
      const totalH = y - scale(10);
      this.adjusterContainer.position.set(this.panelWidth / 2, this.panelHeight - scale(50) - totalH / 2);
    }
  }

  public updateValuesFromTarget() {
    if (!this.activeProp || !this.target.data) return;

    // Only update if value is different (though controls usually handle this check)
    // But we need to handle specific properties only?
    // The inspector only shows one property at a time (activeProp).
    const val = this.activeProp.getValue
      ? this.activeProp.getValue(this.target.data)
      : this.target.data[this.activeProp.key];

    if (val !== undefined && this.activeControl) {
      this.activeControl.setValue(val);
    } else if (this.activeProp.type === 'enum') {
      // For enums, we might need to re-render adjuster to update button selection
      this.renderAdjuster();
    }
  }

  private fadeTicker: ((ticker: PIXI.Ticker) => void) | null = null;
  private targetGlassMode: boolean = false;

  public setGlassMode(enabled: boolean) {
    this.targetGlassMode = enabled;
    if (!this.fadeTicker) {
      this.fadeTicker = (ticker) => this.updateFade(ticker);
      PIXI.Ticker.shared.add(this.fadeTicker);
    }
  }

  private updateFade(ticker: PIXI.Ticker) {
    const dt = ticker.deltaTime;
    const lerpSpeed = 0.1 * dt;
    const epsilon = 0.01;
    let allDone = true;

    // Background
    const bgTarget = this.targetGlassMode ? 0.1 : 0.8;
    if (Math.abs(this.bg.alpha - bgTarget) > epsilon) {
      this.bg.alpha += (bgTarget - this.bg.alpha) * lerpSpeed;
      allDone = false;
    } else {
      this.bg.alpha = bgTarget;
    }

    // Title & Params
    const contentTarget = this.targetGlassMode ? 0.1 : 1.0;

    if (Math.abs(this.title.alpha - contentTarget) > epsilon) {
      this.title.alpha += (contentTarget - this.title.alpha) * lerpSpeed;
      allDone = false;
    } else {
      this.title.alpha = contentTarget;
    }

    if (Math.abs(this.paramListContainer.alpha - contentTarget) > epsilon) {
      this.paramListContainer.alpha += (contentTarget - this.paramListContainer.alpha) * lerpSpeed;
      allDone = false;
    } else {
      this.paramListContainer.alpha = contentTarget;
    }

    // Adjuster
    let adjusterTarget = contentTarget;
    if (this.activeControl && this.activeControl.IsDragging) {
      adjusterTarget = 1.0;
    }

    if (Math.abs(this.adjusterContainer.alpha - adjusterTarget) > epsilon) {
      this.adjusterContainer.alpha += (adjusterTarget - this.adjusterContainer.alpha) * lerpSpeed;
      allDone = false;
    } else {
      this.adjusterContainer.alpha = adjusterTarget;
    }

    if (allDone) {
      PIXI.Ticker.shared.remove(this.fadeTicker!);
      this.fadeTicker = null;
    }
  }

  public destroy(options?: any) {
    if (this.fadeTicker) {
      PIXI.Ticker.shared.remove(this.fadeTicker);
      this.fadeTicker = null;
    }
    super.destroy(options);
  }
}

