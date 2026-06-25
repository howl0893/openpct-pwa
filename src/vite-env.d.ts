/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  readonly VITE_OPENPCT_GEOJSON_BASE_URL?: string;
  readonly VITE_OPENPCT_LEAFLET_ICON_BASE_URL?: string;
  readonly VITE_OPENPCT_HALFMILE_SOCAL_LABEL?: string;
  readonly VITE_OPENPCT_HALFMILE_SOCAL_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_HALFMILE_CENTRAL_LABEL?: string;
  readonly VITE_OPENPCT_HALFMILE_CENTRAL_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_HALFMILE_NOCAL_LABEL?: string;
  readonly VITE_OPENPCT_HALFMILE_NOCAL_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_HALFMILE_OR_LABEL?: string;
  readonly VITE_OPENPCT_HALFMILE_OR_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_HALFMILE_WA_LABEL?: string;
  readonly VITE_OPENPCT_HALFMILE_WA_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_TRAIL_WA_LABEL?: string;
  readonly VITE_OPENPCT_TRAIL_WA_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_TRAIL_OR_LABEL?: string;
  readonly VITE_OPENPCT_TRAIL_OR_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_TRAIL_NOCAL_LABEL?: string;
  readonly VITE_OPENPCT_TRAIL_NOCAL_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_TRAIL_CENTRAL_LABEL?: string;
  readonly VITE_OPENPCT_TRAIL_CENTRAL_GEOJSON_URL?: string;
  readonly VITE_OPENPCT_TRAIL_SOCAL_LABEL?: string;
  readonly VITE_OPENPCT_TRAIL_SOCAL_GEOJSON_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
