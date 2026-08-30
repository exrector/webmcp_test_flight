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

FlightDeck uses imperative WebMCP tool registration. A representative tool follows the canonical WebMCP form:

```js
document.modelContext.registerTool({
  name: "search_testflight_apps",
  description: "Search real public TestFlight programs by app name, platform, and current availability.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      query: { type: "string" },
      platform: { type: "string" },
      availability: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100 }
    }
  },
  execute: async (input) => {
    // FlightDeck validates input and returns structured catalog results.
  }
});
```

The production implementation in `app.js` uses the same `registerTool()` API through the detected WebMCP model context and registers all six tools with explicit schemas, validation, and execution handlers.

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
