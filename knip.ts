import { KnipConfig } from "knip";

export default {
    entry: [
        "src/vector/index.ts",
        "src/serviceworker/index.ts",
        "src/workers/*.worker.ts",
        "src/utils/exportUtils/exportJS.js",
        "scripts/**",
        "playwright/**",
        "test/**",
        "res/decoder-ring/**",
    ],
    project: ["**/*.{js,ts,jsx,tsx}"],
    ignore: [
        "docs/**",
        "res/jitsi_external_api.min.js",
        // Used by jest
        "__mocks__/maplibre-gl.js",
        // Keep for now
        "src/hooks/useLocalStorageState.ts",
        "src/components/views/elements/InfoTooltip.tsx",
        "src/components/views/elements/StyledCheckbox.tsx",
        // VERJI - Ignore the following: TechDebt re-implement the following
        "src/dispatcher/payloads/OpenReportEventDialogPayload.ts", // Due to report event not exposed in Verji - keep this on ignored, in case we want to use it later.
        "src/SecurityManager.ts",
        // VERJI - Ignore webpack config because we have to polyfill some dependencies
        ".webpack.config.js",
    ],
    ignoreDependencies: [
        // Required for `action-validator`
        "@action-validator/*",
        // Used for git pre-commit hooks
        "husky",
        // Used by jest
        "babel-jest",
        // Used by babel
        "@babel/runtime",
        "@babel/plugin-transform-class-properties",
        // Referenced in PCSS
        "github-markdown-css",
        // False positive
        "sw.js",
        // Used by webpack
        //"buffer",
        "process",
        "util",
        // Used by workflows
        "ts-prune",
        // Required due to bug in bloom-filters https://github.com/Callidon/bloom-filters/issues/75
        "@types/seedrandom",
        // Verji ignore dependencies used in verji-modules
        "browserify",
        "rss-parser",
        "https-browserify",
        "timers-browserify",
        "stream-browserify",
    ],
    ignoreBinaries: [
        // Used in scripts & workflows
        "jq",
    ],
    ignoreExportsUsedInFile: true,
} satisfies KnipConfig;
