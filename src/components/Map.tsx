import { useEffect, useRef, useState } from 'react';
import L, { Control, ControlOptions, Icon, Map as LeafletMap, Marker, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import './Map.css';
import {
    CacheStatus,
    clearMapDataFiles,
    downloadMapDataFiles,
    getMapDataCacheStatus,
} from '../mapDataCache';
import { trackEvent } from '../analytics';

// Configuration
const env = import.meta.env;
const POLL_INTERVAL = 3000; // Poll GPS every 5 seconds
const HEADING_THRESHOLD = 1; // Minimum heading change (degrees) to update marker

type DataFile = {
    name: string;
    path: string;
    group: DataGroup;
    region: RegionKey;
};

type DataGroup = 'PCTA Trail Data' | 'Halfmile Notes';
type RegionKey = 'socal' | 'central' | 'nocal' | 'or' | 'wa';

type Region = {
    key: RegionKey;
    name: string;
};

const envValue = (key: keyof ImportMetaEnv, fallback: string): string => {
    const value = env[key];
    if (value === undefined) return fallback;
    const trimmed = value.trim();
    return trimmed === '' ? fallback : trimmed;
};

const joinUrl = (baseUrl: string, path: string): string => {
    const cleanBase = baseUrl.replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    return cleanBase ? `${cleanBase}/${cleanPath}` : `/${cleanPath}`;
};

const configuredDataFile = (
    labelKey: keyof ImportMetaEnv,
    urlKey: keyof ImportMetaEnv,
    fallbackLabel: string,
    fallbackUrl: string,
    group: DataGroup,
    region: RegionKey
): DataFile | null => {
    const name = envValue(labelKey, fallbackLabel);
    const path = envValue(urlKey, fallbackUrl);
    return path ? { name, path, group, region } : null;
};

const GEOJSON_BASE_URL = envValue('VITE_OPENPCT_GEOJSON_BASE_URL', '/geojson');
const LEAFLET_ICON_BASE_URL = envValue('VITE_OPENPCT_LEAFLET_ICON_BASE_URL', '/leaflet');

const regions: Region[] = [
    { key: 'socal', name: 'Southern California' },
    { key: 'central', name: 'Central California' },
    { key: 'nocal', name: 'Northern California' },
    { key: 'or', name: 'Oregon' },
    { key: 'wa', name: 'Washington' },
];

const dataFiles: DataFile[] = [
    configuredDataFile(
        'VITE_OPENPCT_TRAIL_SOCAL_LABEL',
        'VITE_OPENPCT_TRAIL_SOCAL_GEOJSON_URL',
        'PCTA Southern California',
        joinUrl(GEOJSON_BASE_URL, 'trail/socal.geojson'),
        'PCTA Trail Data',
        'socal'
    ),
    configuredDataFile(
        'VITE_OPENPCT_TRAIL_CENTRAL_LABEL',
        'VITE_OPENPCT_TRAIL_CENTRAL_GEOJSON_URL',
        'PCTA Central California',
        joinUrl(GEOJSON_BASE_URL, 'trail/central.geojson'),
        'PCTA Trail Data',
        'central'
    ),
    configuredDataFile(
        'VITE_OPENPCT_TRAIL_NOCAL_LABEL',
        'VITE_OPENPCT_TRAIL_NOCAL_GEOJSON_URL',
        'PCTA Northern California',
        joinUrl(GEOJSON_BASE_URL, 'trail/nocal.geojson'),
        'PCTA Trail Data',
        'nocal'
    ),
    configuredDataFile(
        'VITE_OPENPCT_TRAIL_OR_LABEL',
        'VITE_OPENPCT_TRAIL_OR_GEOJSON_URL',
        'PCTA Oregon',
        joinUrl(GEOJSON_BASE_URL, 'trail/or.geojson'),
        'PCTA Trail Data',
        'or'
    ),
    configuredDataFile(
        'VITE_OPENPCT_TRAIL_WA_LABEL',
        'VITE_OPENPCT_TRAIL_WA_GEOJSON_URL',
        'PCTA Washington',
        joinUrl(GEOJSON_BASE_URL, 'trail/wa.geojson'),
        'PCTA Trail Data',
        'wa'
    ),
    configuredDataFile(
        'VITE_OPENPCT_HALFMILE_SOCAL_LABEL',
        'VITE_OPENPCT_HALFMILE_SOCAL_GEOJSON_URL',
        'Halfmile Southern California Notes',
        joinUrl(GEOJSON_BASE_URL, 'halfmile/socal.geojson'),
        'Halfmile Notes',
        'socal'
    ),
    configuredDataFile(
        'VITE_OPENPCT_HALFMILE_CENTRAL_LABEL',
        'VITE_OPENPCT_HALFMILE_CENTRAL_GEOJSON_URL',
        'Halfmile Central California Notes',
        joinUrl(GEOJSON_BASE_URL, 'halfmile/central.geojson'),
        'Halfmile Notes',
        'central'
    ),
    configuredDataFile(
        'VITE_OPENPCT_HALFMILE_NOCAL_LABEL',
        'VITE_OPENPCT_HALFMILE_NOCAL_GEOJSON_URL',
        'Halfmile Northern California Notes',
        joinUrl(GEOJSON_BASE_URL, 'halfmile/nocal.geojson'),
        'Halfmile Notes',
        'nocal'
    ),
    configuredDataFile(
        'VITE_OPENPCT_HALFMILE_OR_LABEL',
        'VITE_OPENPCT_HALFMILE_OR_GEOJSON_URL',
        'Halfmile Oregon Notes',
        joinUrl(GEOJSON_BASE_URL, 'halfmile/or.geojson'),
        'Halfmile Notes',
        'or'
    ),
    configuredDataFile(
        'VITE_OPENPCT_HALFMILE_WA_LABEL',
        'VITE_OPENPCT_HALFMILE_WA_GEOJSON_URL',
        'Halfmile Washington Notes',
        joinUrl(GEOJSON_BASE_URL, 'halfmile/wa.geojson'),
        'Halfmile Notes',
        'wa'
    ),
].filter((file): file is DataFile => file !== null);

const fetchGeoJson = async (path: string): Promise<GeoJSON.GeoJsonObject> => {
    const response = await fetch(path);
    const text = await response.text();

    if (!response.ok) {
        throw new Error(`HTTP ${response.status} while loading ${path}`);
    }

    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
        throw new Error(`Expected GeoJSON but received HTML for ${path}. Check that the file exists or update the VITE_OPENPCT_* URL.`);
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON';
        throw new Error(`Invalid GeoJSON at ${path}: ${message}`);
    }
};

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: joinUrl(LEAFLET_ICON_BASE_URL, 'marker-icon-2x.png'),
    iconUrl: joinUrl(LEAFLET_ICON_BASE_URL, 'marker-icon.png'),
    shadowUrl: joinUrl(LEAFLET_ICON_BASE_URL, 'marker-shadow.png'),
});

// Define custom icons for waypoint types and user location
interface IconMap {
    [key: string]: Icon;
}

const iconMap: IconMap = {
    'Water Source': L.icon({
        iconUrl: '/icons/water.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Trail Junction': L.icon({
        iconUrl: '/icons/direction.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Paved Road': L.icon({
        iconUrl: '/icons/road.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Unpaved Road': L.icon({
        iconUrl: '/icons/road.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Established Campsite': L.icon({
        iconUrl: '/icons/tent.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Undeveloped Campsite': L.icon({
        iconUrl: '/icons/fire.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Resupply': L.icon({
        iconUrl: '/icons/city.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'Landmark': L.icon({
        iconUrl: '/icons/flag.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'default': L.icon({
        iconUrl: '/icons/point.svg',
        className: 'icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
    'user': L.icon({
        iconUrl: '/icons/user-location.svg',
        className: 'user-location-icon icon-with-circle',
        iconSize: [24, 24],
        popupAnchor: [0, -24],
    }),
};

// Weather cache
interface WeatherCache {
    [key: string]: { data: string; timestamp: number };
}

const weatherCache: WeatherCache = {};
const CACHE_TTL = 10 * 60 * 1000;

const fetchWeatherData = async (lat: number, lon: number): Promise<string> => {
    const cacheKey = `${lat.toFixed(6)},${lon.toFixed(6)}`;
    const cached = weatherCache[cacheKey];
    const now = Date.now();

    if (cached && now - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }

    if (!navigator.onLine) {
        return 'Weather data unavailable (offline)';
    }

    try {
        const pointsResponse = await fetch(`https://api.weather.gov/points/${lat},${lon}`, {
            headers: { 'User-Agent': 'OpenPCT/1.0 (contact: example@example.com)' },
        });
        if (!pointsResponse.ok) throw new Error(`Points API error: ${pointsResponse.status}`);
        const pointsData = await pointsResponse.json();
        const forecastUrl = pointsData.properties?.forecast;
        if (!forecastUrl) throw new Error('No forecast URL found');

        const forecastResponse = await fetch(forecastUrl, {
            headers: { 'User-Agent': 'OpenPCT/1.0 (contact: example@example.com)' },
        });
        if (!forecastResponse.ok) throw new Error(`Forecast API error: ${forecastResponse.status}`);
        const forecastData = await forecastResponse.json();
        const currentPeriod = forecastData.properties?.periods?.[0];
        if (!currentPeriod) throw new Error('No forecast periods found');

        const temperature = currentPeriod.temperature
            ? `${currentPeriod.temperature} °${currentPeriod.temperatureUnit}`
            : 'N/A';
        const shortForecast = currentPeriod.shortForecast || 'N/A';
        const weatherContent = `
      <b>Temperature:</b> ${temperature}<br>
      <b>Forecast:</b> ${shortForecast}
    `;
        weatherCache[cacheKey] = { data: weatherContent, timestamp: now };
        return weatherContent;
    } catch (error: unknown) {
        console.error(`Error fetching weather for [${lat}, ${lon}]:`, error);
        return error instanceof Error ? `Weather data unavailable: ${error.message}` : 'Weather data unavailable';
    }
};

// Normalize waypoint type
const getNormalizedType = (type: string | undefined): string => {
    if (!type || type === 'Unknown' || typeof type !== 'string') return 'default';
    const types = type.split('\n').map((t) => t.trim()).filter((t) => t);
    for (const t of types) {
        if (iconMap[t]) return t;
    }
    if (types.includes('Water Source')) return 'Water Source';
    if (types.includes('Trail Junction')) return 'Trail Junction';
    if (types.includes('Paved Road')) return 'Paved Road';
    if (types.includes('Campground')) return 'Campground';
    if (types.includes('Undeveloped Campsite')) return 'Undeveloped Campsite';
    if (types.includes('Resupply') || types.includes('Small Store') || types.includes('Mail')) return 'Resupply';
    if (types.includes('Landmark')) return 'Landmark';
    return 'default';
};

const queryFeaturesAt = async (map: LeafletMap, e: L.LeafletMouseEvent) => {
    if (!navigator.onLine) {
        L.popup()
            .setLatLng(e.latlng)
            .setContent('<b>Query Features</b><br>Feature query unavailable offline.')
            .openOn(map);
        return;
    }

    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${e.latlng.lat}&lon=${e.latlng.lng}&zoom=18&addressdetails=1`,
            { headers: { 'User-Agent': 'OpenPCT/1.0 (contact: example@example.com)' } }
        );
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const data = await response.json();
        const address = data.address || {};
        const nearbyFeatures = address.road ? `${address.road}` : 'No nearby road found';
        const enclosingFeatures = [
            address.county ? `County Boundary ${address.county}` : null,
            address.state ? `State Boundary ${address.state}` : null,
            address.timezone || 'Timezone Unknown',
            address.country ? `Region ${address.country}` : null,
            address.timezone ? `Timezone ${address.timezone}` : null,
            address.country ? `International Boundary ${address.country}` : null,
        ]
            .filter(Boolean)
            .join('<br>');
        const popupContent = `
            <b>Query Features</b><br>
            Double-click the map to find nearby features.<br><br>
            <b>Nearby features</b><br>
            ${nearbyFeatures}<br><br>
            <b>Enclosing features</b><br>
            ${enclosingFeatures || 'No enclosing features found'}
          `;
        L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        const popupContent = `
            <b>Query Features</b><br>
            Unable to retrieve features: ${message}<br>
            Please try again later.
          `;
        L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
    }
};

// Extend Marker to include note property and rotation
interface CustomMarker extends Marker {
    note?: string;
    setRotationAngle?: (angle: number) => void;
}

// User location state
interface UserLocation {
    latlng: LatLng;
    heading: number;
    timestamp: number;
}

interface LocationControlOptions extends ControlOptions {
    onToggleTracking: () => void;
}

// LocationControl
const LocationControl = Control.extend({
    options: { position: 'topright' } as LocationControlOptions,
    initialize: function (options: LocationControlOptions) {
        L.setOptions(this, options);
        this.onToggleTracking = options.onToggleTracking;
    },
    onAdd: function (map: LeafletMap) {
        console.log("map: ", map);
        console.log('LocationControl: Initializing');
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-location');
        container.style.width = '32px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage = "url('/icons/location.svg')";
        button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        button.style.borderRadius = '2px';
        button.style.backgroundSize = '24px 24px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        L.DomEvent.on(button, 'click', async (e: Event) => {
            console.log('LocationControl: Button clicked');
            L.DomEvent.stopPropagation(e);
            this.onToggleTracking();
            button.style.backgroundColor = button.style.backgroundColor === 'rgb(224, 224, 224)' ? '#fff' : '#e0e0e0';
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        return container;
    },
});

interface LayersControlOptions extends ControlOptions {
    baseLayers: { [key: string]: L.TileLayer };
}

const styleTextControl = (container: HTMLElement, width: string) => {
    container.style.width = width;
    container.style.height = '30px';
    container.style.marginBottom = '2px';
    container.style.backgroundColor = '#fff';
    container.style.cursor = 'pointer';
};

const styleTextControlButton = (button: HTMLElement, width: string) => {
    button.style.width = width;
    button.style.height = '30px';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.fontFamily = 'Arial, sans-serif';
    button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
    button.style.borderRadius = '2px';
    button.style.fontSize = '12px';
    button.style.color = '#333';
};

const styleDropdown = (dropdown: HTMLElement, left: string) => {
    dropdown.style.minWidth = '300px';
    dropdown.style.maxWidth = '360px';
    dropdown.style.padding = '8px';
    dropdown.style.fontSize = '14px';
    dropdown.style.lineHeight = '1.5';
    dropdown.style.backgroundColor = '#fff';
    dropdown.style.border = '2px solid rgba(60, 60, 60, 0.5)';
    dropdown.style.borderRadius = '4px';
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.left = left;
    dropdown.style.top = '0px';
    dropdown.style.cursor = 'pointer';
};

const createSectionHeader = (
    parent: HTMLElement,
    titleText: string,
    expanded: boolean,
    margin: string
): { content: HTMLDivElement; indicator: HTMLSpanElement; getExpanded: () => boolean } => {
    let isExpanded = expanded;
    const header = L.DomUtil.create('button', '', parent);
    header.type = 'button';
    header.style.width = '100%';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.margin = margin;
    header.style.padding = '3px 0';
    header.style.border = '0';
    header.style.borderBottom = '1px solid rgba(60, 60, 60, 0.18)';
    header.style.background = 'transparent';
    header.style.color = '#333';
    header.style.cursor = 'pointer';
    header.style.fontWeight = '700';
    header.style.fontSize = '12px';
    header.style.textTransform = 'uppercase';
    header.style.letterSpacing = '0';

    const title = L.DomUtil.create('span', '', header);
    title.textContent = titleText;

    const indicator = L.DomUtil.create('span', '', header);
    indicator.textContent = expanded ? '-' : '+';
    indicator.style.fontSize = '14px';
    indicator.style.lineHeight = '1';

    const content = L.DomUtil.create('div', '', parent);
    content.style.display = expanded ? 'block' : 'none';

    L.DomEvent.on(header, 'click', (e: Event) => {
        L.DomEvent.stopPropagation(e);
        isExpanded = !isExpanded;
        content.style.display = isExpanded ? 'block' : 'none';
        indicator.textContent = isExpanded ? '-' : '+';
    });

    return { content, indicator, getExpanded: () => isExpanded };
};

interface AnnotateControlOptions extends ControlOptions {
    drawnItems?: L.FeatureGroup;
}

const AnnotateControl = Control.extend({
    options: { position: 'topleft', drawnItems: new L.FeatureGroup() } as AnnotateControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-annotate-openpct');
        styleTextControl(container, '86px');

        const button = L.DomUtil.create('div', '', container);
        styleTextControlButton(button, '86px');
        button.textContent = 'Annotate';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-annotate-openpct-expanded', container);
        styleDropdown(dropdown, '90px');
        dropdown.style.minWidth = '180px';

        let noteMode = false;
        const setModeButtonState = (modeButton: HTMLButtonElement, active: boolean) => {
            modeButton.style.background = active ? '#e0e0e0' : '#f7f7f7';
        };

        const createModeButton = (label: string): HTMLButtonElement => {
            const modeButton = L.DomUtil.create('button', '', dropdown);
            modeButton.type = 'button';
            modeButton.textContent = label;
            modeButton.style.width = '100%';
            modeButton.style.margin = '3px 0';
            modeButton.style.padding = '5px 8px';
            modeButton.style.border = '1px solid rgba(60, 60, 60, 0.3)';
            modeButton.style.borderRadius = '3px';
            modeButton.style.background = '#f7f7f7';
            modeButton.style.color = '#333';
            modeButton.style.cursor = 'pointer';
            modeButton.style.fontSize = '12px';
            modeButton.style.textAlign = 'left';
            return modeButton;
        };

        const noteButton = createModeButton('Note');
        const drawButton = createModeButton('Draw tools');

        L.DomEvent.on(noteButton, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            noteMode = !noteMode;
            setModeButtonState(noteButton, noteMode);
            map.getContainer().style.cursor = noteMode ? 'pointer' : 'grab';
        });

        L.DomEvent.on(drawButton, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            const mapContainer = map.getContainer();
            const showDrawTools = !mapContainer.classList.contains('openpct-show-draw-tools');
            mapContainer.classList.toggle('openpct-show-draw-tools', showDrawTools);
            setModeButtonState(drawButton, showDrawTools);
        });

        map.on('click', async (e: L.LeafletMouseEvent) => {
            if (noteMode) {
                const marker = L.marker(e.latlng) as CustomMarker;
                marker.note = '';
                this.options.drawnItems?.addLayer(marker);
                const popupContent = L.DomUtil.create('div');
                const textarea = L.DomUtil.create('textarea', '', popupContent);
                textarea.style.width = '200px';
                textarea.style.height = '100px';
                textarea.placeholder = 'Enter your note...';
                const saveButton = L.DomUtil.create('button', '', popupContent);
                saveButton.textContent = 'Save Note';
                saveButton.style.marginTop = '5px';
                saveButton.style.padding = '5px 10px';
                saveButton.style.cursor = 'pointer';
                L.DomEvent.on(saveButton, 'click', () => {
                    marker.note = textarea.value;
                    marker.bindPopup(`<b>Note:</b><br>${marker.note || 'No note added.'}`).closePopup();
                    marker.openPopup();
                });
                marker.bindPopup(popupContent).openPopup();
                marker.on('click', () => {
                    marker.bindPopup(`<b>Note:</b><br>${marker.note || 'No note added.'}`).openPopup();
                });
                noteMode = false;
                setModeButtonState(noteButton, false);
                map.getContainer().style.cursor = 'grab';
                return;
            }
        });

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        const closeDropdown = () => {
            dropdown.style.display = 'none';
        };
        L.DomEvent.on(document as any, 'click', closeDropdown);

        return container;
    },
    onRemove: function () {
        const closeDropdown = () => {
            // No-op, handled in onAdd
        };
        L.DomEvent.off(document as any, 'click', closeDropdown);
    },
});

const UiToggleControl = Control.extend({
    options: { position: 'topleft' } as ControlOptions,
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-ui-toggle');
        container.style.width = '32px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('button', '', container);
        button.type = 'button';
        button.title = 'Hide controls (H)';
        button.setAttribute('aria-label', 'Hide controls');
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        button.style.borderRadius = '2px';
        button.style.background = '#fff';
        button.style.color = '#333';
        button.style.cursor = 'pointer';

        const setHidden = (hidden: boolean, shouldTrack = true) => {
            document.body.classList.toggle('openpct-ui-hidden', hidden);
            button.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6M9 9h6v6H9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            button.title = 'Hide controls (H)';
            button.setAttribute('aria-label', 'Hide controls');
            if (shouldTrack) {
                trackEvent(hidden ? 'ui_hidden' : 'ui_shown');
            }
        };

        const toggleHidden = () => {
            setHidden(!document.body.classList.contains('openpct-ui-hidden'));
        };

        setHidden(document.body.classList.contains('openpct-ui-hidden'), false);

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            toggleHidden();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            const tagName = target?.tagName?.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea' || target?.isContentEditable) return;
            if (event.key === 'Escape') {
                if (!document.body.classList.contains('openpct-ui-hidden')) return;
                event.preventDefault();
                setHidden(false);
                return;
            }
            if (event.key.toLowerCase() !== 'h') return;
            event.preventDefault();
            toggleHidden();
        };
        window.addEventListener('keydown', handleKeyDown);

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        this._handleKeyDown = handleKeyDown;
        return container;
    },
    onRemove: function () {
        if (this._handleKeyDown) {
            window.removeEventListener('keydown', this._handleKeyDown);
        }
    },
});

// LayersControl
const LayersControl = Control.extend({
    options: { position: 'topleft', baseLayers: {} } as LayersControlOptions,
    initialize: function (options: LayersControlOptions) {
        L.setOptions(this, options);
    },
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-layers-openpct');
        styleTextControl(container, '72px');

        const button = L.DomUtil.create('div', '', container);
        styleTextControlButton(button, '72px');
        button.textContent = 'Layers';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-layers-openpct-expanded', container);
        styleDropdown(dropdown, '128px');

        const files = dataFiles;
        const loadedLayers: { [key: string]: L.Layer } = {};

        const updateMapBounds = () => {
            const bounds: L.LatLngBounds[] = [];
            Object.values(loadedLayers).forEach((layer) => {
                if ('getBounds' in layer) {
                    bounds.push((layer as any).getBounds());
                }
            });
            if (bounds.length > 0) {
                const combinedBounds = bounds.reduce((acc, curr) => acc.extend(curr), bounds[0]);
                map.fitBounds(combinedBounds);
            } else {
                map.setView([39, -98], 3);
            }
        };

        const baseMapSection = createSectionHeader(dropdown, 'Base map', true, '0 0 4px');
        const baseLayerOptions = [
            { name: 'OpenStreetMap', layer: this.options.baseLayers.OpenStreetMap },
            { name: 'OpenTopoMap', layer: this.options.baseLayers.OpenTopoMap },
            { name: 'Satellite', layer: this.options.baseLayers.Satellite },
            { name: 'Dark', layer: this.options.baseLayers.Dark },
            { name: 'Offline', layer: this.options.baseLayers.Offline },
        ];

        baseLayerOptions.forEach(({ name, layer }) => {
            const label = L.DomUtil.create('label', '', baseMapSection.content);
            label.style.display = 'block';
            label.style.margin = '3px 0';
            label.style.whiteSpace = 'nowrap';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.cursor = 'pointer';

            const input = L.DomUtil.create('input', '', label);
            input.type = 'radio';
            input.name = 'openpct-base-layers';
            input.value = name;
            input.checked = map.hasLayer(layer);
            input.style.marginRight = '5px';

            const span = L.DomUtil.create('span', '', label);
            span.textContent = name;

            L.DomEvent.on(input, 'change', () => {
                baseLayerOptions.forEach(({ layer }) => {
                    if (map.hasLayer(layer)) map.removeLayer(layer);
                });
                map.addLayer(layer);
            });
        });

        const groupContainers: Partial<Record<DataGroup, HTMLDivElement>> = {};
        const groups = Array.from(new Set(files.map((file) => file.group)));

        groups.forEach((group, index) => {
            const section = createSectionHeader(dropdown, group, index === 0, '10px 0 4px');
            groupContainers[group] = section.content;
        });

        files.forEach(({ name, path, group, region }) => {
            const groupContent = groupContainers[group] || dropdown;
            const label = L.DomUtil.create('label', '', groupContent);
            label.style.display = 'grid';
            label.style.gridTemplateColumns = 'auto 1fr';
            label.style.columnGap = '5px';
            label.style.alignItems = 'center';
            label.style.margin = '5px 0';
            label.style.cursor = 'pointer';
            label.title = name;

            const input = L.DomUtil.create('input', '', label);
            input.type = 'checkbox';
            input.name = 'openpct-overlay-layers';
            input.value = path;

            const span = L.DomUtil.create('span', '', label);
            span.textContent = name;
            span.style.minWidth = '0';
            span.style.whiteSpace = 'nowrap';
            span.style.overflow = 'hidden';
            span.style.textOverflow = 'ellipsis';

            L.DomEvent.on(input, 'change', () => {
                if (input.checked) {
                    try {
                        fetchGeoJson(path)
                            .then((data) => {
                                const layer = L.geoJSON(data, {
                                    pointToLayer: (feature, latlng) => {
                                        if (feature.geometry.type !== 'Point') {
                                            console.warn('Skipping non-point feature:', feature);
                                            return null as any; // Type workaround
                                        }
                                        if (!feature.properties) {
                                            console.warn('Feature missing properties:', feature);
                                            return L.marker(latlng, { icon: iconMap.default });
                                        }
                                        const type = getNormalizedType(feature.properties.type);
                                        const icon = iconMap[type] || iconMap.default;
                                        return L.marker(latlng, { icon });
                                    },
                                    style: { color: '#630000', weight: 4, opacity: 0.7 },
                                    onEachFeature: (feature, layer) => {
                                        if (feature.geometry.type !== 'Point' || !feature.properties) {
                                            return;
                                        }
                                        const props = feature.properties;
                                        const coords = feature.geometry.coordinates;
                                        const maxDescLength = 200;
                                        let description = props.description || '';
                                        if (description.length > maxDescLength) {
                                            description = description.substring(0, maxDescLength) + '...';
                                        }
                                        const initialPopupContent = `
                        <div style="max-width: 250px; font-size: 12px;">
                          <b>${props.name || 'Unnamed Waypoint'}</b><br>
                          <b>Type:</b> ${props.type || 'Unknown'}<br>
                          <b>Coordinates:</b> [${coords[1]?.toFixed(6) || 'N/A'}, ${coords[0]?.toFixed(6) || 'N/A'}]<br>
                          <b>PCT Mile (NB):</b> ${props.pct_mile_nb?.toFixed(1) || 'N/A'}<br>
                          <b>PCT Mile (SB):</b> ${props.pct_mile_sb?.toFixed(1) || 'N/A'}<br>
                          <b>Elevation:</b> ${props.elevation_ft ? props.elevation_ft.toFixed(0) + ' ft' : 'N/A'}<br>
                          <b>Description:</b> ${description || 'None'}<br>
                          <hr>
                          <b>Source:</b> Halfmile<br>
                          <hr>
                          <b>Weather:</b><br>
                          Loading weather...<br>
                          <a href="https://forecast.weather.gov/MapClick.php?lat=${coords[1]?.toFixed(6) || 0}&lon=${coords[0]?.toFixed(6) || 0}" target="_blank">Get More</a>
                        </div>
                      `;
                                        layer.bindPopup(initialPopupContent);
                                        layer.on('popupopen', async () => {
                                            const weatherContent = await fetchWeatherData(coords[1], coords[0]);
                                            const updatedPopupContent = `
                          <div style="max-width: 250px; font-size: 12px;">
                            <b>${props.name || 'Unnamed Waypoint'}</b><br>
                            <b>Type:</b> ${props.type || 'Unknown'}<br>
                            <b>Coordinates:</b> [${coords[1]?.toFixed(6) || 'N/A'}, ${coords[0]?.toFixed(6) || 'N/A'}]<br>
                            <b>PCT Mile (NB):</b> ${props.pct_mile_nb?.toFixed(1) || 'N/A'}<br>
                            <b>PCT Mile (SB):</b> ${props.pct_mile_sb?.toFixed(1) || 'N/A'}<br>
                            <b>Elevation:</b> ${props.elevation_ft ? props.elevation_ft.toFixed(0) + ' ft' : 'N/A'}<br>
                            <b>Description:</b> ${description || 'None'}<br>
                            <hr>
                            <b>Source:</b> Halfmile<br>
                            <hr>
                            <b>Weather:</b><br>
                            ${weatherContent}<br>
                            <a href="https://forecast.weather.gov/MapClick.php?lat=${coords[1]?.toFixed(6) || 0}&lon=${coords[0]?.toFixed(6) || 0}" target="_blank">Get More</a>
                          </div>
                        `;
                                            layer.setPopupContent(updatedPopupContent);
                                        });
                                    },
                                }).addTo(map);
                                loadedLayers[path] = layer;
                                map.addLayer(layer);
                                updateMapBounds();
                                trackEvent('map_layer_loaded', {
                                    layer_group: group,
                                    region,
                                });
                            })
                            .catch((error: unknown) => {
                                const message = error instanceof Error ? error.message : 'Unknown error';
                                const alertMessage = !navigator.onLine
                                    ? 'This map layer is not downloaded for offline use. Reconnect and download it first.'
                                    : `Error loading GeoJSON file: ${message}`;
                                console.error('Error loading GeoJSON:', error, path);
                                alert(alertMessage);
                                input.checked = false;
                            });
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        console.error('Error loading file:', error, path);
                        alert(`Error loading file: ${message}`);
                        input.checked = false;
                    }
                } else if (loadedLayers[path]) {
                    map.removeLayer(loadedLayers[path]);
                    delete loadedLayers[path];
                    updateMapBounds();
                }
            });
        });

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        const closeDropdown = () => {
            dropdown.style.display = 'none';
        };
        L.DomEvent.on(document as any, 'click', closeDropdown);

        return container;
    },
    onRemove: function () {
        const closeDropdown = () => {
            // No-op, handled in onAdd
        };
        L.DomEvent.off(document as any, 'click', closeDropdown);
    },
});

// DownloadsControl
const DownloadsControl = Control.extend({
    options: { position: 'topleft' } as ControlOptions,
    onAdd: function () {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-downloads-openpct');
        styleTextControl(container, '92px');

        const button = L.DomUtil.create('div', '', container);
        styleTextControlButton(button, '92px');
        button.textContent = 'Downloads';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-downloads-openpct-expanded', container);
        styleDropdown(dropdown, '96px');

        const files = dataFiles;
        const regionStatusElements: Partial<Record<RegionKey, HTMLSpanElement>> = {};
        const regionActionButtons: Partial<Record<RegionKey, HTMLButtonElement>> = {};
        const allDataPaths = files.map((file) => file.path);

        const cacheStatusLabel = (status: CacheStatus): string => {
            if (status === 'downloaded') return 'Downloaded';
            if (status === 'downloading') return 'Downloading...';
            if (status === 'failed') return 'Failed';
            if (status === 'unsupported') return 'Offline downloads unsupported';
            return 'Not downloaded';
        };

        const summarizeCacheStatuses = (paths: string[], statuses: Record<string, CacheStatus>): string => {
            const fileStatuses = paths.map((path) => statuses[path] || 'not-downloaded');
            if (fileStatuses.some((status) => status === 'unsupported')) return 'Unsupported';
            if (fileStatuses.every((status) => status === 'downloaded')) return 'Downloaded';
            if (fileStatuses.some((status) => status === 'downloaded')) return 'Partially downloaded';
            return 'Not downloaded';
        };

        const arePathsDownloaded = (paths: string[], statuses: Record<string, CacheStatus>): boolean => {
            return paths.length > 0 && paths.every((path) => statuses[path] === 'downloaded');
        };

        const setIconButtonState = (actionButton: HTMLButtonElement, isDownloaded: boolean, label: string) => {
            actionButton.innerHTML = isDownloaded
                ? '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v7M14 10v7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
                : '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            actionButton.title = isDownloaded ? `Clear ${label}` : `Download ${label}`;
            actionButton.setAttribute('aria-label', actionButton.title);
        };

        const createIconButton = (parent: HTMLElement, label: string): HTMLButtonElement => {
            const actionButton = L.DomUtil.create('button', '', parent);
            actionButton.type = 'button';
            actionButton.title = label;
            actionButton.setAttribute('aria-label', label);
            actionButton.style.width = '24px';
            actionButton.style.height = '24px';
            actionButton.style.display = 'inline-flex';
            actionButton.style.alignItems = 'center';
            actionButton.style.justifyContent = 'center';
            actionButton.style.padding = '0';
            actionButton.style.border = '1px solid rgba(60, 60, 60, 0.3)';
            actionButton.style.borderRadius = '3px';
            actionButton.style.background = '#f7f7f7';
            actionButton.style.color = '#333';
            actionButton.style.cursor = 'pointer';
            setIconButtonState(actionButton, false, label);
            return actionButton;
        };

        const refreshCacheStatuses = async () => {
            try {
                const statuses = await getMapDataCacheStatus(allDataPaths);
                regions.forEach((region) => {
                    const regionPaths = files.filter((file) => file.region === region.key).map((file) => file.path);
                    const statusElement = regionStatusElements[region.key];
                    const actionButton = regionActionButtons[region.key];
                    if (statusElement) {
                        statusElement.textContent = summarizeCacheStatuses(regionPaths, statuses);
                    }
                    if (actionButton) {
                        setIconButtonState(actionButton, arePathsDownloaded(regionPaths, statuses), region.name);
                    }
                });
            } catch (error) {
                console.error('Error checking offline map cache:', error);
            }
        };

        const setPathsStatus = (paths: string[], status: CacheStatus) => {
            paths.forEach((path) => {
                const file = files.find((candidate) => candidate.path === path);
                if (!file) return;
                const statusElement = regionStatusElements[file.region];
                if (statusElement) {
                    statusElement.textContent = cacheStatusLabel(status);
                }
            });
        };

        const downloadPaths = async (paths: string[], statusElement?: HTMLSpanElement): Promise<boolean> => {
            if (paths.length === 0) return false;

            setPathsStatus(paths, 'downloading');
            if (statusElement) {
                statusElement.textContent = 'Downloading...';
            }

            try {
                await downloadMapDataFiles(paths, (_path, completed, total) => {
                    if (statusElement) {
                        statusElement.textContent = `Downloading ${completed}/${total}`;
                    }
                });
                await refreshCacheStatuses();
                return true;
            } catch (error: unknown) {
                setPathsStatus(paths, 'failed');
                if (statusElement) {
                    statusElement.textContent = 'Failed';
                }
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error downloading offline map data:', error);
                alert(`Error downloading offline map data: ${message}`);
                return false;
            }
        };

        const clearPaths = async (paths: string[], statusElement?: HTMLSpanElement): Promise<boolean> => {
            if (paths.length === 0) return false;

            try {
                await clearMapDataFiles(paths);
                if (statusElement) {
                    statusElement.textContent = 'Not downloaded';
                }
                await refreshCacheStatuses();
                return true;
            } catch (error: unknown) {
                if (statusElement) {
                    statusElement.textContent = 'Failed';
                }
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error clearing offline map data:', error);
                alert(`Error clearing offline map data: ${message}`);
                return false;
            }
        };

        const section = createSectionHeader(dropdown, 'Trail data', true, '0 0 4px');

        regions.forEach((region) => {
            const regionPaths = files.filter((file) => file.region === region.key).map((file) => file.path);
            if (regionPaths.length === 0) return;

            const row = L.DomUtil.create('div', '', section.content);
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr auto';
            row.style.gap = '6px';
            row.style.alignItems = 'center';
            row.style.margin = '5px 0';

            const label = L.DomUtil.create('div', '', row);
            label.textContent = region.name;
            label.style.minWidth = '0';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.whiteSpace = 'nowrap';
            label.style.fontSize = '12px';

            const actionButton = createIconButton(row, region.name);
            regionActionButtons[region.key] = actionButton;

            const status = L.DomUtil.create('div', '', section.content);
            status.textContent = 'Not downloaded';
            status.style.margin = '-3px 30px 5px 0';
            status.style.color = '#666';
            status.style.fontSize = '11px';
            regionStatusElements[region.key] = status;

            L.DomEvent.on(actionButton, 'click', async (e: Event) => {
                L.DomEvent.stopPropagation(e);
                const statuses = await getMapDataCacheStatus(regionPaths);
                if (arePathsDownloaded(regionPaths, statuses)) {
                    if (await clearPaths(regionPaths, status)) {
                        trackEvent('offline_region_cleared', { region: region.key });
                    }
                    return;
                }
                if (await downloadPaths(regionPaths, status)) {
                    trackEvent('offline_region_downloaded', { region: region.key });
                }
            });
        });

        const basemapNote = L.DomUtil.create('div', '', dropdown);
        basemapNote.textContent = 'Offline basemaps are not available yet. Use the Offline base map with downloaded trail data.';
        basemapNote.style.marginTop = '8px';
        basemapNote.style.color = '#666';
        basemapNote.style.fontSize = '11px';
        basemapNote.style.lineHeight = '1.3';

        void refreshCacheStatuses();

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        const closeDropdown = () => {
            dropdown.style.display = 'none';
        };
        L.DomEvent.on(document as any, 'click', closeDropdown);

        return container;
    },
    onRemove: function () {
        const closeDropdown = () => {
            // No-op, handled in onAdd
        };
        L.DomEvent.off(document as any, 'click', closeDropdown);
    },
});

const Map = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<L.Map | null>(null);
    const drawControl = useRef<L.Control.Draw | null>(null);
    const drawnItems = useRef(new L.FeatureGroup());
    const userMarker = useRef<CustomMarker | null>(null);
    const [drawnFeatures, setDrawnFeatures] = useState<number[]>([]);
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [isTracking, setIsTracking] = useState(false);
    const watchId = useRef<number | null>(null);
    const hasIMU = useRef<boolean>('DeviceOrientationEvent' in window);

    console.log('Map: Component initialized, hasIMU:', hasIMU.current);

    const baseLayers = {
        OpenStreetMap: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
        }),
        OpenTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> contributors',
            maxZoom: 17,
        }),
        Satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© <a href="https://www.esri.com">Esri</a>',
            maxZoom: 19,
        }),
        Dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://carto.com">CARTO</a>',
            maxZoom: 19,
        }),
        Offline: L.tileLayer('', {
            attribution: 'Offline mode (GeoJSON only)',
            maxZoom: 19,
        }),
    };

    // Handle geolocation updates
    const handleGeolocation = (position: GeolocationPosition) => {
        console.log('Geolocation: Received position', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            heading: position.coords.heading,
            timestamp: position.timestamp,
        });
        const { latitude, longitude, heading } = position.coords;
        const timestamp = position.timestamp;
        setUserLocation((prev) => {
            const newHeading = heading !== null ? heading : prev?.heading || 0;
            return {
                latlng: new LatLng(latitude, longitude),
                heading: newHeading,
                timestamp,
            };
        });
    };

    // Handle geolocation errors
    const handleGeolocationError = (error: GeolocationPositionError) => {
        console.error('Geolocation: Error', { code: error.code, message: error.message });
        setIsTracking(false);
        setUserLocation(null);
        if (userMarker.current && map.current) {
            map.current.removeLayer(userMarker.current);
            userMarker.current = null;
        }
        switch (error.code) {
            case error.PERMISSION_DENIED:
                alert('Location access denied. Please enable location services.');
                break;
            case error.POSITION_UNAVAILABLE:
                alert('Location information is unavailable.');
                break;
            case error.TIMEOUT:
                alert('The request to get location timed out.');
                break;
            default:
                alert(`Geolocation error: ${error.message}`);
        }
    };

    // Handle device orientation for IMU data
    const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
        console.log('DeviceOrientation: Received event', {
            alpha: event.alpha,
            beta: event.beta,
            gamma: event.gamma,
        });
        let heading = event.alpha;
        if (heading !== null) {
            heading = (360 - heading) % 360; // Normalize to 0-360
            setUserLocation((prev) => {
                if (!prev) return prev;
                if (Math.abs(prev.heading - heading) < HEADING_THRESHOLD) return prev;
                console.log('DeviceOrientation: Updating heading', heading);
                return { ...prev, heading };
            });
        } else {
            console.warn('DeviceOrientation: No alpha value available');
        }
    };

    // Start tracking location and orientation
    const startTracking = async () => {
        console.log('startTracking: Initiating');
        if (!window.isSecureContext) {
            console.error('startTracking: Secure context required');
            alert('Geolocation requires a secure context (HTTPS or localhost).');
            setIsTracking(false);
            return;
        }
        if (!navigator.geolocation) {
            console.error('startTracking: Geolocation not supported');
            alert('Geolocation is not supported by this browser.');
            setIsTracking(false);
            return;
        }
        if ('permissions' in navigator) {
            try {
                const geoPermission = await navigator.permissions.query({ name: 'geolocation' });
                console.log('startTracking: Geolocation permission state', geoPermission.state);
                if (geoPermission.state === 'denied') {
                    console.error('startTracking: Geolocation permission denied');
                    alert('Location access is denied. Please enable location services.');
                    setIsTracking(false);
                    return;
                }
                if (hasIMU.current && 'DeviceOrientationEvent' in window && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                    try {
                        const orientationPermission = await (DeviceOrientationEvent as any).requestPermission();
                        console.log('startTracking: Orientation permission', orientationPermission);
                        if (orientationPermission !== 'granted') {
                            console.warn('startTracking: Device orientation permission denied');
                            hasIMU.current = false;
                        }
                    } catch (error) {
                        console.warn('startTracking: Error requesting orientation permission', error);
                        hasIMU.current = false;
                    }
                }
            } catch (error) {
                console.warn('startTracking: Permission query failed', error);
            }
        }

        console.log('startTracking: Starting watchPosition');
        watchId.current = navigator.geolocation.watchPosition(
            handleGeolocation,
            handleGeolocationError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: POLL_INTERVAL }
        );

        if (hasIMU.current) {
            console.log('startTracking: Adding deviceorientation listener');
            window.addEventListener('deviceorientation', handleDeviceOrientation);
        } else {
            console.log('startTracking: No IMU support, relying on GPS heading');
        }

        setIsTracking(true);
        console.log('startTracking: Tracking started, watchId:', watchId.current);
    };

    // Stop tracking location and orientation
    const stopTracking = () => {
        console.log('stopTracking: Initiating, watchId:', watchId.current);
        if (watchId.current !== null) {
            navigator.geolocation.clearWatch(watchId.current);
            watchId.current = null;
        }
        if (hasIMU.current) {
            window.removeEventListener('deviceorientation', handleDeviceOrientation);
        }
        setIsTracking(false);
        setUserLocation(null);
        if (userMarker.current && map.current) {
            map.current.removeLayer(userMarker.current);
            userMarker.current = null;
        }
        console.log('stopTracking: Tracking stopped');
    };

    // Update user marker on map
    useEffect(() => {
        if (!map.current || !userLocation) {
            console.log('UserLocation useEffect: No map or userLocation');
            return;
        }

        console.log('UserLocation useEffect: Updating marker', {
            lat: userLocation.latlng.lat,
            lng: userLocation.latlng.lng,
            heading: userLocation.heading,
        });

        if (!userMarker.current) {
            userMarker.current = L.marker(userLocation.latlng, {
                icon: iconMap.user,
            }).addTo(map.current);
            userMarker.current.bindPopup(`
                <b>Your Location</b><br>
                <b>Coordinates:</b> [${userLocation.latlng.lat.toFixed(6)}, ${userLocation.latlng.lng.toFixed(6)}]<br>
                <b>Heading:</b> ${userLocation.heading.toFixed(0)}°
            `);
            console.log('UserLocation useEffect: Created new marker');
        } else {
            userMarker.current.setLatLng(userLocation.latlng);
            userMarker.current.setRotationAngle?.(userLocation.heading);
            userMarker.current.setPopupContent(`
                <b>Your Location</b><br>
                <b>Coordinates:</b> [${userLocation.latlng.lat.toFixed(6)}, ${userLocation.latlng.lng.toFixed(6)}]<br>
                <b>Heading:</b> ${userLocation.heading.toFixed(0)}°
            `);
            console.log('UserLocation useEffect: Updated existing marker');
        }

        map.current.setView(userLocation.latlng, 15);
    }, [userLocation]);

    useEffect(() => {
        if (!mapContainer.current) return;

        console.log('Map useEffect: Initializing map');
        try {
            map.current = L.map(mapContainer.current, {
                center: [39, -98],
                zoom: 4,
                layers: [navigator.onLine ? baseLayers.OpenStreetMap : baseLayers.Offline, drawnItems.current],
                zoomControl: false,
                doubleClickZoom: false,
            });

            if (map.current) {
                map.current.addControl(new L.Control.Zoom({ position: 'topright' }));
                map.current.addControl(new LayersControl({ position: 'topleft', baseLayers } as LayersControlOptions));
                map.current.addControl(new DownloadsControl({ position: 'topleft' }));
                map.current.addControl(new AnnotateControl({ position: 'topleft', drawnItems: drawnItems.current } as AnnotateControlOptions));
                map.current.addControl(new UiToggleControl({ position: 'topleft' }));
                map.current.addControl(new LocationControl({ position: 'topright', onToggleTracking: () => {
                    console.log('LocationControl: Toggle tracking, current isTracking:', isTracking);
                    if (isTracking) {
                        stopTracking();
                    } else {
                        startTracking();
                    }
                }} as any));

                drawControl.current = new L.Control.Draw({
                    position: 'topleft',
                    draw: {
                        marker: { icon: iconMap.default },
                        polyline: { shapeOptions: { color: '#3388ff' } },
                        polygon: { shapeOptions: { color: '#3388ff' } },
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                    },
                    edit: { featureGroup: drawnItems.current, remove: true },
                });
                map.current.addControl(drawControl.current);

                map.current.on('draw:created', (e: L.LeafletEvent) => {
                    const event = e as any;
                    const layer = event.layer as L.Layer;
                    const featureId = L.stamp(layer);
                    drawnItems.current.addLayer(layer);
                    setDrawnFeatures((prev) => [...prev, featureId]);
                });

                map.current.on('draw:deleted', (e: L.LeafletEvent) => {
                    const event = e as any;
                    const deletedFeatureIds: number[] = [];
                    (event.layers as L.LayerGroup).eachLayer((layer: L.Layer) => {
                        deletedFeatureIds.push(L.stamp(layer));
                    });
                    setDrawnFeatures((prev) => prev.filter((id) => !deletedFeatureIds.includes(id)));
                });

                map.current.on('dblclick', (e: L.LeafletMouseEvent) => {
                    L.DomEvent.stop(e.originalEvent);
                    void queryFeaturesAt(map.current as LeafletMap, e);
                });

                map.current.invalidateSize();

                const handleResize = () => {
                    if (map.current) {
                        map.current.invalidateSize();
                    }
                };
                window.addEventListener('resize', handleResize);

                if (!navigator.onLine) {
                    alert('Offline mode: Only cached GeoJSON data is available. Select "Offline" layer for best experience.');
                }

                console.log('Map useEffect: Map initialized');
                return () => {
                    console.log('Map useEffect: Cleaning up');
                    window.removeEventListener('resize', handleResize);
                    document.body.classList.remove('openpct-ui-hidden');
                    if (map.current) map.current.remove();
                    stopTracking();
                };
            }
        } catch (error) {
            console.error('Map useEffect: Failed to initialize map', error);
        }
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (drawnFeatures.length > 0) {
                    const lastFeatureId = drawnFeatures[drawnFeatures.length - 1];
                    drawnItems.current.eachLayer((layer) => {
                        if (L.stamp(layer) === lastFeatureId) {
                            drawnItems.current.removeLayer(layer);
                        }
                    });
                    setDrawnFeatures((prev) => prev.slice(0, -1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [drawnFeatures]);

    return (
        <div className="map-wrapper">
            <div ref={mapContainer} className="map-container" />
            <div className="openpct-hide-hint">Press H or Esc to show controls</div>
            <img src="/favicon.svg" className="openpct-hidden-logo" alt="OpenPCT" />
        </div>
    );
};

export default Map;
