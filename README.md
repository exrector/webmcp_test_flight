# FlightDeck

A static, WebMCP-enabled directory for discovering public TestFlight betas.

## What works now

- Responsive catalog UI.
- Text search and category / availability filters.
- Shareable filter state in the URL.
- Catalog data loaded from `apps.json`.
- Graceful fallback in browsers without WebMCP.
- Six WebMCP tools registered through `document.modelContext.registerTool()`:
  - `search_testflight_apps`
  - `get_testflight_app`
  - `list_testflight_categories`
  - `get_catalog_stats`
  - `filter_visible_catalog`
  - `prepare_testflight_join`
- HTTPS-ready deployment through GitHub Pages.

The current records are deliberately marked **DEMO**. They are not presented as real TestFlight programs.

## Add a real TestFlight entry

Edit `apps.json` and add an object:

```json
{
  "id": "unique-stable-id",
  "name": "App Name",
  "developer": "Developer",
  "category": "Games",
  "platforms": ["iOS", "iPadOS"],
  "availability": "open",
  "description": "Short description.",
  "tags": ["strategy", "multiplayer"],
  "testflightUrl": "https://testflight.apple.com/join/XXXXXXXX",
  "demo": false,
  "updatedAt": "2026-08-27"
}
```

Recommended availability values: `open`, `limited`, `closed`, `demo`.

## Run locally

Because the catalog is fetched from JSON, serve the folder over HTTP instead of opening `index.html` as a `file://` URL.

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

WebMCP itself requires a secure context in normal use; GitHub Pages provides HTTPS.

## GitHub Pages

A Pages deployment workflow is included in `.github/workflows/pages.yml`.

If Pages has never been enabled for this repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Run the **Deploy FlightDeck to GitHub Pages** workflow, or push a commit to `main`.

Expected site URL:

`https://exrector.github.io/webmcp_test_flight/`

## WebMCP browser support

WebMCP is experimental. The page feature-detects `document.modelContext.registerTool()` and remains a normal website when the API is unavailable.

The current imperative API is intentionally isolated in `app.js`, so spec changes can be updated without rebuilding the rest of the site.

## Structure

```
index.html
styles.css
app.js
apps.json
.github/workflows/pages.yml
```

## Independence

FlightDeck is an independent prototype and is not affiliated with Apple. TestFlight is a trademark of Apple Inc.
