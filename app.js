const state = {
  apps: [],
  filtered: [],
  query: "",
  category: "all",
  availability: "all",
};

const els = {
  catalog: document.querySelector("#catalog"),
  template: document.querySelector("#appCardTemplate"),
  searchForm: document.querySelector("#searchForm"),
  searchInput: document.querySelector("#searchInput"),
  categoryFilter: document.querySelector("#categoryFilter"),
  availabilityFilter: document.querySelector("#availabilityFilter"),
  resetFilters: document.querySelector("#resetFilters"),
  resultCount: document.querySelector("#resultCount"),
  emptyState: document.querySelector("#emptyState"),
  webmcpStatus: document.querySelector("#webmcpStatus"),
};

const normalize = value => String(value ?? "").trim().toLowerCase();

function searchableText(app) {
  return [
    app.name,
    app.developer,
    app.category,
    app.description,
    ...(app.platforms || []),
    ...(app.tags || []),
  ].map(normalize).join(" ");
}

function filterApps({ query = "", category = "all", availability = "all", platform = "all" } = {}) {
  const q = normalize(query);
  const categoryValue = normalize(category);
  const availabilityValue = normalize(availability);
  const platformValue = normalize(platform);

  return state.apps.filter(app => {
    const matchesQuery = !q || searchableText(app).includes(q);
    const matchesCategory = categoryValue === "all" || normalize(app.category) === categoryValue;
    const matchesAvailability = availabilityValue === "all" || normalize(app.availability) === availabilityValue;
    const matchesPlatform = platformValue === "all" || (app.platforms || []).some(item => normalize(item) === platformValue);
    return matchesQuery && matchesCategory && matchesAvailability && matchesPlatform;
  });
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.category !== "all") params.set("category", state.category);
  if (state.availability !== "all") params.set("availability", state.availability);
  const next = params.size ? `?${params.toString()}` : location.pathname;
  history.replaceState(null, "", next);
}

function applyFilters({ updateUrl = true } = {}) {
  state.filtered = filterApps({
    query: state.query,
    category: state.category,
    availability: state.availability,
  });
  renderCatalog();
  if (updateUrl) syncUrl();
  return state.filtered;
}

function renderCatalog() {
  els.catalog.replaceChildren();

  for (const app of state.filtered) {
    const card = els.template.content.firstElementChild.cloneNode(true);
    card.dataset.appId = app.id;

    card.querySelector(".category-badge").textContent = app.category;
    const availability = card.querySelector(".availability-badge");
    availability.textContent = app.availability;
    availability.classList.add(normalize(app.availability));

    card.querySelector(".app-name").textContent = app.name;
    card.querySelector(".developer").textContent = app.developer;
    card.querySelector(".description").textContent = app.description;
    card.querySelector(".platforms").textContent = (app.platforms || []).join(" · ");

    const tags = card.querySelector(".tags");
    for (const item of app.tags || []) {
      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = item;
      tags.append(tag);
    }

    const link = card.querySelector(".join-link");
    if (app.testflightUrl) {
      link.href = app.testflightUrl;
      link.setAttribute("aria-label", `Open ${app.name} in TestFlight`);
    } else {
      link.removeAttribute("href");
      link.textContent = "Demo entry";
      link.classList.add("disabled");
      link.setAttribute("aria-disabled", "true");
    }

    els.catalog.append(card);
  }

  const count = state.filtered.length;
  els.resultCount.textContent = `${count} ${count === 1 ? "beta" : "betas"}`;
  els.emptyState.hidden = count !== 0;
}

function populateCategories() {
  const categories = [...new Set(state.apps.map(app => app.category))].sort((a, b) => a.localeCompare(b));
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);
  }
}

function readUrlState() {
  const params = new URLSearchParams(location.search);
  state.query = params.get("q") || "";
  state.category = params.get("category") || "all";
  state.availability = params.get("availability") || "all";

  els.searchInput.value = state.query;
  els.categoryFilter.value = state.category;
  els.availabilityFilter.value = state.availability;
}

function highlightApp(id) {
  document.querySelectorAll(".app-card.agent-focus").forEach(card => card.classList.remove("agent-focus"));
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
    developer: app.developer,
    category: app.category,
    platforms: app.platforms,
    availability: app.availability,
    description: app.description,
    tags: app.tags,
    testflightUrl: app.testflightUrl || null,
    demo: Boolean(app.demo),
    updatedAt: app.updatedAt,
  };
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
      description: "Search the TestFlight catalog by text, category, availability, or Apple platform without changing the visible page.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search words for app name, developer, description, tags, or platform." },
          category: { type: "string", description: "Exact category name, or all." },
          availability: { type: "string", enum: ["all", "open", "limited", "closed", "demo"], description: "Beta availability." },
          platform: { type: "string", description: "Apple platform such as iOS, iPadOS, macOS, tvOS, watchOS, or visionOS." },
          limit: { type: "integer", minimum: 1, maximum: 50, description: "Maximum number of results." }
        }
      },
      execute(input = {}) {
        const limit = Math.min(Math.max(Number(input.limit) || 20, 1), 50);
        const results = filterApps(input).slice(0, limit).map(toolResult);
        return { count: results.length, results };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "get_testflight_app",
      description: "Get complete catalog information for one beta by its stable catalog id.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Stable app id from search_testflight_apps." } },
        required: ["id"]
      },
      execute({ id }) {
        const app = state.apps.find(item => item.id === id);
        if (!app) return { found: false, error: `No app with id "${id}".` };
        return { found: true, app: toolResult(app) };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "list_testflight_categories",
      description: "List available categories in the current TestFlight catalog.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        const categories = [...new Set(state.apps.map(app => app.category))].sort();
        return { categories };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "get_catalog_stats",
      description: "Return summary counts for the TestFlight catalog.",
      inputSchema: { type: "object", properties: {} },
      execute() {
        const byAvailability = {};
        const byPlatform = {};
        for (const app of state.apps) {
          byAvailability[app.availability] = (byAvailability[app.availability] || 0) + 1;
          for (const platform of app.platforms || []) {
            byPlatform[platform] = (byPlatform[platform] || 0) + 1;
          }
        }
        return {
          total: state.apps.length,
          byAvailability,
          byPlatform,
          demoEntries: state.apps.filter(app => app.demo).length
        };
      },
      annotations: { readOnlyHint: true }
    },
    {
      name: "filter_visible_catalog",
      description: "Apply search and filter values to the visible catalog UI so the user sees the same results as the agent.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search words. Empty string clears text search." },
          category: { type: "string", description: "Exact category name, or all." },
          availability: { type: "string", enum: ["all", "open", "limited", "closed", "demo"] }
        }
      },
      execute(input = {}) {
        if (typeof input.query === "string") state.query = input.query;
        if (typeof input.category === "string") state.category = input.category;
        if (typeof input.availability === "string") state.availability = input.availability;

        els.searchInput.value = state.query;
        els.categoryFilter.value = state.category;
        els.availabilityFilter.value = state.availability;

        const results = applyFilters();
        return {
          visibleCount: results.length,
          filters: { query: state.query, category: state.category, availability: state.availability }
        };
      }
    },
    {
      name: "prepare_testflight_join",
      description: "Bring one beta into view and return its TestFlight URL. The user remains in control of opening the external TestFlight page.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", description: "Stable app id from search_testflight_apps." } },
        required: ["id"]
      },
      execute({ id }) {
        const app = state.apps.find(item => item.id === id);
        if (!app) return { prepared: false, error: `No app with id "${id}".` };

        state.query = app.name;
        state.category = "all";
        state.availability = "all";
        els.searchInput.value = state.query;
        els.categoryFilter.value = "all";
        els.availabilityFilter.value = "all";
        applyFilters();

        const highlighted = highlightApp(id);
        return {
          prepared: highlighted,
          id,
          name: app.name,
          testflightUrl: app.testflightUrl || null,
          requiresUserOpen: true,
          demo: Boolean(app.demo)
        };
      }
    }
  ];

  try {
    for (const tool of tools) {
      await modelContext.registerTool(tool, { signal });
    }
    els.webmcpStatus.textContent = `WebMCP ready · ${tools.length} tools`;
    els.webmcpStatus.classList.add("supported");
    window.addEventListener("pagehide", () => controller.abort(), { once: true });
  } catch (error) {
    console.error("WebMCP registration failed", error);
    els.webmcpStatus.textContent = "WebMCP registration error";
    els.webmcpStatus.classList.add("unsupported");
  }
}

async function loadCatalog() {
  const response = await fetch("./apps.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load apps.json: ${response.status}`);
  const payload = await response.json();
  state.apps = Array.isArray(payload) ? payload : payload.apps;
  if (!Array.isArray(state.apps)) throw new Error("apps.json must contain an array or an { apps: [] } object.");

  populateCategories();
  readUrlState();
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

els.categoryFilter.addEventListener("change", () => {
  state.category = els.categoryFilter.value;
  applyFilters();
});

els.availabilityFilter.addEventListener("change", () => {
  state.availability = els.availabilityFilter.value;
  applyFilters();
});

els.resetFilters.addEventListener("click", () => {
  state.query = "";
  state.category = "all";
  state.availability = "all";
  els.searchInput.value = "";
  els.categoryFilter.value = "all";
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
