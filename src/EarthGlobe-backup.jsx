import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Globe from "globe.gl";
import { GROUPS, fetchSatelliteRecords, calculateSatellite, calculateOrbitTrack, exportSatellitesCsv } from "./satelliteData.js";
const COLORS = { LEO: "#2dd4bf", MEO: "#fbbf24", GEO: "#a78bfa" };
const fmt = (n, d = 1) => Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d }) : "—";
export default function EarthGlobe() {
  const host = useRef(null), globe = useRef(null), recordsRef = useRef([]);
  const [group, setGroup] = useState("stations"), [satellites, setSatellites] = useState([]), [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState(""), [orbitType, setOrbitType] = useState("ALL"), [minAlt, setMinAlt] = useState("0"), [maxAlt, setMaxAlt] = useState("40000");
  const [pathLimit, setPathLimit] = useState("100"), [status, setStatus] = useState("Connecting to API…"), [error, setError] = useState(""), [dataInfo, setDataInfo] = useState(null), [updatedAt, setUpdatedAt] = useState(null), [tick, setTick] = useState(0);
  const recalc = useCallback(() => {
    if (!recordsRef.current.length) return;
    const now = new Date(), rows = [];
    for (const record of recordsRef.current) { try { const sat = calculateSatellite(record, now); if (sat) rows.push(sat); } catch {} }
    setSatellites(rows); setUpdatedAt(now); setStatus(`Tracking ${rows.length.toLocaleString()} satellites`);
  }, []);
  const load = useCallback(async (signal) => {
    setError(""); setStatus("Loading TLE data…"); setSatellites([]); recordsRef.current = []; setSelectedId("");
    try { const data = await fetchSatelliteRecords(group, signal); recordsRef.current = data.satellites; setDataInfo(data); setStatus(data.stale ? "Using saved cached TLE data" : `Loaded ${data.count.toLocaleString()} TLE records`); recalc(); }
    catch (e) { if (e.name !== "AbortError") { setError(e.message || "Unknown API error"); setStatus("Satellite data unavailable"); } }
  }, [group, recalc]);
  useEffect(() => { const c = new AbortController(); load(c.signal); return () => c.abort(); }, [load]);
  useEffect(() => { const id = setInterval(() => setTick(x => x + 1), 15000); return () => clearInterval(id); }, []);
  useEffect(() => { if (recordsRef.current.length) recalc(); }, [tick, recalc]);
  useEffect(() => {
    if (!host.current) return;
    const world = Globe()(host.current); globe.current = world;
    world.width(host.current.clientWidth).height(520).backgroundColor("#030914")
      .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg")
      .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png")
      .showAtmosphere(true).atmosphereColor("#39bdf8").atmosphereAltitude(.15)
      .pointsData([]).pointLat("lat").pointLng("lng").pointAltitude(d => Math.max(.001, d.altitudeKm / 6371))
      .pointRadius(d => d.noradId === selectedId ? .24 : .10).pointColor(d => d.noradId === selectedId ? "#fff" : COLORS[d.orbitType])
      .pointLabel(d => `<div style="padding:8px;color:#e8f4ff;background:#071426;border:1px solid #2dd4bf;border-radius:8px"><b>${String(d.name).replace(/[<>]/g, "")}</b><br>NORAD ${d.noradId}<br>${d.orbitType} · ${fmt(d.altitudeKm, 0)} km</div>`)
      .onPointClick(p => setSelectedId(p.noradId)).pathsData([]).pathPoints("coords").pathPointLat(p => p[0]).pathPointLng(p => p[1]).pathPointAlt(p => p[2])
      .pathColor(p => p.noradId === selectedId ? "#fff" : COLORS[p.orbitType]).pathStroke(p => p.noradId === selectedId ? 1.4 : .45).pathResolution(3).pathLabel(p => `${p.name} · ${p.orbitType} predicted orbit`);
    world.pointOfView({ lat: 18, lng: 10, altitude: 2.4 }, 0);
    const observer = new ResizeObserver(() => { if (host.current) world.width(host.current.clientWidth); }); observer.observe(host.current);
    return () => { observer.disconnect(); world._destructor?.(); globe.current = null; host.current?.replaceChildren(); };
  }, []);
  const filtered = useMemo(() => { const q = search.trim().toLowerCase(), lo = minAlt === "" ? -Infinity : Number(minAlt), hi = maxAlt === "" ? Infinity : Number(maxAlt); return satellites.filter(s => (!q || s.name.toLowerCase().includes(q) || s.noradId.includes(q)) && (orbitType === "ALL" || s.orbitType === orbitType) && s.altitudeKm >= lo && s.altitudeKm <= hi); }, [satellites, search, orbitType, minAlt, maxAlt]);
  const selected = filtered.find(s => s.noradId === selectedId) || satellites.find(s => s.noradId === selectedId) || null;
  const points = useMemo(() => filtered.slice(0, 2500), [filtered]);
  const paths = useMemo(() => { const n = pathLimit === "all" ? filtered.length : Number(pathLimit); const now = new Date(); return filtered.slice(0, n).flatMap(s => { const coords = calculateOrbitTrack(s.satrec, now, 100, 5); return coords.length > 1 ? [{ name: s.name, noradId: s.noradId, orbitType: s.orbitType, coords }] : []; }); }, [filtered, pathLimit]);
  useEffect(() => { if (globe.current) { globe.current.pointRadius(d => d.noradId === selectedId ? .24 : .10).pointColor(d => d.noradId === selectedId ? "#fff" : COLORS[d.orbitType]).pathColor(p => p.noradId === selectedId ? "#fff" : COLORS[p.orbitType]).pathStroke(p => p.noradId === selectedId ? 1.4 : .45).pointsData(points).pathsData(paths); } }, [points, paths, selectedId]);
  const focus = sat => { setSelectedId(sat.noradId); globe.current?.pointOfView({ lat: sat.lat, lng: sat.lng, altitude: 1.5 }, 800); };
  const retry = () => load(new AbortController().signal);
  return <section className="tracker">
    <div className="section-heading"><div><p className="eyebrow">LIVE ORBITAL VIEW</p><h2>3D Satellite Orbit Viewer</h2><p className="muted">Drag to rotate · Scroll to zoom · Click a satellite to inspect it</p></div><div className="status-pill"><i className={error ? "status-dot error-dot" : "status-dot"}/>{error ? "DATA OFFLINE" : dataInfo?.stale ? "CACHED DATA" : "SYSTEM STATUS"}</div></div>
    <div className="toolbar">
      <label className="field"><span>Satellite group</span><select value={group} onChange={e => setGroup(e.target.value)}>{GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      <label className="field search-field"><span>Search name / NORAD ID</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="e.g. ISS or 25544"/></label>
      <label className="field"><span>Orbit class</span><select value={orbitType} onChange={e => setOrbitType(e.target.value)}><option value="ALL">All orbit classes</option><option value="LEO">LEO</option><option value="MEO">MEO</option><option value="GEO">GEO</option></select></label>
      <button className="button" disabled={!filtered.length} onClick={() => exportSatellitesCsv(filtered)}>Export CSV ↓</button>
    </div>
    <div className="filter-row"><strong>Altitude filter <small>(km)</small></strong><label>Min <input type="number" min="0" value={minAlt} onChange={e => setMinAlt(e.target.value)}/></label><label>Max <input type="number" min="0" value={maxAlt} onChange={e => setMaxAlt(e.target.value)}/></label><label>Orbital paths <select value={pathLimit} onChange={e => setPathLimit(e.target.value)}><option value="25">25 max</option><option value="100">100 max</option><option value="250">250 max</option><option value="500">500 max</option><option value="all">All filtered</option></select></label><button className="link-button" onClick={() => { setSearch(""); setOrbitType("ALL"); setMinAlt("0"); setMaxAlt("40000"); }}>Reset filters</button></div>
    {error && <div className="error-panel"><b>Satellite data could not be loaded</b><p>{error}</p><p>Check the API service at <code>http://127.0.0.1:3001/api/health</code>. The backend caches successful data in SQLite for two hours.</p><button className="button" onClick={retry}>Retry data request</button></div>}
    <div className="metrics-grid"><Metric label="Loaded satellites" value={satellites.length.toLocaleString()} sub="TLE records propagated"/><Metric label="Filtered results" value={filtered.length.toLocaleString()} sub="Current filters and search"/><Metric label="Orbital paths" value={paths.length.toLocaleString()} sub="100-minute prediction window"/><Metric label="Position update" value={updatedAt ? updatedAt.toLocaleTimeString() : "Waiting"} sub="Refresh every 15 seconds"/></div>
    <div className="globe-layout"><div className="globe-panel"><div className="globe-panel-top"><span><i className="legend leo"/> LEO <i className="legend meo"/> MEO <i className="legend geo"/> GEO</span><span>{dataInfo ? `${dataInfo.source}${dataInfo.stale ? " · stale cache" : ""}` : status}</span></div><div className="globe-container" ref={host}/><div className="globe-foot">{status} · rendered marker cap: 2,500</div></div>
    <aside className="telemetry-panel"><p className="eyebrow">OBJECT INSPECTOR</p><h3>Satellite telemetry</h3>{selected ? <><h2 className="selected-name">{selected.name}</h2><p className="muted">NORAD ID {selected.noradId}</p><span className="orbit-badge" style={{color:COLORS[selected.orbitType]}}>{selected.orbitType} ORBIT</span><div className="telemetry-grid"><Datum label="Latitude" value={`${fmt(selected.lat,3)}°`}/><Datum label="Longitude" value={`${fmt(selected.lng,3)}°`}/><Datum label="Altitude" value={`${fmt(selected.altitudeKm)} km`}/><Datum label="Speed" value={`${fmt(selected.speedKmS,3)} km/s`}/><Datum label="Inclination" value={`${fmt(selected.inclinationDeg,2)}°`}/><Datum label="Eccentricity" value={fmt(selected.eccentricity,5)}/><Datum label="Period" value={`${fmt(selected.periodMin)} min`}/><Datum label="Mean altitude" value={`${fmt(selected.meanAltitudeKm,0)} km`}/><Datum label="Perigee" value={`${fmt(selected.perigeeAltitudeKm,0)} km`}/><Datum label="Apogee" value={`${fmt(selected.apogeeAltitudeKm,0)} km`}/></div><button className="button focus-button" onClick={() => globe.current?.pointOfView({lat:selected.lat,lng:selected.lng,altitude:1.5},800)}>Focus satellite</button></> : <div className="empty-selection"><div>◎</div><b>Select a satellite</b><p>Click a globe marker or use Inspect in the catalogue below.</p></div>}<div className="source-box"><small>ORBITAL ELEMENT SOURCE</small><b>CelesTrak GP data</b><span>{dataInfo?.fetchedAt ? `Retrieved ${new Date(dataInfo.fetchedAt).toLocaleString()}` : "No successful data fetch yet"}</span>{dataInfo?.warning && <span className="warning">{dataInfo.warning}</span>}</div></aside></div>
    <div className="table-panel"><div className="table-header"><div><p className="eyebrow">CATALOG BROWSER</p><h3>Satellite catalogue</h3></div><span>Showing {Math.min(100,filtered.length)} of {filtered.length.toLocaleString()}</span></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>NORAD ID</th><th>Orbit</th><th>Altitude km</th><th>Speed km/s</th><th>Latitude</th><th>Longitude</th><th></th></tr></thead><tbody>{filtered.slice(0,100).map(s => <tr key={s.noradId} className={selectedId===s.noradId?"selected-row":""}><td className="sat-name">{s.name}</td><td>{s.noradId}</td><td style={{color:COLORS[s.orbitType]}}>{s.orbitType}</td><td>{fmt(s.altitudeKm)}</td><td>{fmt(s.speedKmS,3)}</td><td>{fmt(s.lat,3)}°</td><td>{fmt(s.lng,3)}°</td><td><button className="link-button" onClick={() => focus(s)}>Inspect ↗</button></td></tr>)}{!filtered.length && <tr><td colSpan="8" className="empty-table">No matching satellites or data has not loaded.</td></tr>}</tbody></table></div></div>
    <p className="disclaimer">Positions are estimates from publicly available GP/TLE data propagated using SGP4. Large groups may be slow. Not a certified navigation, collision-avoidance, or operational tracking system.</p>
  </section>;
}
function Metric({label,value,sub}) { return <div className="metric-card"><span>{label}</span><b>{value}</b><small>{sub}</small></div>; }
function Datum({label,value}) { return <div className="datum"><small>{label}</small><b>{value}</b></div>; }
