const STATUS_LABELS = {
  open: "Accepting testers",
  full: "Full",
  closed: "Not accepting",
  removed: "Removed"
};

const STATUS_ORDER = { open: 0, full: 1, closed: 2, removed: 3 };
const PLATFORMS = ["all", "iOS", "iPadOS", "macOS", "tvOS", "visionOS"];
const AVAILABILITIES = ["all", "open", "full", "closed", "removed"];

const state = {
  apps: [],
  filtered: [],
  meta: {},
  query: "",
  platform: "all",
  availability: "all"
};

const els = {
  catalog: document.querySelector("#catalog"),
  template: document.querySelector("#appCardTemplate"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  platformFilter: document.querySelector("#platformFilter"),
  availabilityFilter: document.querySelector("#availabilityFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  resultCount: document.querySelector("#resultCount"),
  liveStats: document.querySelector("#liveStats"),
  emptyState: document.querySelector("#emptyState"),
  webmcpStatus: document.querySelector("#webmcpStatus")
};

const normalize = value => String(value ?? "").trim().toLowerCase();

function sortApps(apps) {
  return [...apps].sort((a, b) => {
    const status = (STATUS_ORDER[a.availability] ?? 99) - (STATUS_ORDER[b.availability] ?? 99);
    if (status) return status;
    const date = String(b.lastModified || "").localeCompare(String(a.lastModified || ""));
    if (date) return date;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function filterApps({ query = "", platform = "all", availability = "all" } = {}) {
  const q = normalize(query);
  return sortApps(state.apps.filter(app => {
    const matchesQuery = !q || normalize(app.name).includes(q) || normalize(app.id).includes(q);
    const matchesPlatform = platform === "all" || (app.platforms || []).includes(platform);
    const matchesAvailability = availability === "all" || app.availability === availability;
    return matchesQuery && matchesPlatform && matchesAvailability;
  }));
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.platform !== "all") params.set("platform", state.platform);
  if (state.availability !== "all") params.set("availability", state.availability);
  history.replaceState(null, "", params.size ? `?${params}` : location.pathname);
}

function applyFilters({ updateUrl = true } = {}) {
  state.filtered = filterApps(state);
  renderCatalog();
  if (updateUrl) syncUrl();
  return state.filtered;
}

function platformBadge(name) {
  const span = document.createElement("span");
  span.className = "platform-badge";
  span.textContent = name;
  return span;
}

function renderCatalog() {
  els.catalog.replaceChildren();

  for (const app of state.filtered) {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.dataset.appId = app.id;

    const platformWrap = card.querySelector(".platform-badges");
    for (const platform of app.platforms || []) platformWrap.append(platformBadge(platform));

    const availability = card.querySelector(".availability-badge");
    availability.textContent = STATUS_LABELS[app.availability] || app.availability;
    availability.classList.add(app.availability);

    card.querySelector(".app-name").textContent = app.name;
    card.querySelector(".updated").textContent = app.lastModified ? `Status checked ${app.lastModified}` : "Status date unavailable";
    card.querySelector(".testflight-id").textContent = `ID ${app.id}`;

    const link = card.querySelector(".join-link");
    if (app.availability === "removed") {
      link.removeAttribute("href");
      link.textContent = "Removed";
      link.classList.add("disabled");
      link.setAttribute("aria-disabled", "true");
    } else {
      link.href = app.testflightUrl;
      link.setAttribute("aria-label", `Open ${app.name} in TestFlight`);
    }

    els.catalog.append(card);
  }

  els.resultCount.textContent = `${state.filtered.length.toLocaleString()} of ${state.apps.length.toLocaleString()}`;
  els.emptyState.hidden = state.filtered.length !== 0;
}

function renderStats() {
  const open = state.apps.filter(app => app.availability === "open").length;
  const full = state.apps.filter(app => app.availability === "full").length;
  const synced = state.meta.generatedAt ? new Date(state.meta.generatedAt).toLocaleString() : "unknown";
  els.liveStats.innerHTML = `
    <span><strong>${state.apps.length.toLocaleString()}</strong> tracked</span>
    <span><strong>${open.toLocaleString()}</strong> accepting testers</span>
    <span><strong>${full.toLocaleString()}</strong> full</span>
    <span class="sync-time">Synced ${synced}</span>
  `;
}

function readUrlState() {
  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.platform = params.get("platform") || "all";
  state.availability = params.get("availability") || "all";
  els.searchInput.value = state.query;
  els.platformFilter.value = state.platform;
  els.availabilityFilter.value = state.availability;
}

function highlightApp(id) {
  document.querySelectorAll(".agent-focus").forEach(card => card.classList.remove("agent-focus"));
  const card = document.querySelector(`[data-app-id="${CSS.escape(id)}"]`);
  if (!card) return false;
  card.classList.add("agent-focus");
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

function toolResult(app) {
  return {
    id: app.id,
    name: app.name,
    platforms: app.platforms,
    availability: app.availability,
    availabilityLabel: STATUS_LABELS[app.availability] || app.availability,
    lastModified: app.lastModified,
    testflightUrl: app.testflightUrl,
    source: state.meta.source || null
  };
}

function invalidArgument(message) {
  return { error: { code: "INVALID_ARGUMENT", message } };
}

function validateToolInput(input, fields = {}) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return invalidArgument("Arguments must be an object.");
  }

  const allowed = new Set(Object.keys(fields));
  const unknown = Object.keys(input).filter(key => !allowed.has(key));
  if (unknown.length) {
    return invalidArgument(`Unknown argument${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
  }

  for (const [name, rules] of Object.entries(fields)) {
    const present = Object.prototype.hasOwnProperty.call(input, name);
    if (rules.required && !present) return invalidArgument(`Missing required argument: ${name}.`);
    if (!present) continue;

    const value = input[name];
    if (rules.type === "string" && typeof value !== "string") {
      return invalidArgument(`${name} must be a string.`);
    }
    if (rules.type === "integer" && !Number.isInteger(value)) {
      return invalidArgument(`${name} must be an integer.`);
    }
    if (rules.nonEmpty && !value.trim()) {
      return invalidArgument(`${name} must be a non-empty string.`);
    }
    if (rules.enum && !rules.enum.includes(value)) {
      return invalidArgument(`${name} must be one of: ${rules.enum.join(", ")}.`);
    }
    if (rules.minimum !== undefined && value < rules.minimum) {
      return invalidArgument(`${name} must be at least ${rules.minimum}.`);
    }
    if (rules.maximum !== undefined && value > rules.maximum) {
      return invalidArgument(`${name} must be at most ${rules.maximum}.`);
    }
  }

  return null;
}

async function registerWebMCPTools() {
  const modelContext = document.modelContext || navigator.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== "function") {
    els.webmcpStatus.textContent = "WebMCP unavailable";
    els.webmcpStatus.classList.add("unsupported");
    return;
  }

  const controller = new AbortController();
  const signal = controller.signal;

  const tools = [
    {
      name: "search_testflight_apps",
      description: "Search real public TestFlight programs by app name, platform, and current availability.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string", description: "App name or TestFlight ID." },
          platform: { type: "string", enum: ["all", "iOS", "iPadOS", "macOS", "tvOS", "visionOS"] },
          availability: { type: "string", enum: ["all", "open", "full", "closed", "removed"] },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        }
      },
      execute(input = {}) {
        const validationError = validateToolInput(input, {
          query: { type: "string" },
          platform: { type: "string", enum: PLATFORMS },
          availability: { type: "string", enum: AVAILABILITIES },
          limit: { type: "integer", minimum: 1, maximum: 100 }
        });
        if (validationError) return validationError;
        const limit = input.limit ?? 25;
        const results = filterApps(input).slice(0, limit).map(toolResult);
        return { count: results.length, results };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "get_testflight_app",
      description: "Get one real TestFlight program by its join ID.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"]
      },
      execute(input = {}) {
        const validationError = validateToolInput(input, {
          id: { type: "string", required: true, nonEmpty: true }
        });
        if (validationError) return validationError;
        const { id } = input;
        const app = state.apps.find(item => item.id === id);
        return app ? { found: true, app: toolResult(app) } : { found: false };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "list_testflight_platforms",
      description: "List supported Apple platforms and counts in the live catalog.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute(input = {}) {
        const validationError = validateToolInput(input);
        if (validationError) return validationError;
        const counts = {};
        for (const app of state.apps) for (const p of app.platforms || []) counts[p] = (counts[p] || 0) + 1;
        return { platforms: counts };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "get_catalog_stats",
      description: "Return live TestFlight catalog counts by availability and platform.",
      inputSchema: { type: "object", additionalProperties: false, properties: {} },
      execute(input = {}) {
        const validationError = validateToolInput(input);
        if (validationError) return validationError;
        const byAvailability = {};
        const byPlatform = {};
        for (const app of state.apps) {
          byAvailability[app.availability] = (byAvailability[app.availability] || 0) + 1;
          for (const p of app.platforms || []) byPlatform[p] = (byPlatform[p] || 0) + 1;
        }
        return { total: state.apps.length, byAvailability, byPlatform, generatedAt: state.meta.generatedAt, source: state.meta.source };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "filter_visible_catalog",
      description: "Apply filters to the page so the user sees the same real TestFlight results as the agent.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          query: { type: "string" },
          platform: { type: "string", enum: ["all", "iOS", "iPadOS", "macOS", "tvOS", "visionOS"] },
          availability: { type: "string", enum: ["all", "open", "full", "closed", "removed"] }
        }
      },
      execute(input = {}) {
        const validationError = validateToolInput(input, {
          query: { type: "string" },
          platform: { type: "string", enum: PLATFORMS },
          availability: { type: "string", enum: AVAILABILITIES }
        });
        if (validationError) return validationError;
        if (Object.prototype.hasOwnProperty.call(input, "query")) state.query = input.query;
        if (Object.prototype.hasOwnProperty.call(input, "platform")) state.platform = input.platform;
        if (Object.prototype.hasOwnProperty.call(input, "availability")) state.availability = input.availability;
        els.searchInput.value = state.query;
        els.platformFilter.value = state.platform;
        els.availabilityFilter.value = state.availability;
        const results = applyFilters();
        return { visibleCount: results.length, filters: { query: state.query, platform: state.platform, availability: state.availability } };
      }
    },
    {
      name: "prepare_testflight_join",
      description: "Bring a real TestFlight program into view and return its Apple TestFlight join URL for the user to open.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"]
      },
      execute(input = {}) {
        const validationError = validateToolInput(input, {
          id: { type: "string", required: true, nonEmpty: true }
        });
        if (validationError) return validationError;
        const { id } = input;
        const app = state.apps.find(item => item.id === id);
        if (!app) return { prepared: false, error: "App not found" };
        state.query = app.name;
        state.platform = "all";
        state.availability = "all";
        els.searchInput.value = state.query;
        els.platformFilter.value = "all";
        els.availabilityFilter.value = "all";
        applyFilters();
        return {
          prepared: highlightApp(id),
          app: toolResult(app),
          requiresUserOpen: true,
          joinable: app.availability !== "removed"
        };
      }
    }
  ];

  try {
    for (const tool of tools) await modelContext.registerTool(tool, { signal });
    els.webmcpStatus.textContent = `WebMCP ready · ${tools.length} tools`;
    els.webmcpStatus.classList.add("supported");
    window.addEventListener("pagehide", () => controller.abort(), { once: true });
  } catch (error) {
    console.error(error);
    els.webmcpStatus.textContent = "WebMCP registration error";
    els.webmcpStatus.classList.add("unsupported");
  }
}

async function loadCatalog() {
  const response = await fetch("./apps.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load apps.json: ${response.status}`);
  const payload = await response.json();
  state.apps = Array.isArray(payload.apps) ? payload.apps : [];
  state.meta = payload.meta || {};
  readUrlState();
  renderStats();
  applyFilters({ updateUrl: false });
  await registerWebMCPTools();
}

els.searchForm.addEventListener("submit", event => {
  event.preventDefault();
  state.query = els.searchInput.value.trim();
  applyFilters();
});

els.searchInput.addEventListener("input", () => {
  state.query = els.searchInput.value.trim();
  applyFilters();
});

els.platformFilter.addEventListener("change", () => {
  state.platform = els.platformFilter.value;
  applyFilters();
});

els.availabilityFilter.addEventListener("change", () => {
  state.availability = els.availabilityFilter.value;
  applyFilters();
});

els.resetFilters.addEventListener("click", () => {
  state.query = "";
  state.platform = "all";
  state.availability = "all";
  els.searchInput.value = "";
  els.platformFilter.value = "all";
  els.availabilityFilter.value = "all";
  applyFilters();
});

loadCatalog().catch(error => {
  console.error(error);
  els.catalog.innerHTML = `<div class="empty-state"><h3>Catalog failed to load</h3><p>${error.message}</p></div>`;
  els.resultCount.textContent = "Error";
  els.webmcpStatus.textContent = "Catalog error";
  els.webmcpStatus.classList.add("unsupported");
});
