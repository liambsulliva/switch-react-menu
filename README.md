# Switch React Menu

A minimalist home menu for the Nintendo Switch, built with React. This project relies on react-tela, which allows React components to be mounted to a `<canvas>` element instead of a DOM. This allows the nx.js runtime to natively render the components to the screen.

## Features

- Clean, minimalist interface for launching Switch applications
- Smooth pagination for browsing through installed games
- Gamepad support with L/R shoulder buttons and directional controls
- Touch screen support
- Custom font integration (Source Sans Pro)
- Game icon display with truncated titles
- Selected game highlighting

## Technical Stack

- React 18
- TypeScript
- nx.js (Nintendo Switch JavaScript runtime)
- react-tela (canvas rendering library)
- esbuild

## Controls

- **L/R Shoulder Buttons**: Navigate between pages
- **D-Pad/Left Stick**: Navigate between games
- **A Button**: Launch selected game
- **Touch**: Select and launch games directly
- **Touch Navigation**: Use on-screen prev/next buttons

## Project Structure

- `/src` - Source code
  - `/components` - React components (AppIcon, Navigation)
  - `/hooks` - Custom React hooks for gamepad navigation
  - `/lib` - Utility functions
  - `/types` - TypeScript type definitions

## Building From Source

1. Install dependencies

```bash
npm i
```

2. Build the project (application bundle stored in /romfs/)

```bash
npm run build
```

3. Create a corresponding NRO/NSP file (Keys must be supplied for NSP)

```bash
npm run nro # Creates NRO file
npm run nsp # Creates NSP file
```
