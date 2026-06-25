import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        allowedHosts: ["localhost", ".ngrok-free.app"]
    },
    plugins: [react(), VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',

        pwaAssets: {
            disabled: false,
            config: true,
        },

        manifest: {
            name: 'OpenPCT',
            short_name: 'OpenPCT',
            description: 'Progressive web app for open Pacific Crest Trail data',
            start_url: '/',
            scope: '/',
            display: 'standalone',
            orientation: 'any',
            theme_color: '#ffffff',
            background_color: '#ffffff',
            icons: [
                {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                },
                {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                },
                {
                    src: '/maskable-icon-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                },
            ],
        },

        workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,json,webmanifest}'],
            runtimeCaching: [
                {
                    urlPattern: ({ request }) => {
                        const url = request.url.split('?')[0];
                        return url.includes('/geojson/') && url.endsWith('.geojson');
                    },
                    handler: 'CacheFirst',
                    options: {
                        cacheName: 'openpct-map-data-v1',
                        cacheableResponse: {
                            statuses: [0, 200],
                        },
                        expiration: {
                            maxEntries: 60,
                            purgeOnQuotaError: true,
                        },
                    },
                },
            ],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
            skipWaiting: true,
        },

        devOptions: {
            enabled: true,
            navigateFallback: 'index.html',
            suppressWarnings: true,
            type: 'module',
        },
    })],
})
