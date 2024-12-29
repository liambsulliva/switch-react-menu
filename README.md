# Switch React Menu

A minimalist home menu for the Nintendo Switch, built with React. This project demonstrates how to create a custom home menu interface using React and react-tela, rendering React components directly to a canvas instead of the DOM.

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
- react-tela (React canvas renderer)
- esbuild (for bundling)
- nx.js (Nintendo Switch JavaScript runtime)
- TypeScript

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
- `/romfs` - Runtime files (fonts, bundled JavaScript)

## Building From Source

1. Install dependencies

```bash
npm i
```

2. Build the project (Application bundle stored in /romfs/)

```bash
npm run build
```

3. Create a corresponding NRO/NSP file (Keys must be supplied for NSP)

```bash
npm run nro # Creates NRO file
npm run nsp # Creates NSP file
```
