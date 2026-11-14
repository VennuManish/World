import { calculatePasses, calculateSatellite } from "./satelliteData.js";

self.onmessage = event => {
  const { records, latitude, longitude, durationHours, minimumElevationDeg, algorithm, startedAt } = event.data;
  const startDate = new Date(startedAt);
  const observer = { latitude, longitude };
  const results = [];
  let failedRecords = 0;

  records.forEach((record, index) => {
    try {
      const selected = calculateSatellite(record, startDate, algorithm);
      if (selected) {
        const passes = calculatePasses(
          selected.satrec,
          observer,
          startDate,
          durationHours,
          minimumElevationDeg,
          algorithm,
          selected.elementEpoch,
          60
        );
        for (const pass of passes) results.push({ noradId: record.noradId, name: record.name, source: record.passSource, ...pass });
      } else {
        failedRecords += 1;
      }
    } catch (error) {
      failedRecords += 1;
      console.error(`Unable to predict passes for NORAD ${record.noradId}:`, error);
    }

    if ((index + 1) % 10 === 0 || index + 1 === records.length) {
      self.postMessage({
        type: "progress",
        completed: index + 1,
        total: records.length,
        failedRecords
      });
    }
  });

  results.sort((left, right) => left.aos.getTime() - right.aos.getTime());
  self.postMessage({ type: "complete", results, failedRecords });
};
