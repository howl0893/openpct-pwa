# OpenPCT PWA

A React, TypeScript, Vite, Leaflet, and `vite-plugin-pwa` app for viewing Pacific Crest Trail map data as a progressive web app.

## Prerequisites

- Node.js compatible with Vite 6: `^18.0.0`, `^20.0.0`, or `>=22.0.0`. This repo was last smoke-tested with Node `v24.13.1`.
- Yarn classic (`1.x`). This repo includes `yarn.lock`, so prefer Yarn over npm for reproducible installs.

Check your local versions:

```sh
node --version
yarn --version
```

## Install

From the repo root:

```sh
yarn install --frozen-lockfile
```

If you are actively updating dependencies, use `yarn install` instead so `yarn.lock` can be updated.

## Local Assets

The app source references a few local static asset folders that are intentionally ignored by git:

- `public/geojson/` for trail and waypoint GeoJSON files.
- `public/leaflet/` for Leaflet's default marker images.

The GeoJSON URLs are configurable with `VITE_OPENPCT_*` variables. Copy `.env.example` to `.env` if you need to override labels or served URLs. Keep filesystem paths and Google credential values in `openpct-utils/.env`; `VITE_` values are exposed to browser code.

Create the Leaflet marker image folder after installing dependencies:

```sh
mkdir -p public/leaflet
cp node_modules/leaflet/dist/images/marker-icon.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-icon-2x.png public/leaflet/
cp node_modules/leaflet/dist/images/marker-shadow.png public/leaflet/
```

Generate the GeoJSON files from `openpct-utils` after downloading PCTA GeoJSONs, the Central California KML/KMZ, and Halfmile notes into `OPENPCT_DATA`:

```sh
cd ../openpct-utils
python -m venv .venv
.venv/bin/python -m pip install pandas openpyxl python-dotenv
.venv/bin/python app/scripts/prepare_pwa_data.py
```

Without trail data, the app still starts and shows the base map. The "Layers" menu will fail for missing files until the expected GeoJSON files exist at these default paths:

```text
public/geojson/halfmile/socal.geojson
public/geojson/halfmile/central.geojson
public/geojson/halfmile/nocal.geojson
public/geojson/halfmile/or.geojson
public/geojson/halfmile/wa.geojson
public/geojson/trail/socal.geojson
public/geojson/trail/central.geojson
public/geojson/trail/nocal.geojson
public/geojson/trail/or.geojson
public/geojson/trail/wa.geojson
```

`central.geojson` is generated from PCTA's Central California KML/KMZ because PCTA did not publish that region as GeoJSON in the downloaded bundle.

## Start The Dev Server

```sh
yarn dev
```

Vite serves the app at:

```text
http://localhost:5173/
```

If you need to test from another device on your network, bind to all interfaces:

```sh
yarn dev --host 0.0.0.0
```

## Build And Preview

Create a production build:

```sh
yarn build
```

Preview the built app locally:

```sh
yarn preview
```

## Deploy To GitHub Pages

This repo includes `.github/workflows/deploy-pages.yml`, which builds the app and publishes `dist/` to GitHub Pages using GitHub Actions.

1. Commit and push the PWA repo to GitHub.
2. In GitHub, open the repository settings.
3. Go to **Pages**.
4. Set **Build and deployment** source to **GitHub Actions**.
5. Push to `main` or run the `Deploy GitHub Pages` workflow manually.

The app includes `public/CNAME` with:

```text
openpct.com
```

For `openpct.com`, add GitHub Pages DNS records at your domain registrar:

```text
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
CNAME www  <your-github-username>.github.io
```

After DNS resolves, return to GitHub Pages settings and enable **Enforce HTTPS**.

## Google Analytics

Google Analytics 4 uses public production measurement ID `G-P34VJCTJMV` by
default. This ID is not a secret. You can override it with a Vite environment
variable for local or alternate-property testing.

1. In Google Analytics, create a GA4 property and add a web data stream for `https://openpct.com`.
2. Copy the measurement ID, which looks like `G-XXXXXXXXXX`.
3. For local testing, copy `.env.example` to `.env` and set:

```text
VITE_OPENPCT_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_OPENPCT_GA_DEBUG=true
```

4. For GitHub Pages, the deployment workflow defaults to the OpenPCT production
   measurement ID. To override it, add these repository variables under
   **Settings > Secrets and variables > Actions > Variables**:

```text
VITE_OPENPCT_GA_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_OPENPCT_GA_DEBUG=false
```

The implementation sends explicit page/screen views and named app events for
install/update prompts, map controls, layers, downloads, search, annotation,
location outcomes, weather outbound clicks, and UI hide/show. Search queries are
included. Events do not include GPS coordinates, note text, cache file paths,
contact-style user-entered data, or custom user identifiers.

## Host Map Data On S3

The generated map data is intentionally ignored by git. Host it in S3 or CloudFront, then point the PWA build at that public URL.

Example upload:

```sh
aws s3 sync public/geojson s3://openpct-map-data/geojson \
  --delete \
  --cache-control "public,max-age=86400"
```

Set CORS on the S3 bucket so the browser can fetch map files from `openpct.com`:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://openpct.com", "http://localhost:5173"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]
```

In the GitHub repository, add this repository variable under **Settings > Secrets and variables > Actions > Variables**:

```text
VITE_OPENPCT_GEOJSON_BASE_URL=https://<your-s3-or-cloudfront-host>/geojson
```

For local development, `.env` can keep using:

```text
VITE_OPENPCT_GEOJSON_BASE_URL=/geojson
```

GitHub Pages is a good fit for the app shell, but keep the map data in S3/CloudFront. GitHub Pages has a 1 GB published-site limit and soft bandwidth limits, while the map data will grow over time.

## Verification

Verified locally on June 25, 2026:

- `yarn install --frozen-lockfile` completes.
- `yarn build` completes and generates `dist/`, `dist/sw.js`, and PWA assets.
- `yarn dev --host 127.0.0.1` starts Vite at `http://127.0.0.1:5173/`.
- `curl -I http://127.0.0.1:5173/` returns `HTTP/1.1 200 OK`.
- With `VITE_OPENPCT_GA_MEASUREMENT_ID` set, Google Tag Assistant or Chrome DevTools should show requests to `googletagmanager.com` and `google-analytics.com`. With it unset, those requests should not appear.

`yarn lint` currently fails on pre-existing TypeScript lint issues, mostly `@typescript-eslint/no-explicit-any` in `src/App.tsx` and `src/components/Map.tsx`, plus one React hook dependency warning in `Map.tsx`.

## Notes

- No `.env` file is required for the current local startup path.
- The PWA precaches the app shell, icons, manifest, Leaflet marker images, JS, CSS, and HTML so the installed app can reopen offline.
- GeoJSON map data is not automatically precached. Use **Downloads > Trail data** to download a region bundle for offline map use. Each region bundle stores both the PCTA trail GeoJSON and Halfmile notes GeoJSON in the browser Cache API.
- The default online map opens on the Satellite basemap, frames the full PCT from the Mexican border to the Canadian border, and loads all PCTA trail overlays. Halfmile note overlays are available in **Layers** but are off by default.
- Use **Layers** for visible map choices: basemap, PCTA trail overlays, and Halfmile note overlays. Use **Downloads** for saved-for-offline data. Download actions show a download icon when data is missing and a trash icon when it is saved.
- Use the square map UI toggle or press `H` to hide the header and map controls. Press `H` or `Esc` to show them again.
- Double-click the map to query nearby features. This requires network access.
- Google Analytics is disabled unless `VITE_OPENPCT_GA_MEASUREMENT_ID` is set. Analytics events are best-effort and are dropped if the browser is offline or blocks Google scripts.
- PWA install prompts are browser-controlled. The app always shows an Install button, but Chrome/Edge only show the native prompt when the site is HTTPS, has a valid manifest, has an active service worker, and is not already installed or temporarily dismissed.
- Browser geolocation requires a secure context. `localhost` and `127.0.0.1` satisfy that requirement during local development.
- Weather popups call `api.weather.gov`, and feature queries call OpenStreetMap Nominatim, so those features need network access.
- The PWA service worker is enabled in dev via `vite.config.ts`, so a hard refresh or clearing site data can help if stale local assets appear during testing.
