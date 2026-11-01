import * as satellite from "satellite.js";
export const GROUPS = [
  { id: "stations", name: "Space stations" }, { id: "active", name: "Active satellites" },
  { id: "starlink", name: "Starlink" }, { id: "oneweb", name: "OneWeb" },
  { id: "weather", name: "Weather" }, { id: "gps-ops", name: "GPS operational" },
  { id: "geo", name: "Geostationary" }, { id: "resource", name: "Earth observation" },
  { id: "communications", name: "Communications" }, { id: "scientific", name: "Science missions" },
  { id: "payload", name: "Payloads" }, { id: "rocket-body", name: "Rocket bodies" },
  { id: "debris", name: "Debris" }
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
const EARTH_MU_KM3_S2 = 398600.4418;
const EARTH_RADIUS_KM = 6371;

function stumpffFunctions(z) {
  if (Math.abs(z) < 1e-6) {
    const z2 = z * z, z3 = z2 * z;
    return {
      c: 0.5 - z / 24 + z2 / 720 - z3 / 40320,
      s: 1 / 6 - z / 120 + z2 / 5040 - z3 / 362880
    };
  }
  if (z > 0) {
    const root = Math.sqrt(z);
    return { c: (1 - Math.cos(root)) / z, s: (root - Math.sin(root)) / (root ** 3) };
  }
  const root = Math.sqrt(-z);
  if (root > 50) return null;
  return { c: (Math.cosh(root) - 1) / -z, s: (Math.sinh(root) - root) / (root ** 3) };
}

export function propagateFAndG(position, velocity, elapsedSeconds, mu = EARTH_MU_KM3_S2) {
  const r0 = Math.hypot(position.x, position.y, position.z);
  const v0Squared = velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2;
  if (![r0, v0Squared, elapsedSeconds, mu].every(Number.isFinite) || r0 <= 0 || mu <= 0) return null;
  if (elapsedSeconds === 0) return { position: { ...position }, velocity: { ...velocity } };

  const sqrtMu = Math.sqrt(mu);
  const radialVelocity = (position.x * velocity.x + position.y * velocity.y + position.z * velocity.z) / r0;
  const alpha = 2 / r0 - v0Squared / mu;
  let universalAnomaly = Math.abs(alpha) > 1e-8
    ? Math.sign(elapsedSeconds) * sqrtMu * Math.abs(alpha) * Math.abs(elapsedSeconds)
    : sqrtMu * elapsedSeconds / r0;
  let converged = false;

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const z = alpha * universalAnomaly ** 2;
    const stumpff = stumpffFunctions(z);
    if (!stumpff) return null;
    const { c, s } = stumpff;
    const anomalySquared = universalAnomaly ** 2;
    const anomalyCubed = anomalySquared * universalAnomaly;
    const residual = r0 * radialVelocity / sqrtMu * anomalySquared * c
      + (1 - alpha * r0) * anomalyCubed * s
      + r0 * universalAnomaly - sqrtMu * elapsedSeconds;
    const derivative = r0 * radialVelocity / sqrtMu * universalAnomaly * (1 - z * s)
      + (1 - alpha * r0) * anomalySquared * c + r0;
    if (!Number.isFinite(residual) || !Number.isFinite(derivative) || Math.abs(derivative) < 1e-12) return null;
    const correction = residual / derivative;
    universalAnomaly -= correction;
    if (Math.abs(correction) < 1e-8) {
      converged = true;
      break;
    }
  }
  if (!converged) return null;

  const z = alpha * universalAnomaly ** 2;
  const stumpff = stumpffFunctions(z);
  if (!stumpff) return null;
  const { c, s } = stumpff;
  const anomalySquared = universalAnomaly ** 2;
  const anomalyCubed = anomalySquared * universalAnomaly;
  const f = 1 - anomalySquared / r0 * c;
  const g = elapsedSeconds - anomalyCubed / sqrtMu * s;
  const propagatedPosition = {
    x: f * position.x + g * velocity.x,
    y: f * position.y + g * velocity.y,
    z: f * position.z + g * velocity.z
  };
  const radius = Math.hypot(propagatedPosition.x, propagatedPosition.y, propagatedPosition.z);
  if (!Number.isFinite(radius) || radius <= 0) return null;
  const fDot = sqrtMu / (radius * r0) * (alpha * anomalyCubed * s - universalAnomaly);
  const gDot = 1 - anomalySquared / radius * c;
  const propagatedVelocity = {
    x: fDot * position.x + gDot * velocity.x,
    y: fDot * position.y + gDot * velocity.y,
    z: fDot * position.z + gDot * velocity.z
  };
  if (![propagatedPosition.x, propagatedPosition.y, propagatedPosition.z, propagatedVelocity.x, propagatedVelocity.y, propagatedVelocity.z].every(Number.isFinite)) return null;
  return { position: propagatedPosition, velocity: propagatedVelocity };
}

function getFAndGEpochState(satrec, elementEpoch) {
  const epoch = Date.parse(elementEpoch || "");
  if (!Number.isFinite(epoch)) return null;
  const epochDate = new Date(epoch);
  const state = satellite.propagate(satrec, epochDate);
  if (!state?.position || !state?.velocity || typeof state.position === "boolean" || typeof state.velocity === "boolean") return null;
  return { date: epochDate, position: state.position, velocity: state.velocity };
}

function propagateAtDate(satrec, date, algorithm, fgEpochState) {
  if (algorithm !== "fg") return satellite.propagate(satrec, date);
  if (!fgEpochState) return null;
  const state = propagateFAndG(
    fgEpochState.position,
    fgEpochState.velocity,
    (date.getTime() - fgEpochState.date.getTime()) / 1000
  );
  return state ? { ...state } : null;
}

export function calculatePasses(satrec, observer, startDate = new Date(), durationHours = 24, minimumElevationDeg = 10, algorithm = "sgp4", elementEpoch = null) {
  const fgEpochState = algorithm === "fg" ? getFAndGEpochState(satrec, elementEpoch) : null;
  if (algorithm === "fg" && !fgEpochState) throw new Error("F&G prediction needs a valid orbital-element epoch.");
  const observerGeodetic = {
    longitude: observer.longitude * Math.PI / 180,
    latitude: observer.latitude * Math.PI / 180,
    height: observer.heightKm || 0
  };
  const elevationMask = minimumElevationDeg * Math.PI / 180;
  const stepMilliseconds = 30_000;
  const endTime = startDate.getTime() + durationHours * 60 * 60 * 1000;
  const lookAt = timestamp => {
    const date = new Date(timestamp);
    const propagated = propagateAtDate(satrec, date, algorithm, fgEpochState);
    const position = propagated?.position;
    if (!position || typeof position === "boolean") return null;
    const ecf = satellite.eciToEcf(position, satellite.gstime(date));
    return satellite.ecfToLookAngles(observerGeodetic, ecf);
  };
  const passes = [];
  let previousTime = startDate.getTime();
  let previousLook = lookAt(previousTime);
  let inPass = Boolean(previousLook && previousLook.elevation >= elevationMask);
  let aos = inPass ? previousTime : null;
  let maxElevation = inPass ? previousLook.elevation : -Infinity;
  let maxElevationTime = inPass ? previousTime : null;
  for (let timestamp = previousTime + stepMilliseconds; timestamp <= endTime + stepMilliseconds; timestamp += stepMilliseconds) {
    const currentTime = Math.min(timestamp, endTime);
    const currentLook = lookAt(currentTime);
    if (currentLook && currentLook.elevation > maxElevation) {
      maxElevation = currentLook.elevation;
      maxElevationTime = currentTime;
    }
    const currentlyVisible = Boolean(currentLook && currentLook.elevation >= elevationMask);
    if (currentlyVisible !== inPass) {
      let low = previousTime;
      let high = currentTime;
      for (let iteration = 0; iteration < 12 && high - low > 1000; iteration += 1) {
        const midpoint = Math.floor((low + high) / 2);
        const midpointLook = lookAt(midpoint);
        if (Boolean(midpointLook && midpointLook.elevation >= elevationMask) === inPass) low = midpoint;
        else high = midpoint;
      }
      const crossingTime = Math.floor((low + high) / 2);
      if (currentlyVisible) {
        aos = crossingTime;
        maxElevation = currentLook?.elevation ?? -Infinity;
        maxElevationTime = currentTime;
      } else if (aos !== null && maxElevationTime !== null) {
        passes.push({
          aos: new Date(aos),
          tca: new Date(maxElevationTime),
          los: new Date(crossingTime),
          maxElevationDeg: maxElevation * 180 / Math.PI
        });
        aos = null;
        maxElevation = -Infinity;
        maxElevationTime = null;
      }
      inPass = currentlyVisible;
    }
    previousTime = currentTime;
    previousLook = currentLook;
    if (currentTime === endTime) break;
  }
  if (inPass && aos !== null && maxElevationTime !== null) {
    passes.push({
      aos: new Date(aos),
      tca: new Date(maxElevationTime),
      los: new Date(endTime),
      maxElevationDeg: maxElevation * 180 / Math.PI,
      ongoing: true
    });
  }
  return passes;
}
export function calculateSatellite(record, date = new Date(), algorithm = "sgp4") {
  const satrec = record.omm
    ? satellite.json2satrec(record.omm)
    : satellite.twoline2satrec(record.line1, record.line2);
  if (satrec.error) return null;
  const elementEpoch = record.elementEpoch || record.omm?.EPOCH || null;
  const fgEpochState = algorithm === "fg" ? getFAndGEpochState(satrec, elementEpoch) : null;
  if (algorithm === "fg" && !fgEpochState) return null;
  const p = propagateAtDate(satrec, date, algorithm, fgEpochState);
  if (!p?.position || !p?.velocity || typeof p.position === "boolean" || typeof p.velocity === "boolean") return null;
  const geo = satellite.eciToGeodetic(p.position, satellite.gstime(date));
  const lat = satellite.degreesLat(geo.latitude), lng = satellite.degreesLong(geo.longitude), altitudeKm = geo.height;
  const speedKmS = Math.hypot(p.velocity.x, p.velocity.y, p.velocity.z);
  const meanMotionRadMin = satrec.no;
  const periodMin = meanMotionRadMin > 0 ? 2 * Math.PI / meanMotionRadMin : 0;
  const meanMotionRevDay = meanMotionRadMin * 1440 / (2 * Math.PI);
  const semiMajorAxisKm = meanMotionRadMin > 0 ? Math.cbrt(398600.4418 / ((meanMotionRadMin / 60) ** 2)) : 0;
  const eccentricity = satrec.ecco;
  const elementAgeHours = elementEpoch ? Math.max(0, (date.getTime() - Date.parse(elementEpoch)) / 3600000) : null;
  const elementFreshness = elementAgeHours === null ? "unknown" : elementAgeHours <= 24 ? "fresh" : elementAgeHours <= 72 ? "aging" : "stale";
  const meanAltitudeKm = semiMajorAxisKm - EARTH_RADIUS_KM;
  const orbitType = meanAltitudeKm >= 32000 ? "GEO" : meanAltitudeKm >= 2000 ? "MEO" : "LEO";
  if (![lat, lng, altitudeKm, speedKmS, periodMin].every(Number.isFinite)) return null;
  return { ...record, elementEpoch, elementAgeHours, elementFreshness, positionTimeUtc: date.toISOString(), propagationModel: algorithm, lat, lng, altitudeKm, speedKmS, inclinationDeg: satrec.inclo * 180 / Math.PI, eccentricity, meanMotionRevDay, periodMin, meanAltitudeKm, perigeeAltitudeKm: semiMajorAxisKm * (1 - eccentricity) - EARTH_RADIUS_KM, apogeeAltitudeKm: semiMajorAxisKm * (1 + eccentricity) - EARTH_RADIUS_KM, orbitType, satrec, fgEpochState };
}
export function calculateOrbitTrack(calculatedRecord, startDate = new Date(), durationMinutes = 100, stepMinutes = 5, algorithm = "sgp4") {
  const coords = [];
  const satrec = calculatedRecord.satrec || calculatedRecord;
  const fgEpochState = algorithm === "fg"
    ? calculatedRecord.fgEpochState || getFAndGEpochState(satrec, calculatedRecord.elementEpoch)
    : null;
  if (algorithm === "fg" && !fgEpochState) return coords;
  for (let minute = 0; minute <= durationMinutes; minute += stepMinutes) {
    const date = new Date(startDate.getTime() + minute * 60000);
    const p = propagateAtDate(satrec, date, algorithm, fgEpochState);
    if (!p?.position || typeof p.position === "boolean") continue;
    const geo = satellite.eciToGeodetic(p.position, satellite.gstime(date));
    const lat = satellite.degreesLat(geo.latitude), lng = satellite.degreesLong(geo.longitude), alt = geo.height;
    if ([lat, lng, alt].every(Number.isFinite)) coords.push([lat, lng, Math.max(0.001, alt / 6371)]);
  }
  return coords;
}
export function exportSatellitesCsv(rows) {
  const cols = [["name", "Name"], ["noradId", "NORAD ID"], ["objectType", "Object type"], ["orbitType", "Orbit type"], ["lat", "Latitude"], ["lng", "Longitude"], ["positionTimeUtc", "Position time UTC"], ["altitudeKm", "Altitude km"], ["speedKmS", "Speed km/s"], ["inclinationDeg", "Inclination deg"], ["eccentricity", "Eccentricity"], ["periodMin", "Period min"], ["meanAltitudeKm", "Mean altitude km"], ["elementEpoch", "Element epoch"], ["elementFreshness", "Element freshness"], ["propagationModel", "Propagation model"]];
  const q = v => `"${String(v ?? "").replaceAll('"', '""')}"`;
  const csv = [cols.map(c => q(c[1])).join(","), ...rows.map(r => cols.map(([k]) => q(k === "objectType" ? r.omm?.OBJECT_TYPE : typeof r[k] === "number" ? r[k].toFixed(4) : r[k])).join(","))].join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a"); a.href = url; a.download = `satellites-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
