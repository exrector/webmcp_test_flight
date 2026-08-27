# FlightDeck

FlightDeck is a real, static TestFlight discovery site with WebMCP tools for AI agents.

Live site: https://exrector.github.io/webmcp_test_flight/

## Data source

The catalog is synchronized from:

- https://github.com/pluwen/awesome-testflight-link
- Upstream data file: `data/links.json`
- Upstream license: MIT

FlightDeck converts the upstream TestFlight join ID, app name, platform list, status, and last-modified date into `apps.json`.

Upstream status mapping:

- `Y` → accepting testers
- `F` → full
- `N` → not accepting new testers
- `D` → removed

The site does not invent app metadata that the source does not provide.

## Automatic synchronization

`.github/workflows/pages.yml` runs:

- on every push to `main`
- manually with `workflow_dispatch`
- once per day at 06:17 UTC

Before every deployment it runs:

```bash
node scripts/sync-testflight.mjs
```

The generated `apps.json` is then deployed to GitHub Pages.

## WebMCP tools

The page registers six tools when WebMCP is available:

- `search_testflight_apps`
- `get_testflight_app`
- `list_testflight_platforms`
- `get_catalog_stats`
- `filter_visible_catalog`
- `prepare_testflight_join`

These are the only WebMCP tools exposed by the page. The search form is ordinary
HTML UI and does not register an additional declarative tool.

Every tool validates its arguments before reading or changing page state.
Unknown arguments, unsupported `platform` or `availability` values, non-integer
or out-of-range `limit` values (valid range: `1..100`), missing or empty required
`id` values, and other incorrect argument types return a structured error:

```json
{
  "error": {
    "code": "INVALID_ARGUMENT",
    "message": "A clear description of the invalid argument."
  }
}
```

Invalid calls to `filter_visible_catalog` and `prepare_testflight_join` do not
change the visible filters or catalog state.

The site remains a normal searchable website in browsers without WebMCP.

## Local development

```bash
node scripts/sync-testflight.mjs
node scripts/test-webmcp.mjs
python3 -m http.server 8080
```

Then open http://localhost:8080.

## Independence

FlightDeck is independent and is not affiliated with Apple. TestFlight is a trademark of Apple Inc.
