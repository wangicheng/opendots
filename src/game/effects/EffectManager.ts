import * as PIXI from 'pixi.js';

export class EffectManager {
  private container: PIXI.Container;
  private activeEffects: PIXI.Container[] = [];

  constructor(container: PIXI.Container) {
    this.container = container;
  }

  /**
   * Create an expanding ring explosion effect
   * @param x Center X
   * @param y Center Y
   * @param color Color of the rings
   * @param count Number of rings (default 3)
   */
  createRingExplosion(x: number, y: number, color: number, count: number = 3): void {
    const explosion = new PIXI.Container();
    explosion.position.set(x, y);
    this.container.addChild(explosion);
    this.activeEffects.push(explosion);

    for (let i = 0; i < count; i++) {
      // Stagger the rings
      setTimeout(() => {
        if (explosion.destroyed) return;
        this.createSingleRing(explosion, color);
      }, i * 200);
    }

    // Auto cleanup after some time (approximate duration of effect)
    setTimeout(() => {
      if (!explosion.destroyed) {
        explosion.destroy({ children: true });
        const index = this.activeEffects.indexOf(explosion);
        if (index !== -1) {
          this.activeEffects.splice(index, 1);
        }
      }
    }, 2000); // 1s visual + delay
  }

  /**
   * Create a particle explosion effect for ball disappearance
   * @param x Center X
   * @param y Center Y
   * @param shape Shape of the particles ('circle' | 'star')
   */
  createParticleExplosion(x: number, y: number, color: number, type: 'circle' | 'star' = 'circle'): void {
    const explosion = new PIXI.Container();
    explosion.position.set(x, y);
    this.container.addChild(explosion);
    this.activeEffects.push(explosion);

    const particles: { sprite: PIXI.Graphics, vx: number, vy: number }[] = [];
    const PARTICLE_COUNT = 30;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = 4 + Math.random() * 6; // Random size small balls
      const particle = new PIXI.Graphics();

      if (type === 'star') {
        this.drawStar(particle, 0, 0, 5, radius, radius / 2);
      } else {
        particle.circle(0, 0, radius);
      }

      particle.fill({ color: color });
      explosion.addChild(particle);

      // Random direction
      const angle = Math.random() * Math.PI * 2;
      // Speed starts fast
      const speed = 4 + Math.random() * 8;

      particles.push({
        sprite: particle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed
      });
    }

    const ticker = PIXI.Ticker.shared;
    const animate = () => {
      if (explosion.destroyed) {
        ticker.remove(animate);
        return;
      }

      for (const p of particles) {
        p.sprite.x += p.vx;
        p.sprite.y += p.vy;

        // Decelerate (fast to slow)
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
    };

    ticker.add(animate);

    // Shrink and destroy
    setTimeout(() => {
      // Start shrinking
      const shrinkTicker = () => {
        if (explosion.destroyed) {
          ticker.remove(shrinkTicker);
          return;
        }

        let allShrunk = true;
        for (const p of particles) {
          if (p.sprite.scale.x > 0) {
            p.sprite.scale.x -= 0.05;
            p.sprite.scale.y -= 0.05;
            if (p.sprite.scale.x < 0) {
              p.sprite.scale.set(0);
            }
            allShrunk = false;
          }
        }

        if (allShrunk) {
          ticker.remove(shrinkTicker);
          ticker.remove(animate);
          explosion.destroy({ children: true });
          const index = this.activeEffects.indexOf(explosion);
          if (index !== -1) {
            this.activeEffects.splice(index, 1);
          }
        }
      }
      ticker.add(shrinkTicker);
    }, 1000);
  }

  private createSingleRing(parent: PIXI.Container, color: number): void {
    const ring = new PIXI.Graphics();
    ring.circle(0, 0, 10); // Start small
    ring.stroke({ width: 10, color: color });
    ring.alpha = 1;

    // Add misty/blur effect
    const blurFilter = new PIXI.BlurFilter();
    blurFilter.strength = 3; // Very strong blur for misty edge
    blurFilter.quality = 2; // Better quality
    ring.filters = [blurFilter];

    parent.addChild(ring);

    // Animate
    let scale = 1;
    let alpha = 0.8;

    const animate = () => {
      if (ring.destroyed) return;

      scale += 1.25; // Expand speed (much faster to cover screen)
      alpha -= 0.01; // Fade speed (slower to last longer)

      ring.clear();
      ring.circle(0, 0, 10 * scale);
      ring.stroke({ width: 10, color: color, alpha: alpha }); // Very thick stroke for strong blur

      // Actually, stroke width scaling might look weird if we don't adjust. 
      // Simplest is to just scale the graphics object if we didn't clear/redraw, 
      // but clearing allows better quality.
      // Let's rely on scaling the graphics object for performance if possible, 
      // but stroke width scales then.
      // Let's just redraw for now, simple circles are cheap.

      if (alpha <= 0) {
        ring.destroy();
        ticker.remove(animate);
      }
    };

    // Need access to a ticker. 
    // Ideally EffectManager should update every frame, or we use a temporary ticker listener.
    // For simplicity, let's attach to the shared ticker or just use requestAnimationFrame loop if we don't have safe access to app.ticker here.
    // Actually PIXI.Ticker.shared is usually available.

    const ticker = PIXI.Ticker.shared;
    ticker.add(animate);
  }

  /**
   * Update all active effects
   * (If we needed manual update logic, but here we used shared ticker)
   */
  update(): void {
    // 
  }

  clear(): void {
    for (const effect of this.activeEffects) {
      if (!effect.destroyed) {
        effect.destroy({ children: true });
      }
    }
    this.activeEffects = [];
  }

  private drawStar(g: PIXI.Graphics, cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    g.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      g.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      g.lineTo(x, y);
      rot += step;
    }
    g.lineTo(cx, cy - outerRadius);
    g.closePath();
  }
}
