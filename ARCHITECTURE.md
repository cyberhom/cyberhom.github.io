# Atelier — architecture (GitHub Pages static edition)

## Runtime

- Static HTML: `index.html`
- Styling and responsive museum theme: `styles.css`
- Client-side behaviors and direct public API calls: `app.js`
- Lightweight atmospheric background: `ambient.js`
- Personal data: browser `localStorage` (`atelier.personal.v1`)

## External data

### Wikimedia Commons

- Search endpoint: `https://commons.wikimedia.org/w/api.php`
- Requests include `origin=*` to support cross-origin JSON access.
- Image results retain the file page URL, credit, and license metadata when exposed by the API.
- Commons is the only artwork discovery source in this deployment to avoid server proxies and the Art Institute API's browser CORS issue in the user's environment.

### Internet Archive

- Search endpoint: `https://archive.org/advancedsearch.php`
- Item metadata endpoint: `https://archive.org/metadata/{identifier}`
- Track audio streams from `https://archive.org/download/{identifier}/{file}` when a usable media file is available; otherwise the archive embed is used.
- Search and metadata are requested directly from the browser; there is no API key or server function.

## What GitHub Pages cannot do

GitHub Pages serves static assets. It does not execute `api/`, Netlify Functions, Node.js or Python server code. This static edition intentionally excludes all server files and never requests same-origin `/api/artic`, `/api/iiif` or `/api/music/*` endpoints.

## Personal storage

Works, ideas, favorites, study resources, and practice sessions are persisted locally using `localStorage`. JSON backup/restore is included; no personal entry is uploaded to an external service.
