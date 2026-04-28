// VERJI - Custom snapshot serializer added by Verji. Internal/private code; no copyright header by intent.
/* eslint-disable matrix-org/require-copyright-header */
/*
Custom snapshot serializer that normalizes React 18 `useId()` values so
DOM snapshots stay stable across environments. Without this, the same component
serializes differently depending on test order (useId is order-sensitive) and
on whether Radix/Compound tooltip primitives have mounted by the time the
snapshot is taken (they inject `aria-describedby` via an effect, with a
useId-generated value).

The serializer walks a cloned DOM tree and:
  - Strips `aria-describedby=":<useId>:"` entirely (the most timing-fragile attr).
  - Normalizes `aria-labelledby` / `aria-owns` / `aria-controls` / `id="radix-:..."`
    with useId-pattern values to a constant sentinel.

It only fires on the OUTER container/fragment passed to `toMatchSnapshot()`;
once we have a normalized clone, we pass it to `printer()` which will then
recursively serialize children via the default DOMElement plugin (the marker
WeakSet prevents this serializer from re-entering on those child elements).
*/

import type { NewPlugin } from "pretty-format";

const USE_ID_PATTERN = /^:[a-z0-9]+:$/i;
const RADIX_USE_ID_PATTERN = /^radix-:[a-z0-9]+:$/i;
const NORMALIZED_ID = "[useId]";

const STRIP_ATTRS = ["aria-describedby"] as const;
const NORMALIZE_ATTRS = ["aria-labelledby", "aria-owns", "aria-controls"] as const;

const handled = new WeakSet<Node>();

function normalizeNode(node: Node): void {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;

    for (const attr of STRIP_ATTRS) {
        const value = el.getAttribute(attr);
        if (value && USE_ID_PATTERN.test(value)) {
            el.removeAttribute(attr);
        }
    }

    for (const attr of NORMALIZE_ATTRS) {
        const value = el.getAttribute(attr);
        if (value && USE_ID_PATTERN.test(value)) {
            el.setAttribute(attr, NORMALIZED_ID);
        }
    }

    const id = el.getAttribute("id");
    if (id && RADIX_USE_ID_PATTERN.test(id)) {
        el.setAttribute("id", `radix-${NORMALIZED_ID}`);
    }

    for (let child = el.firstChild; child !== null; child = child.nextSibling) {
        normalizeNode(child);
    }
}

const useIdSnapshotSerializer: NewPlugin = {
    test(val: unknown): boolean {
        if (!(val instanceof Element || val instanceof DocumentFragment)) return false;
        return !handled.has(val);
    },
    serialize(val, config, indentation, depth, refs, printer) {
        const clone = (val as Element | DocumentFragment).cloneNode(true);
        if (clone instanceof DocumentFragment) {
            for (let child = clone.firstChild; child !== null; child = child.nextSibling) {
                normalizeNode(child);
            }
        } else {
            normalizeNode(clone);
        }

        // Mark the clone (and every descendant) as already handled so the recursive
        // printer call dispatches to the default DOMElement plugin instead of looping
        // back into us.
        markHandled(clone);
        return printer(clone, config, indentation, depth, refs);
    },
};

function markHandled(node: Node): void {
    handled.add(node);
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    for (let child = node.firstChild; child !== null; child = child.nextSibling) {
        markHandled(child);
    }
}

export default useIdSnapshotSerializer;
