// Settings for Mozilla's web-ext tool (npm run lint / build / sign / start).
export default {
  sourceDir: "src",
  artifactsDir: "dist",
  build: {
    filename: "markdown-meeting-viewer-{version}.zip",
  },
  run: {
    startUrl: ["about:debugging#/runtime/this-firefox"],
  },
};
