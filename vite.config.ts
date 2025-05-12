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
            name: 'openpct-pwa',
            short_name: 'openpct',
            description: 'progressive web app for open PCT data',
            theme_color: '#ffffff',
        },

        workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
            cleanupOutdatedCaches: true,
            clientsClaim: true,
        },

        devOptions: {
            enabled: true,
            navigateFallback: 'index.html',
            suppressWarnings: true,
            type: 'module',
        },
    })],
})