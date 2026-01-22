
export interface Pen {
  id: string;
  name: string;
  color: number; // Hex color
  width: number; // Pixels
  opacity: number;
  minDistance: number; // Pixels
  density: number;
  friction: number;
  restitution: number;
}

export const PENS: Pen[] = [
  {
    id: 'pencil',
    name: 'Pencil',
    color: 0x777777,
    width: 13,
    opacity: 1,
    minDistance: 18,
    density: 2.0,
    friction: 0.1,
    restitution: 0
  },
  {
    id: 'mechanicalpencil',
    name: 'Mechanical Pencil',
    color: 0x4C4C4C,
    width: 9,
    opacity: 0.7,
    minDistance: 18,
    density: 2.4,
    friction: 0.1,
    restitution: 0.02
  },
  {
    id: 'crayon',
    name: 'Crayon',
    color: 0xFC0014,
    width: 22,
    opacity: 1,
    minDistance: 18,
    density: 1.6,
    friction: 0.2,
    restitution: 0.06
  },
  {
    id: 'brush',
    name: 'Brush',
    color: 0xDC3B27,
    width: 51,
    opacity: 1,
    minDistance: 18,
    density: 1.6,
    friction: 0.2,
    restitution: 0.04
  },
  {
    id: 'roller',
    name: 'Roller',
    color: 0xD20000,
    width: 85,
    opacity: 1,
    minDistance: 18,
    density: 1.6,
    friction: 0.2,
    restitution: 0.06
  },
  {
    id: 'cranetrack',
    name: 'Crane Track',
    color: 0xC2C2C2,
    width: 38,
    opacity: 1,
    minDistance: 18,
    density: 4.5,
    friction: 0.6,
    restitution: 0.06
  }
];

export const DEFAULT_PEN = PENS[0];
