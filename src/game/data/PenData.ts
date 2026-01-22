
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
    density: 1.0,
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
    density: 1.2,
    friction: 0.1,
    restitution: 0.02
  },
  {
    id: 'crayon',
    name: 'Crayon',
    color: 0xFC0014,
    width: 22,
    opacity: 1,
    minDistance: 20,
    density: 0.8,
    friction: 0.2,
    restitution: 0.06
  }
];

export const DEFAULT_PEN = PENS[0];
