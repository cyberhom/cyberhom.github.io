# Atelier — architecture (GitHub Pages static edition)

## Runtime

- Static HTML: `index.html`
- Styling and responsive museum theme: `styles.css`
- Client-side behaviors and static snapshot search: `app.js`
- GitHub Actions sync script: `scripts/sync-artic-data.mjs`
- Generated museum data snapshot: `data/artic-artworks.json`
- Lightweight atmospheric background: `ambient.js`
- Personal data: browser `localStorage` (`atelier.personal.v1`)

## External data

### Art Institute of Chicago

- Official API: `https://api.artic.edu/api/v1/artworks/search`
- The GitHub Actions workflow fetches public-domain works with available `image_id` values at deploy time and weekly.
- Data is stored as a static JSON snapshot at `data/artic-artworks.json`; the browser filters this snapshot locally, so it does not request the museum API directly and does not need CORS.
- Images use the official IIIF URL pattern: `https://www.artic.edu/iiif/2/{image_id}/full/843,/0/default.jpg`.
- This is not an unlimited live search over every museum record; it searches the synced selection of eight artist queries and ten thematic queries. The workflow keeps the site GitHub-only.

### Wikimedia Commons fallback

- Search endpoint: `https://commons.wikimedia.org/w/api.php`
- Requests include `origin=*` to support cross-origin JSON access.
- Commons is used only when the synced Art Institute snapshot contains no matching visible works or the snapshot cannot be loaded. Image results retain the file page URL, credit, and license metadata when available.

### Internet Archive

- Search endpoint: `https://archive.org/advancedsearch.php`
- Item metadata endpoint: `https://archive.org/metadata/{identifier}`
- Track audio streams from `https://archive.org/download/{identifier}/{file}` when a usable media file is available; otherwise the archive embed is used.
- Search and metadata are requested directly from the browser; there is no API key or server function.

## What GitHub Pages cannot do

GitHub Pages serves static assets. It does not execute `api/`, Netlify Functions, Node.js or Python server code. The official Art Institute API is therefore called by GitHub Actions before deployment; browsers load the resulting JSON snapshot. Internet Archive music and Wikimedia Commons fallback are requested directly from the browser.

## Personal storage

Works, ideas, favorites, study resources, and practice sessions are persisted locally using `localStorage`. JSON backup/restore is included; no personal entry is uploaded to an external service.
