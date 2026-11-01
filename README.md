# Satellite, Debris & Rocket Body Tracking

An independent satellite and space-object tracking website. It is not the official Space-Track website and is not affiliated with Space-Track.

Features: 3D Earth globe, satellite markers and predicted tracks, full active Space-Track catalog search by name/NORAD ID, sortable catalog with current coordinates, debris and rocket-body counts, orbit/object-type/altitude filters, enriched telemetry and element freshness, 24-hour local pass predictions with browser geolocation and opt-in alerts, automatic position recalculation every 15 seconds, timestamped CSV export, Express API, and SQLite orbital-element cache.

## Setup on Windows / VS Code
1. Install a current Node.js LTS version (Vite 8 requires Node 20.19+ or 22.12+).
2. Open this project folder in VS Code.
3. Open Terminal and run:

```powershell
npm.cmd install
npm.cmd run dev
```

4. Open the Local URL shown by Vite, normally `http://localhost:5173/`.

The dev command runs Vite and the Express API (port 3001). Test the API at `http://127.0.0.1:3001/api/health`. Test data at `http://127.0.0.1:3001/api/satellites?group=stations&provider=space-track`.

## Satellite data providers

The tracker supports CelesTrak and Space-Track. Space-Track is the default provider for both satellite views; choose CelesTrak in the Earth viewer's Data provider selector if desired. The Earth catalog includes station, constellation, mission, orbit-class, and object-type filters, full active-catalog name/NORAD search, and orbital element age in the inspector.

- CelesTrak uses its public GP OMM JSON group feeds and does not require an account. OMM is passed to `satellite.js` SGP4 and supports catalog numbers beyond the five-digit limit of legacy TLE text.
- If CelesTrak rejects the Render request or is unavailable, the server automatically falls back to the public [TLE API](https://tle.ivanstanojevic.me/) search service, which does not require an API key. Results are grouped by satellite name and cached for two hours; the fallback is a bounded selection rather than a complete catalog, may have its own availability limits, and legacy TLE cannot represent catalog IDs above 99,999. CelesTrak requests are paused for 24 hours after HTTP 403 to avoid repeatedly hitting a blocked feed.
- Space-Track requires a registered account. Copy `.env.example` to `.env` and enter your credentials in `.env` as `SPACETRACK_IDENTITY` and `SPACETRACK_PASSWORD`. Restart the server after editing. The `.env` file is ignored by Git; credentials are used only by the Express server and are never sent to the browser.
- Space-Track returns recent GP OMM JSON records, including satellite names and object types. Group membership is an approximation based on object type, object names, and orbit mean motion; use CelesTrak groups when you need its curated categories.
- Select a satellite in the Earth viewer to see its object type, country, launch date, element epoch, and element freshness. Pass predictions use manually entered observer coordinates in the browser, compute the next 24 hours above the selected elevation mask, and do not send location to the server. Browser alerts are opt-in, require notification permission, and only fire while the page remains open.
- The pass predictor can request the browser's current location after user permission; coordinates remain in the page and are not uploaded or saved. The catalogue headers sort results, and **Copy latitude, longitude** copies the selected object's current coordinates. CSV exports include the coordinate calculation time in UTC and the source element freshness.
- Debris and rocket-body counts summarize the currently loaded provider/group. **Low-perigee debris** counts only cataloged debris with a calculated perigee from 0 to below 200 km; it is an orbital-altitude indicator, not a collision probability or risk assessment.
- The Earth viewer's **Propagation model** selector defaults to SGP4. **F&G · two-body comparison** uses universal-variable Lagrange f and g coefficients initialized from the GP state at its element epoch. This optional comparison omits drag, Earth oblateness, and third-body perturbations, so it is educational and not an operational replacement for SGP4.
- Use **Update data** to ask the selected provider for fresh elements immediately, bypassing the local cache. The app refreshes automatically just over every two hours, and retries in about five minutes when a provider request fails or only stale cached data is available. Provider availability, rate limits, or publication schedules may prevent newer elements from being returned; in that case the last successful provider-specific cache remains available and is marked stale. Automatic refresh runs while the app is open; opening the app also fetches data on startup.

Successful provider/group downloads are cached separately in `server/data/satellite-cache.sqlite` for two hours. A provider never silently uses another provider's cache. If the first download fails, check the `dev:server` terminal for the upstream HTTP/network error. A cache cannot help until that provider has completed one successful download.

## Production build
```powershell
npm.cmd run build
npm.cmd start
```
Then open `http://127.0.0.1:3001/`.

## Deploy to Vercel from VS Code
The Vercel configuration builds the frontend as a static site and serves the Express API through a Node function. From the VS Code terminal, run:

```powershell
npx.cmd --yes vercel@latest login
npx.cmd --yes vercel@latest
npx.cmd --yes vercel@latest --prod
```

Follow the prompts to sign in and link this folder to a Vercel project. The SQLite TLE cache uses the function's temporary filesystem on Vercel, so cache entries are best-effort and may be lost when a function instance stops. For persistent shared caching, configure an external database and set `SATELLITE_DB_PATH` only when using a persistent mounted filesystem; Vercel functions do not provide one.

## Free deployment on Render

This project includes a Render Blueprint in `render.yaml`. It deploys the Express API and built frontend together as a free Node web service.

1. Push this project to a GitHub repository.
2. In the [Render Dashboard](https://dashboard.render.com/), choose **New > Blueprint** and connect that repository.
3. Confirm the `satellite-tracking` service uses the **Free** plan, then create the Blueprint.
4. Wait for the deploy to finish and open the `onrender.com` URL shown for the service.

The free service uses an ephemeral filesystem: the SQLite satellite cache is lost when Render restarts or spins down the service and must be refetched. Free services can spin down after 15 minutes without traffic and may take about a minute to start on the next request. This is suitable for demos and hobby use, not production availability. See [Render's free instance limitations](https://render.com/docs/free).

Space-Track is not enabled in the Blueprint by default. To use it, add `SPACETRACK_IDENTITY` and `SPACETRACK_PASSWORD` as secret environment variables in the Render service dashboard; never commit credentials or put them in frontend settings.

This is an educational visualization and is not certified for operational navigation or collision avoidance.
