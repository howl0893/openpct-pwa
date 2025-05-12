import { useEffect, useRef, useState } from 'react';
import L, { Control, ControlOptions, Icon, Map as LeafletMap, Marker, LatLng } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import {GPX} from 'leaflet-gpx';
import './Map.css';

// Configuration
const USE_GEOJSON = true;
const POLL_INTERVAL = 3000; // Poll GPS every 5 seconds
const HEADING_THRESHOLD = 1; // Minimum heading change (degrees) to update marker

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
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

// LayersControl
interface LayersControlOptions extends ControlOptions {
    baseLayers: { [key: string]: L.TileLayer };
}

const LayersControl = Control.extend({
    options: { position: 'topright', baseLayers: {} } as LayersControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-layers');
        container.style.width = '32px';
        container.style.minWidth = '34px';
        container.style.marginBottom = '2px';

        const button = L.DomUtil.create('div', 'leaflet-control-layers-toggle', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage = "url('/icons/layers.svg')";
        button.style.cursor = 'pointer';
        button.style.borderRadius = '2px';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-layers-expanded', container);
        dropdown.style.minWidth = '150px';
        dropdown.style.maxWidth = '200px';
        dropdown.style.padding = '5px';
        dropdown.style.fontSize = '14px';
        dropdown.style.lineHeight = '1.5';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        dropdown.style.borderRadius = '4px';
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.right = '40px';
        dropdown.style.top = '0px';
        dropdown.style.cursor = 'pointer';

        const layers = [
            { name: 'OpenStreetMap', layer: this.options.baseLayers.OpenStreetMap },
            { name: 'OpenTopoMap', layer: this.options.baseLayers.OpenTopoMap },
            { name: 'Satellite', layer: this.options.baseLayers.Satellite },
            { name: 'Dark', layer: this.options.baseLayers.Dark },
            { name: 'Offline', layer: this.options.baseLayers.Offline },
        ];

        layers.forEach(({ name, layer }) => {
            const label = L.DomUtil.create('label', '', dropdown);
            label.style.display = 'block';
            label.style.margin = '2px 0';
            label.style.whiteSpace = 'nowrap';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.cursor = 'pointer';

            const input = L.DomUtil.create('input', '', label);
            input.type = 'radio';
            input.name = 'leaflet-base-layers';
            input.value = name;
            input.checked = map.hasLayer(layer);
            input.style.marginRight = '5px';

            const span = L.DomUtil.create('span', '', label);
            span.textContent = name;

            L.DomEvent.on(input, 'change', () => {
                layers.forEach(({ layer }) => {
                    if (map.hasLayer(layer)) map.removeLayer(layer);
                });
                map.addLayer(layer);
                dropdown.style.display = 'none';
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

// NoteControl
interface NoteControlOptions extends ControlOptions {
    drawnItems?: L.FeatureGroup;
}

const NoteControl = Control.extend({
    options: { position: 'topright', drawnItems: new L.FeatureGroup() } as NoteControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-note');
        container.style.width = '32px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage = "url('/icons/comment.svg')";
        button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        button.style.borderRadius = '2px';
        button.style.backgroundSize = '20px 20px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        let noteMode = false;

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            noteMode = !noteMode;
            button.style.backgroundColor = noteMode ? '#e0e0e0' : '#fff';
            map.getContainer().style.cursor = noteMode ? 'pointer' : 'grab';
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
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
                button.style.backgroundColor = '#fff';
                map.getContainer().style.cursor = 'grab';
            }
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        return container;
    },
});

// QueryFeaturesControl
const QueryFeaturesControl = Control.extend({
    options: { position: 'topright' } as ControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-query');
        container.style.width = '32px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage = "url('/icons/search.svg')";
        button.style.borderRadius = '2px';
        button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        button.style.backgroundSize = '20px 20px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        let queryMode = false;

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            queryMode = !queryMode;
            button.style.backgroundColor = queryMode ? '#e0e0e0' : '#fff';
            map.getContainer().style.cursor = queryMode ? 'pointer' : 'grab';
        });

        map.on('click', async (e: L.LeafletMouseEvent) => {
            if (queryMode) {
                if (!navigator.onLine) {
                    L.popup()
                        .setLatLng(e.latlng)
                        .setContent('<b>Query Features</b><br>Feature query unavailable offline.')
                        .openOn(map);
                    queryMode = false;
                    button.style.backgroundColor = '#fff';
                    map.getContainer().style.cursor = 'grab';
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
            Click on the map to find nearby features.<br><br>
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
                queryMode = false;
                button.style.backgroundColor = '#fff';
                map.getContainer().style.cursor = 'grab';
            }
        });

        L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'dblclick', L.DomEvent.stopPropagation);
        L.DomEvent.on(container, 'mousedown', L.DomEvent.stopPropagation);

        return container;
    },
});

// LoadMapControl
const LoadMapControl = Control.extend({
    options: { position: 'topleft' } as ControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-loadmap');
        container.style.width = '72px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.cursor = 'pointer';
        container.style.top = '50px';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '72px';
        button.style.height = '30px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontFamily = 'Arial, sans-serif';
        button.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        button.style.borderRadius = '2px';
        button.style.fontSize = '12px';
        button.style.color = '#333';
        button.textContent = 'Load Data';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-loadmap-expanded', container);
        dropdown.style.minWidth = '150px';
        dropdown.style.maxWidth = '200px';
        dropdown.style.padding = '5px';
        dropdown.style.fontSize = '14px';
        dropdown.style.lineHeight = '1.5';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.border = '2px solid rgba(60, 60, 60, 0.5)';
        dropdown.style.borderRadius = '4px';
        dropdown.style.display = 'none';
        dropdown.style.position = 'absolute';
        dropdown.style.left = '76px';
        dropdown.style.top = '0px';
        dropdown.style.cursor = 'pointer';

        const gpxFiles = [{ name: 'Washington', path: '/gpx/Washington.gpx' }];

        const geojsonFiles = [
            { name: "Halfmile's WA Trail Notes", path: '/geojson/halfmile/wa.geojson' },
            { name: 'Washington', path: '/geojson/trail/wa.geojson' },
            { name: 'Oregon', path: '/geojson/trail/or.geojson' },
            { name: 'North California', path: '/geojson/trail/nocal.geojson' },
            { name: 'South California', path: '/geojson/trail/socal.geojson' },
        ];

        const files = USE_GEOJSON ? geojsonFiles : gpxFiles;
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

        files.forEach(({ name, path }) => {
            const label = L.DomUtil.create('label', '', dropdown);
            label.style.display = 'block';
            label.style.margin = '2px 0';
            label.style.whiteSpace = 'nowrap';
            label.style.overflow = 'hidden';
            label.style.textOverflow = 'ellipsis';
            label.style.cursor = 'pointer';

            const input = L.DomUtil.create('input', '', label);
            input.type = 'checkbox';
            input.name = 'leaflet-layers';
            input.value = path;
            input.style.marginRight = '5px';

            const span = L.DomUtil.create('span', '', label);
            span.textContent = name;

            L.DomEvent.on(input, 'change', () => {
                if (input.checked) {
                    try {
                        if (USE_GEOJSON) {
                            fetch(path)
                                .then((res) => {
                                    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
                                    return res.json();
                                })
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
                                                console.warn('Skipping popup for invalid feature:', feature);
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
                                })
                                .catch((error: unknown) => {
                                    const message = error instanceof Error ? error.message : 'Unknown error';
                                    console.error('Error loading GeoJSON:', error, path);
                                    alert(`Error loading GeoJSON file: ${message}`);
                                    input.checked = false;
                                });
                        } else {
                            new GPX(path, {
                                async: true,
                                polyline_options: { color: '#ff0000', weight: 4, opacity: 0.7 },
                            })
                                .on('loaded', (e: L.LeafletEvent) => {
                                    const layer = e.target;
                                    loadedLayers[path] = layer;
                                    map.addLayer(layer);
                                    updateMapBounds();
                                })
                                .on('error', (e: any) => {
                                    alert(`Failed to load GPX file: ${e.message || 'Unknown error'}`);
                                    input.checked = false;
                                });
                        }
                    } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : 'Unknown error';
                        console.error('Error loading file:', error, path);
                        alert(`Error loading file: ${message}`);
                        input.checked = false;
                    }
                } else {
                    if (loadedLayers[path]) {
                        map.removeLayer(loadedLayers[path]);
                        delete loadedLayers[path];
                        updateMapBounds();
                    }
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
            });

            if (map.current) {
                map.current.addControl(new L.Control.Zoom({ position: 'topright' }));
                map.current.addControl(new LayersControl({ position: 'topright', baseLayers } as LayersControlOptions));
                map.current.addControl(new LocationControl({ position: 'topright', onToggleTracking: () => {
                    console.log('LocationControl: Toggle tracking, current isTracking:', isTracking);
                    if (isTracking) {
                        stopTracking();
                    } else {
                        startTracking();
                    }
                }} as any));
                map.current.addControl(new NoteControl({ drawnItems: drawnItems.current } as NoteControlOptions));
                map.current.addControl(new QueryFeaturesControl());
                map.current.addControl(new LoadMapControl());

                drawControl.current = new L.Control.Draw({
                    position: 'topright',
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
        </div>
    );
};

export default Map;