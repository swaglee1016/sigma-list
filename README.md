# Sigma List

Eisenhower Matrix task manager — cross-platform (Web, Android, iOS) via Capacitor.

## Quick start

```sh
npm install
npm run dev        # → http://localhost:3000
```

## Build for Android

1. Install [Android Studio](https://developer.android.com/studio)
2. ```sh
   npm run build
   npx cap sync
   npx cap open android
   ```
3. In Android Studio: **Build → Build APK(s)**
4. APK at `android/app/build/outputs/apk/debug/app-debug.apk`

## Build for iOS (macOS only)

```sh
npx cap add ios
npx cap open ios
```

## Project structure

```
src/
  main.js / app.js    Entry point + DOM construction + event wiring
  constants.js        Quadrants, MAX=133, storage keys
  data/               storage (Preferences/localStorage) + task/note models
  views/              matrix / list / notes / calendar / modals
  services/           local notifications / haptics / JSON export
  utils/              dom helpers + date helpers
  styles/             10 CSS files (variables, matrix, list, notes, calendar, etc.)
```

## Features

- **Matrix** — 2x2 Eisenhower grid with drag-and-drop (desktop) and touch reorder (mobile)
- **List** — Active/Done sections sorted by quadrant priority
- **Calendar** — Month grid with due-date dots and daily task detail
- **Notes** — Card grid with markdown-ish preview
- **Due dates** with local notifications on native platforms
- **Export** — JSON backup via native share sheet or browser download
- **Offline** — pure local storage, no account required
