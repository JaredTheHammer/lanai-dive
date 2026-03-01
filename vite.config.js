import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Lanai Dive Conditions',
        short_name: 'LanaiDive',
        description: 'Real-time skin diving & spearfishing conditions for Lanai',
        theme_color: '#0c1929',
        background_color: '#0c1929',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,geojson}'],
        // Import push notification handler into the generated SW
        importScripts: ['/push-sw.js'],
        // SPA fallback: serve index.html for navigation requests when offline
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // NOAA tides, NWS weather, NDBC buoy (proxied through /api/)
            urlPattern: /\/api\/(tides|weather|buoy|erddap)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-local-proxy',
              expiration: { maxEntries: 30, maxAgeSeconds: 1800 }, // 30 min
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // Direct external API calls (production, no proxy)
            urlPattern: /^https:\/\/(api\.(tidesandcurrents\.noaa\.gov|weather\.gov)|www\.ndbc\.noaa\.gov)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-external',
              expiration: { maxEntries: 50, maxAgeSeconds: 1800 },
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            // CartoDB map tiles
            urlPattern: /^https:\/\/basemaps\.cartocdn\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 500, maxAgeSeconds: 604800 } // 7 days
            }
          },
          {
            // MapLibre GL JS / style resources
            urlPattern: /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cdn-assets',
              expiration: { maxEntries: 30, maxAgeSeconds: 2592000 } // 30 days
            }
          }
        ]
      }
    })
  ],
  server: {
    proxy: {
      '/api/tides': {
        target: 'https://api.tidesandcurrents.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/tides/, '/api/prod/datagetter')
      },
      '/api/weather': {
        target: 'https://api.weather.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
        headers: { 'User-Agent': '(lanai-dive, jared.m.hamm@gmail.com)' }
      },
      '/api/buoy': {
        target: 'https://www.ndbc.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/buoy/, '/data/realtime2')
      },
      '/api/erddap': {
        target: 'https://pae-paha.pacioos.hawaii.edu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/erddap/, '/erddap')
      }
    }
  }
});
