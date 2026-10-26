import express from "express";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDatabaseDirectory = process.env.VERCEL === "1" ? tmpdir() : path.join(here, "data");
const databasePath = path.resolve(process.env.SATELLITE_DB_PATH || path.join(defaultDatabaseDirectory, "satellite-cache.sqlite"));
mkdirSync(path.dirname(databasePath), { recursive: true });
const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS tle_cache (group_name TEXT PRIMARY KEY, payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS planet_ephemeris (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, fetched_at INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS spacecraft_ephemeris (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, fetched_at INTEGER NOT NULL)
`);
const readCache = db.prepare("SELECT payload, fetched_at FROM tle_cache WHERE group_name = ?");
const writeCache = db.prepare(`INSERT INTO tle_cache(group_name,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(group_name) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at`);
const readPlanetEphemeris = db.prepare("SELECT payload, fetched_at FROM planet_ephemeris WHERE id = 1");
const writePlanetEphemeris = db.prepare(`INSERT INTO planet_ephemeris(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at`);
const readSpacecraftEphemeris = db.prepare("SELECT payload, fetched_at FROM spacecraft_ephemeris WHERE id = 1");
const writeSpacecraftEphemeris = db.prepare(`INSERT INTO spacecraft_ephemeris(id,payload,fetched_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at`);
const app = express();
const PORT = Number(process.env.PORT || 3001);
const TTL = 2 * 60 * 60 * 1000;
const PLANET_EPHEMERIS_TTL = 30 * 60 * 1000;
const FORCE_REFRESH_COOLDOWN = 60 * 1000;
const forcedRefreshes = new Map();
const SPACE_TRACK_URL = "https://www.space-track.org";
const HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api";
let horizonsRequestQueue = Promise.resolve();
const PLANETS = [
  { name: "Mercury", id: "199" },
  { name: "Venus", id: "299" },
  { name: "Earth", id: "399" },
  { name: "Mars", id: "499" },
  { name: "Jupiter", id: "599" },
  { name: "Saturn", id: "699" },
  { name: "Uranus", id: "799" },
  { name: "Neptune", id: "899" }
];
const SPACECRAFT_MISSIONS = [
  { name: "Parker Solar Probe", id: "-96", target: "Sun", displayTarget: "Solar orbit", center: "10", frame: "sun", status: "Solar orbit" },
  { name: "Solar Orbiter", id: "-144", target: "Sun", displayTarget: "Solar orbit", center: "10", frame: "sun", status: "Solar orbit" },
  { name: "BepiColombo", id: "-121", target: "Mercury", displayTarget: "Mercury transfer", center: "10", frame: "sun", status: "Cruise to Mercury" },
  { name: "MESSENGER", target: "Mercury", displayTarget: "Mercury", status: "Historic Mercury orbiter (2011-2015)", historical: true },
  { name: "Akatsuki", target: "Venus", displayTarget: "Venus", status: "Historic Venus orbiter (2015-2025)", historical: true },
  { name: "Mars Reconnaissance Orbiter", id: "-74", target: "Mars", displayTarget: "Mars", center: "499", frame: "planet", status: "Mars orbiter" },
  { name: "Mars Odyssey", id: "-53", target: "Mars", displayTarget: "Mars", center: "499", frame: "planet", status: "Mars orbiter" },
  { name: "Juno", id: "-61", target: "Jupiter", displayTarget: "Jupiter", center: "599", frame: "planet", status: "Jupiter orbiter" },
  { name: "Europa Clipper", id: "-159", target: "Jupiter", displayTarget: "Jupiter system", center: "10", frame: "sun", status: "Cruise to Jupiter" },
  { name: "JUICE", id: "-28", target: "Jupiter", displayTarget: "Jupiter system", center: "10", frame: "sun", status: "Cruise to Jupiter" },
  { name: "Cassini", target: "Saturn", displayTarget: "Saturn", status: "Historic Saturn orbiter (2004-2017)", historical: true },
  { name: "Voyager 2", id: "-32", target: "Neptune", encounters: ["Uranus", "Neptune"], displayTarget: "Uranus and Neptune", center: "10", frame: "sun", status: "Outbound; Uranus and Neptune flybys completed" }
];
function requestHorizons(url) {
  const request = horizonsRequestQueue.then(() => fetch(url, { signal: AbortSignal.timeout(60000) }));
  horizonsRequestQueue = request.then(
    () => new Promise(resolve => setTimeout(resolve, 1200)),
    () => new Promise(resolve => setTimeout(resolve, 1200))
  );
  return request;
}
const GROUPS = {
  stations: "Space stations", active: "Active satellites", starlink: "Starlink", oneweb: "OneWeb",
  weather: "Weather", "gps-ops": "GPS operational", geo: "Geostationary", resource: "Earth observation"
};
function parseTle(text) {
  const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    let name, line1, line2;
    if (lines[i].startsWith("1 ") && lines[i + 1]?.startsWith("2 ")) {
      name = `Satellite ${rows.length + 1}`; line1 = lines[i]; line2 = lines[++i];
    } else if (lines[i + 1]?.startsWith("1 ") && lines[i + 2]?.startsWith("2 ")) {
      name = lines[i]; line1 = lines[i + 1]; line2 = lines[i + 2]; i += 2;
    } else continue;
    rows.push({ name: name.slice(0, 100), noradId: line1.slice(2, 7).trim(), line1, line2 });
  }
  return rows;
}
function matchesSpaceTrackGroup(record, group) {
  const name = record.name.toUpperCase();
  if (group === "active") return true;
  if (group === "stations") return /\b(ISS|ZARYA|TIANGONG|CSS|SPACE STATION)\b/.test(name);
  if (group === "starlink") return name.includes("STARLINK");
  if (group === "oneweb") return name.includes("ONEWEB");
  if (group === "weather") return /\b(NOAA|GOES|METOP|HIMAWARI|WEATHER|FENGYUN|JPSS)\b/.test(name);
  if (group === "gps-ops") return /\b(GPS|NAVSTAR|GLONASS|GALILEO|BEIDOU|QZSS)\b/.test(name);
  if (group === "geo") {
    const meanMotion = Number(record.line2.slice(52, 63));
    return Number.isFinite(meanMotion) && meanMotion >= 0.8 && meanMotion <= 1.2;
  }
  if (group === "resource") return /\b(LANDSAT|SENTINEL|AQUA|TERRA|EARTH|RADARSAT|WORLDVIEW|PLEIADES|RESOURCESAT|CARTOSAT)\b/.test(name);
  return false;
}
async function fetchSpaceTrackRecords(group) {
  const identity = process.env.SPACETRACK_IDENTITY;
  const password = process.env.SPACETRACK_PASSWORD;
  if (!identity || !password) {
    const error = new Error("Space-Track is not configured. Set SPACETRACK_IDENTITY and SPACETRACK_PASSWORD in the server .env file, then restart the server.");
    error.statusCode = 503;
    throw error;
  }

  const login = await fetch(`${SPACE_TRACK_URL}/ajaxauth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity, password }),
    signal: AbortSignal.timeout(20000)
  });
  if (!login.ok) throw new Error(`Space-Track login failed (HTTP ${login.status}). Check the server credentials and account access.`);

  const cookies = login.headers.getSetCookie?.() ?? [login.headers.get("set-cookie")].filter(Boolean);
  const cookieHeader = cookies.map(cookie => cookie.split(";")[0]).filter(Boolean).join("; ");
  if (!cookieHeader) throw new Error("Space-Track login returned no authenticated session.");

  const query = `${SPACE_TRACK_URL}/basicspacedata/query/class/gp/DECAY_DATE/null-val/EPOCH/%3Enow-30/ORDERBY/NORAD_CAT_ID/FORMAT/tle`;
  const response = await fetch(query, {
    headers: { Cookie: cookieHeader, "User-Agent": "SatelliteTracking/1.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`Space-Track GP query failed (HTTP ${response.status}). Check account access and API availability.`);
  const records = parseTle(await response.text()).filter(record => matchesSpaceTrackGroup(record, group));
  if (!records.length) throw new Error(`Space-Track returned no recent TLE records for the ${GROUPS[group]} group.`);
  return records;
}
async function fetchPlanetVectors(planet, startDate, stopDate) {
  const params = new URLSearchParams({
    format: "json",
    COMMAND: `'${planet.id}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    CENTER: "'500@10'",
    START_TIME: `'${startDate}'`,
    STOP_TIME: `'${stopDate}'`,
    STEP_SIZE: "'1 d'",
    OUT_UNITS: "'AU-D'",
    REF_PLANE: "'ECLIPTIC'",
    VEC_TABLE: "'2'"
  });
  const response = await requestHorizons(`${HORIZONS_URL}?${params}`);
  const responseText = await response.text();
  if (!response.ok) throw new Error(`JPL Horizons returned HTTP ${response.status} for ${planet.name}: ${responseText.slice(0, 240)}`);
  let payload;
  try {
    payload = JSON.parse(responseText);
  } catch (error) {
    throw new Error(`JPL Horizons returned invalid JSON for ${planet.name}: ${error.message}`);
  }
  if (payload.error) throw new Error(`JPL Horizons ${planet.name}: ${payload.error}`);
  const result = payload.result;
  const start = result.indexOf("$$SOE");
  const end = result.indexOf("$$EOE", start);
  if (start === -1 || end === -1) throw new Error(`JPL Horizons returned no vector table for ${planet.name}.`);

  const lines = result.slice(start + 5, end).split(/\r?\n/);
  const positions = [];
  for (let index = 0; index < lines.length; index += 1) {
    const epoch = lines[index].match(/^\s*(\d+(?:\.\d+)?)\s*=/);
    if (!epoch) continue;
    const vectorLine = lines.slice(index + 1, index + 4).join(" ");
    const vector = vectorLine.match(/X\s*=\s*([-+\d.E]+)\s+Y\s*=\s*([-+\d.E]+)\s+Z\s*=\s*([-+\d.E]+)/);
    if (!vector) throw new Error(`JPL Horizons returned an invalid position for ${planet.name}.`);
    positions.push({
      jd: Number(epoch[1]),
      x: Number(vector[1]),
      y: Number(vector[2]),
      z: Number(vector[3])
    });
  }
  if (positions.length < 2 || positions.some(position => ![position.jd, position.x, position.y, position.z].every(Number.isFinite))) {
    throw new Error(`JPL Horizons returned incomplete position data for ${planet.name}.`);
  }
  return { name: planet.name, id: planet.id, positions };
}
async function fetchSpacecraftVectors(mission, startDate, stopDate) {
  let requestedStopDate = stopDate;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const params = new URLSearchParams({
      format: "json",
      COMMAND: `'${mission.id}'`,
      OBJ_DATA: "'NO'",
      MAKE_EPHEM: "'YES'",
      EPHEM_TYPE: "'VECTORS'",
      CENTER: `'500@${mission.center}'`,
      START_TIME: `'${startDate}'`,
      STOP_TIME: `'${requestedStopDate}'`,
      STEP_SIZE: "'1 d'",
      OUT_UNITS: "'AU-D'",
      REF_PLANE: "'ECLIPTIC'",
      VEC_TABLE: "'2'"
    });
    const response = await requestHorizons(`${HORIZONS_URL}?${params}`);
    const responseText = await response.text();
    if (!response.ok) throw new Error(`JPL Horizons returned HTTP ${response.status} for ${mission.name}: ${responseText.slice(0, 240)}`);
    let payload;
    try {
      payload = JSON.parse(responseText);
    } catch (error) {
      throw new Error(`JPL Horizons returned invalid JSON for ${mission.name}: ${error.message}`);
    }
    if (payload.error) {
      lastError = new Error(`JPL Horizons ${mission.name}: ${payload.error}`);
      const cutoff = payload.error.match(/No ephemeris for target.+ after A\.D\.\s*(\d{4})-([A-Z]{3})-(\d{2})/);
      const months = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
      const coverageDate = cutoff && months[cutoff[2]] ? `${cutoff[1]}-${months[cutoff[2]]}-${cutoff[3]}` : "";
      if (!coverageDate || coverageDate < startDate || attempt === 2) throw lastError;
      if (coverageDate < requestedStopDate) {
        requestedStopDate = coverageDate;
      } else {
        const previousDate = new Date(`${requestedStopDate}T00:00:00Z`);
        previousDate.setUTCDate(previousDate.getUTCDate() - 1);
        requestedStopDate = previousDate.toISOString().slice(0, 10);
      }
      continue;
    }
    const result = payload.result || "";
    const start = result.indexOf("$$SOE");
    const end = result.indexOf("$$EOE", start);
    if (start === -1 || end === -1) throw new Error(`JPL Horizons returned no trajectory for ${mission.name}.`);

    const lines = result.slice(start + 5, end).split(/\r?\n/);
    const positions = [];
    for (let index = 0; index < lines.length; index += 1) {
      const epoch = lines[index].match(/^\s*(\d+(?:\.\d+)?)\s*=/);
      if (!epoch) continue;
      const vectorLine = lines.slice(index + 1, index + 4).join(" ");
      const vector = vectorLine.match(/X\s*=\s*([-+\d.E]+)\s+Y\s*=\s*([-+\d.E]+)\s+Z\s*=\s*([-+\d.E]+)/);
      if (!vector) throw new Error(`JPL Horizons returned an invalid vector for ${mission.name}.`);
      positions.push({
        jd: Number(epoch[1]),
        x: Number(vector[1]),
        y: Number(vector[2]),
        z: Number(vector[3])
      });
    }
    if (positions.length < 2 || positions.some(position => ![position.jd, position.x, position.y, position.z].every(Number.isFinite))) {
      throw new Error(`JPL Horizons returned incomplete trajectory data for ${mission.name}.`);
    }
    return {
      name: mission.name,
      id: mission.id,
      target: mission.target,
      encounters: mission.encounters,
      displayTarget: mission.displayTarget,
      frame: mission.frame,
      status: mission.status,
      historical: false,
      endDate: requestedStopDate,
      positions
    };
  }
  throw lastError || new Error(`JPL Horizons returned no trajectory for ${mission.name}.`);
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "OrbitScope API", database: "SQLite", time: new Date().toISOString() }));
app.get("/api/groups", (_req, res) => res.json(Object.entries(GROUPS).map(([id, name]) => ({ id, name }))));
app.get("/api/providers", (_req, res) => res.json([
  { id: "celestrak", name: "CelesTrak", configured: true },
  { id: "space-track", name: "Space-Track", configured: Boolean(process.env.SPACETRACK_IDENTITY && process.env.SPACETRACK_PASSWORD) }
]));
app.get("/api/planet-positions", async (req, res) => {
  const cached = readPlanetEphemeris.get();
  const now = Date.now();
  const forceRefresh = req.query.refresh === "true";
  const cacheKey = "planet-positions";
  if (forceRefresh) {
    const lastForcedRefresh = forcedRefreshes.get(cacheKey) || 0;
    const remaining = FORCE_REFRESH_COOLDOWN - (now - lastForcedRefresh);
    if (remaining > 0) {
      return res.status(429).json({
        error: "A planet ephemeris refresh was requested recently.",
        details: `Wait ${Math.ceil(remaining / 1000)} seconds before refreshing again.`
      });
    }
    forcedRefreshes.set(cacheKey, now);
  }
  if (!forceRefresh && cached && now - cached.fetched_at < PLANET_EPHEMERIS_TTL) {
    return res.json({ ...JSON.parse(cached.payload), fetchedAt: new Date(cached.fetched_at).toISOString(), stale: false });
  }

  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const stop = new Date(start.getTime() + 365 * 86400000);
    const startDate = start.toISOString().slice(0, 10);
    const stopDate = stop.toISOString().slice(0, 10);
    const bodies = [];
    for (const planet of PLANETS) {
      bodies.push(await fetchPlanetVectors(planet, startDate, stopDate));
      if (planet !== PLANETS[PLANETS.length - 1]) await new Promise(resolve => setTimeout(resolve, 1200));
    }
    const payload = { source: "JPL Horizons", startDate, stopDate, stepDays: 1, bodies };
    const fetchedAt = Date.now();
    writePlanetEphemeris.run(JSON.stringify(payload), fetchedAt);
    res.json({ ...payload, fetchedAt: new Date(fetchedAt).toISOString(), stale: false });
  } catch (error) {
    console.error(`[JPL Horizons] Planet positions: ${error.message}`);
    if (cached) {
      return res.json({ ...JSON.parse(cached.payload), fetchedAt: new Date(cached.fetched_at).toISOString(), stale: true, warning: error.message });
    }
    res.status(502).json({
      error: "Live planetary positions are unavailable and no saved ephemeris exists.",
      details: error.message,
      suggestion: "Check JPL Horizons availability and retry."
    });
  }
});
app.get("/api/spacecraft-trajectories", async (req, res) => {
  const cached = readSpacecraftEphemeris.get();
  const now = Date.now();
  const cacheKey = "spacecraft-trajectories-v4";
  const forceRefresh = req.query.refresh === "true";
  if (forceRefresh) {
    const lastForcedRefresh = forcedRefreshes.get(cacheKey) || 0;
    const remaining = FORCE_REFRESH_COOLDOWN - (now - lastForcedRefresh);
    if (remaining > 0) {
      return res.status(429).json({
        error: "A spacecraft trajectory refresh was requested recently.",
        details: `Wait ${Math.ceil(remaining / 1000)} seconds before refreshing again.`
      });
    }
    forcedRefreshes.set(cacheKey, now);
  }
  let cachedTrajectories = null;
  if (cached) {
    try {
      const payload = JSON.parse(cached.payload);
      if (payload.type === cacheKey) cachedTrajectories = payload;
    } catch (error) {
      console.error(`[JPL Horizons] Invalid cached spacecraft trajectories: ${error.message}`);
    }
  }
  if (!forceRefresh && cachedTrajectories && now - cached.fetched_at < PLANET_EPHEMERIS_TTL) {
    return res.json({ ...cachedTrajectories, fetchedAt: new Date(cached.fetched_at).toISOString(), stale: false });
  }

  try {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const stop = new Date(start.getTime() + 365 * 86400000);
    const startDate = start.toISOString().slice(0, 10);
    const stopDate = stop.toISOString().slice(0, 10);
    const missions = [];
    for (const mission of SPACECRAFT_MISSIONS) {
      missions.push(mission.historical
        ? { ...mission, positions: [] }
        : await fetchSpacecraftVectors(mission, startDate, stopDate));
    }
    const payload = { type: cacheKey, source: "JPL Horizons", startDate, stopDate, stepDays: 1, missions };
    const fetchedAt = Date.now();
    writeSpacecraftEphemeris.run(JSON.stringify(payload), fetchedAt);
    res.json({ ...payload, fetchedAt: new Date(fetchedAt).toISOString(), stale: false });
  } catch (error) {
    console.error(`[JPL Horizons] Spacecraft trajectories: ${error.message}`);
    if (cachedTrajectories) {
      return res.json({ ...cachedTrajectories, fetchedAt: new Date(cached.fetched_at).toISOString(), stale: true, warning: error.message });
    }
    res.status(502).json({
      error: "Live spacecraft trajectories are unavailable and no saved trajectories exist.",
      details: error.message,
      suggestion: "Check JPL Horizons availability and retry."
    });
  }
});
app.get("/api/satellites", async (req, res) => {
  const group = String(req.query.group || "stations").toLowerCase();
  if (!Object.hasOwn(GROUPS, group)) return res.status(400).json({ error: "Unsupported satellite group." });
  const provider = String(req.query.provider || "celestrak").toLowerCase();
  if (!["celestrak", "space-track"].includes(provider)) return res.status(400).json({ error: "Unsupported satellite data provider." });
  const providerName = provider === "celestrak" ? "CelesTrak" : "Space-Track";
  const cacheKey = provider === "celestrak" ? group : `${provider}:${group}`;
  const cached = readCache.get(cacheKey);
  const now = Date.now();
  const forceRefresh = req.query.refresh === "true";
  if (forceRefresh) {
    const lastForcedRefresh = forcedRefreshes.get(cacheKey) || 0;
    const remaining = FORCE_REFRESH_COOLDOWN - (now - lastForcedRefresh);
    if (remaining > 0) {
      return res.status(429).json({
        error: "A refresh for this provider and group was requested recently.",
        details: `Wait ${Math.ceil(remaining / 1000)} seconds before refreshing again.`
      });
    }
    forcedRefreshes.set(cacheKey, now);
  }
  if (!forceRefresh && cached && now - cached.fetched_at < TTL) {
    const satellites = JSON.parse(cached.payload);
    return res.json({ group, groupName: GROUPS[group], provider, providerName, fetchedAt: new Date(cached.fetched_at).toISOString(), stale: false, source: "sqlite-cache", count: satellites.length, satellites });
  }
  try {
    let satellites;
    if (provider === "space-track") {
      satellites = await fetchSpaceTrackRecords(group);
    } else {
      const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group.toUpperCase())}&FORMAT=TLE`;
      const upstream = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { "User-Agent": "SatelliteTracking/1.0" } });
      const body = await upstream.text();
      if (!upstream.ok) throw new Error(`CelesTrak HTTP ${upstream.status}: ${body.slice(0, 160)}`);
      satellites = parseTle(body);
      if (!satellites.length) throw new Error("CelesTrak returned no parseable TLE records.");
    }
    const fetchedAt = Date.now();
    writeCache.run(cacheKey, JSON.stringify(satellites), fetchedAt);
    res.json({ group, groupName: GROUPS[group], provider, providerName, fetchedAt: new Date(fetchedAt).toISOString(), stale: false, source: provider, count: satellites.length, satellites });
  } catch (error) {
    console.error(`[${providerName}] ${group}: ${error.message}`);
    if (cached) {
      const satellites = JSON.parse(cached.payload);
      return res.json({ group, groupName: GROUPS[group], provider, providerName, fetchedAt: new Date(cached.fetched_at).toISOString(), stale: true, source: "sqlite-stale-cache", warning: error.message, count: satellites.length, satellites });
    }
    res.status(error.statusCode || 502).json({ error: `${providerName} satellite data is unavailable and no provider-specific cached copy exists.`, details: error.message, suggestion: "Check provider availability and server configuration, then retry. Successful data is cached for two hours." });
  }
});
const dist = path.resolve(here, "../dist");
app.use(express.static(dist));
app.get("/", (_req, res, next) => res.sendFile(path.join(dist, "index.html"), err => err && next()));
const HOST = process.env.HOST || "127.0.0.1";
export default app;

if (process.env.VERCEL !== "1") {
  app.listen(PORT, HOST, () => console.log(`Satellite Tracking API: http://${HOST}:${PORT}/api/health`));
}
