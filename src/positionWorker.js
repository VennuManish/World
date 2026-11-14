import { calculateSatellite } from "./satelliteData.js";

let records = [];

self.onmessage = ({ data }) => {
  if (data.type !== "calculate") return;
  if (Array.isArray(data.records)) records = data.records;

  const started = performance.now();
  const date = new Date(data.startedAt);
  const rows = [];
  let failedRecords = 0;
  const progressInterval = Math.max(1000, Math.ceil(records.length / 20));

  records.forEach((record, index) => {
    try {
      const satellite = calculateSatellite(record, date, data.algorithm);
      if (satellite) {
        const {
          elementEpoch, elementAgeHours, elementFreshness, positionTimeUtc, propagationModel,
          lat, lng, altitudeKm, speedKmS, inclinationDeg, eccentricity, meanMotionRevDay,
          periodMin, meanAltitudeKm, perigeeAltitudeKm, apogeeAltitudeKm, orbitType,
          satrec, fgEpochState
        } = satellite;
        rows.push({
          index, elementEpoch, elementAgeHours, elementFreshness, positionTimeUtc, propagationModel,
          lat, lng, altitudeKm, speedKmS, inclinationDeg, eccentricity, meanMotionRevDay,
          periodMin, meanAltitudeKm, perigeeAltitudeKm, apogeeAltitudeKm, orbitType, satrec, fgEpochState
        });
      } else {
        failedRecords += 1;
      }
    } catch (error) {
      failedRecords += 1;
      if (failedRecords === 1) console.error(`Unable to calculate position for NORAD ${record.noradId}:`, error);
    }

    if ((index + 1) % progressInterval === 0 || index + 1 === records.length) {
      self.postMessage({
        type: "progress",
        completed: index + 1,
        total: records.length
      });
    }
  });

  self.postMessage({
    type: "complete",
    rows,
    failedRecords,
    algorithm: data.algorithm,
    startedAt: data.startedAt,
    durationMs: performance.now() - started
  });
};
