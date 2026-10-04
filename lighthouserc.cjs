/* Lighthouse budget (a step in .github/workflows/ci.yml; locally: npm run build:test && npm run lighthouse).
   Runs against the demo-mode build, one phone-sized run per page to keep Actions minutes low.
   Accessibility below 0.95 fails the build. Performance only warns: one run is noisy, so the budgets sit a little
   under the scores measured below. Raise them when the pages get faster. */
const PORT = Number(process.env.PORT) || 3100;
process.env.NODE_ENV = "test"; // the server lhci starts inherits this, so like the browser tests it ignores .env.local
// Measured 4 Oct 2026 (two runs, phone emulation): / 0.48-0.57, /epoch 0.47-0.51 (the 3D scene), the other three 0.66-0.79.
const PAGES = { "/": 0.45, "/epoch": 0.45, "/events/git-merge-26": 0.65, "/board": 0.65, "/learn": 0.65 }; // path → performance budget

module.exports = {
  ci: {
    collect: {
      startServerCommand: `npx next start -p ${PORT}`,
      startServerReadyPattern: "Ready",
      url: Object.keys(PAGES).map((p) => `http://localhost:${PORT}${p}`),
      numberOfRuns: 1,
      settings: { chromeFlags: "--headless=new --no-sandbox" },
    },
    assert: {
      assertMatrix: Object.entries(PAGES).map(([path, perf]) => ({
        matchingUrlPattern: `^http://localhost:${PORT}${path.replace(/\//g, "\\/")}$`,
        assertions: { "categories:accessibility": ["error", { minScore: 0.95 }], "categories:performance": ["warn", { minScore: perf }] },
      })),
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
