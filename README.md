# Switch React Menu

![Switch React Menu Mockup](mockup.png)

A minimalist home menu for the Nintendo Switch, built with React. This project relies on react-tela, which allows React components to be mounted to a `<canvas>` element instead of a DOM. This allows the nx.js runtime to natively render the components to the screen.

## Features

- Clean, minimalist interface for launching Switch applications
- Two home layouts: a horizontal **grid view** (default) and a scrollable **compact list view**
- Smooth horizontal scrolling through installed titles with L/R page jumps and prev/next navigation
- Gamepad support with shoulder buttons, D-pad/stick navigation, and held-input repeat
- Touch screen support for selecting titles and tapping on-screen controls
- Custom font integration (Source Sans Pro)
- Game icon display with truncated titles, selection highlighting, and a focus scale animation
- Digital clock in the top-right corner of the grid view
- Top-bar shortcuts for search, web browser, photo album, and settings
- Full-text **search** with `#tag` filtering, committed tag badges, and autocomplete from installed-game metadata
- Native Switch **virtual keyboard** integration for search and metadata editing (icons reflow above the keyboard while typing)
- **Rich game details** powered by a bundled IGDB catalog: summaries, release dates, tags, cover/background art, and YouTube trailers
- Locally cached rich-metadata and icon-derived gradient colors, with a manual **Rebuild local game database** action in settings
- **Hero detail panel** on the rich-details grid (expand with **Down** on a highlighted title): icon-tinted gradient backdrop, tag badges, trailer cards, and Play / Edit Info actions
- Per-title **metadata editor** for overriding catalog entries (title, release date, tags, summary, art URLs, trailers)
- **Settings menu** with toggles and actions for sorting, layout, and catalog behavior
- **Disable Rich Details** falls back to classic mode: compact list toggle, pagination style control, plain application-details modal on **−**, and no IGDB-backed metadata
- **Sorting modes**: Recently Played (stock), Alphabetical, Release Date, Times Opened, and Custom
- **Custom sort mode** with drag-to-reorder (hold **A**), hide/unhide titles (**X**), save (**+**), and cancel (**B** / **−**)
- **Last played** tracking with an optional “Last Played!” eyebrow on the most recent title
- Launch-count tracking for “Times Opened” sorting
- **Photo album** browser for SD-card screenshots with grid navigation, lightbox preview, and delete confirmation
- **Web applet** shortcut (opens the system browser via `Switch.WebApplet`)
- Pagination style toggle (**numerical** page label vs **dots**) when rich details are disabled
- Reusable UI primitives: `List`, `Modal`, `Button`, `Badge`, `Card`, `SearchBar`, and header-based panel layouts

## Technical Stack

- React 18
- TypeScript
- [nx.js](https://github.com/TooTallNate/nx.js) (Nintendo Switch JavaScript runtime)
- [react-tela](https://github.com/TooTallNate/react-tela) (canvas rendering library)
- ESBuild (for NRO/NSP bundle)
- Vite (for browser preview)

## Controls

### Grid home

- **L/R Shoulder Buttons**: Jump by one viewport of icons (also moves focus within hero trailer/action rows when open)
- **D-Pad/Left Stick (Left/Right)**: Move between games; in hero panel, navigate trailer cards and action buttons
- **D-Pad/Left Stick (Up/Down)**: Move focus between the icon row, top-bar shortcuts (search → globe → album → settings), and bottom navigation; when the hero detail panel is available, **Down** on a highlighted title expands it and **Up** collapses it
- **A Button**: Launch the selected game; activate the focused top-bar icon, nav arrow, hero action, or trailer
- **B Button**: Back out of nested UI; in the search field, delete a character (or dismiss when empty)
- **X Button**: In the search field, dismiss search; in custom sort, hide/unhide the selected title
- **Plus Button**: Open settings; in the search field, submit/confirm; in custom sort, save order
- **Minus Button**: With rich details disabled, open a plain application-details modal; in the search field, cancel; in custom sort, cancel; **B** / **−** also close most panels consistently
- **Touch**: Select and launch games; tap top-bar icons, the search bar, and on-screen prev/next buttons

### Compact list home

- **Up/Down**: Move through the title list; **Up** from the first row focuses settings
- **A Button**: Launch the selected title (tap again on an already-selected row)
- **Plus Button**: Open settings
- **Minus Button**: Open application details for the selected title

### Settings, album, and editor

- **Up/Down**: Move through list rows or album grid cells (with hold-to-repeat)
- **Left/Right** (album): Move between photos in the grid or lightbox
- **A Button**: Toggle a setting knob, trigger an action row, open a photo preview, or confirm a modal
- **B / Minus**: Close the current panel or modal (consistent across list-based screens)
- **X** (album): Delete the highlighted screenshot (confirmation modal)
- **Plus** (custom sort): Save the new order

## Project Structure

- `/src` - Source code
  - `/browser` - Browser-specific code (polyfills, mock data, entrypoint)
  - `/components` - Shared React components (`AppIcon`, `Navigation`, `SearchBar`, `List`, `Modal`, `Button`, `Badge`, etc.)
  - `/hooks` - Custom React hooks (`useGamepadNavigation`, `useSwitchVirtualKeyboard`, `useHeroSplashInlineExperience`)
  - `/layouts` - Reusable screen chrome (`HeaderLayout`)
  - `/lib` - Utilities (sorting, search, rich-details catalog/cache, icon gradients, colors, web applet helpers)
  - `/navigation` - Full-screen views (`GridHome`, `CompactHome`, `SettingsMenu`, `AlbumPage`, `HeroSplashPage`, `EditAppPage`, `CustomSortMode`)
  - `/settings` - Persistent settings and stores (sort order, hidden games, launch counts, last played)
  - `/types` - TypeScript type definitions
- `/public` - Static assets shipped in `romfs/` (includes `igdb-games-catalog.json`)
- `/scripts` - Node scripts (`fetch-igdb-games.mjs` for regenerating the IGDB catalog)

## Building From Source (for Switch)

1. Install dependencies

```bash
npm i
```

2. Build the project (application bundle stored in /romfs/)

```bash
npm run build:switch
```

3. Create a corresponding NRO/NSP file (Keys must be supplied for NSP)

```bash
npm run nro # Creates NRO file
npm run nsp # Creates NSP file
```

4. Run the application on the Switch through your preferred Homebrew Launcher!

### Regenerating the IGDB catalog (optional)

The rich-details experience reads `public/igdb-games-catalog.json`, which is copied into `romfs/` during `build:switch`. To refresh it from IGDB, add Twitch/IGDB credentials to `.env` and run:

```bash
npm run catalog:populate
```

Required variables: `VITE_IGDB_CLIENT_ID` and `VITE_IGDB_CLIENT_SECRET` (or the `IGDB_*` equivalents). On startup the app matches catalog entries to installed titles, caches hydrated metadata locally, and only re-fetches the bundled JSON when you trigger **Rebuild local game database** in settings.

## Building/Testing in the Browser (DOM)

`react-tela` renders to a generic `<canvas>`, so the same React tree that runs on Switch can be rendered in any modern browser once a few nx.js globals are polyfilled. This repository ships a Vite-based dev/prod pipeline that does exactly that, making it useful for quick iteration without needing to go through NRO/NSP bundling to test!

```bash
npm run dev             # http://localhost:5173 with Hot Module Replacement (HMR)
npm run build:browser   # static bundle in dist/browser
npm run preview         # build + preview the static bundle
```

### How it works

- `index.html` mounts a single `<canvas id="screen">` with a 1280x720 drawing buffer (the Switch's native resolution), CSS-scaled to fit the window it's running in.
- `src/browser/main.tsx` is the browser entry. It installs polyfills for the nx.js globals _before_ dynamically importing `App.tsx`, so app code runs in a sandbox of sorts.
- The polyfills (in `src/browser/polyfills/`) cover everything this project touches:
  | Polyfill | Replaces | Notes |
  |---|---|---|
  | `screen.ts` | `globalThis.screen` | Points at the real `<canvas>`; `screen.width`/`screen.height` return the buffer size. |
  | `fonts.ts` | `globalThis.fonts` | Aliases `document.fonts` so `fonts.add(new FontFace(...))` works. |
  | `switch.ts` | `globalThis.Switch` | Implements `Switch.readFile` (via `fetch`), `Switch.Application`, album APIs, and `Switch.WebApplet`. |
  | `virtual-keyboard.ts` | `navigator.virtualKeyboard` | Hidden DOM `<input>` stub so search and the metadata editor can use the same keyboard hooks as on-device. |
  | `keyboard-gamepad.ts` | `navigator.getGamepads` | Synthesizes a `Gamepad` whose buttons/axes are driven by the keyboard, using the same `Button` enum from `@nx.js/constants`. |
  | `mouse-touch.ts` | the `<canvas>` listener | Turns clicks into `touchstart`/`touchend` events so on-screen tap targets respond to mouse input. |
- Mock applications (`src/browser/mock-data/apps.ts`) generate gradient PNG icons at runtime via `OffscreenCanvas`. To preview real Switch icons instead, drop image files into `public/mock-icons/` and replace `generateIconBytes` with a `fetch()` call.

### Browser keyboard mapping

| Key                      | Switch input                                                          |
| ------------------------ | --------------------------------------------------------------------- |
| `←` `→` `↑` `↓` / `WASD` | D-pad + left stick (`Button.Left/Right/Up/Down`, `axes[0]`/`axes[1]`) |
| `Q` / `E`                | `Button.L` / `Button.R` (page back / forward)                         |
| `1` / `2`                | `Button.ZL` / `Button.ZR`                                             |
| `Enter` `Space` `Z`      | `Button.A` (launch)                                                   |
| `X`                      | `Button.B`                                                            |
| `C` / `V`                | `Button.Y` / `Button.X`                                               |
| `Backspace` `Esc`        | `Button.Minus`                                                        |
| `Tab`                    | `Button.Plus`                                                         |
| Mouse click on canvas    | Synthetic `touchstart`/`touchend` (drives `onTouchStart` props)       |

When a text field is focused in the browser, the hidden `<input>` captures typing; face-button mappings above still apply for confirm/cancel while the virtual-keyboard stub is open.

### Adding new nx.js APIs to the polyfill

When the app starts using a new `Switch.*` API, add a polyfill to `src/browser/polyfills/switch.ts`. Anything left uncovered throws an Exception on its first call, so it's easy to spot missing coverage during development.
