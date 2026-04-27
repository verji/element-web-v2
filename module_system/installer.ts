/*
Copyright 2022-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import * as fs from "fs";
import * as childProcess from "child_process";
import * as semver from "semver";
// Verji - crypto + path used by the install-cache short-circuit below
import * as crypto from "crypto";
import * as path from "path";

import { type BuildConfig } from "./BuildConfig";

// This expects to be run from ./scripts/install.ts

const moduleApiDepName = "@matrix-org/react-sdk-module-api";

const MODULES_TS_HEADER = `
/*
 * THIS FILE IS AUTO-GENERATED
 * You can edit it you like, but your changes will be overwritten,
 * so you'd just be trying to swim upstream like a salmon.
 * You are not a salmon.
 */

import { RuntimeModule } from "@matrix-org/react-sdk-module-api/lib/RuntimeModule";
import { ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";

type ModuleConstructor = new (api: ModuleApi) => RuntimeModule;
`;
const MODULES_TS_DEFINITIONS = `
export const INSTALLED_MODULES: ModuleConstructor[] = [];
`;

// Verji Start: install-cache short-circuit. On Windows, `yarn add -O file:...`
// Verji        of the @verji/* modules takes ~1 hour per run, and is the
// Verji        dominant cost of every `yarn start`. We compute a fingerprint
// Verji        over the module list + each module's package.json + each
// Verji        module's lib/ mtimes; if it matches the last successful
// Verji        install's fingerprint AND node_modules/@verji and src/modules.ts
// Verji        exist, we skip `yarn add` entirely and just regenerate
// Verji        src/modules.ts from the cached installed-module list.
// Verji        See docs/Verji/DevLoopWindows.md §6.
const VERJI_CACHE_PATH = "./node_modules/.verji-install-cache.json";
const VERJI_CACHE_VERSION = 1;

type VerjiInstallCache = {
    version: number;
    fingerprint: string;
    installedModules: string[];
};

function latestMtimeIn(dir: string): number {
    let latest = 0;
    try {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                latest = Math.max(latest, latestMtimeIn(full));
            } else {
                latest = Math.max(latest, fs.statSync(full).mtimeMs);
            }
        }
    } catch {
        /* directory missing or unreadable — contribute zero */
    }
    return latest;
}

function computeVerjiInstallFingerprint(config: BuildConfig): string {
    const hash = crypto.createHash("sha256");
    hash.update(JSON.stringify(config.modules));
    for (const ref of config.modules ?? []) {
        const m = ref.match(/^file:(.+)$/);
        if (m) {
            const modDir = path.resolve(m[1]);
            const pkgPath = path.join(modDir, "package.json");
            if (fs.existsSync(pkgPath)) hash.update(fs.readFileSync(pkgPath));
            hash.update(String(latestMtimeIn(path.join(modDir, "lib"))));
        }
    }
    return hash.digest("hex");
}

function loadVerjiInstallCache(): VerjiInstallCache | null {
    try {
        const raw = fs.readFileSync(VERJI_CACHE_PATH, "utf-8");
        const parsed = JSON.parse(raw) as VerjiInstallCache;
        if (parsed.version !== VERJI_CACHE_VERSION) return null;
        return parsed;
    } catch {
        return null;
    }
}

function writeVerjiInstallCache(cache: VerjiInstallCache): void {
    try {
        fs.writeFileSync(VERJI_CACHE_PATH, JSON.stringify(cache, null, 2), "utf-8");
    } catch (err) {
        console.warn("Verji installer: failed to write install cache:", err);
    }
}

function writeModulesTsFor(installedModules: string[]): void {
    let modulesTsHeader = MODULES_TS_HEADER;
    let modulesTsDefs = MODULES_TS_DEFINITIONS;
    let index = 0;
    for (const moduleName of installedModules) {
        const importName = `Module${++index}`;
        modulesTsHeader += `import ${importName} from "${moduleName}";\n`;
        modulesTsDefs += `INSTALLED_MODULES.push(${importName});\n`;
    }
    writeModulesTs(modulesTsHeader + modulesTsDefs);
}

// Verji - runtime guards that abort before yarn add runs if we detect
// Verji   conditions that cause yarn v1 to recursively pack a workspace
// Verji   sibling into its cache (7 GB+ per attempt, grows unboundedly).
// Verji   See docs/Verji/VerjiModules.md §"Issues we uncovered".
function verjiGuardAgainstRecursion(config: BuildConfig): void {
    const problems: string[] = [];

    // Z. Self-reference check — element-web-v2's OWN package.json declaring itself
    //    as a dep. This was the actual root cause of the week-long debugging saga
    //    in April 2026: a leftover `"element-web": "file:../element-web-v2"` entry
    //    in element-web-v2's own devDependencies caused every `yarn install` to
    //    recursively install element-web inside element-web inside element-web,
    //    producing the 7 GB cache entries and BSODs. Catch this regression first
    //    because it's the most expensive failure mode if it slips through.
    try {
        const ownPkg = JSON.parse(fs.readFileSync("./package.json", "utf-8"));
        const ownName = ownPkg.name;
        if (typeof ownName === "string" && ownName.length > 0) {
            for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
                const sectionDeps = (ownPkg[section] ?? {}) as Record<string, string>;
                if (ownName in sectionDeps) {
                    problems.push(
                        `[Z] element-web-v2/package.json declares its own name "${ownName}" in \`${section}\` ` +
                            `with spec "${sectionDeps[ownName]}". This is a self-reference that yarn v1 will ` +
                            `try to satisfy by recursively installing the project inside itself, producing ` +
                            `unbounded recursive packing into the yarn cache (~7 GB per attempt, fills disks, ` +
                            `causes BSODs). Remove the entry. See docs/Verji/VerjiModules.md §"The actual root cause".`,
                    );
                }
            }
        }
    } catch {
        /* couldn't read own manifest — let yarn surface that error itself */
    }

    // A. Manifest check — each file: dep's package.json.
    for (const ref of config.modules ?? []) {
        const m = ref.match(/^file:(.+)$/);
        if (!m) continue;
        const modDir = path.resolve(m[1]);
        const pkgPath = path.join(modDir, "package.json");
        if (!fs.existsSync(pkgPath)) continue;
        let pkg: Record<string, unknown>;
        try {
            pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        } catch {
            continue;
        }
        const deps = (pkg.dependencies ?? {}) as Record<string, string>;
        const peerDeps = (pkg.peerDependencies ?? {}) as Record<string, string>;
        // element-web cannot live in `dependencies` or `peerDependencies` — both
        // trigger yarn v1's recursive self-packing when the consuming project
        // also has `name: "element-web"`. peerDep triggers because yarn resolves
        // the peer by `name` against the current project and treats it as a
        // link-protocol satisfier. Must be in `devDependencies` only (or absent).
        if ("element-web" in deps) {
            problems.push(
                `[A] ${path.basename(modDir)}: declares "element-web": "${deps["element-web"]}" in \`dependencies\`. ` +
                    `This causes yarn v1 to recursively pack element-web into its cache ` +
                    `(7 GB+ per attempt, grows unboundedly). Move it to \`devDependencies\` (not ` +
                    `\`peerDependencies\` — that also triggers the same bug). See docs/Verji/VerjiModules.md §Part B.`,
            );
        }
        if ("element-web" in peerDeps) {
            problems.push(
                `[A] ${path.basename(modDir)}: declares "element-web": "${peerDeps["element-web"]}" in \`peerDependencies\`. ` +
                    `This *also* causes yarn v1 to recursively pack element-web (verified with depth-5 nesting ` +
                    `on a 7 GB cache entry). Remove the entry entirely — the runtime dependency on element-web ` +
                    `is handled by the webpack alias in element-web-v2/webpack.config.js; documenting it as a ` +
                    `peerDep adds nothing functional and triggers the bug. See docs/Verji/VerjiModules.md.`,
            );
        }
        for (const [depName, depSpec] of Object.entries(deps)) {
            if (depName === "element-web") continue; // already flagged above
            if (typeof depSpec === "string" && depSpec.startsWith("link:")) {
                const linkPath = depSpec.slice("link:".length);
                const resolvedTarget = path.resolve(modDir, linkPath);
                const workspaceRoot = path.resolve(modDir, "..");
                if (resolvedTarget === workspaceRoot || resolvedTarget.startsWith(workspaceRoot + path.sep)) {
                    problems.push(
                        `[A] ${path.basename(modDir)}: declares "${depName}": "${depSpec}" in \`dependencies\`. ` +
                            `This is a workspace-sibling \`link:\` reference that may trigger the same ` +
                            `recursive-packing failure mode as the element-web case. Move it to ` +
                            `\`devDependencies\`.`,
                    );
                }
            }
        }
    }

    // B1. Residue check — orphan `npm-element-web-*` cache entries from prior recursive packing.
    const yarnCacheV6 = process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "Yarn", "Cache", "v6")
        : null;
    if (yarnCacheV6 && fs.existsSync(yarnCacheV6)) {
        try {
            const orphans = fs.readdirSync(yarnCacheV6).filter((name) => /^npm-element-web-/.test(name));
            if (orphans.length > 0) {
                problems.push(
                    `[B] Found ${orphans.length} orphan \`npm-element-web-*\` cache entr${orphans.length === 1 ? "y" : "ies"} in ${yarnCacheV6}. ` +
                        `Residue from a prior recursive-packing run; will grow unboundedly if install continues. ` +
                        `Clean it up (see docs/Verji/VerjiModules.md §"What to check if issues recur") before retrying.`,
                );
            }
        } catch {
            /* unreadable cache — skip */
        }
    }

    // B2. Residue check — recursive @verji/<mod>/node_modules/element-web/node_modules/element-web nesting.
    const verjiDir = path.resolve("./node_modules/@verji");
    if (fs.existsSync(verjiDir)) {
        try {
            for (const mod of fs.readdirSync(verjiDir)) {
                const nestedPath = path.join(
                    verjiDir,
                    mod,
                    "node_modules",
                    "element-web",
                    "node_modules",
                    "element-web",
                );
                if (fs.existsSync(nestedPath)) {
                    problems.push(
                        `[B] Recursive element-web nesting detected at ${nestedPath}. ` +
                            `This is the exact failure mode that caused 7 GB cache entries and disk exhaustion. ` +
                            `Run \`yarn verji:prestart\` to clean and retry.`,
                    );
                    break;
                }
            }
        } catch {
            /* unreadable — skip */
        }
    }

    if (problems.length > 0) {
        console.error(
            "Verji installer: ABORT — detected conditions that cause yarn v1 to recursively pack element-web:",
        );
        for (const p of problems) {
            console.error("  " + p);
        }
        console.error("");
        console.error("See docs/Verji/VerjiModules.md for the full explanation and fixes.");
        process.exit(1);
    }
}
// Verji End

export function installer(config: BuildConfig): void {
    if (!config.modules?.length) {
        // nothing to do
        writeModulesTs(MODULES_TS_HEADER + MODULES_TS_DEFINITIONS);
        return;
    }

    // Verji Start: short-circuit if module set + content unchanged since last successful install.
    const fingerprint = computeVerjiInstallFingerprint(config);
    const cached = loadVerjiInstallCache();
    const verjiDirExists = fs.existsSync("./node_modules/@verji");
    const modulesTsExists = fs.existsSync("./src/modules.ts");
    if (cached && cached.fingerprint === fingerprint && verjiDirExists && modulesTsExists) {
        console.log("Verji installer: fingerprint matches last successful install — skipping yarn add.");
        console.log("Verji installer: reusing modules:", cached.installedModules);
        writeModulesTsFor(cached.installedModules);
        console.log("Verji installer: done (short-circuited).");
        return;
    }
    if (cached) {
        console.log("Verji installer: fingerprint changed since last install — running full yarn add.");
    } else {
        console.log("Verji installer: no install cache yet — running full yarn add.");
    }
    // Verji End

    let exitCode = 0;

    // We cheat a bit and store the current package.json and lockfile so we can safely
    // run `yarn add` without creating extra committed files for people. We restore
    // these files by simply overwriting them when we're done.
    const packageDeps = readCurrentPackageDetails();

    // Record which optional dependencies there are currently, if any, so we can exclude
    // them from our "must be a module" assumption later on.
    const currentOptDeps = getOptionalDepNames(packageDeps.packageJson);

    // Verji - abort early if any module manifest shape or residual workspace
    // Verji   state would trigger yarn v1's recursive self-packing.
    verjiGuardAgainstRecursion(config);

    try {
        // Install the modules with yarn
        const yarnAddRef = config.modules!.join(" ");
        callYarnAdd(yarnAddRef); // install them all at once

        // Grab the optional dependencies again and exclude what was there already. Everything
        // else must be a module, we assume.
        const pkgJsonStr = fs.readFileSync("./package.json", "utf-8");
        const optionalDepNames = getOptionalDepNames(pkgJsonStr);
        const installedModules = optionalDepNames.filter((d) => !currentOptDeps.includes(d));
        // Verji - this flag is something we have implemented
        if (!config.skip_module_dependency_version_check) {
            // Ensure all the modules are compatible. We check them all and report at the end to
            // try and save the user some time debugging this sort of failure.
            const ourApiVersion = getTopLevelDependencyVersion(moduleApiDepName);
            const incompatibleNames: string[] = [];
            for (const moduleName of installedModules) {
                const modApiVersion = getModuleApiVersionFor(moduleName);
                if (!isModuleVersionCompatible(ourApiVersion, modApiVersion)) {
                    incompatibleNames.push(moduleName);
                }
            }
            if (incompatibleNames.length > 0) {
                console.error(
                    "The following modules are not compatible with this version of element-web. Please update the module " +
                        "references and try again.",
                    JSON.stringify(incompatibleNames, null, 4), // stringify to get prettier/complete output
                );
                exitCode = 1;
                return; // hit the finally{} block before exiting
            }
        }

        // If we reach here, everything seems fine. Write modules.ts and log some output
        // Note: we compile modules.ts in two parts for developer friendliness if they
        // happen to look at it.
        console.log("The following modules have been installed: ", installedModules);
        let modulesTsHeader = MODULES_TS_HEADER;
        let modulesTsDefs = MODULES_TS_DEFINITIONS;
        let index = 0;
        for (const moduleName of installedModules) {
            const importName = `Module${++index}`;
            modulesTsHeader += `import ${importName} from "${moduleName}";\n`;
            modulesTsDefs += `INSTALLED_MODULES.push(${importName});\n`;
        }
        writeModulesTs(modulesTsHeader + modulesTsDefs);
        console.log("Done installing modules");
        // Verji - persist fingerprint so the next `yarn start` can short-circuit.
        writeVerjiInstallCache({
            version: VERJI_CACHE_VERSION,
            fingerprint,
            installedModules,
        });
    } finally {
        // Always restore package details (or at least try to)
        writePackageDetails(packageDeps);

        if (exitCode > 0) {
            process.exit(exitCode);
        }
    }
}

type RawDependencies = {
    lockfile: string;
    packageJson: string;
};

function readCurrentPackageDetails(): RawDependencies {
    return {
        lockfile: fs.readFileSync("./yarn.lock", "utf-8"),
        packageJson: fs.readFileSync("./package.json", "utf-8"),
    };
}

function writePackageDetails(deps: RawDependencies): void {
    fs.writeFileSync("./yarn.lock", deps.lockfile, "utf-8");
    fs.writeFileSync("./package.json", deps.packageJson, "utf-8");
}

function callYarnAdd(dep: string): void {
    // Add the module to the optional dependencies section just in case something
    // goes wrong in restoring the original package details.
    childProcess.execSync(`yarn add -O ${dep}`, {
        env: process.env,
        stdio: ["inherit", "inherit", "inherit"],
    });
}

function getOptionalDepNames(pkgJsonStr: string): string[] {
    return Object.keys(JSON.parse(pkgJsonStr)?.["optionalDependencies"] ?? {});
}

function findDepVersionInPackageJson(dep: string, pkgJsonStr: string): string {
    const pkgJson = JSON.parse(pkgJsonStr);
    const packages = {
        ...(pkgJson["optionalDependencies"] ?? {}),
        ...(pkgJson["devDependencies"] ?? {}),
        ...(pkgJson["dependencies"] ?? {}),
    };
    return packages[dep];
}

function getTopLevelDependencyVersion(dep: string): string {
    const dependencyTree = JSON.parse(
        childProcess
            .execSync(`npm list ${dep} --depth=0 --json`, {
                env: process.env,
                stdio: ["inherit", "pipe", "pipe"],
            })
            .toString("utf-8"),
    );

    /*
        What a dependency tree looks like:
        {
          "version": "1.10.13",
          "name": "element-web",
          "dependencies": {
            "@matrix-org/react-sdk-module-api": {
              "version": "0.0.1",
              "resolved": "file:../../../matrix-react-sdk-module-api"
            }
          }
        }
     */

    return dependencyTree["dependencies"][dep]["version"];
}

function getModuleApiVersionFor(moduleName: string): string {
    // We'll just pretend that this isn't highly problematic...
    // Yarn is fairly stable in putting modules in a flat hierarchy, at least.
    const pkgJsonStr = fs.readFileSync(`./node_modules/${moduleName}/package.json`, "utf-8");
    return findDepVersionInPackageJson(moduleApiDepName, pkgJsonStr);
}

// A list of Module API versions that are supported in addition to the currently installed one
// defined in the package.json. This is necessary because semantic versioning is applied to both
// the Module-side surface of the API and the Client-side surface of the API. So breaking changes
// in the Client-side surface lead to a major bump even though the Module-side surface stays
// compatible. We aim to not break the Module-side surface so we maintain a list of compatible
// older versions.
const backwardsCompatibleMajorVersions = ["1.0.0"];

function isModuleVersionCompatible(ourApiVersion: string, moduleApiVersion: string): boolean {
    if (!moduleApiVersion) return false;
    return (
        semver.satisfies(ourApiVersion, moduleApiVersion) ||
        backwardsCompatibleMajorVersions.some((version) => semver.satisfies(version, moduleApiVersion))
    );
}

function writeModulesTs(content: string): void {
    fs.writeFileSync("./src/modules.ts", content, "utf-8");
}
