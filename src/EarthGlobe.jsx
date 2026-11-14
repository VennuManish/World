import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import { BufferGeometry, Line, LineBasicMaterial, ShaderMaterial, SRGBColorSpace, TextureLoader, Vector2, Vector3 } from "three";
import CITY_DATA_URL from "../node_modules/globe.gl/example/datasets/ne_110m_populated_places_simple.geojson?url";
import WORLD_COUNTRIES_URL from "../node_modules/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson?url";
import NIGHT_TEXTURE from "../node_modules/three-globe/example/img/earth-night.jpg?url";
import STARFIELD_TEXTURE from "../node_modules/three-globe/example/img/night-sky.png?url";
import { GROUPS, fetchDataProviders, fetchSatelliteRecords, calculateOrbitTrack, calculateOrbitalTrajectory, splitOrbitTrackAtAntimeridian, calculatePasses, exportSatellitesCsv } from "./satelliteData.js";
const DAY_TEXTURE = "/images/nasa-blue-marble-2048.jpg";
const COLORS = { LEO: "#2dd4bf", MEO: "#fbbf24", GEO: "#a78bfa" };
const fmt = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
const normalizeSearch = value => value.toLowerCase().replace(/[^a-z0-9]/g, "");
function getCountryOutlines(geoJson) {
  return geoJson.features.flatMap(feature => {
    const geometry = feature.geometry;
    const polygons = geometry?.type === "Polygon"
      ? [geometry.coordinates]
      : geometry?.type === "MultiPolygon"
        ? geometry.coordinates
        : [];
    return polygons.map(polygon => {
      let crossesDateLine = false;
      const path = polygon.map(ring => {
        let previousLongitude = null;
        const commands = [];
        for (const [longitude, latitude] of ring) {
          const x = ((longitude + 180) / 360) * 900;
          const y = ((90 - latitude) / 180) * 420;
          const crosses = previousLongitude !== null && Math.abs(longitude - previousLongitude) > 180;
          if (crosses) crossesDateLine = true;
          commands.push(`${previousLongitude === null || crosses ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
          previousLongitude = longitude;
        }
        return commands.length > 1 ? `${commands.join(" ")} Z` : "";
      }).filter(Boolean).join(" ");
      return { path, fill: !crossesDateLine };
    }).filter(polygon => polygon.path);
  });
}
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
  const host = useRef(null), globe = useRef(null), globeMaterial = useRef(null), recordsRef = useRef([]), autoFocusedId = useRef(""), fullCatalogPreviousSelection = useRef(null);
  const positionWorkerRef = useRef(null), workerRecordsRef = useRef(null), calculationRecordsRef = useRef(null), positionWorkerBusyRef = useRef(false), pendingPositionUpdateRef = useRef(false);
  const [group, setGroup] = useState("active"), [provider, setProvider] = useState("space-track"), [propagationModel, setPropagationModel] = useState("sgp4"), [providerAvailability, setProviderAvailability] = useState(null), [providerStatusError, setProviderStatusError] = useState(""), [satellites, setSatellites] = useState([]), [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(""), [searchFullCatalog, setSearchFullCatalog] = useState(false), [orbitType, setOrbitType] = useState("ALL"), [objectTypeFilter, setObjectTypeFilter] = useState("ALL"), [minAlt, setMinAlt] = useState("0"), [maxAlt, setMaxAlt] = useState("40000");
  const [searchOpen, setSearchOpen] = useState(false), [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const [coordinateCopyStatus, setCoordinateCopyStatus] = useState("");
  const [pathLimit, setPathLimit] = useState("25"), [visibleRows, setVisibleRows] = useState(100), [status, setStatus] = useState("Connecting to API…"), [error, setError] = useState(""), [dataInfo, setDataInfo] = useState(null), [updatedAt, setUpdatedAt] = useState(null), [isLoadingData, setIsLoadingData] = useState(false), [tick, setTick] = useState(0);
  const [cityCatalog, setCityCatalog] = useState([]), [cityLimit, setCityLimit] = useState(60), [showCityLabels, setShowCityLabels] = useState(true);
  const [countryOutlines, setCountryOutlines] = useState([]);
  const [solarClock, setSolarClock] = useState(() => Date.now());
  const [operationalStatus, setOperationalStatus] = useState(null);
  const [operationalStatusError, setOperationalStatusError] = useState("");
  const [reentryData, setReentryData] = useState(null);
  const [reentryError, setReentryError] = useState("");
  const [isLoadingReentries, setIsLoadingReentries] = useState(false);
  const reentryRequestRef = useRef(null);
  const propagationModelRef = useRef(propagationModel);
  const spaceTrackConfigured = providerAvailability?.find(item => item.id === "space-track")?.configured === true;
  const automaticRefreshDelay = error || dataInfo?.stale ? 5 * 60 * 1000 : 60 * 60 * 1000 + 60 * 1000;
  const solarPosition = useMemo(() => getSolarPosition(new Date(solarClock)), [solarClock]);
  const cityLabels = useMemo(() => showCityLabels ? cityCatalog.slice(0, cityLimit).map(city => {
    const toRad = Math.PI / 180;
    const daylight = Math.sin(city.lat * toRad) * Math.sin(solarPosition.lat * toRad) + Math.cos(city.lat * toRad) * Math.cos(solarPosition.lat * toRad) * Math.cos((city.lng - solarPosition.lng) * toRad);
    return { ...city, isNight: daylight < -0.05 };
  }) : [], [cityCatalog, cityLimit, showCityLabels, solarPosition]);
  const recalcRef = useRef(() => {});
  const createPositionWorker = useCallback(() => {
    const worker = new Worker(new URL("./positionWorker.js", import.meta.url), { type: "module" });
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") {
        if (calculationRecordsRef.current === recordsRef.current) {
          setStatus(`Calculating positions: ${data.completed.toLocaleString()} / ${data.total.toLocaleString()}`);
        }
        return;
      }
      if (data.type !== "complete") return;
      const sourceRecords = calculationRecordsRef.current;
      const isCurrent = sourceRecords === recordsRef.current && data.algorithm === propagationModelRef.current;
      positionWorkerBusyRef.current = false;
      calculationRecordsRef.current = null;
      if (isCurrent) {
        const rows = data.rows.map(({ index, ...calculated }) => ({ ...sourceRecords[index], ...calculated }));
        setSatellites(rows);
        const updatedAt = new Date(data.startedAt);
        setUpdatedAt(updatedAt);
        setError("");
        const modelName = data.algorithm === "fg" ? "F&G two-body" : "SGP4";
        const duration = (data.durationMs / 1000).toFixed(1);
        setStatus(`Tracking ${rows.length.toLocaleString()} satellites with ${modelName} · updated in ${duration}s`);
        if (data.failedRecords) {
          console.warn(`${data.failedRecords.toLocaleString()} satellite positions could not be calculated.`);
        }
      } else if (recordsRef.current.length) {
        pendingPositionUpdateRef.current = true;
      }
      if (pendingPositionUpdateRef.current) {
        pendingPositionUpdateRef.current = false;
        recalcRef.current();
      }
    };
    worker.onerror = event => {
      positionWorkerBusyRef.current = false;
      workerRecordsRef.current = null;
      calculationRecordsRef.current = null;
      pendingPositionUpdateRef.current = false;
      if (positionWorkerRef.current === worker) positionWorkerRef.current = null;
      worker.terminate();
      setError(`Satellite position calculation failed: ${event.message}`);
      setStatus("Satellite position calculation failed");
    };
    positionWorkerRef.current = worker;
    return worker;
  }, []);
  const recalc = useCallback(() => {
    const records = recordsRef.current;
    if (!records.length) return;
    if (positionWorkerBusyRef.current) {
      pendingPositionUpdateRef.current = true;
      return;
    }
    const now = new Date();
    try {
      const worker = positionWorkerRef.current || createPositionWorker();
      const includeRecords = workerRecordsRef.current !== records;
      positionWorkerBusyRef.current = true;
      calculationRecordsRef.current = records;
      workerRecordsRef.current = records;
      setStatus(`Calculating positions for ${records.length.toLocaleString()} satellites…`);
      worker.postMessage({
        type: "calculate",
        records: includeRecords ? records : null,
        startedAt: now.toISOString(),
        algorithm: propagationModel
      });
    } catch (error) {
      positionWorkerBusyRef.current = false;
      calculationRecordsRef.current = null;
      workerRecordsRef.current = null;
      setError(`Unable to start satellite position calculation: ${error.message}`);
      setStatus("Satellite position calculation failed");
    }
  }, [createPositionWorker, propagationModel]);
  useEffect(() => { recalcRef.current = recalc; }, [recalc]);
  useEffect(() => { propagationModelRef.current = propagationModel; }, [propagationModel]);
  useEffect(() => () => positionWorkerRef.current?.terminate(), []);
  const load = useCallback(async (signal, forceRefresh = false, preserveExisting = false) => {
    setIsLoadingData(true); setError(""); setStatus(forceRefresh ? "Refreshing orbital data…" : "Loading orbital elements…");
    if (!preserveExisting) { setSatellites([]); recordsRef.current = []; setSelectedId(""); setDataInfo(null); }
    try {
      const data = await fetchSatelliteRecords(group, signal, provider, forceRefresh);
      if (signal.aborted) return;
      recordsRef.current = data.satellites;
      setDataInfo(data);
      setError("");
      setStatus(data.stale ? `Using saved ${data.providerName} cache` : `Loaded ${data.count.toLocaleString()} ${data.format || "orbital element"} records from ${data.providerName}`);
      recalcRef.current();
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message || "Unknown API error");
        setStatus(preserveExisting && recordsRef.current.length ? "Refresh failed; continuing with loaded data" : "Satellite data unavailable");
      }
    } finally {
      if (!signal.aborted) setIsLoadingData(false);
    }
  }, [group, provider]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => {
    const timeout = setTimeout(() => load(new AbortController().signal, false, true), automaticRefreshDelay);
    return () => clearTimeout(timeout);
  }, [load, automaticRefreshDelay]);
  useEffect(() => {
    const controller = new AbortController();
    fetchDataProviders(controller.signal)
      .then(setProviderAvailability)
      .catch(error => { if (error.name !== "AbortError") setProviderStatusError(error.message || "Unable to check data provider configuration."); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let controller = new AbortController();
    const refreshStatus = async () => {
      try {
        const response = await fetch("/api/operational-status", { signal: controller.signal, cache: "no-store" });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.details || payload.error || `API error ${response.status}`);
        setOperationalStatus(payload);
        setOperationalStatusError("");
      } catch (error) {
        if (error.name !== "AbortError") setOperationalStatusError(error.message || "Operational status is unavailable.");
      }
    };
    refreshStatus();
    const timer = window.setInterval(() => {
      controller.abort();
      controller = new AbortController();
      refreshStatus();
    }, 60_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
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
  useEffect(() => {
    const controller = new AbortController();
    fetch(WORLD_COUNTRIES_URL, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error(`World map data request failed (${response.status})`); return response.json(); })
      .then(data => setCountryOutlines(getCountryOutlines(data)))
      .catch(error => { if (error.name !== "AbortError") console.error("Unable to load world map outlines", error); });
    return () => controller.abort();
  }, []);
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { const id = setInterval(() => setSolarClock(Date.now()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => { if (recordsRef.current.length) recalc(); }, [tick, recalc]);
  useEffect(() => () => reentryRequestRef.current?.abort(), []);
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
      .pathColor(p => p.noradId === selectedId ? "#fff" : COLORS[p.orbitType]).pathStroke(p => p.noradId === selectedId ? 1.4 : .45).pathResolution(.35).pathLabel(p => `${p.name} · ${p.orbitType}${p.fullOrbit ? " · one-period Earth-fixed ground track" : " predicted orbit preview"}`)
      .customLayerData([])
      .customThreeObject(() => new Line(new BufferGeometry(), new LineBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.82,
        depthTest: false,
        depthWrite: false
      })))
      .customThreeObjectUpdate((object, orbit) => {
        const points = orbit.coords.map(([latitude, longitude, altitude]) => {
          const position = world.getCoords(latitude, longitude, altitude);
          return new Vector3(position.x, position.y, position.z);
        });
        object.renderOrder = 10;
        object.geometry.setFromPoints(points);
        object.geometry.computeBoundingSphere();
      })
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
        (objectTypeFilter === "ALL" || satellite.omm?.OBJECT_TYPE === objectTypeFilter) &&
        satellite.altitudeKm >= lo && satellite.altitudeKm <= hi);
    if (searchQuery) {
      const rank = ({ name, noradId }) => name === searchQuery || noradId === searchQuery ? 0 : name.startsWith(searchQuery) || noradId.startsWith(searchQuery) ? 1 : 2;
      matches.sort((a, b) => rank(a) - rank(b) || a.noradId.localeCompare(b.noradId, undefined, { numeric: true }));
    }
    return matches.map(({ satellite }) => satellite);
  }, [searchableSatellites, searchQuery, orbitType, objectTypeFilter, minAlt, maxAlt]);
  const sortedFiltered = useMemo(() => {
    const valueFor = (satellite, key) => key === "objectType"
      ? satellite.omm?.OBJECT_TYPE || ""
      : satellite[key] ?? "";
    return [...filtered].sort((a, b) => {
      const left = valueFor(a, sort.key), right = valueFor(b, sort.key);
      if ((left === "") !== (right === "")) return left === "" ? 1 : -1;
      const comparison = typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
      return comparison * (sort.direction === "asc" ? 1 : -1);
    });
  }, [filtered, sort]);
  const objectCounts = useMemo(() => {
    const counts = { debris: 0, rocketBodies: 0, payloads: 0, lowPerigeeDebris: 0, staleDebris: 0, watchlist: [] };
    for (const item of satellites) {
      const type = String(item.omm?.OBJECT_TYPE || "").toUpperCase();
      if (type === "DEBRIS") {
        counts.debris += 1;
        if (item.elementFreshness === "stale") counts.staleDebris += 1;
        if (item.perigeeAltitudeKm >= 0 && item.perigeeAltitudeKm < 200) {
          counts.lowPerigeeDebris += 1;
          counts.watchlist.push(item);
        }
      } else if (type === "ROCKET BODY") counts.rocketBodies += 1;
      else if (type === "PAYLOAD") counts.payloads += 1;
    }
    counts.watchlist.sort((left, right) => left.perigeeAltitudeKm - right.perigeeAltitudeKm);
    counts.watchlist = counts.watchlist.slice(0, 5);
    return counts;
  }, [satellites]);
  const searchSuggestions = useMemo(() => searchQuery ? filtered.slice(0, 6) : [], [filtered, searchQuery]);
  const searchMatch = searchQuery ? filtered[0] || null : null;
  useEffect(() => { setVisibleRows(100); }, [searchQuery, orbitType, objectTypeFilter, minAlt, maxAlt, group]);
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
  useEffect(() => { setCoordinateCopyStatus(""); }, [selectedId]);
  const points = useMemo(() => filtered.slice(0, 2500), [filtered]);
  const paths = useMemo(() => {
    const n = pathLimit === "all" ? 2500 : Number(pathLimit);
    const candidates = filtered.slice(0, n).filter(satellite => satellite.noradId !== selectedId);
    const selectedSatellite = satellites.find(satellite => satellite.noradId === selectedId);
    const now = new Date();
    return candidates.flatMap(s => {
      const coords = calculateOrbitTrack(s, now, 100, 5, propagationModel);
      return splitOrbitTrackAtAntimeridian(coords).map(segment => ({
        name: s.name,
        noradId: s.noradId,
        orbitType: s.orbitType,
        coords: segment
      }));
    });
  }, [filtered, pathLimit, propagationModel, selectedId, satellites]);
  const selectedOrbit = useMemo(() => {
    const selectedSatellite = satellites.find(satellite => satellite.noradId === selectedId);
    if (!selectedSatellite) return [];
    const coords = calculateOrbitalTrajectory(selectedSatellite, new Date(), 720, propagationModel);
    return coords.length > 1 ? [{ ...selectedSatellite, coords }] : [];
  }, [propagationModel, selectedId, satellites]);
  useEffect(() => {
    if (!globe.current) return;
    globe.current.pointRadius(d => d.noradId === selectedId ? .24 : .10)
      .pointColor(d => d.noradId === selectedId ? "#fff" : COLORS[d.orbitType])
      .pathColor(p => COLORS[p.orbitType])
      .pathStroke(.45)
      .pointsData(points)
      .pathsData(paths)
      .customLayerData(selectedOrbit);
  }, [points, paths, selectedId, selectedOrbit]);
  const focus = sat => { setSelectedId(sat.noradId); globe.current?.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 1.5 }, 800); };
  const resetGlobeView = () => {
    const nightLongitude = solarPosition.lng > 0 ? solarPosition.lng - 180 : solarPosition.lng + 180;
    setSelectedId("");
    globe.current?.pointOfView({ lat: -solarPosition.lat, lng: nightLongitude, altitude: 2.1 }, 800);
  };
  const chooseSuggestion = sat => { setSearch(sat.name); setSearchOpen(false); setActiveSuggestion(-1); focus(sat); };
  const enableFullCatalogSearch = enabled => {
    if (enabled) {
      fullCatalogPreviousSelection.current = { provider, group };
      setProvider("space-track");
      setGroup("active");
    } else if (searchFullCatalog && fullCatalogPreviousSelection.current) {
      setProvider(fullCatalogPreviousSelection.current.provider);
      setGroup(fullCatalogPreviousSelection.current.group);
      fullCatalogPreviousSelection.current = null;
    }
    setSearchFullCatalog(enabled);
  };
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
  const toggleSort = key => setSort(current => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
  }));
  const sortHeader = (key, label) => <th key={key} scope="col" aria-sort={sort.key === key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
    <button className="table-sort" type="button" onClick={() => toggleSort(key)}>{label}<span aria-hidden="true">{sort.key === key ? (sort.direction === "asc" ? " ↑" : " ↓") : " ↕"}</span></button>
  </th>;
  const copyCoordinates = async () => {
    if (!selected || !navigator.clipboard?.writeText) {
      setCoordinateCopyStatus("Clipboard access is unavailable in this browser context.");
      return;
    }
    try {
      await navigator.clipboard.writeText(`${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`);
      setCoordinateCopyStatus("Latitude, longitude copied.");
    } catch (error) {
      setCoordinateCopyStatus(`Could not copy coordinates: ${error.message}`);
    }
  };
  const loadReentries = async () => {
    reentryRequestRef.current?.abort();
    const controller = new AbortController();
    reentryRequestRef.current = controller;
    setIsLoadingReentries(true);
    setReentryError("");
    try {
      const response = await fetch("/api/reentries", { signal: controller.signal, cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.details || payload.error || `API error ${response.status}`);
      setReentryData(payload);
    } catch (error) {
      if (error.name !== "AbortError") setReentryError(error.message || "Space-Track TIP data is unavailable.");
    } finally {
      if (!controller.signal.aborted) setIsLoadingReentries(false);
    }
  };
  const formatCacheStatus = providerId => {
    const providerInfo = operationalStatus?.providers?.find(item => item.id === providerId);
    if (!providerInfo) return "Checking cache status…";
    if (!providerInfo.configured) return "Not configured";
    if (providerInfo.cacheState === "no-cache") return "No cached sync yet";
    const cacheAge = Math.max(0, Date.now() - Date.parse(providerInfo.lastSuccessfulSync));
    const ageMinutes = Math.floor(cacheAge / 60_000);
    const ageLabel = ageMinutes < 60 ? `${ageMinutes} min ago` : `${Math.floor(ageMinutes / 60)} h ago`;
    return `${providerInfo.cacheState === "fresh-cache" ? "Cached" : "Stale cache"} · ${ageLabel}`;
  };
  const missionMapTrack = useMemo(() => {
    const trackedSatellite = selected ? satellites.find(satellite => satellite.noradId === selectedId) : filtered[0];
    if (!trackedSatellite) return "";
    const coords = calculateOrbitalTrajectory(trackedSatellite, new Date(), 240, propagationModel);
    if (!coords.length) return "";
    return coords
      .map(([latitude, longitude]) => `${((longitude + 180) / 360) * 100},${((90 - latitude) / 180) * 100}`)
      .join(" ");
  }, [filtered, propagationModel, selected, selectedId, satellites]);
  const missionMapSatellites = useMemo(() => {
    const focusId = selected?.noradId || filtered[0]?.noradId || "";
    return filtered.slice(0, 2500).map(satellite => ({
      ...satellite,
      x: ((satellite.lng + 180) / 360) * 100,
      y: ((90 - satellite.lat) / 180) * 100,
      color: COLORS[satellite.orbitType] || "#71e6d1",
      active: satellite.noradId === focusId
    }));
  }, [filtered, selected?.noradId]);
  return <section className="tracker">
    <div className="section-heading"><div><p className="eyebrow">LIVE ORBITAL VIEW</p><h2>3D Satellite Orbit Viewer</h2><p className="muted">Drag to rotate · Scroll to zoom · Click a satellite to inspect it</p></div><div className="status-pill"><i className={error ? "status-dot error-dot" : "status-dot"}/>{error ? "DATA OFFLINE" : dataInfo?.stale ? "CACHED DATA" : "SYSTEM STATUS"}</div></div>
    <div className="mission-map-panel">
      <div className="mission-map-header">
        <div>
          <p className="eyebrow">ORBITAL ANALYSIS</p>
          <h3>Satellite Constellation World Map</h3>
        </div>
        <div className="mission-map-badges">
          <span>{propagationModel === "fg" ? "F&G TWO-BODY" : "SGP4"}</span>
          <span>{dataInfo?.providerName || "Space-Track"}</span>
          <span>{Math.min(filtered.length, 2500).toLocaleString()} / {filtered.length.toLocaleString()} ON MAP</span>
          <span>{selected ? selected.name : "Select a satellite"}</span>
        </div>
      </div>
      <div className="mission-map-wrap">
        <svg viewBox="0 0 900 420" className="world-map-svg" preserveAspectRatio="xMidYMid meet" aria-label="World map showing satellite constellation positions and ground tracks">
          <defs>
            <linearGradient id="mapGlow" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#071b2d" />
              <stop offset="55%" stopColor="#0d2336" />
              <stop offset="100%" stopColor="#09131d" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="900" height="420" rx="18" fill="url(#mapGlow)" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(longitude => {
            const x = (longitude + 180) / 360 * 900;
            return <line key={`lon-${longitude}`} x1={x} y1="0" x2={x} y2="420" stroke="rgba(110, 170, 208, 0.18)" strokeWidth="1" />;
          })}
          {[0, 30, 60, 90].map(latitude => {
            const y = ((90 - latitude) / 180) * 420;
            return <line key={`lat-${latitude}`} x1="0" y1={y} x2="900" y2={y} stroke="rgba(110, 170, 208, 0.18)" strokeWidth="1" />;
          })}
          {countryOutlines.map((country, index) => <path key={`country-${index}`} d={country.path} fill={country.fill ? "rgba(48, 119, 133, 0.42)" : "none"} fillRule="evenodd" stroke="rgba(126, 179, 196, 0.58)" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
          {missionMapTrack && <polyline points={missionMapTrack} fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.92" />}
          {missionMapSatellites.map(satellite => <g key={satellite.noradId}>
            <circle cx={`${satellite.x}%`} cy={`${satellite.y}%`} r={satellite.active ? 6 : 4} fill={satellite.color} opacity={satellite.active ? 1 : 0.7} />
            {satellite.active && <circle cx={`${satellite.x}%`} cy={`${satellite.y}%`} r={13} fill="none" stroke="#e8f2ff" strokeWidth="1.5" opacity="0.8" />}
          </g>)}
          <g>
            <text x="24" y="36" fill="#c4d8ef" fontSize="11" fontFamily="DM Mono, monospace" letterSpacing="2">WORLD MAP</text>
            <text x="24" y="392" fill="#9bb0c1" fontSize="10" fontFamily="DM Mono, monospace" letterSpacing="2">LAT / LON GRID</text>
          </g>
        </svg>
      </div>
    </div>
    <div className="toolbar">
      <label className="field"><span>Data provider</span><select value={provider} onChange={event => { setProvider(event.target.value); setSearchFullCatalog(false); fullCatalogPreviousSelection.current = null; }}><option value="celestrak">CelesTrak</option><option value="space-track">Space-Track{spaceTrackConfigured ? "" : " · needs setup"}</option></select></label>
      <label className="field"><span>Satellite group</span><select value={group} onChange={event => { setGroup(event.target.value); setSearchFullCatalog(false); fullCatalogPreviousSelection.current = null; }}>{GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="field"><span>Propagation model</span><select value={propagationModel} onChange={event => setPropagationModel(event.target.value)}><option value="sgp4">SGP4 · TLE/OMM standard</option><option value="fg">F&G · two-body comparison</option></select></label>
      <div className="field search-field"><label htmlFor="satellite-search"><span>Find a satellite</span></label><div className="search-control"><span className="search-icon" aria-hidden="true"/><input id="satellite-search" type="search" role="combobox" aria-autocomplete="list" aria-expanded={searchOpen && searchSuggestions.length > 0} aria-controls="satellite-search-results" aria-activedescendant={activeSuggestion >= 0 ? `satellite-suggestion-${activeSuggestion}` : undefined} value={search} onFocus={() => setSearchOpen(true)} onChange={event => { setSearch(event.target.value); setSearchOpen(true); setActiveSuggestion(-1); }} onKeyDown={handleSearchKeyDown} onBlur={() => window.setTimeout(() => { setSearchOpen(false); setActiveSuggestion(-1); }, 120)} placeholder="Search satellite name or NORAD ID…" />{search && <button type="button" className="search-clear" onMouseDown={event => event.preventDefault()} onClick={() => { setSearch(""); setSearchOpen(true); setActiveSuggestion(-1); document.getElementById("satellite-search")?.focus(); }} aria-label="Clear satellite search">×</button>}
        {searchOpen && searchQuery && <div className="search-results" id="satellite-search-results" role="listbox" aria-label="Satellite search suggestions">{searchSuggestions.length ? searchSuggestions.map((satellite, index) => <button type="button" role="option" aria-selected={activeSuggestion === index} id={`satellite-suggestion-${index}`} className={`search-result${activeSuggestion === index ? " active" : ""}`} key={satellite.noradId} onMouseDown={event => event.preventDefault()} onClick={() => chooseSuggestion(satellite)}><span className="search-result-main"><b>{satellite.name}</b><small>NORAD {satellite.noradId}</small></span><span className="search-result-orbit" style={{ color: COLORS[satellite.orbitType] }}>{satellite.orbitType}</span></button>) : <div className="search-no-results">No matches. Try another name or NORAD ID.</div>}</div>}
      </div>            <small className="search-summary" aria-live="polite">{searchQuery ? `${filtered.length.toLocaleString()} matching ${filtered.length === 1 ? "satellite" : "satellites"}` : "Search across the loaded satellite group"}{searchFullCatalog ? " · all active Space-Track objects" : ""}</small>
      <label className="catalog-search-toggle"><input type="checkbox" checked={searchFullCatalog} onChange={event => enableFullCatalogSearch(event.target.checked)}/> Search entire active catalog</label></div>
      <label className="field"><span>Orbit class</span><select value={orbitType} onChange={e => setOrbitType(e.target.value)}><option value="ALL">All orbit classes</option><option value="LEO">LEO</option><option value="MEO">MEO</option><option value="GEO">GEO</option></select></label>
      <label className="field"><span>Object type</span><select value={objectTypeFilter} onChange={event => setObjectTypeFilter(event.target.value)}><option value="ALL">All object types</option><option value="PAYLOAD">Payload</option><option value="ROCKET BODY">Rocket body</option><option value="DEBRIS">Debris</option></select></label>
      <div className="toolbar-actions"><button className="button refresh-button" disabled={isLoadingData} onClick={retry} title="Request the latest data from the selected provider">{isLoadingData ? "Updating…" : "↻ Update data"}</button><button className="button" disabled={!filtered.length} onClick={() => exportSatellitesCsv(sortedFiltered)}>Export CSV ↓</button></div>
    </div>
    {providerStatusError && <p className="provider-note warning">{providerStatusError}</p>}
    {provider === "space-track" && !spaceTrackConfigured && <p className="provider-note">Space-Track needs server credentials. Set <code>SPACETRACK_IDENTITY</code> and <code>SPACETRACK_PASSWORD</code> in <code>.env</code>, then restart the server. Credentials stay on the server and are never sent to the browser.</p>}
    {dataInfo?.warning && <p className="provider-note warning">{dataInfo.warning}{dataInfo.stale ? " The app will retry automatically in about five minutes." : ""}</p>}
    <div className="filter-row"><strong>Altitude filter <small>(km)</small></strong><label>Min <input type="number" min="0" value={minAlt} onChange={e => setMinAlt(e.target.value)}/></label><label>Max <input type="number" min="0" value={maxAlt} onChange={e => setMaxAlt(e.target.value)}/></label><label>Orbital paths <select value={pathLimit} onChange={e => setPathLimit(e.target.value)}><option value="25">25 max</option><option value="100">100 max</option><option value="250">250 max</option><option value="500">500 max</option><option value="all">All displayed (up to 2,500)</option></select></label><button className="link-button" onClick={() => { setSearch(""); setOrbitType("ALL"); setObjectTypeFilter("ALL"); setMinAlt("0"); setMaxAlt("40000"); }}>Reset filters</button></div>
    {error && <div className="error-panel"><b>{recordsRef.current.length ? "Could not update satellite data" : "Satellite data could not be loaded"}</b><p>{error}</p><p>{recordsRef.current.length ? `Tracking continues using the last successful ${dataInfo?.providerName || "provider"} data from ${dataInfo?.fetchedAt ? new Date(dataInfo.fetchedAt).toLocaleString() : "an earlier fetch"}.` : "The app will retry automatically in about five minutes. If the provider keeps rejecting requests, its access policy or the deployment network must allow the request before new orbital data can load."}</p><button className="button" disabled={isLoadingData} onClick={retry}>{isLoadingData ? "Updating…" : "Try update again"}</button></div>}
    <div className="metrics-grid"><Metric label="Loaded satellites" value={satellites.length.toLocaleString()} sub={`${dataInfo?.providerName || "Selected provider"} ${dataInfo?.format || "orbital element"} records`}/><Metric label="Filtered results" value={filtered.length.toLocaleString()} sub="Current filters and search"/><Metric label="Orbital paths" value={paths.length.toLocaleString()} sub="100-minute prediction window"/><Metric label="Rocket bodies" value={objectCounts.rocketBodies.toLocaleString()} sub="In the loaded catalog"/></div>
    <section className="debris-monitor-panel" aria-labelledby="debris-monitor-title">
      <div className="debris-monitor-header">
        <div><p className="eyebrow">DEBRIS MONITORING</p><h3 id="debris-monitor-title">Orbital decay watch</h3></div>
        <span>{dataInfo?.providerName || "Waiting for provider data"}{dataInfo?.fetchedAt ? ` · updated ${new Date(dataInfo.fetchedAt).toLocaleString()}` : ""}</span>
      </div>
      <div className="debris-monitor-stats">
        <Metric label="Tracked debris" value={objectCounts.debris.toLocaleString()} sub="In the loaded catalog"/>
        <Metric label="Below 200 km perigee" value={objectCounts.lowPerigeeDebris.toLocaleString()} sub="Low-altitude monitoring threshold"/>
        <Metric label="Stale debris elements" value={objectCounts.staleDebris.toLocaleString()} sub="Orbital element age over 72 hours"/>
      </div>
      <div className="debris-watchlist">
        <div className="debris-watchlist-heading"><b>Lowest-perigee debris</b><span>Up to 5 objects from the current catalog</span></div>
        {objectCounts.watchlist.length
          ? objectCounts.watchlist.map(item => <button className="debris-watch-item" key={item.noradId} type="button" onClick={() => focus(item)}>
            <span><b>{item.name}</b><small>NORAD {item.noradId} · {item.elementFreshness} elements</small></span>
            <strong>{fmt(item.perigeeAltitudeKm, 0)} km</strong>
          </button>)
          : <p className="debris-watch-empty">No debris objects are currently below the 200 km perigee threshold.</p>}
      </div>
      <div className="debris-monitor-footer">
        <p>Perigee and element age are screening indicators only; they do not predict reentry or collision risk.</p>
        <button className="button" type="button" disabled={!objectCounts.debris} onClick={() => {
          setSearch("");
          setOrbitType("ALL");
          setMinAlt("0");
          setMaxAlt("40000");
          setObjectTypeFilter("DEBRIS");
        }}>Review debris catalog</button>
      </div>
    </section>
    <section className="ops-status-panel" aria-labelledby="ops-status-title">
      <div className="debris-monitor-header">
        <div><p className="eyebrow">LIVE DATA STATUS</p><h3 id="ops-status-title">Source and synchronization status</h3></div>
        <span>Refreshes every 60 seconds · provider configuration is not a connectivity check</span>
      </div>
      <div className="ops-status-grid">
        <div className={`ops-status-card${operationalStatusError ? " is-warning" : ""}`}>
          <small>BACKEND API</small>
          <b>{operationalStatusError ? "Unavailable" : operationalStatus ? "Responding" : "Checking…"}</b>
          <span>{operationalStatusError || "HTTP health and cache metadata only"}</span>
        </div>
        <div className="ops-status-card">
          <small>CELESTRAK</small>
          <b>{formatCacheStatus("celestrak")}</b>
          <span>{operationalStatus?.providers?.find(item => item.id === "celestrak")?.cachedGroups ?? 0} cached groups · upstream availability not inferred</span>
        </div>
        <div className={`ops-status-card${!spaceTrackConfigured ? " is-warning" : ""}`}>
          <small>SPACE-TRACK</small>
          <b>{formatCacheStatus("space-track")}</b>
          <span>{spaceTrackConfigured ? "Server credentials configured; authentication is verified only by a successful data request." : "Credentials are not configured on the backend."}</span>
        </div>
        <div className="ops-status-card">
          <small>LOADED PROVIDER/GROUP</small>
          <b>{satellites.length.toLocaleString()} objects</b>
          <span>{objectCounts.payloads.toLocaleString()} payloads · {objectCounts.rocketBodies.toLocaleString()} rocket bodies · {objectCounts.debris.toLocaleString()} debris</span>
        </div>
        <div className="ops-status-card">
          <small>CURRENT ELEMENTS</small>
          <b>{dataInfo?.providerName || "No provider data loaded"}</b>
          <span>{dataInfo?.fetchedAt ? `Retrieved ${new Date(dataInfo.fetchedAt).toLocaleString()}${dataInfo.stale ? " · stale cache" : ""}` : "No successful fetch for the current view"}</span>
        </div>
      </div>
      <p className="data-scope-note">LIVE DATA: provider orbital elements and source-published TIP records only. Derived positions and pass times are propagated estimates. No covariance-based collision probability, radar observation, impact location, or uncertainty region is shown unless a source supplies the required data.</p>
    </section>
    <section className="reentry-panel" aria-labelledby="reentry-title">
      <div className="debris-monitor-header">
        <div><p className="eyebrow">LIVE RE-ENTRY SOURCE</p><h3 id="reentry-title">Space-Track TIP predictions</h3></div>
        <button className="button" type="button" onClick={loadReentries} disabled={isLoadingReentries || operationalStatus?.reentryTip?.configured === false}>
          {isLoadingReentries ? "Requesting TIP data…" : reentryData ? "Refresh TIP data" : "Load TIP data"}
        </button>
      </div>
      <p className="data-scope-note">This panel displays only predictions returned by Space-Track TIP. It does not derive re-entry forecasts from perigee and does not invent an uncertainty region.</p>
      {operationalStatus?.reentryTip?.configured === false && <p className="provider-note warning">Space-Track credentials are not configured on the server. No TIP request was made.</p>}
      {reentryError && <p className="provider-note warning" role="status">{reentryError}</p>}
      {reentryData && <>
        <p className="reentry-source-note" role="status">{reentryData.count} source records · {reentryData.source} · retrieved {new Date(reentryData.fetchedAt).toLocaleString()}{reentryData.stale ? " · stale cache" : ""}{reentryData.warning ? ` · ${reentryData.warning}` : ""}</p>
        {reentryData.records.length > 0 ? <div className="reentry-records">
          {reentryData.records.slice(0, 20).map(record => <article className="reentry-record" key={`${record.noradId}-${record.predictedDecay}`}>
            <b>{record.name || `NORAD ${record.noradId}`}</b>
            <span>NORAD {record.noradId} · predicted decay {new Date(record.predictedDecay).toLocaleString()}</span>
            <small>{record.predictionWindow ? `Source window: ${record.predictionWindow}` : "Prediction window not provided"}{record.direction ? ` · ${record.direction}` : ""}{Number.isFinite(Number(record.latitude)) && Number.isFinite(Number(record.longitude)) ? ` · source coordinate ${Number(record.latitude).toFixed(2)}°, ${Number(record.longitude).toFixed(2)}°` : " · no source coordinate supplied"}</small>
          </article>)}
        </div> : <p className="debris-watch-empty">Space-Track returned no upcoming TIP records.</p>}
      </>}
    </section>
    <div className="globe-layout"><div className="globe-panel"><div className="globe-panel-top"><span className="globe-legend"><i className="legend leo"/> LEO <i className="legend meo"/> MEO <i className="legend geo"/> GEO{selected && <><i className="legend" style={{ background: "#fff" }}/> SELECTED FULL ORBIT</>}</span><span className="globe-source">{dataInfo ? `${dataInfo.providerName} · ${dataInfo.source}${dataInfo.stale ? " · stale cache" : ""}` : status}</span><div className="globe-actions"><button type="button" className="globe-control" onClick={() => setShowCityLabels(value => !value)} aria-pressed={showCityLabels}>{showCityLabels ? "Cities on" : "Cities off"}</button><button type="button" className="globe-control" onClick={resetGlobeView}>Global view</button></div></div><div className="globe-container" ref={host}/><div className="globe-foot">{status} · rendered marker cap: 2,500 · {selected ? "White line: complete, closed 3D orbit (720 SGP4 samples) · anchored to Earth orientation now" : "Select a satellite to display its complete, closed orbital curve"} · Other satellites: short ground-track previews · Day/night terminator · subsolar {fmt(solarPosition.lat)}°, {fmt(solarPosition.lng)}° · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/" target="_blank" rel="noreferrer">NASA Earth Observatory · Blue Marble Next Generation</a></div></div>
    <aside className="telemetry-panel"><p className="eyebrow">OBJECT INSPECTOR</p><h3>Satellite telemetry</h3>{selected ? <><h2 className="selected-name">{selected.name}</h2><p className="muted">NORAD ID {selected.noradId}</p><span className="orbit-badge" style={{color:COLORS[selected.orbitType]}}>{selected.orbitType} ORBIT</span><div className="telemetry-grid"><Datum label="Latitude" value={`${fmt(selected.lat,3)}°`}/><Datum label="Longitude" value={`${fmt(selected.lng,3)}°`}/><Datum label="Position calculated (UTC)" value={selected.positionTimeUtc || "Not available"}/><Datum label="Altitude" value={`${fmt(selected.altitudeKm)} km`}/><Datum label="Speed" value={`${fmt(selected.speedKmS,3)} km/s`}/><Datum label="Inclination" value={`${fmt(selected.inclinationDeg,2)}°`}/><Datum label="Eccentricity" value={fmt(selected.eccentricity,5)}/><Datum label="Period" value={`${fmt(selected.periodMin)} min`}/><Datum label="Mean altitude" value={`${fmt(selected.meanAltitudeKm,0)} km`}/><Datum label="Perigee" value={`${fmt(selected.perigeeAltitudeKm,0)} km`}/><Datum label="Apogee" value={`${fmt(selected.apogeeAltitudeKm,0)} km`}/><Datum label="Object type" value={selected.omm?.OBJECT_TYPE || "Not provided"}/><Datum label="Country" value={selected.omm?.COUNTRY_CODE || "Not provided"}/><Datum label="Launch date" value={selected.omm?.LAUNCH_DATE || "Not provided"}/><Datum label="Element epoch" value={selected.elementEpoch ? new Date(selected.elementEpoch).toLocaleString() : "Not provided"}/><Datum label="Element age" value={selected.elementAgeHours === null ? "Unknown" : `${fmt(selected.elementAgeHours,1)} hours · ${selected.elementFreshness}`}/><Datum label="Propagation model" value={propagationModel === "fg" ? "F&G two-body" : "SGP4"}/></div><button className="button focus-button" onClick={() => globe.current?.pointOfView({lat:selected.lat,lng:selected.lng,altitude:1.5},800)}>Focus satellite</button><button className="button copy-coordinates" type="button" onClick={copyCoordinates}>Copy latitude, longitude</button>{coordinateCopyStatus && <p className="copy-status" role="status">{coordinateCopyStatus}</p>}</> : <div className="empty-selection"><div>◎</div><b>Select a satellite</b><p>Click a globe marker or use Inspect in the catalogue below.</p></div>}<PassPredictor selected={selected} satellites={satellites} onSelectSatellite={focus} algorithm={propagationModel} providerName={dataInfo?.providerName || (provider === "space-track" ? "Space-Track" : "CelesTrak")}/><div className="source-box"><small>ORBITAL ELEMENT SOURCE</small><b><a href={provider === "space-track" ? "https://www.space-track.org/" : "https://celestrak.org/"} target="_blank" rel="noreferrer">{dataInfo?.providerName || (provider === "space-track" ? "Space-Track" : "CelesTrak")} ↗</a></b><span>{dataInfo?.fetchedAt ? `Retrieved ${new Date(dataInfo.fetchedAt).toLocaleString()}` : "No successful data fetch yet"}</span><span>{selected?.elementFreshness ? `Selected element status: ${selected.elementFreshness}` : "Element freshness appears when a satellite is selected"}</span>{dataInfo?.warning && <span className="warning">{dataInfo.warning}</span>}</div></aside></div>
    <div className="table-panel"><div className="table-header"><div><p className="eyebrow">CATALOG BROWSER</p><h3>Satellite catalogue</h3></div><span>Showing {Math.min(visibleRows,sortedFiltered.length).toLocaleString()} of {sortedFiltered.length.toLocaleString()}</span></div><div className="table-scroll"><table><thead><tr>{[["name","Name"],["noradId","NORAD ID"],["objectType","Object type"],["orbitType","Orbit"],["altitudeKm","Altitude km"],["elementAgeHours","Element age"],["lat","Latitude"],["lng","Longitude"]].map(([key,label]) => sortHeader(key,label))}<th scope="col">Inspect</th></tr></thead><tbody>{sortedFiltered.slice(0,visibleRows).map(s => <tr key={s.noradId} className={selectedId===s.noradId?"selected-row":""}><td className="sat-name">{s.name}</td><td>{s.noradId}</td><td>{s.omm?.OBJECT_TYPE || "—"}</td><td style={{color:COLORS[s.orbitType]}}>{s.orbitType}</td><td>{fmt(s.altitudeKm)}</td><td>{s.elementAgeHours === null ? "—" : `${fmt(s.elementAgeHours,1)} h · ${s.elementFreshness}`}</td><td>{fmt(s.lat,3)}°</td><td>{fmt(s.lng,3)}°</td><td><button className="link-button" onClick={() => focus(s)}>Inspect ↗</button></td></tr>)}{!sortedFiltered.length && <tr><td colSpan="9" className="empty-table">{searchQuery ? "No satellites match this search and the selected filters." : "No satellites match the selected filters or data has not loaded."}</td></tr>}</tbody></table></div>{visibleRows < sortedFiltered.length && <div className="table-more"><button className="button" onClick={() => setVisibleRows(count => Math.min(count + 100, sortedFiltered.length))}>Show 100 more results</button></div>}</div>
    <p className="disclaimer">{propagationModel === "fg" ? "F&G mode uses a two-body universal-variable model seeded from the Space-Track element epoch. It omits drag, Earth oblateness, and third-body perturbations; use SGP4 for standard TLE/OMM tracking." : "Positions are estimates from publicly available GP orbital data propagated using SGP4."} Large groups may be slow. Not a certified navigation, collision-avoidance, or operational tracking system.</p>
  </section>;
}
function Metric({label,value,sub}) { return <div className="metric-card"><span>{label}</span><b>{value}</b><small>{sub}</small></div>; }
function Datum({label,value}) { return <div className="datum"><small>{label}</small><b>{value}</b></div>; }
function PassPredictor({ selected, satellites, onSelectSatellite, algorithm, providerName }) {
  const catalogIdentity = useMemo(() => satellites.map(satellite => satellite.noradId).join(","), [satellites]);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [locationAccuracyMeters, setLocationAccuracyMeters] = useState(null);
  const [locationCapturedAt, setLocationCapturedAt] = useState(null);
  const [minimumElevation, setMinimumElevation] = useState("10");
  const [predictionHours, setPredictionHours] = useState("24");
  const [passes, setPasses] = useState([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [catalogPasses, setCatalogPasses] = useState([]);
  const [catalogScanStatus, setCatalogScanStatus] = useState("");
  const [catalogScanProgress, setCatalogScanProgress] = useState(null);
  const [isScanningCatalog, setIsScanningCatalog] = useState(false);
  const catalogWorker = useRef(null);
  const catalogFetchController = useRef(null);

  const invalidatePrediction = () => {
    setPasses([]);
    setAlertsEnabled(false);
    setMessage("");
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setMessage("Device location is not supported by this browser. Enter coordinates manually.");
      return;
    }
    setMessage("Requesting a high-accuracy device location. This needs HTTPS (or localhost); allow access when your browser asks…");
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) => {
        setLatitude(coords.latitude.toFixed(5));
        setLongitude(coords.longitude.toFixed(5));
        setLocationAccuracyMeters(Number.isFinite(coords.accuracy) ? coords.accuracy : null);
        setLocationCapturedAt(new Date(timestamp));
        invalidatePrediction();
        setMessage("Device location set. It stays in this page and is not sent to the satellite API.");
      },
      error => {
        const reason = error.code === error.PERMISSION_DENIED
          ? "Location permission was denied."
          : error.code === error.TIMEOUT
            ? "Location request timed out."
            : "Current location is unavailable.";
        setMessage(`${reason} You can enter coordinates manually.`);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
    );
  };

  useEffect(() => {
    setPasses([]);
    setAlertsEnabled(false);
    setMessage("");
  }, [selected?.noradId, algorithm]);

  useEffect(() => () => {
    catalogFetchController.current?.abort();
    catalogWorker.current?.terminate();
  }, []);

  useEffect(() => {
    catalogFetchController.current?.abort();
    catalogWorker.current?.terminate();
    catalogFetchController.current = null;
    catalogWorker.current = null;
    setCatalogPasses([]);
    setCatalogScanStatus("");
    setCatalogScanProgress(null);
    setIsScanningCatalog(false);
  }, [algorithm, catalogIdentity]);

  useEffect(() => {
    if (!alertsEnabled || !passes.length || typeof Notification === "undefined" || Notification.permission !== "granted") return undefined;
    const nextPass = passes.find(pass => !pass.ongoing && pass.aos.getTime() > Date.now());
    if (!nextPass) return undefined;
    const timeout = window.setTimeout(() => {
      new Notification(`${selected?.name || "Satellite"} pass soon`, {
        body: `Visible above ${minimumElevation}° elevation at ${nextPass.aos.toLocaleTimeString()}.`
      });
      setAlertsEnabled(false);
    }, Math.min(nextPass.aos.getTime() - Date.now(), 2147483647));
    return () => window.clearTimeout(timeout);
  }, [alertsEnabled, passes, selected?.name, minimumElevation]);

  const predict = () => {
    const lat = Number(latitude), lng = Number(longitude), mask = Number(minimumElevation);
    if (!selected) {
      setMessage("Select a satellite before calculating passes.");
      return;
    }
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setMessage("Enter a valid latitude (−90 to 90) and longitude (−180 to 180).");
      return;
    }
    setMessage("");
    setIsCalculating(true);
    window.setTimeout(() => {
      try {
        const results = calculatePasses(selected.satrec, { latitude: lat, longitude: lng }, new Date(), Number(predictionHours), mask, algorithm, selected.elementEpoch, 10);
        setPasses(results);
        if (!results.length) setMessage(`No passes above this elevation mask in the next ${predictionHours} hours.`);
      } catch (error) {
        setPasses([]);
        setMessage(`Pass prediction failed: ${error.message}`);
      } finally {
        setIsCalculating(false);
      }
    }, 0);
  };

  const scanCatalog = async () => {
    const lat = Number(latitude), lng = Number(longitude), mask = Number(minimumElevation);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      setMessage("Enter a valid location or use device location before scanning the catalog.");
      return;
    }
    catalogFetchController.current?.abort();
    catalogWorker.current?.terminate();
    setCatalogPasses([]);
    setCatalogScanStatus("Fetching CelesTrak and Space-Track records for the selected group…");
    setCatalogScanProgress(null);
    setIsScanningCatalog(true);
    setMessage("");

    try {
      const controller = new AbortController();
      catalogFetchController.current = controller;
      const providers = ["celestrak", "space-track"];
      const sourceResults = await Promise.allSettled(
        providers.map(source => fetchSatelliteRecords(group, controller.signal, source))
      );
      if (controller.signal.aborted) return;

      const successfulSources = [];
      const sourceErrors = [];
      const recordsByNorad = new Map();
      sourceResults.forEach((result, index) => {
        const source = providers[index];
        if (result.status === "rejected") {
          sourceErrors.push(`${source === "celestrak" ? "CelesTrak" : "Space-Track"}: ${result.reason?.message || "unavailable"}`);
          return;
        }
        successfulSources.push(result.value.providerName || (source === "celestrak" ? "CelesTrak" : "Space-Track"));
        for (const record of result.value.satellites || []) {
          const noradId = String(record.noradId || "");
          if (!noradId) continue;
          const candidate = { ...record, passSource: result.value.providerName || (source === "celestrak" ? "CelesTrak" : "Space-Track") };
          const current = recordsByNorad.get(noradId);
          const candidateEpoch = Date.parse(candidate.elementEpoch || candidate.omm?.EPOCH || "") || 0;
          const currentEpoch = current ? Date.parse(current.elementEpoch || current.omm?.EPOCH || "") || 0 : -1;
          if (!current || candidateEpoch > currentEpoch) recordsByNorad.set(noradId, candidate);
        }
      });
      const records = [...recordsByNorad.values()];
      if (!records.length) {
        throw new Error(sourceErrors.length ? sourceErrors.join(" · ") : "Neither provider returned usable satellite records.");
      }

      setCatalogScanStatus(`Scanning ${records.length.toLocaleString()} unique satellites from ${successfulSources.join(" + ")}…`);
      setCatalogScanProgress({ completed: 0, total: records.length, failedRecords: 0 });
      const worker = new Worker(new URL("./passWorker.js", import.meta.url), { type: "module" });
      catalogWorker.current = worker;
      worker.onmessage = event => {
        if (event.data.type === "progress") {
          setCatalogScanProgress({
            completed: event.data.completed,
            total: event.data.total,
            failedRecords: event.data.failedRecords
          });
          return;
        }
        if (event.data.type === "complete") {
          setCatalogPasses(event.data.results);
          const resultSummary = event.data.results.length
            ? `Found ${event.data.results.length} passes for ${new Set(event.data.results.map(pass => pass.noradId)).size} satellites from ${successfulSources.join(" + ")}.`
            : `No passes found in ${predictionHours} hours for ${successfulSources.join(" + ")}.`;
          setCatalogScanStatus(`${resultSummary}${sourceErrors.length ? ` Source unavailable: ${sourceErrors.join(" · ")}` : ""}`);
          setCatalogScanProgress({ completed: records.length, total: records.length, failedRecords: event.data.failedRecords });
          setIsScanningCatalog(false);
          worker.terminate();
          catalogWorker.current = null;
          catalogFetchController.current = null;
        }
      };
      worker.onerror = event => {
        setCatalogScanStatus(`Catalog scan failed: ${event.message || "Worker error"}`);
        setIsScanningCatalog(false);
        worker.terminate();
        catalogWorker.current = null;
        catalogFetchController.current = null;
      };
      worker.postMessage({
        records: records.map(({ noradId, name, omm, line1, line2, elementEpoch, passSource }) => ({ noradId, name, omm, line1, line2, elementEpoch, passSource })),
        latitude: lat,
        longitude: lng,
        durationHours: Number(predictionHours),
        minimumElevationDeg: mask,
        algorithm,
        startedAt: new Date().toISOString()
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      setCatalogScanStatus(`Could not start the catalog scan: ${error.message}`);
      setIsScanningCatalog(false);
      catalogWorker.current?.terminate();
      catalogWorker.current = null;
      catalogFetchController.current = null;
    }
  };
  const cancelCatalogScan = () => {
    catalogFetchController.current?.abort();
    catalogFetchController.current = null;
    catalogWorker.current?.terminate();
    catalogWorker.current = null;
    setIsScanningCatalog(false);
    setCatalogScanStatus("Catalog scan canceled.");
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") {
      setMessage("Browser notifications are not supported here.");
      return;
    }
    let permission = Notification.permission;
    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        setMessage(`Could not request notification permission: ${error.message}`);
        return;
      }
    }
    if (permission !== "granted") {
      setAlertsEnabled(false);
      setMessage("Notification permission was not granted. Pass times remain available on this page.");
      return;
    }
    if (!passes.some(pass => !pass.ongoing && pass.aos.getTime() > Date.now())) {
      setMessage("Calculate passes first; there is no future pass to alert for.");
      return;
    }
    setMessage("Browser alert enabled for the next predicted pass. Keep this page open.");
    setAlertsEnabled(true);
  };

  const formatAzimuth = degrees => {
    if (!Number.isFinite(degrees)) return "—";
    const compass = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
    return `${degrees.toFixed(0)}° ${compass}`;
  };
  const formatPassTime = date => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return <section className="pass-predictor">
    <p className="eyebrow">LOCAL PASS PREDICTION</p>
    <h4>Upcoming passes</h4>
    <p className="pass-location-note">Use a one-time device location (GPS/GNSS when available) or enter coordinates. The browser may use other location signals; coordinates stay in this page and are not sent to our API.</p>
    <button className="button location-button" type="button" onClick={useMyLocation}>Use device location · GPS if available</button>
    {locationCapturedAt && <p className="pass-location-fix" role="status">
      Location fix {locationAccuracyMeters === null ? "" : `±${Math.round(locationAccuracyMeters).toLocaleString()} m · `}
      {locationCapturedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </p>}
    <div className="pass-location-fields">
      <label>Latitude<input aria-label="Observer latitude" inputMode="decimal" type="number" min="-90" max="90" step="any" value={latitude} onChange={event => { setLatitude(event.target.value); setLocationAccuracyMeters(null); setLocationCapturedAt(null); invalidatePrediction(); }} placeholder="e.g. 13.08"/></label>
      <label>Longitude<input aria-label="Observer longitude" inputMode="decimal" type="number" min="-180" max="180" step="any" value={longitude} onChange={event => { setLongitude(event.target.value); setLocationAccuracyMeters(null); setLocationCapturedAt(null); invalidatePrediction(); }} placeholder="e.g. 80.27"/></label>
      <label>Min. elevation<select aria-label="Minimum pass elevation" value={minimumElevation} onChange={event => { setMinimumElevation(event.target.value); invalidatePrediction(); }}><option value="0">0°</option><option value="5">5°</option><option value="10">10°</option><option value="20">20°</option></select></label>
      <label>Forecast period<select aria-label="Pass forecast period" value={predictionHours} onChange={event => { setPredictionHours(event.target.value); invalidatePrediction(); }}><option value="24">24 hours</option><option value="48">48 hours</option></select></label>
    </div>
    <div className="pass-actions">
      <button className="button" type="button" disabled={!selected || isCalculating} onClick={predict}>{isCalculating ? "Calculating…" : `Predict next ${predictionHours} hours`}</button>
      <button className="button" type="button" disabled={!passes.length || alertsEnabled} onClick={enableAlerts}>{alertsEnabled ? "Alert enabled" : "Enable browser alert"}</button>
    </div>
    {message && <p className="pass-message" role="status">{message}</p>}
    {passes.length > 0 && <div className="pass-results" aria-live="polite">
      {passes.slice(0, 8).map((pass, index) => <article className="pass-result" key={`${pass.aos.toISOString()}-${index}`}>
        <b>{pass.ongoing ? "In progress" : pass.aos.toLocaleDateString()} · AOS {formatPassTime(pass.aos)}</b>
        <div className="pass-detail-grid">
          <span><small>AOS direction</small><strong>{formatAzimuth(pass.aosAzimuthDeg)}</strong></span>
          <span><small>Peak elevation</small><strong>{pass.maxElevationDeg.toFixed(1)}°{pass.ongoing ? " so far" : ""}</strong></span>
          <span><small>{pass.ongoing ? "Peak direction so far" : "Peak time"}</small><strong>{pass.ongoing ? formatAzimuth(pass.tcaAzimuthDeg) : formatPassTime(pass.tca)}</strong></span>
          <span><small>Peak range</small><strong>{Number.isFinite(pass.rangeAtTcaKm) ? `${Math.round(pass.rangeAtTcaKm).toLocaleString()} km` : "—"}</strong></span>
          {!pass.ongoing && <span><small>Duration</small><strong>{Math.round(pass.durationMinutes)} min</strong></span>}
          <span><small>LOS direction</small><strong>{pass.ongoing ? "Beyond forecast" : formatAzimuth(pass.losAzimuthDeg)}</strong></span>
        </div>
        {!pass.ongoing && <span className="pass-los">LOS {formatPassTime(pass.los)}</span>}
      </article>)}
      <small>Times use this device’s local time. Predictions use {providerName} orbital elements with {algorithm === "fg" ? "the experimental two-body model" : "SGP4"}. Event crossings are numerically refined to 0.25 seconds; this is not a guarantee of real-world timing accuracy, which depends on element age and orbit quality. Terrain, refraction, sunlight, and clouds are not included.</small>
    </div>}
    <div className="catalog-pass-finder">
      <div className="catalog-pass-heading"><b>Find passes using both orbital sources</b><small>CelesTrak + Space-Track · duplicate satellites use the newest element epoch</small></div>
      <p className="pass-location-note">Scans the selected group at your observer location using both providers. Results are ordered by rise time; select any pass to inspect the satellite. The catalog scan uses 60-second sampling, then refines detected crossings to 0.25 seconds. If Space-Track is not configured or a provider is unavailable, the other provider is still used.</p>
      <div className="pass-actions">
        <button className="button" type="button" disabled={isScanningCatalog} onClick={scanCatalog}>
          {isScanningCatalog ? "Scanning both sources…" : "Scan CelesTrak + Space-Track"}
        </button>
        {isScanningCatalog && <button className="button" type="button" onClick={cancelCatalogScan}>Cancel scan</button>}
      </div>
      {catalogScanProgress && <div className="catalog-scan-progress" role="status">
        <progress value={catalogScanProgress.completed} max={catalogScanProgress.total}/>
        <span>{catalogScanProgress.completed.toLocaleString()} / {catalogScanProgress.total.toLocaleString()} checked</span>
      </div>}
      {catalogScanStatus && <p className="pass-message" role="status">{catalogScanStatus}{catalogScanProgress?.failedRecords ? ` ${catalogScanProgress.failedRecords} invalid or uncalculable records skipped.` : ""}</p>}
      {catalogPasses.length > 0 && <div className="catalog-pass-results" aria-live="polite">
        {catalogPasses.slice(0, 30).map((pass, index) => <article className="catalog-pass-result" key={`${pass.noradId}-${pass.aos.toISOString()}-${index}`}>
          <div className="catalog-pass-result-heading"><b>{pass.name}</b><small>{pass.source} · NORAD {pass.noradId}</small></div>
          <div className="pass-detail-grid">
            <span><small>AOS · rise</small><strong>{pass.aos.toLocaleString()} · {formatAzimuth(pass.aosAzimuthDeg)}</strong></span>
            <span><small>Peak · local time</small><strong>{pass.tca.toLocaleTimeString()}</strong></span>
            <span><small>Peak · elevation / azimuth</small><strong>{pass.maxElevationDeg.toFixed(1)}° · {formatAzimuth(pass.tcaAzimuthDeg)}</strong></span>
            <span><small>Peak slant range</small><strong>{Number.isFinite(pass.rangeAtTcaKm) ? `${Math.round(pass.rangeAtTcaKm).toLocaleString()} km` : "—"}</strong></span>
            <span><small>LOS · set</small><strong>{pass.ongoing ? "Beyond forecast" : `${pass.los.toLocaleString()} · ${formatAzimuth(pass.losAzimuthDeg)}`}</strong></span>
            <span><small>Visible duration</small><strong>{pass.ongoing ? "In progress" : `${Math.round(pass.durationMinutes)} min`}</strong></span>
          </div>
          {satellites.some(satellite => satellite.noradId === pass.noradId)
            ? <button className="link-button" type="button" onClick={() => onSelectSatellite(satellites.find(satellite => satellite.noradId === pass.noradId))}>Inspect satellite ↗</button>
            : <small className="catalog-pass-unavailable">This satellite is not in the currently displayed provider catalog; its pass details above are from {pass.source}.</small>}
        </article>)}
        {catalogPasses.length > 30 && <small>Showing the next 30 of {catalogPasses.length} predicted passes.</small>}
      </div>}
    </div>
  </section>;
}
