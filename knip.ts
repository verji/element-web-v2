import { KnipConfig } from "knip";

export default {
    entry: [
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
        // Keep for now
        "src/hooks/useLocalStorageState.ts",
        "src/components/views/elements/InfoTooltip.tsx",
        "src/components/views/elements/StyledCheckbox.tsx",
        // Side-effect module loaded via require() in src/vector/index.ts; knip can't follow CJS require
        "src/vector/localstorage-fix.ts",
        // VERJI - Ignore the following: TechDebt re-implement the following
        "src/dispatcher/payloads/OpenReportEventDialogPayload.ts", // Due to report event not exposed in Verji - keep this on ignored, in case we want to use it later.
        "src/SecurityManager.ts",
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
        // Types for `katex` (used in HtmlUtils.tsx); knip doesn't link @types/* to runtime usage here
        "@types/katex",
        // Used at runtime by `webpack serve` in the start:js script
        "webpack-dev-server",
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
        // `yarn list` subcommand in end-to-end-tests.yaml — knip parses `list` as a binary
        "list",
    ],
    ignoreExportsUsedInFile: true,
    // Recognize `@public` JSDoc tag to keep Verji-retained exports without callers (see FormattingUtils.ts).
    tags: ["+public"],
} satisfies KnipConfig;
