import { useEffect, useRef, useState } from 'react';
import L, { Control, ControlOptions, Icon, Map as LeafletMap, Marker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import 'leaflet-draw';
import 'leaflet-gpx';

// Configuration
const USE_GEOJSON = true;

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/leaflet/marker-icon-2x.png',
    iconUrl: '/leaflet/marker-icon.png',
    shadowUrl: '/leaflet/marker-shadow.png',
});

// Define custom icons for waypoint types
interface IconMap {
    [key: string]: Icon;
}

const iconMap: IconMap = {
    'Water Source': L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjMDA1NmIzIiBmaWxsLW9wYWNpdHk9IjAiIGQ9Ik0xMiA1YzAgMCA1IDYgNSA5YzAgMi43NiAtMi4yNCA1IC01IDVjLTIuNzYgMCAtNSAtMi4yNCAtNSAtNWMwIC0zIDUgLTkgNSAtOVoiPjxhbmltYXRlIGZpbGw9ImZyZWV6ZSIgYXR0cmlidXRlTmFtZT0iZmlsbC1vcGFjaXR5IiBiZWdpbj0iMC40cyIgZHVyPSIwLjE1cyIgdmFsdWVzPSIwOzAuMyIvPjwvcGF0aD48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMwMDU2YjMiIHN0cm9rZS1kYXNoYXJyYXk9IjIwIiBzdHJva2UtZGFzaG9mZnNldD0iMjAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTIgNWMwIDAgNSA2IDUgOWMwIDIuNzYgLTIuMjQgNSAtNSA1Ij48YW5pbWF0ZSBmaWxsPSJmcmVlemUiIGF0dHJpYnV0ZU5hbWU9InN0cm9rZS1kYXNob2Zmc2V0IiBkdXI9IjAuNHMiIHZhbHVlcz0iMjA7MCIvPjwvcGF0aD48cGF0aCBkPSJNMTIgNWMwIDAgLTUgNiAtNSA5YzAgMi43NiAyLjI0IDUgNSA1Ij48YW5pbWF0ZSBmaWxsPSJmcmVlemUiIGF0dHJpYnV0ZU5hbWU9InN0cm9rZS1kYXNob2Zmc2V0IiBkdXI9IjAuNHMiIHZhbHVlcz0iMjA7MCIvPjwvcGF0aD48L2c+PC9zdmc+',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    'Trail Junction': L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiM5MTkxOTEiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTE3IDExbDUtNWwtNS01bTUgNWgtNGE2IDYgMCAwIDAtNiA2djEyTTcgNmwtNSA1bDUgNW0tNS01aDRhNiA2IDAgMCAxIDYgNnY3Ii8+PC9zdmc+',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    'Paved Road': L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI1NzYiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNTc2IDUxMiI+PHBhdGggZmlsbD0iIzQyNDI0MiIgZD0iTTI1NiAzMmgtNzQuOGMtMjcuMSAwLTUxLjMgMTcuMS02MC4zIDQyLjZMMy4xIDQwNy4yYy0yIDUuOC0zLjEgMTItMy4xIDE4LjJDMCA0NTUuNSAyNC41IDQ4MCA1NC42IDQ4MEgyNTZ2LTY0YzAtMTcuNyAxNC4zLTMyIDMyLTMyczMzIDE0LjMgMzIgMzJ2NjRoMjAxLjRjMzAuMiAwIDU0LjYtMjQuNSA1NC42LTU0LjZjMC02LjItMS4xLTEyLjQtMy4xLTE4LjJMNDU1LjEgNzQuNkM0NDYgNDkuMSA0MjEuOSAzMiAzOTQuOCAzMkgzMjB2NjRjMCAxNy43LTE0LjMgMzItMzIgMzJzLTMyLTE0LjMtMzItMzJ6bTY0IDE5MnY2NGMwIDE3LjctMTQuMyAzMi0zMiAzMnMtMzItMTQuMy0zMi0zMnYtNjRjMC0xNy43IDE0LjMtMzIgMzItMzJzMzIgMT4LjMgMzIgMzIiLz48L3N2Zz4=',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    Campground: L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NDAiIGhlaWdodD0iNTEyIiB2aWV3Qm94PSIwIDAgNjQwIDUxMiI+PHBhdGggZmlsbD0iIzNjNjYzYyIgZD0iTTYyNCA0NDhoLTI0LjY4TDM1OS41NCAxMTcuNzVsNTMuNDEtNzMuNTVjNS4xOS03LjE1IDMuNjEtMTcuMTYtMy41NC0yMi4zNWwtMjUuOS0xOC43OWMtNy4xNS01LjE5LTE3LjE1LTMuNjEtMjIuMzUgMy41NUwzMjAgNjMuM0wyNzguODMgNi42Yy01LjE5LTcuMTUtMTUuMi04Ljc0LTIyLjM1LTMuNTVsLTI1Ljg4IDE4LjhjLTcuMTUgNS4xOS04Ljc0IDE1LjItMy41NCAyMi4zNWw1My40MSA3My41NUw0MC42OCA0NDhIMTZjLTguODQgMC0xNiA3LjE2LTE2IDE2djMyYzAgOC44NCA3LjE2IDE2IDE2IDE2aDYwOGM4Ljg0IDAgMTYtNy4xNiAxNi0xNnYtMzJjMC04Ljg0LTcuMTYtMTYtMTYtMTZNMzIwIDI4OGwxMTYuMzYgMTYwSDIwMy42NHoiLz48L3N2Zz4=',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    'Undeveloped Campsite': L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjNWU1MTNmIiBkPSJtMTUuOSAxOC41bDYgMS42bC0uNCAxLjlsLTkuNC0yLjVMMi43IDIybC0uNS0xLjlsNi0xLjZsLTYuMS0xLjZsLjUtMS45bDkuNCAyLjVsOS40LTIuNWwuNSAxLjl6bS4xNy0xMC41OGMtLjE2LS4yMi0uMzYtLjQyLS41Ny0uNTljLS40NS0uNDMtMS0uNzQtMS40NC0xLjJDMTMgNS4wOCAxMi43OSAzLjM0IDEzLjQ0IDJjLS42NS4xNy0xLjI2LjU0LTEuNzcuOTVDOS44NCA0LjQ2IDkuMTEgNy4xIDEwIDkuMzhjMCAuMDcuMDQuMTUuMDQuMjRjMCAuMTYtLjExLjMtLjI1LjM4YS41MS41MSAwIDAgMS0uNTctLjIzYy0uOC0xLjAzLS45My0yLjUxLS4zOC0zLjdjLTEuMTkuOTktMS44NCAyLjY1LTEuNzMgNC4yMmMuMDIuMzYuMDcuNzEuMTkgMS4wN2MuMTEuNDQuMjkuODcuNTIgMS4yNWMuNzUgMS4yNSAyLjA4IDIuMTUgMy41IDIuMzNjMS41Mi4yIDMuMTQtLjA5IDQuMzEtMS1xY2ljZmY0MS4zLTEuMiAxLjc3LTMuMTIgMS4wOC00LjY5bC0uMS0uMTdxLS4yMS0uNDk1LS41Ny0uOXptLTIuMjQgNC41NWMtLjIuMTgtLjUyLjM2LS43OC40NGMtLjc5LjI4LTEuNTktLjEyLTIuMDUtLjZjLjg0LS4yIDEuMzQtLjg0IDEuNS0xLjQ4Yy4xMS0uNTgtLjExLTEuMDUtLjIxLTEuNjFjLS4wOC0uNTMtLjA3LS45OS4xMy0xLjQ5Yy4xMy4yNy4yNy41NS40NC43N2MuNTUuNzIgMS40MSAxLjA0IDEuNTkgMmMuMDIuMTMuMDUuMjIuMDUuMzNjMCAuNi0uMjQgMS4yNC0uNjggMS42NCIvPjwvc3ZnPg==',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    Resupply: L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSJjdXJyZW50Q29sb3IiIGQ9Ik0xOSAxNWgtMnYtMmgybTAgNmgtMnYtMmgyTTEzIDdoLTJWNWgybTAgNmgtMlY5aDJtMCA2aC0ydi0yaDJtMCA2aC0ydi0yaDJtLTYtNkg1VjloMm0wIDZINXYtMmgybTAgNkg1di0yaDJtOC02VjVsLTMtM2wtMyAzdjJIM3YxNGgxOFYxMXoiLz48L3N2Zz4=',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    Landmark: L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjMzM0ZjJiIiBkPSJNNSAyMVY0aDlsLjQgMkgyMHYxMGgtN2wtLjQtMkg3djd6Ii8+PC9zdmc+',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24],
    }),
    default: L.icon({
        iconUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI4IDI0Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIyIiBkPSJNOCAxMmE0IDQgMCAxIDAgOCAwYTQgNCAwIDEgMC04IDAiLz48L3N2Zz4=',
        iconRetinaUrl:
            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZWRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI4IDI0Ij48cGF0aCBmaWxsPSJub25lIiBzdHJva2U9IiMwMDAiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIyIiBkPSJNOCAxMmE0IDQgMCAxIDAgOCAwYTQgNCAwIDEgMC04IDAiLz48L3N2Zz4=',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
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
            headers: { 'User-Agent': 'GrokMapApp/1.0 (contact: example@example.com)' },
        });
        if (!pointsResponse.ok) throw new Error(`Points API error: ${pointsResponse.status}`);
        const pointsData = await pointsResponse.json();
        const forecastUrl = pointsData.properties?.forecast;
        if (!forecastUrl) throw new Error('No forecast URL found');

        const forecastResponse = await fetch(forecastUrl, {
            headers: { 'User-Agent': 'GrokMapApp/1.0 (contact: example@example.com)' },
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

// Extend Marker to include note property
interface CustomMarker extends Marker {
    note?: string;
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
        button.style.backgroundImage =
            "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiLz48cGF0aCBmaWxsPSIjOTE5MTkxIiBkPSJtMTIgMjEuMDVsLTktN2wxLjY1LTEuMjVMMTIgMTguNWw3LjM1LTUuN0wyMSAxNC4wNXpNMTIgMTZMMyA5bDktN2w5IDd6Ii8+PC9zdmc+')";
        button.style.cursor = 'pointer';
        button.style.border = '1px solid #8AADB9';
        button.style.borderRadius = '2px';

        const dropdown = L.DomUtil.create('div', 'leaflet-control-layers-expanded', container);
        dropdown.style.minWidth = '150px';
        dropdown.style.maxWidth = '200px';
        dropdown.style.padding = '5px';
        dropdown.style.fontSize = '14px';
        dropdown.style.lineHeight = '1.5';
        dropdown.style.backgroundColor = '#fff';
        dropdown.style.border = '1px solid #8AADB9';
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

// LocationControl
const LocationControl = Control.extend({
    options: { position: 'topright' } as ControlOptions,
    onAdd: function (map: LeafletMap) {
        const container = L.DomUtil.create('div', 'leaflet-control leaflet-control-location');
        container.style.width = '32px';
        container.style.height = '30px';
        container.style.marginBottom = '2px';
        container.style.backgroundColor = '#fff';
        container.style.border = '1px solid #8AADB9';
        container.style.borderRadius = '4px';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage =
            "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiLz48ZyBmaWxsPSJub25lIiBzdHJva2U9IiM5MTkxOTEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMiAxMmgzbTE0IDBoM00xMiAydjNtMCAxNHYzIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNyIvPjwvZz48L3N2Zz4=')";
        button.style.backgroundSize = '24px 24px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        L.DomEvent.on(button, 'click', async (e: Event) => {
            L.DomEvent.stopPropagation(e);
            if (!window.isSecureContext) {
                alert('Geolocation requires a secure context (HTTPS or localhost).');
                return;
            }
            if ('permissions' in navigator) {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
                    if (permissionStatus.state === 'denied') {
                        alert('Location access is denied. Please enable location services in your browser or system settings.');
                        return;
                    }
                } catch (error: unknown) {
                    console.warn('Permission query failed:', error);
                }
            }
            if (!navigator.geolocation) {
                alert('Geolocation is not supported by this browser.');
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], 15);
                    const marker = L.marker([latitude, longitude]).addTo(map);
                    setTimeout(() => map.removeLayer(marker), 5000);
                },
                (error: GeolocationPositionError) => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            alert('Location access denied. Please enable location services in your browser or system settings.');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            alert('Location information is unavailable.');
                            break;
                        case error.TIMEOUT:
                            alert('The request to get location timed out.');
                            break;
                        default:
                            alert('An error occurred while retrieving location: ' + error.message);
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
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
        container.style.border = '1px solid #8AADB9';
        container.style.borderRadius = '4px';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage =
            "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiLz48cGF0aCBmaWxsPSIjOTE5MTkxIiBkPSJNNiAxNGgxMnYtMkg2em0wLTNoMTJWOUg2em0wLTNoMTJWNkg2ek00IDE4cS0uODI1IDAtMS40MTItLjU4N1QyIDE2VjRxMC0uODI1LjU4OC0xLjQxMlQ0IDJoMTZxLjgyNSAwIDEuNDEzLjU4OFQyMiA0djE4bC00LTR6Ii8+PC9zdmc+')";
        button.style.backgroundSize = '20px 20px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        let noteMode = false;

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            noteMode = !noteMode;
            button.style.backgroundColor = noteMode ? '#e0e0e0' : '#fff';
            map.getContainer().style.cursor = noteMode ? 'pointer' : 'grab';
            if (noteMode) alert('Click on the map to add a new waypoint with a note.');
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
        container.style.border = '1px solid #8AADB9';
        container.style.borderRadius = '4px';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '32px';
        button.style.height = '30px';
        button.style.backgroundImage =
            "url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cmVjdCB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIGZpbGw9Im5vbmUiLz48cGF0aCBmaWxsPSIjOTE5MTkxIiBkPSJtMTkuNiAyMWwtNi4zLTYuM3EtLjc1LjYtMS43MjUuOTVUOS41IDE2cS0yLjcyNSAwLTQuNjEyLTEuODg4VDMgOS41dDEuODg4LTQuNjEyVDkuNSAzdDQuNjEzIDEuODg4VDE2IDkuNXEwIDEuMS0uMzUgMi4wNzVUMTQuNyAxMy4zbDYuMyA2LjN6TTkuNSAxNHExLjg3NSAwIDMuMTg4LTEuMzEyVDE0IDkuNXQtMS4zMTItMy4xODdUOS41IDVUNi4zMTMgNi4zMTNUNSA5LjV0MS4zMTMgMy4xODhUOS41IDE0Ii8+PC9zdmc+')";
        button.style.backgroundSize = '20px 20px';
        button.style.backgroundPosition = 'center';
        button.style.backgroundRepeat = 'no-repeat';

        let queryMode = false;

        L.DomEvent.on(button, 'click', (e: Event) => {
            L.DomEvent.stopPropagation(e);
            queryMode = !queryMode;
            button.style.backgroundColor = queryMode ? '#e0e0e0' : '#fff';
            map.getContainer().style.cursor = queryMode ? 'pointer' : 'grab';
            if (queryMode) alert('Click on the map to find nearby features.');
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
                        { headers: { 'User-Agent': 'GrokMapApp/1.0 (contact: example@example.com)' } }
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
        container.style.border = '1px solid #8AADB9';
        container.style.borderRadius = '4px';
        container.style.cursor = 'pointer';

        const button = L.DomUtil.create('div', '', container);
        button.style.width = '72px';
        button.style.height = '30px';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.style.fontFamily = 'Arial, sans-serif';
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
        dropdown.style.border = '1px solid #8AADB9';
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
                                        style: { color: '#ff0000', weight: 4, opacity: 0.7 },
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
                            new L.GPX(path, {
                                async: true,
                                // marker_options: { startIcon: undefined, endIcon: undefined, shadow: undefined },
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
    const [drawnFeatures, setDrawnFeatures] = useState<number[]>([]);

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

    useEffect(() => {
        if (!mapContainer.current) return;

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
                map.current.addControl(new LocationControl());
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
                    const event = e as any; // Workaround for Leaflet-Draw type mismatch
                    const layer = event.layer as L.Layer;
                    const featureId = L.stamp(layer);
                    drawnItems.current.addLayer(layer);
                    setDrawnFeatures((prev) => [...prev, featureId]);
                });

                map.current.on('draw:deleted', (e: L.LeafletEvent) => {
                    const event = e as any; // Workaround for Leaflet-Draw type mismatch
                    const deletedFeatureIds: number[] = [];
                    (event.layers as L.LayerGroup).eachLayer((layer: L.Layer) => {
                        deletedFeatureIds.push(L.stamp(layer));
                    });
                    setDrawnFeatures((prev) => prev.filter((id) => !deletedFeatureIds.includes(id)));
                });

                // Ensure the map resizes correctly
                map.current.invalidateSize();

                // Handle window resize to update map size
                const handleResize = () => {
                    if (map.current) {
                        map.current.invalidateSize();
                    }
                };
                window.addEventListener('resize', handleResize);

                if (!navigator.onLine) {
                    alert('Offline mode: Only cached GeoJSON data is available. Select "Offline" layer for best experience.');
                }

                return () => {
                    window.removeEventListener('resize', handleResize);
                    if (map.current) map.current.remove();
                };
            }
        } catch (error) {
            console.error('Failed to initialize map:', error);
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