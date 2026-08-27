import { writeFile } from "node:fs/promises";

const SOURCE_URL = "https://raw.githubusercontent.com/pluwen/awesome-testflight-link/main/data/links.json";
const SOURCE_REPO = "https://github.com/pluwen/awesome-testflight-link";

const platformMap = {
  ios: "iOS",
  ipados: "iPadOS",
  macos: "macOS",
  tvos: "tvOS",
  visionos: "visionOS"
};

const statusMap = {
  Y: "open",
  F: "full",
  N: "closed",
  D: "removed"
};

const response = await fetch(SOURCE_URL, {
  headers: { "User-Agent": "FlightDeck-GitHub-Pages-Sync/1.0" }
});

if (!response.ok) {
  throw new Error(`Upstream fetch failed: ${response.status} ${response.statusText}`);
}

const upstream = await response.json();
const links = upstream._links || {};

const apps = Object.entries(links).map(([id, info]) => ({
  id,
  name: info.app_name || "Unnamed beta",
  platforms: (info.tables || []).map(p => platformMap[p] || p),
  availability: statusMap[info.status] || "closed",
  upstreamStatus: info.status || "N",
  lastModified: info.last_modify || null,
  testflightUrl: `https://testflight.apple.com/join/${id}`
})).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

const payload = {
  meta: {
    source: SOURCE_REPO,
    sourceData: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    count: apps.length
  },
  apps
};

await writeFile("apps.json", JSON.stringify(payload, null, 2) + "\n", "utf8");

const counts = apps.reduce((acc, app) => {
  acc[app.availability] = (acc[app.availability] || 0) + 1;
  return acc;
}, {});

console.log(`Synced ${apps.length} TestFlight programs`, counts);
