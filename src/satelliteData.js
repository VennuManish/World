import * as satellite from "satellite.js";
export const GROUPS = [
  { id: "stations", name: "Space stations" }, { id: "active", name: "Active satellites" },
  { id: "starlink", name: "Starlink" }, { id: "oneweb", name: "OneWeb" },
  { id: "weather", name: "Weather" }, { id: "gps-ops", name: "GPS operational" },
  { id: "geo", name: "Geostationary" }, { id: "resource", name: "Earth observation" }
];
export async function fetchDataProviders(signal) {
  const response = await fetch("/api/providers", { signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.details || payload.error || `API error ${response.status}`);
  return payload;
}
export async function fetchSatelliteRecords(group, signal, provider = "celestrak", refresh = false) {
  const params = new URLSearchParams({ group, provider });
  if (refresh) params.set("refresh", "true");
  const response = await fetch(`/api/satellites?${params}`, { signal, cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.details || payload.error || `API error ${response.status}`);
  return payload;
}
export function calculateSatellite(record, date = new Date()) {
  const satrec = record.omm
    ? satellite.json2satrec(record.omm)
    : satellite.twoline2satrec(record.line1, record.line2);
  if (satrec.error) return null;
  const p = satellite.propagate(satrec, date);
  if (!p?.position || !p?.velocity || typeof p.position === "boolean" || typeof p.velocity === "boolean") return null;
  const geo = satellite.eciToGeodetic(p.position, satellite.gstime(date));
  const lat = satellite.degreesLat(geo.latitude), lng = satellite.degreesLong(geo.longitude), altitudeKm = geo.height;
  const speedKmS = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z);
  const meanMotionRadMin = satrec.no;
  const periodMin = meanMotionRadMin > 0 ? 2 * Math.PI / meanMotionRadMin : 0;
  const meanMotionRevDay = meanMotionRadMin * 1440 / (2 * Math.PI);
  const semiMajorAxisKm = meanMotionRadMin > 0 ? Math.cbrt(398600.4418 / ((meanMotionRadMin / 60) ** 2)) : 0;
  const eccentricity = satrec.ecco;
  const meanAltitudeKm = semiMajorAxisKm - 6371;
  const orbitType = meanAltitudeKm >= 32000 ? "GEO" : meanAltitudeKm >= 2000 ? "MEO" : "LEO";
  if (![lat, lng, altitudeKm, speedKmS, periodMin].every(Number.isFinite)) return null;
  return { ...record, lat, lng, altitudeKm, speedKmS, inclinationDeg: satrec.inclo * 180 / Math.PI, eccentricity, meanMotionRevDay, periodMin, meanAltitudeKm, perigeeAltitudeKm: semiMajorAxisKm * (1 - eccentricity) - 6371, apogeeAltitudeKm: semiMajorAxisKm * (1 + eccentricity) - 6371, orbitType, satrec };
}
export function calculateOrbitTrack(satrec, startDate = new Date(), durationMinutes = 100, stepMinutes = 5) {
  const coords = [];
  for (let minute = 0; minute <= durationMinutes; minute += stepMinutes) {
    const date = new Date(startDate.getTime() + minute * 60000);
    const p = satellite.propagate(satrec, date);
    if (!p?.position || typeof p.position === "boolean") continue;
    const geo = satellite.eciToGeodetic(p.position, satellite.gstime(date));
    const lat = satellite.degreesLat(geo.latitude), lng = satellite.degreesLong(geo.longitude), alt = geo.height;
    if ([lat, lng, alt].every(Number.isFinite)) coords.push([lat, lng, Math.max(0.001, alt / 6371)]);
  }
  return coords;
}
export function exportSatellitesCsv(rows) {
  const cols = [["name", "Name"], ["noradId", "NORAD ID"], ["orbitType", "Orbit type"], ["lat", "Latitude"], ["lng", "Longitude"], ["altitudeKm", "Altitude km"], ["speedKmS", "Speed km/s"], ["inclinationDeg", "Inclination deg"], ["eccentricity", "Eccentricity"], ["periodMin", "Period min"], ["meanAltitudeKm", "Mean altitude km"]];
  const q = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [cols.map(c => q(c[1])).join(","), ...rows.map(r => cols.map(([k]) => q(typeof r[k] === "number" ? r[k].toFixed(4) : r[k])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = `satellites-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
