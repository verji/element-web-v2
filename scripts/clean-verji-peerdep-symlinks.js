/*
 * Verji - Cleans every piece of state that yarn v1's link protocol leaves
 *         behind when installing the @verji/* file: deps on Windows. Needed
 *         because several verji-*-modules declare `element-web` as a link:
 *         or peer dep, creating a circular reference that yarn v1 cannot
 *         atomically reconcile — stale entries surface as EEXIST during
 *         the next install's [4/5] Linking phase.
 *
 *         Scope (all three wiped on a broken state — see health check below):
 *           1. <root>/node_modules/@verji — consumer-side install state.
 *           2. Yarn's global link-protocol registry entry for `element-web`:
 *                Windows: %LOCALAPPDATA%\Yarn\Data\link\element-web
 *                POSIX:   ~/.config/yarn/link/element-web
 *           3. Each sibling verji-*-module's node_modules/element-web junction.
 *
 *         Fast path: if no dangling symlinks are detected anywhere in scope,
 *         state is healthy and we skip the wipe entirely. A full wipe of
 *         @verji takes ~60s on Windows and is pure waste when state is
 *         already consistent; this keeps the common-case `yarn start` fast.
 *
 *         See docs/Verji/DevLoopWindows.md for the full rationale.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

function safeRemove(target) {
    if (!target) return false;
    if (fs.lstatSync(target, { throwIfNoEntry: false })) {
        fs.rmSync(target, { recursive: true, force: true });
        return true;
    }
    return false;
}

function isDangling(p) {
    const lstat = fs.lstatSync(p, { throwIfNoEntry: false });
    if (!lstat) return false;
    try {
        fs.statSync(p);
        return false;
    } catch {
        return true;
    }
}

const projectRoot = path.join(__dirname, "..");
const workspaceRoot = path.join(projectRoot, "..");
const verjiDir = path.join(projectRoot, "node_modules", "@verji");

// Health check — skip wipe if no dangling symlinks are detected. A dangling
// symlink at any of the three scopes indicates prior failed/interrupted
// install state that will cause EEXIST on the next yarn add.
let needsWipe = false;

if (fs.existsSync(verjiDir)) {
    for (const mod of fs.readdirSync(verjiDir)) {
        if (isDangling(path.join(verjiDir, mod, "node_modules", "element-web"))) {
            needsWipe = true;
            break;
        }
    }
}

if (!needsWipe && fs.existsSync(workspaceRoot)) {
    for (const entry of fs.readdirSync(workspaceRoot)) {
        if (!entry.startsWith("verji-") || !entry.endsWith("-module")) continue;
        if (isDangling(path.join(workspaceRoot, entry, "node_modules", "element-web"))) {
            needsWipe = true;
            break;
        }
    }
}

if (!needsWipe) {
    console.log("Verji prestart: state looks healthy, skipping wipe.");
    process.exit(0);
}

console.log("Verji prestart: detected dangling symlink state, running full cleanup.");

// 1: consumer-side @verji tree
safeRemove(verjiDir);

// 2: yarn global link-store entry for element-web
const linkStoreRoots = [];
if (process.env.LOCALAPPDATA) {
    linkStoreRoots.push(path.join(process.env.LOCALAPPDATA, "Yarn", "Data", "link"));
}
linkStoreRoots.push(path.join(os.homedir(), ".config", "yarn", "link"));
for (const root of linkStoreRoots) {
    safeRemove(path.join(root, "element-web"));
}

// 3: sibling verji-*-module node_modules/element-web junctions
if (fs.existsSync(workspaceRoot)) {
    for (const entry of fs.readdirSync(workspaceRoot)) {
        if (!entry.startsWith("verji-") || !entry.endsWith("-module")) continue;
        safeRemove(path.join(workspaceRoot, entry, "node_modules", "element-web"));
    }
}
