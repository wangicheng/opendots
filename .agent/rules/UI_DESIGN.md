---
trigger: manual
description: UI & Visual Design Guidelines
---

# UI & Visual Design Guidelines

This document serves as the single source of truth for the visual style and UI components of the OpenDots project. Agents should refer to this whenever creating or modifying user interfaces.

## Typography

- **Font Families**: 
  - Canvas UI: `Arial` (Standard system font for Pixi text).
  - Icons: `bootstrap-icons` (Unicode characters).
  - DOM/HTML overlay: `Inter`, margin-left: system-ui, sans-serif.
- **Colors**:
  - **Primary Text**: `#555555` (Dark Grey) - Used for titles and active states.
  - **Secondary/Inactive**: `#AAAAAA` (Light Grey) - Used for placeholder text or inactive buttons.
  - **Headings**: `#3E3E3E` or `#555555`, typically **Bold**.
  - **Light Text**: `#FFFFFF` (White) - Used on dark backgrounds or colored buttons.

## Components

### Cards (Level Selection)
- **Container**:
  - Background: White (`0xFFFFFF`).
  - Shape: Sharp corners.
  - Shadow: Soft blur (`Blur: 8`, `Alpha: 0.3`, `Y-offset: 4`).
- **Status Pills** (Top Left):
  - *Untested*: Light Grey background (`#EEEEEE`), Grey text.
  - *Draft*: Medium Grey background (`#888888`), White text.
  - *Likes*: Semi-transparent Black (`Alpha 0.4`), White text & Icon.
- **Avatar** (Bottom Right):
  - Circle with unique colored fill.
  - White stroke (2-3px) to separate from card content.

### Popups & Modals
- **Overlay**: Full-screen Black with `Alpha 0.35`.
- **Main Container**:
  - Centered on screen.
  - Background: White (`0xFFFFFF`).
  - Drop Shadow: Distinct to separate from background.
- **Header**:
  - **Close Button**: Circle background (`#555555`) with White '×' text.
  - **Title**: Large, clear font (`#3E3E3E`).
- **Buttons**:
  - **Primary**: Pill-shaped or rounded rectangle.
  - **Primary Color**: Blue (`#37A4E9`).
  - **Text**: White.
- **Badges**:
  - Background: Light Grey (`#F2F2F2`).
  - Content: Dark Icons/Text.

### Icons & Buttons (Header)
- **Library**: `bootstrap-icons` via Unicode string.
- **Navigation Buttons**:
  - Style: Simple text (e.g., "Latest", "Popular").
  - Active: Bold, `#555555`.
  - Inactive: Normal, `#AAAAAA`.
- **Circular Action Buttons**:
  - Invisible hit area for better touch targets.
  - Icon color: `#555555`.
- **FAB (Floating Action Button)**:
  - Location: Typically Bottom Right.
  - Shape: Circle with shadow.
  - Content: Large '+' symbol.

### Toggle Switches (Edit/Play)
- **Container**: Rounded capsule shape, White background.
- **Highlight**: Moving active area.
  - Edit Mode: Left side, Grey (`#555555`), Custom shape merging circle + rect.
  - Play Mode: Right side, Grey (`#555555`).
- **Text**: White on active side, Dark Grey on inactive side.

### Editor Interface
- **Toolbar (Bottom)**:
  - Background: Dark Grey (`#333333`), High Alpha (`0.8`).
- **Tabs**:
  - Attached to the top of the toolbar.
  - Active: Match toolbar color (`#333333`).
  - Inactive: Lighter Grey (`#555555`).
- **Tool Items**:
  - Style: Icon-based (Shapes).
  - Interaction: Drag & Drop.

## Canvas & Global Layout
- **Aspect Ratio**: 16:9 fixed logic (via `config.ts`).
- **Background**:
  - Page (HTML): Dark (`#242424`).
  - Canvas (Game): Off-white (`0xF5F5F5`) with Light Blue (`0xE0EFFF`) grid.
- **Shadow**: Deep drop shadow on the canvas element (`0 20px 60px rgba(0,0,0,0.4)`).