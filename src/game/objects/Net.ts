import * as PIXI from 'pixi.js';
import RAPIER from '@dimforge/rapier2d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SCALE, COLLISION_GROUP } from '../config';
import type { NetConfig } from '../levels/LevelSchema';

export class Net {
  public graphics: PIXI.Container;
  private sprite: PIXI.TilingSprite;
  private border: PIXI.Graphics;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;

  constructor(physicsWorld: PhysicsWorld, config: NetConfig) {
    this.graphics = new PIXI.Container();
    this.graphics.x = config.x;
    this.graphics.y = config.y;
    if (config.angle) {
      this.graphics.rotation = config.angle * (Math.PI / 180);
    }

    // Create tiling sprite for the net pattern
    const texture = PIXI.Texture.from('/object_ami.png');
    this.sprite = new PIXI.TilingSprite({
      texture,
      width: config.width,
      height: config.height
    });

    // Create mask for rounded corners
    const radius = 5;
    const mask = new PIXI.Graphics();
    mask.roundRect(0, 0, config.width, config.height, radius);
    mask.fill(0xffffff);
    this.sprite.mask = mask;
    this.graphics.addChild(this.sprite);
    this.graphics.addChild(mask); // Add mask to container

    // Create border
    this.border = new PIXI.Graphics();
    this.border.roundRect(0, 0, config.width, config.height, radius);
    this.border.stroke({ width: 2, color: 0x808080 }); // #808080 border
    this.graphics.addChild(this.border);

    // --- Physics Setup (Sensor) ---
    const world = physicsWorld.getWorld();
    const R = physicsWorld.getRAPIER();

    // Calculate center relative to top-left anchor for physics body
    // Pixi container is at (x,y), but content is drawn from (0,0) to (w,h)
    // Rapier body center should be at center of the rect
    // We can set body at (x,y) and offset the collider, OR set body at center.
    // Let's set body at center to handle rotation easily.

    // Note: The previous manual implementation handled rotation around the top-left (implicitly via container).
    // To match visual exactly with physics:
    // 1. Center of the rect in local coords: (w/2, h/2)
    // 2. We need to position the body such that the visual rotates around the pivot expected by the config.
    // The previous code did: graphics.rotation = angle. That rotates around (0,0) of the container.
    // So the visual pivot is top-left.

    // Position of the center in the world:
    // We must rotate the local center (w/2, h/2) by 'angle' and add to (x,y)
    const rad = (config.angle || 0) * (Math.PI / 180);
    const w2 = config.width / 2;
    const h2 = config.height / 2;

    // Local center relative to pivot (0,0)
    const cx = w2;
    const cy = h2;

    // Rotate (cx, cy)
    const rotatedCx = cx * Math.cos(rad) - cy * Math.sin(rad);
    const rotatedCy = cx * Math.sin(rad) + cy * Math.cos(rad);

    const worldCenterX = config.x + rotatedCx;
    const worldCenterY = config.y + rotatedCy;

    const physicsPos = physicsWorld.toPhysics(worldCenterX, worldCenterY);

    const rigidBodyDesc = R.RigidBodyDesc.fixed()
      .setTranslation(physicsPos.x, physicsPos.y)
      .setRotation(rad); // Use positive radians for Rapier to match Pixi (if coordinate systems align, but usually Rapier is CCW, Pixi is CW... wait. Game.ts uses -angle for falling objects. Let's check config.)
    // FallingObject: graphics.rotation = (effectiveAngle * Math.PI) / 180;
    // FallingObject body: setRotation(-(effectiveAngle * Math.PI) / 180);
    // It seems Pixi is CW (positive down-screen), Rapier is CCW (standard math).
    // So we should invert the angle for physics.

    rigidBodyDesc.setRotation(-rad);

    this.body = world.createRigidBody(rigidBodyDesc);

    const colliderDesc = R.ColliderDesc.cuboid(
      (config.width / 2) / SCALE,
      (config.height / 2) / SCALE
    )
      .setSensor(true) // Crucial: It's a sensor!
      .setCollisionGroups(COLLISION_GROUP.NET);

    this.collider = world.createCollider(colliderDesc, this.body);
  }

  /**
   * Clean up resources
   */
  destroy(physicsWorld: PhysicsWorld): void {
    physicsWorld.getWorld().removeRigidBody(this.body);
    this.graphics.destroy({ children: true });
  }
}
