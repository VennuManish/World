import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import { ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2 } from "three";
import CITY_DATA_URL from "../node_modules/globe.gl/example/datasets/ne_110m_populated_places_simple.geojson?url";
import NIGHT_TEXTURE from "../node_modules/three-globe/example/img/earth-night.jpg?url";
import STARFIELD_TEXTURE from "../node_modules/three-globe/example/img/night-sky.png?url";
import { GROUPS, fetchDataProviders, fetchSatelliteRecords, calculateSatellite, calculateOrbitTrack, exportSatellitesCsv } from "./satelliteData.js";
const DAY_TEXTURE = "/images/nasa-blue-marble-2048.jpg";
const COLORS = { LEO: "#2dd4bf", MEO: "#fbbf24", GEO: "#a78bfa" };
const fmt = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
const normalizeSearch = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const EXTRA_CITIES = [
  { name: "Chennai", lat: 13.0827, lng: 80.2707, population: 11000000 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867, population: 10500000 },
  { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, population: 8000000 },
  { name: "Pune", lat: 18.5204, lng: 73.8567, population: 7500000 },
  { name: "Surat", lat: 21.1702, lng: 72.8311, population: 7000000 },
  { name: "Jaipur", lat: 26.9124, lng: 75.7873, population: 4000000 },
  { name: "Lucknow", lat: 26.8467, lng: 80.9462, population: 4000000 },
  { name: "Kanpur", lat: 26.4499, lng: 80.3319, population: 3500000 },
  { name: "Nagpur", lat: 21.1458, lng: 79.0882, population: 3000000 },
  { name: "Indore", lat: 22.7196, lng: 75.8577, population: 2500000 },
  { name: "Bhopal", lat: 23.2599, lng: 77.4126, population: 2300000 },
  { name: "Patna", lat: 25.5941, lng: 85.1376, population: 2500000 },
  { name: "Vadodara", lat: 22.3072, lng: 73.1812, population: 2200000 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558, population: 2200000 },
  { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185, population: 2200000 },
  { name: "Kochi", lat: 9.9312, lng: 76.2673, population: 2100000 },
  { name: "Guwahati", lat: 26.1445, lng: 91.7362, population: 1100000 },
  { name: "Ludhiana", lat: 30.901, lng: 75.8573, population: 1800000 },
  { name: "Agra", lat: 27.1767, lng: 78.0081, population: 1600000 },
  { name: "Varanasi", lat: 25.3176, lng: 82.9739, population: 1500000 },
  { name: "New York", lat: 40.7128, lng: -74.006, population: 19000000 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, population: 12500000 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, population: 9000000 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, population: 6500000 },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, population: 22000000 },
  { name: "Sao Paulo", lat: -23.5505, lng: -46.6333, population: 22000000 },
  { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729, population: 13000000 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, population: 15000000 },
  { name: "Lima", lat: -12.0464, lng: -77.0428, population: 11000000 },
  { name: "Bogota", lat: 4.711, lng: -74.0721, population: 11000000 },
  { name: "Santiago", lat: -33.4489, lng: -70.6693, population: 7000000 },
  { name: "Barcelona", lat: 41.3874, lng: 2.1686, population: 5600000 },
  { name: "Milan", lat: 45.4642, lng: 9.19, population: 3200000 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, population: 2500000 },
  { name: "Vienna", lat: 48.2082, lng: 16.3738, population: 2900000 },
  { name: "Prague", lat: 50.0755, lng: 14.4378, population: 1300000 },
  { name: "Warsaw", lat: 52.2297, lng: 21.0122, population: 1800000 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, population: 3500000 },
  { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773, population: 1500000 },
  { name: "Lahore", lat: 31.5204, lng: 74.3587, population: 13000000 },
  { name: "Ho Chi Minh City", lat: 10.8231, lng: 106.6297, population: 9000000 },
  { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869, population: 8000000 },
  { name: "Guangzhou", lat: 23.1291, lng: 113.2644, population: 19000000 },
  { name: "Shenzhen", lat: 22.5431, lng: 114.0579, population: 17500000 },
  { name: "Perth", lat: -31.9505, lng: 115.8605, population: 2200000 },
  { name: "Auckland", lat: -36.8509, lng: 174.7645, population: 1700000 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, population: 4700000 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, population: 5000000 },
  { name: "Addis Ababa", lat: 8.9806, lng: 38.7578, population: 5500000 }
];
const DAY_NIGHT_SHADER = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    #define PI 3.141592653589793
    uniform sampler2D dayTexture;
    uniform sampler2D nightTexture;
    uniform vec2 sunPosition;
    varying vec2 vUv;

    float toRad(float angle) {
      return angle * PI / 180.0;
    }

    vec3 latLngToNormal(vec2 coords) {
      float latitude = toRad(coords.x);
      float longitude = toRad(coords.y);
      return vec3(cos(latitude) * cos(longitude), sin(latitude), cos(latitude) * sin(longitude));
    }

    void main() {
      vec2 geographicPosition = vec2((0.5 - vUv.y) * 180.0, (vUv.x - 0.5) * 360.0);
      vec3 surfaceNormal = latLngToNormal(geographicPosition);
      vec3 sunDirection = latLngToNormal(sunPosition);
      float daylight = dot(surfaceNormal, sunDirection);
      vec4 dayColor = texture2D(dayTexture, vUv);
      vec4 nightColor = texture2D(nightTexture, vUv);
      float blend = smoothstep(-0.1, 0.1, daylight);
      float cityLuma = dot(nightColor.rgb, vec3(0.299, 0.587, 0.114));
      float cityCore = smoothstep(0.025, 0.14, cityLuma);
      vec2 glowStep = vec2(0.0015, 0.003);
      float cityHalo = (
        dot(texture2D(nightTexture, vUv + vec2(glowStep.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) +
        dot(texture2D(nightTexture, vUv - vec2(glowStep.x, 0.0)).rgb, vec3(0.299, 0.587, 0.114)) +
        dot(texture2D(nightTexture, vUv + vec2(0.0, glowStep.y)).rgb, vec3(0.299, 0.587, 0.114)) +
        dot(texture2D(nightTexture, vUv - vec2(0.0, glowStep.y)).rgb, vec3(0.299, 0.587, 0.114))
      ) * 0.25;
      vec3 nightSurface = dayColor.rgb * vec3(0.08, 0.105, 0.15);
      vec3 cityEmission = vec3(1.0, 0.58, 0.18) * (cityCore * 1.65 + cityHalo * 0.8);
      float twilight = smoothstep(-0.24, -0.06, daylight) * (1.0 - smoothstep(-0.06, 0.08, daylight));
      vec3 nightSide = nightSurface + cityEmission + vec3(0.14, 0.065, 0.018) * twilight;
      gl_FragColor = vec4(mix(nightSide, dayColor.rgb, blend), 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
};
function getSolarPosition(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const yearLength = new Date(Date.UTC(date.getUTCFullYear(), 1, 29)).getUTCDate() === 29 ? 366 : 365;
  const gamma = 2 * Math.PI / yearLength * (day - 1 + (minutes / 60 - 12) / 24);
  const equationOfTime = 229.18 * (0.000075 + 0.001868 * Math.cos(gamma) - 0.032077 * Math.sin(gamma) - 0.014615 * Math.cos(2 * gamma) - 0.040849 * Math.sin(2 * gamma));
  const declination = 0.006918 - 0.399912 * Math.cos(gamma) + 0.070257 * Math.sin(gamma) - 0.006758 * Math.cos(2 * gamma) + 0.000907 * Math.sin(2 * gamma) - 0.002697 * Math.cos(3 * gamma) + 0.00148 * Math.sin(3 * gamma);
  const longitude = ((720 - minutes - equationOfTime) / 4 + 540) % 360 - 180;
  return { lat: declination * 180 / Math.PI, lng: longitude };
}
export default function EarthGlobe() {
  const host = useRef(null), globe = useRef(null), globeMaterial = useRef(null), recordsRef = useRef([]), autoFocusedId = useRef("");
  const [group, setGroup] = useState("active"), [provider, setProvider] = useState("celestrak"), [providerAvailability, setProviderAvailability] = useState(null), [providerStatusError, setProviderStatusError] = useState(""), [satellites, setSatellites] = useState([]), [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(""), [orbitType, setOrbitType] = useState("ALL"), [minAlt, setMinAlt] = useState("0"), [maxAlt, setMaxAlt] = useState("40000");
  const [searchOpen, setSearchOpen] = useState(false), [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [pathLimit, setPathLimit] = useState("25"), [visibleRows, setVisibleRows] = useState(100), [status, setStatus] = useState("Connecting to API…"), [error, setError] = useState(""), [dataInfo, setDataInfo] = useState(null), [updatedAt, setUpdatedAt] = useState(null), [isLoadingData, setIsLoadingData] = useState(false), [tick, setTick] = useState(0);
  const [cityCatalog, setCityCatalog] = useState([]), [cityLimit, setCityLimit] = useState(60), [showCityLabels, setShowCityLabels] = useState(true);
  const [solarClock, setSolarClock] = useState(() => Date.now());
  const spaceTrackConfigured = providerAvailability?.find(item => item.id === "space-track")?.configured === true;
  const solarPosition = useMemo(() => getSolarPosition(new Date(solarClock)), [solarClock]);
  const cityLabels = useMemo(() => showCityLabels ? cityCatalog.slice(0, cityLimit).map(city => {
    const toRad = Math.PI / 180;
    const daylight = Math.sin(city.lat * toRad) * Math.sin(solarPosition.lat * toRad) + Math.cos(city.lat * toRad) * Math.cos(solarPosition.lat * toRad) * Math.cos((city.lng - solarPosition.lng) * toRad);
    return { ...city, isNight: daylight < -0.05 };
  }) : [], [cityCatalog, cityLimit, showCityLabels, solarPosition]);
  const recalc = useCallback(() => {
    if (!recordsRef.current.length) return;
    const now = new Date(), rows = [];
    for (const record of recordsRef.current) { try { const sat = calculateSatellite(record, now); if (sat) rows.push(sat); } catch {} }
    setSatellites(rows); setUpdatedAt(now); setStatus(`Tracking ${rows.length.toLocaleString()} satellites`);
  }, []);
  const load = useCallback(async (signal, forceRefresh = false, preserveExisting = false) => {
    setIsLoadingData(true); setError(""); setStatus(forceRefresh ? "Refreshing orbital data…" : "Loading TLE data…");
    if (!preserveExisting) { setSatellites([]); recordsRef.current = []; setSelectedId(""); setDataInfo(null); }
    try {
      const data = await fetchSatelliteRecords(group, signal, provider, forceRefresh);
      if (signal.aborted) return;
      recordsRef.current = data.satellites;
      setDataInfo(data);
      setError("");
      setStatus(data.stale ? `Using saved ${data.providerName} cache` : `Loaded ${data.count.toLocaleString()} TLE records from ${data.providerName}`);
      recalc();
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message || "Unknown API error");
        setStatus(preserveExisting && recordsRef.current.length ? "Refresh failed; continuing with loaded data" : "Satellite data unavailable");
      }
    } finally {
      if (!signal.aborted) setIsLoadingData(false);
    }
  }, [group, provider, recalc]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => {
    const interval = setInterval(() => load(new AbortController().signal, false, true), 2 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);
  useEffect(() => {
    const controller = new AbortController();
    fetchDataProviders(controller.signal)
      .then(setProviderAvailability)
      .catch(error => { if (error.name !== "AbortError") setProviderStatusError(error.message || "Unable to check data provider configuration."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(CITY_DATA_URL, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`City data request failed (${response.status})`); return response.json(); })
      .then(data => {
        const cities = data.features.map(({ properties }) => ({
          name: properties.name,
          lat: Number(properties.latitude),
          lng: Number(properties.longitude),
          population: Number(properties.pop_max) || 0
        })).filter(city => city.name && Number.isFinite(city.lat) && Number.isFinite(city.lng))
          .sort((a, b) => b.population - a.population);
        const knownNames = new Set(cities.map(city => normalizeSearch(city.name)));
        const additionalCities = EXTRA_CITIES.filter(city => !knownNames.has(normalizeSearch(city.name)));
        setCityCatalog([...additionalCities, ...cities].sort((a, b) => b.population - a.population));
      })
      .catch(error => { if (error.name !== "AbortError") console.error("Unable to load populated places", error); });
    return () => controller.abort();
  }, []);
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setSolarClock(Date.now()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { if (recordsRef.current.length) recalc(); }, [tick, recalc]);
  useEffect(() => {
    if (!host.current) return;
    const world = Globe()(host.current); globe.current = world;
    world.width(host.current.clientWidth).height(520).backgroundColor("#030914").backgroundImageUrl(STARFIELD_TEXTURE)
      .globeImageUrl(DAY_TEXTURE)
      .showAtmosphere(true).atmosphereColor("#39bdf8").atmosphereAltitude(.15)
      .pointsData([]).pointLat("lat").pointLng("lng").pointAltitude(d => Math.max(.001, d.altitudeKm / 6371))
      .pointRadius(d => d.noradId === selectedId ? .24 : .10).pointColor(d => d.noradId === selectedId ? "#fff" : COLORS[d.orbitType])
      .pointLabel(d => `<div style="padding:8px;color:#e8f4ff;background:#071426;border:1px solid #2dd4bf;border-radius:8px"><b>${String(d.name).replace(/[<>]/g, "")}</b><br>NORAD ${d.noradId}<br>${d.orbitType} · ${fmt(d.altitudeKm, 0)} km</div>`)
      .onPointClick(p => setSelectedId(p.noradId)).pathsData([]).pathPoints("coords").pathPointLat(p => p[0]).pathPointLng(p => p[1]).pathPointAlt(p => p[2])
      .pathColor(p => p.noradId === selectedId ? "#fff" : COLORS[p.orbitType]).pathStroke(p => p.noradId === selectedId ? 1.4 : .45).pathResolution(3).pathLabel(p => `${p.name} · ${p.orbitType} predicted orbit`)
      .htmlElementsData([]).htmlLat("lat").htmlLng("lng").htmlAltitude(0.016).htmlElement(city => {
        const element = document.createElement("div");
        const color = city.isNight ? "#ffd28a" : "#c2ddf2";
        element.textContent = city.name;
        element.style.color = color;
        element.style.background = city.isNight ? "rgba(24, 17, 8, 0.72)" : "rgba(5, 15, 27, 0.68)";
        element.style.border = `1px solid ${city.isNight ? "rgba(255, 190, 90, 0.48)" : "rgba(145, 190, 220, 0.34)"}`;
        element.style.borderRadius = "3px";
        element.style.boxShadow = `0 0 8px ${city.isNight ? "rgba(255, 176, 58, 0.24)" : "rgba(100, 170, 220, 0.12)"}`;
        element.style.font = '500 9px "DM Mono", monospace';
        element.style.padding = "2px 4px";
        element.style.whiteSpace = "nowrap";
        element.style.pointerEvents = "none";
        return element;
      });
    world.onZoom(({ altitude }) => {
      const nextLimit = altitude > 2.3 ? 30 : altitude > 1.8 ? 50 : altitude > 1.35 ? 80 : altitude > 1 ? 130 : 220;
      setCityLimit(current => current === nextLimit ? current : nextLimit);
    });
    const nightLongitude = solarPosition.lng > 0 ? solarPosition.lng - 180 : solarPosition.lng + 180;
    world.pointOfView({ lat: -solarPosition.lat, lng: nightLongitude, altitude: 2.1 }, 0);
    let disposed = false, dayTexture, nightTexture, material;
    const loader = new TextureLoader();
    Promise.all([loader.loadAsync(DAY_TEXTURE), loader.loadAsync(NIGHT_TEXTURE)]).then(([day, night]) => {
      dayTexture = day; nightTexture = night;
      if (disposed) { day.dispose(); night.dispose(); return; }
      day.colorSpace = SRGBColorSpace; night.colorSpace = SRGBColorSpace;
      material = new ShaderMaterial({
        uniforms: {
          dayTexture: { value: day },
          nightTexture: { value: night },
          sunPosition: { value: new Vector2(solarPosition.lat, solarPosition.lng) }
        },
        vertexShader: DAY_NIGHT_SHADER.vertexShader,
        fragmentShader: DAY_NIGHT_SHADER.fragmentShader
      });
      globeMaterial.current = material;
      world.globeMaterial(material);
    }).catch(error => console.error("Unable to load day/night Earth textures", error));
    const observer = new ResizeObserver(() => { if (host.current) world.width(host.current.clientWidth); }); observer.observe(host.current);
    return () => { disposed = true; observer.disconnect(); material?.dispose(); dayTexture?.dispose(); nightTexture?.dispose(); globeMaterial.current = null; world._destructor?.(); globe.current = null; host.current?.replaceChildren(); };
  }, []);
  useEffect(() => { if (globeMaterial.current) globeMaterial.current.uniforms.sunPosition.value.set(solarPosition.lat, solarPosition.lng); }, [solarPosition]);
  useEffect(() => { globe.current?.htmlElementsData(cityLabels); }, [cityLabels]);
  const searchQuery = normalizeSearch(search.trim());
  const searchableSatellites = useMemo(() => satellites.map(satellite => ({
    satellite,
    name: normalizeSearch(satellite.name),
    noradId: normalizeSearch(satellite.noradId)
  })), [satellites]);
  const filtered = useMemo(() => {
    const lo = minAlt === "" ? -Infinity : Number(minAlt), hi = maxAlt === "" ? Infinity : Number(maxAlt);
    const matches = searchableSatellites
      .filter(({ satellite, name, noradId }) =>
        (!searchQuery || name.includes(searchQuery) || noradId.includes(searchQuery)) &&
        (orbitType === "ALL" || satellite.orbitType === orbitType) &&
        satellite.altitudeKm >= lo && satellite.altitudeKm <= hi);
    if (searchQuery) {
      const rank = ({ name, noradId }) => name === searchQuery || noradId === searchQuery ? 0 : name.startsWith(searchQuery) || noradId.startsWith(searchQuery) ? 1 : 2;
      matches.sort((a, b) => rank(a) - rank(b) || a.noradId.localeCompare(b.noradId, undefined, { numeric: true }));
    }
    return matches.map(({ satellite }) => satellite);
  }, [searchableSatellites, searchQuery, orbitType, minAlt, maxAlt]);
  const searchSuggestions = useMemo(() => searchQuery ? filtered.slice(0, 6) : [], [filtered, searchQuery]);
  const searchMatch = searchQuery ? filtered[0] || null : null;
  useEffect(() => { setVisibleRows(100); }, [searchQuery, orbitType, minAlt, maxAlt, group]);
  useEffect(() => {
    if (!searchQuery) { autoFocusedId.current = ""; return; }
    if (!searchMatch) { setSelectedId(""); autoFocusedId.current = ""; return; }
    setSelectedId(searchMatch.noradId);
    if (autoFocusedId.current !== searchMatch.noradId) {
      autoFocusedId.current = searchMatch.noradId;
      globe.current?.pointOfView({ lat: searchMatch.lat, lng: searchMatch.lng, altitude: 1.5 }, 800);
    }
  }, [searchQuery, searchMatch?.noradId]);
  const selected = filtered.find(s => s.noradId === selectedId) || satellites.find(s => s.noradId === selectedId) || null;
  const points = useMemo(() => filtered.slice(0, 2500), [filtered]);
  const paths = useMemo(() => { const n = pathLimit === "all" ? 2500 : Number(pathLimit), candidates = filtered.slice(0, n), now = new Date(); return candidates.flatMap(s => { const coords = calculateOrbitTrack(s.satrec, now, 100, 5); return coords.length > 1 ? [{ name: s.name, noradId: s.noradId, orbitType: s.orbitType, coords }] : []; }); }, [filtered, pathLimit]);
  useEffect(() => { if (globe.current) { globe.current.pointRadius(d => d.noradId === selectedId ? .24 : .10).pointColor(d => d.noradId === selectedId ? "#fff" : COLORS[d.orbitType]).pathColor(p => p.noradId === selectedId ? "#fff" : COLORS[p.orbitType]).pathStroke(p => p.noradId === selectedId ? 1.4 : .45).pointsData(points).pathsData(paths); } }, [points, paths, selectedId]);
  const focus = sat => { setSelectedId(sat.noradId); globe.current?.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 1.5 }, 800); };
  const resetGlobeView = () => {
    const nightLongitude = solarPosition.lng > 0 ? solarPosition.lng - 180 : solarPosition.lng + 180;
    setSelectedId("");
    globe.current?.pointOfView({ lat: -solarPosition.lat, lng: nightLongitude, altitude: 2.1 }, 800);
  };
  const chooseSuggestion = sat => { setSearch(sat.name); setSearchOpen(false); setActiveSuggestion(-1); focus(sat); };
  const handleSearchKeyDown = event => {
    if (event.key === "Escape") { setSearchOpen(false); setActiveSuggestion(-1); }
    else if (event.key === "ArrowDown" && searchSuggestions.length) {
      event.preventDefault();
      setSearchOpen(true);
      setActiveSuggestion(index => Math.min(index + 1, searchSuggestions.length - 1));
    } else if (event.key === "ArrowUp" && searchSuggestions.length) {
      event.preventDefault();
      setActiveSuggestion(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && searchOpen && activeSuggestion >= 0 && searchSuggestions[activeSuggestion]) {
      event.preventDefault();
      chooseSuggestion(searchSuggestions[activeSuggestion]);
    }
  };
  const retry = () => load(new AbortController().signal, true, true);
  return <section className="tracker">
    <div className="section-heading"><div><p className="eyebrow">LIVE ORBITAL VIEW</p><h2>3D Satellite Orbit Viewer</h2><p className="muted">Drag to rotate · Scroll to zoom · Click a satellite to inspect it</p></div><div className="status-pill"><i className={error ? "status-dot error-dot" : "status-dot"}/>{error ? "DATA OFFLINE" : dataInfo?.stale ? "CACHED DATA" : "SYSTEM STATUS"}</div></div>
    <div className="toolbar">
      <label className="field"><span>Data provider</span><select value={provider} onChange={event => setProvider(event.target.value)}><option value="celestrak">CelesTrak</option><option value="space-track">Space-Track{spaceTrackConfigured ? "" : " · needs setup"}</option></select></label>
      <label className="field"><span>Satellite group</span><select value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <div className="field search-field"><label htmlFor="satellite-search"><span>Find a satellite</span></label><div className="search-control"><span className="search-icon" aria-hidden="true"/><input id="satellite-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={searchOpen && searchSuggestions.length > 0} aria-controls="satellite-search-results" aria-activedescendant={activeSuggestion >= 0 ? `satellite-suggestion-${activeSuggestion}` : undefined} value={search} onFocus={() => setSearchOpen(true)} onChange={event => { setSearch(event.target.value); setSearchOpen(true); setActiveSuggestion(-1); }} onKeyDown={handleSearchKeyDown} onBlur={() => window.setTimeout(() => { setSearchOpen(false); setActiveSuggestion(-1); }, 120)} placeholder="Search satellite name or NORAD ID…" />{search && <button type="button" className="search-clear" onMouseDown={event => event.preventDefault()} onClick={() => { setSearch(""); setSearchOpen(true); setActiveSuggestion(-1); document.getElementById("satellite-search")?.focus(); }} aria-label="Clear satellite search">×</button>}
        {searchOpen && searchQuery && <div className="search-results" id="satellite-search-results" role="listbox" aria-label="Satellite search suggestions">{searchSuggestions.length ? searchSuggestions.map((satellite, index) => <button type="button" role="option" aria-selected={activeSuggestion === index} id={`satellite-suggestion-${index}`} className={`search-result${activeSuggestion === index ? " active" : ""}`} key={satellite.noradId} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(satellite)}><span className="search-result-main"><b>{satellite.name}</b><small>NORAD {satellite.noradId}</small></span><span className="search-result-orbit" style={{ color: COLORS[satellite.orbitType] }}>{satellite.orbitType}</span></button>) : <div className="search-no-results">No matches. Try another name or NORAD ID.</div>}</div>}
      </div><small className="search-summary" aria-live="polite">{searchQuery ? `${filtered.length.toLocaleString()} matching ${filtered.length === 1 ? "satellite" : "satellites"}` : "Search across the loaded satellite group"}</small></div>
      <label className="field"><span>Orbit class</span><select value={orbitType} onChange={e => setOrbitType(e.target.value)}><option value="ALL">All orbit classes</option><option value="LEO">LEO</option><option value="MEO">MEO</option><option value="GEO">GEO</option></select></label>
      <div className="toolbar-actions"><button className="button refresh-button" disabled={isLoadingData} onClick={retry} title="Request the latest data from the selected provider">{isLoadingData ? "Updating…" : "↻ Update data"}</button><button className="button" disabled={!filtered.length} onClick={() => exportSatellitesCsv(filtered)}>Export CSV ↓</button></div>
    </div>
    {providerStatusError && <p className="provider-note warning">{providerStatusError}</p>}
    {provider === "space-track" && !spaceTrackConfigured && <p className="provider-note">Space-Track needs server credentials. Set <code>SPACETRACK_IDENTITY</code> and <code>SPACETRACK_PASSWORD</code> in <code>.env</code>, then restart the server. Credentials stay on the server and are never sent to the browser.</p>}
    <div className="filter-row"><strong>Altitude filter <small>(km)</small></strong><label>Min <input type="number" min="0" value={minAlt} onChange={e => setMinAlt(e.target.value)}/></label><label>Max <input type="number" min="0" value={maxAlt} onChange={e => setMaxAlt(e.target.value)}/></label><label>Orbital paths <select value={pathLimit} onChange={e => setPathLimit(e.target.value)}><option value="25">25 max</option><option value="100">100 max</option><option value="250">250 max</option><option value="500">500 max</option><option value="all">All displayed (up to 2,500)</option></select></label><button className="link-button" onClick={() => { setSearch(""); setOrbitType("ALL"); setMinAlt("0"); setMaxAlt("40000"); }}>Reset filters</button></div>
    {error && <div className="error-panel"><b>{recordsRef.current.length ? "Could not update satellite data" : "Satellite data could not be loaded"}</b><p>{error}</p><p>{recordsRef.current.length ? `Tracking continues using the last successful ${dataInfo?.providerName || "provider"} data from ${dataInfo?.fetchedAt ? new Date(dataInfo.fetchedAt).toLocaleString() : "an earlier fetch"}.` : <>Check the API service at <code>http://127.0.0.1:3001/api/health</code>. Successful provider data is cached for two hours.</>}</p><button className="button" disabled={isLoadingData} onClick={retry}>{isLoadingData ? "Updating…" : "Try update again"}</button></div>}
    <div className="metrics-grid"><Metric label="Loaded satellites" value={satellites.length.toLocaleString()} sub={`${dataInfo?.providerName || "Selected provider"} TLE records`}/><Metric label="Filtered results" value={filtered.length.toLocaleString()} sub="Current filters and search"/><Metric label="Orbital paths" value={paths.length.toLocaleString()} sub="100-minute prediction window"/><Metric label="Last data fetch" value={dataInfo?.fetchedAt ? new Date(dataInfo.fetchedAt).toLocaleTimeString() : "Waiting"} sub={dataInfo?.stale ? "Cached data · refresh may be limited upstream" : dataInfo?.fetchedAt ? new Date(dataInfo.fetchedAt).toLocaleDateString() : "Fetching provider data"}/></div>
    <div className="globe-layout"><div className="globe-panel"><div className="globe-panel-top"><span className="globe-legend"><i className="legend leo"/> LEO <i className="legend meo"/> MEO <i className="legend geo"/> GEO</span><span className="globe-source">{dataInfo ? `${dataInfo.providerName} · ${dataInfo.source}${dataInfo.stale ? " · stale cache" : ""}` : status}</span><div className="globe-actions"><button type="button" className="globe-control" onClick={() => setShowCityLabels(value => !value)} aria-pressed={showCityLabels}>{showCityLabels ? "Cities on" : "Cities off"}</button><button type="button" className="globe-control" onClick={resetGlobeView}>Global view</button></div></div><div className="globe-container" ref={host}/><div className="globe-foot">{status} · rendered marker cap: 2,500 · Day/night terminator · subsolar {fmt(solarPosition.lat)}°, {fmt(solarPosition.lng)}° · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">NASA Earth Observatory · Blue Marble Next Generation</a></div></div>
    <aside className="telemetry-panel"><p className="eyebrow">OBJECT INSPECTOR</p><h3>Satellite telemetry</h3>{selected ? <><h2 className="selected-name">{selected.name}</h2><p className="muted">NORAD ID {selected.noradId}</p><span className="orbit-badge" style={{color:COLORS[selected.orbitType]}}>{selected.orbitType} ORBIT</span><div className="telemetry-grid"><Datum label="Latitude" value={`${fmt(selected.lat,3)}°`}/><Datum label="Longitude" value={`${fmt(selected.lng,3)}°`}/><Datum label="Altitude" value={`${fmt(selected.altitudeKm)} km`}/><Datum label="Speed" value={`${fmt(selected.speedKmS,3)} km/s`}/><Datum label="Inclination" value={`${fmt(selected.inclinationDeg,2)}°`}/><Datum label="Eccentricity" value={fmt(selected.eccentricity,5)}/><Datum label="Period" value={`${fmt(selected.periodMin)} min`}/><Datum label="Mean altitude" value={`${fmt(selected.meanAltitudeKm,0)} km`}/><Datum label="Perigee" value={`${fmt(selected.perigeeAltitudeKm,0)} km`}/><Datum label="Apogee" value={`${fmt(selected.apogeeAltitudeKm,0)} km`}/></div><button className="button focus-button" onClick={() => globe.current?.pointOfView({lat:selected.lat,lng:selected.lng,altitude:1.5},800)}>Focus satellite</button></> : <div className="empty-selection"><div>◎</div><b>Select a satellite</b><p>Click a globe marker or use Inspect in the catalogue below.</p></div>}<div className="source-box"><small>ORBITAL ELEMENT SOURCE</small><b><a href={provider === "space-track" ? "https://www.space-track.org/" : "https://celestrak.org/"} target="_blank" rel="noreferrer">{dataInfo?.providerName || (provider === "space-track" ? "Space-Track" : "CelesTrak")} ↗</a></b><span>{dataInfo?.fetchedAt ? `Retrieved ${new Date(dataInfo.fetchedAt).toLocaleString()}` : "No successful data fetch yet"}</span>{dataInfo?.warning && <span className="warning">{dataInfo.warning}</span>}</div></aside></div>
    <div className="table-panel"><div className="table-header"><div><p className="eyebrow">CATALOG BROWSER</p><h3>Satellite catalogue</h3></div><span>Showing {Math.min(visibleRows,filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>NORAD ID</th><th>Orbit</th><th>Altitude km</th><th>Speed km/s</th><th>Latitude</th><th>Longitude</th><th></th></tr></thead><tbody>{filtered.slice(0,visibleRows).map(s => <tr key={s.noradId} className={selectedId===s.noradId?"selected-row":""}><td className="sat-name">{s.name}</td><td>{s.noradId}</td><td style={{color:COLORS[s.orbitType]}}>{s.orbitType}</td><td>{fmt(s.altitudeKm)}</td><td>{fmt(s.speedKmS,3)}</td><td>{fmt(s.lat,3)}°</td><td>{fmt(s.lng,3)}°</td><td><button className="link-button" onClick={() => focus(s)}>Inspect ↗</button></td></tr>)}{!filtered.length && <tr><td colSpan="8" className="empty-table">{searchQuery ? "No satellites match this search and the selected filters." : "No satellites match the selected filters or data has not loaded."}</td></tr>}</tbody></table></div>{visibleRows < filtered.length && <div className="table-more"><button className="button" onClick={() => setVisibleRows(count => Math.min(count + 100, filtered.length))}>Show 100 more results</button></div>}</div>
    <p className="disclaimer">Positions are estimates from publicly available GP/TLE data propagated using SGP4. Large groups may be slow. Not a certified navigation, collision-avoidance, or operational tracking system.</p>
  </section>;
}
function Metric({label,value,sub}) { return <div className="metric-card"><span>{label}</span><b>{value}</b><small>{sub}</small></div>; }
function Datum({label,value}) { return <div className="datum"><small>{label}</small><b>{value}</b></div>; }
