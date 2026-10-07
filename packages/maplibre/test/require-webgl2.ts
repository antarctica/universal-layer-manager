if (document.createElement('canvas').getContext('webgl2') === null) {
  throw new Error('WebGL2 is unavailable in the test browser, so MapLibre cannot draw. Check the Chromium launch flags in vite.config.ts.');
}
