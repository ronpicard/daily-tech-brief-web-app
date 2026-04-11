# Daily Top Tech Brief

A React + Vite single-page app that aggregates top stories by topic (tech, economy, housing, US news, politics, health, finance, global, and more). It pulls from configurable RSS-style feeds and optionally GDELT, with clocks, local weather (Open-Meteo + browser geolocation), and a full-screen 10-day forecast.

**Live demo:** [GitHub Pages](https://ronpicard.github.io/daily-tech-brief-web-app/)

## Requirements

- Node.js 18+ (recommended)

## Scripts

| Command        | Description                          |
| -------------- | ------------------------------------ |
| `npm run dev`  | Start Vite dev server                |
| `npm run build`| Production build to `dist/`          |
| `npm run preview` | Serve the production build locally |
| `npm run deploy`  | Build and publish to `gh-pages` |

## Configuration

- **News region** and optional **GDELT** usage are controlled in the in-app **Settings** panel (stored in the browser).
- Weather uses [Open-Meteo](https://open-meteo.com/) (no API key) and optional [BigDataCloud](https://www.bigdatacloud.com/) client-side reverse geocoding for place names.

## Tech stack

- React 19
- Vite 8

## License

This project is licensed under the [MIT License](LICENSE).
