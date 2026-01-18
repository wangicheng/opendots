
export interface Pen {
  id: string;
  name: string;
  color: number; // Hex color
  width: number; // Pixels
  minDistance: number; // Pixels
  density: number;
  friction: number;
  restitution: number;
}

export const PENS: Pen[] = [
  {
    id: 'pencil',
    name: 'Pencil',
    color: 0x555555,
    width: 5,
    minDistance: 10,
    density: 1.0,
    friction: 0.5,
    restitution: 0.0
  },
  {
    id: 'ballpoint',
    name: 'Ballpoint',
    color: 0x0000AA, // Blue-ish
    width: 4,
    minDistance: 8,
    density: 1.2,
    friction: 0.4,
    restitution: 0.2
  },
  {
    id: 'marker',
    name: 'Marker',
    color: 0x333333, // Dark
    width: 10,
    minDistance: 15,
    density: 0.8,
    friction: 0.8,
    restitution: 0.05
  },
  {
    id: 'feather',
    name: 'Feather',
    color: 0xAAAAAA, // Light Gray
    width: 3,
    minDistance: 5,
    density: 0.5,
    friction: 0.1,
    restitution: 0.5
  },
  {
    id: 'crayon',
    name: 'Crayon',
    color: 0xFFA500, // Orange
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen5',
    name: 'Pen5',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen6',
    name: 'Pen6',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen7',
    name: 'Pen7',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen8',
    name: 'Pen8',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen9',
    name: 'Pen9',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen10',
    name: 'Pen10',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  },
  {
    id: 'pen11',
    name: 'Pen11',
    color: 0xFFA500,
    width: 12,
    minDistance: 20,
    density: 1.5,
    friction: 0.9,
    restitution: 0.0
  }
];

export const DEFAULT_PEN = PENS[0];
