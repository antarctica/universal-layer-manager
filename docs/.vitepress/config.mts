import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const repo = 'https://github.com/antarctica/universal-layer-manager';
const site = 'https://antarctica.github.io/universal-layer-manager/';

export default withMermaid(defineConfig({
  title: 'Universal Layer Manager',
  description: 'A state-machine-powered layer management library for map applications.',
  base: '/universal-layer-manager/',
  cleanUrls: true,
  lastUpdated: true,
  head: [['link', { rel: 'icon', href: '/universal-layer-manager/logo.svg' }]],
  sitemap: { hostname: site },
  // mermaid 11.17 added fastdom, which vitepress-plugin-mermaid does not pre-bundle
  vite: { optimizeDeps: { include: ['fastdom', 'fastdom/extensions/fastdom-promised.js'] } },
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Reference', link: '/reference/core' },
      {
        text: 'Examples',
        items: [
          { text: 'About the examples', link: '/examples' },
          { text: 'Simple (live)', link: `${site}examples/simple/`, target: '_self' },
          { text: 'Leaflet (live)', link: `${site}examples/leaflet/`, target: '_self' },
          { text: 'Leaflet XState (live)', link: `${site}examples/leaflet-xstate/`, target: '_self' },
          { text: 'MapLibre (live)', link: `${site}examples/maplibre/`, target: '_self' },
        ],
      },
      { text: 'Changelog', link: '/changelog' },
    ],
    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'Installation', link: '/installation' },
          { text: 'Getting started', link: '/getting-started' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Layers and groups', link: '/layers-and-groups' },
          { text: 'Visibility and opacity', link: '/visibility-and-opacity' },
          { text: 'Ordering and moving', link: '/ordering' },
        ],
      },
      {
        text: 'Adapters',
        items: [
          { text: 'About adapters', link: '/adapters/' },
          { text: 'Leaflet', link: '/adapters/leaflet' },
          { text: 'MapLibre', link: '/adapters/maplibre' },
          { text: 'ArcGIS', link: '/adapters/arcgis' },
          { text: 'Writing an adapter', link: '/adapters/writing-an-adapter' },
        ],
      },
      {
        text: 'Going further',
        items: [
          { text: 'Working with XState', link: '/xstate' },
          { text: 'Examples', link: '/examples' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: '@ulm/core', link: '/reference/core' },
          { text: '@ulm/leaflet', link: '/reference/leaflet' },
          { text: '@ulm/maplibre', link: '/reference/maplibre' },
          { text: '@ulm/arcgis', link: '/reference/arcgis' },
        ],
      },
      {
        text: 'Developers',
        items: [
          { text: 'Contributing', link: '/contributing' },
          { text: 'Changelog', link: '/changelog' },
          { text: 'License', link: '/license' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: { pattern: `${repo}/edit/main/docs/:path` },
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 British Antarctic Survey',
    },
  },
}));
