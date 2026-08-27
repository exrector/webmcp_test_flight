import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

class FakeClassList {
  add() {}
  remove() {}
}

class FakeElement {
  constructor() {
    this.value = "";
    this.hidden = false;
    this.textContent = "";
    this.innerHTML = "";
    this.dataset = {};
    this.classList = new FakeClassList();
    this.children = [];
  }

  addEventListener() {}
  append(child) { this.children.push(child); }
  replaceChildren(...children) { this.children = children; }
  removeAttribute() {}
  setAttribute() {}
  scrollIntoView() {}

  querySelector() {
    return new FakeElement();
  }
}

const registered = [];
const elements = new Map([
  ["#catalog", new FakeElement()],
  ["#searchForm", new FakeElement()],
  ["#searchInput", new FakeElement()],
  ["#platformFilter", new FakeElement()],
  ["#availabilityFilter", new FakeElement()],
  ["#resetFilters", new FakeElement()],
  ["#resultCount", new FakeElement()],
  ["#liveStats", new FakeElement()],
  ["#emptyState", new FakeElement()],
  ["#webmcpStatus", new FakeElement()]
]);

const template = new FakeElement();
template.content = { firstElementChild: { cloneNode: () => new FakeElement() } };
elements.set("#appCardTemplate", template);

const modelContext = {
  async registerTool(tool) {
    registered.push(tool);
  }
};

const apps = [
  {
    id: "alpha123",
    name: "Alpha",
    platforms: ["iOS"],
    availability: "open",
    lastModified: "2026-08-27",
    testflightUrl: "https://testflight.apple.com/join/alpha123"
  },
  {
    id: "beta456",
    name: "Beta",
    platforms: ["macOS"],
    availability: "full",
    lastModified: "2026-08-26",
    testflightUrl: "https://testflight.apple.com/join/beta456"
  }
];

const document = {
  modelContext,
  querySelector(selector) {
    if (selector.startsWith("[data-app-id=")) return new FakeElement();
    return elements.get(selector) ?? new FakeElement();
  },
  querySelectorAll() { return []; },
  createElement() { return new FakeElement(); }
};

const context = {
  AbortController,
  CSS: { escape: value => value },
  URLSearchParams,
  console,
  document,
  fetch: async () => ({
    ok: true,
    async json() {
      return { apps, meta: { generatedAt: "2026-08-27T00:00:00Z", source: "test" } };
    }
  }),
  history: { replaceState() {} },
  location: { pathname: "/", search: "" },
  navigator: {},
  window: { addEventListener() {} }
};

const source = await fs.readFile(new URL("../app.js", import.meta.url), "utf8");
vm.runInNewContext(source, context, { filename: "app.js" });
await new Promise(resolve => setImmediate(resolve));
await new Promise(resolve => setImmediate(resolve));

assert.equal(registered.length, 6, "the page must register exactly six imperative tools");
assert.deepEqual(
  registered.map(tool => tool.name),
  [
    "search_testflight_apps",
    "get_testflight_app",
    "list_testflight_platforms",
    "get_catalog_stats",
    "filter_visible_catalog",
    "prepare_testflight_join"
  ]
);

const tools = Object.fromEntries(registered.map(tool => [tool.name, tool]));
const expectInvalid = (result, messagePattern) => {
  assert.equal(result?.error?.code, "INVALID_ARGUMENT");
  assert.match(result.error.message, messagePattern);
};

for (const tool of registered) {
  assert.equal(tool.inputSchema.additionalProperties, false, `${tool.name} schema must reject unknown arguments`);
  expectInvalid(tool.execute(null), /object/i);
  expectInvalid(tool.execute([]), /object/i);
  expectInvalid(tool.execute({ unexpected: true }), /unknown argument/i);
}

expectInvalid(tools.search_testflight_apps.execute({ query: 7 }), /query must be a string/i);
expectInvalid(tools.search_testflight_apps.execute({ platform: "Android" }), /platform must be one of/i);
expectInvalid(tools.search_testflight_apps.execute({ availability: "pending" }), /availability must be one of/i);
expectInvalid(tools.search_testflight_apps.execute({ limit: "25" }), /limit must be an integer/i);
expectInvalid(tools.search_testflight_apps.execute({ limit: 1.5 }), /limit must be an integer/i);
expectInvalid(tools.search_testflight_apps.execute({ limit: 0 }), /limit must be at least 1/i);
expectInvalid(tools.search_testflight_apps.execute({ limit: 101 }), /limit must be at most 100/i);
assert.equal(tools.search_testflight_apps.execute({ limit: 1 }).count, 1);

for (const name of ["get_testflight_app", "prepare_testflight_join"]) {
  expectInvalid(tools[name].execute({}), /missing required argument: id/i);
  expectInvalid(tools[name].execute({ id: "  " }), /non-empty string/i);
  expectInvalid(tools[name].execute({ id: 123 }), /id must be a string/i);
}

const filter = tools.filter_visible_catalog;
assert.equal(filter.execute({ query: "Alpha", platform: "iOS", availability: "open" }).visibleCount, 1);
const beforeInvalidFilter = {
  query: elements.get("#searchInput").value,
  platform: elements.get("#platformFilter").value,
  availability: elements.get("#availabilityFilter").value
};
expectInvalid(filter.execute({ query: "Beta", platform: "Android" }), /platform must be one of/i);
assert.deepEqual(
  {
    query: elements.get("#searchInput").value,
    platform: elements.get("#platformFilter").value,
    availability: elements.get("#availabilityFilter").value
  },
  beforeInvalidFilter,
  "invalid filter calls must not mutate visible UI state"
);

const prepare = tools.prepare_testflight_join;
const prepared = prepare.execute({ id: "beta456" });
assert.equal(prepared.prepared, true);
assert.equal(prepared.app.id, "beta456");
assert.equal(elements.get("#searchInput").value, "Beta");
const beforeInvalidPrepare = elements.get("#searchInput").value;
expectInvalid(prepare.execute({ id: "" }), /non-empty string/i);
assert.equal(elements.get("#searchInput").value, beforeInvalidPrepare, "invalid prepare calls must not mutate UI state");

console.log("WebMCP checks passed: exactly 6 tools, strict validation, UI synchronization preserved.");
