import OObject from '../Object.js';
import Observer from '../Observer.js';
import makeBench from './bench.js';

const ROUNDS = 100;
const WATCHERS = 100;
const MUTATIONS = 100;

const bench = makeBench(ROUNDS);

// `.memo()` shares one upstream subscription across all watchers attached
// below it. The optimization shows up when upstream does meaningful
// per-evaluation work and there are multiple consumers. These benches use
// Observer.mutable / Observer.all as the source, which is where .memo() is
// designed to work — see the .memo() footgun in docs/governors.md for the
// case where it doesn't.

// Heavy synthetic work — enough to dwarf framework overhead.
const heavy = x => {
    let acc = 0;
    for (let i = 0; i < 1000; i++) acc += Math.sqrt(x + i);
    return acc;
};

const attach = (obs, count) => Array.from({length: count}, () => obs.watch(() => {}));
const detach = (removers) => { for (const r of removers) r(); };

console.log('(setup  →  fire  →  cleanup)\n');

// === Cheap upstream (identity map) — measures pure memo overhead ===

bench('cheap upstream, 1 watcher, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(x => x);
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    remove();
});

bench('cheap upstream, 1 watcher, with memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(x => x).memo();
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    remove();
});

bench('cheap upstream, N watchers, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(x => x);
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    detach(removers);
});

bench('cheap upstream, N watchers, with memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(x => x).memo();
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    detach(removers);
});

// === Heavy upstream — where memo is supposed to win ===

bench('heavy upstream, 1 watcher, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy);
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    remove();
});

bench('heavy upstream, 1 watcher, with memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy).memo();
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    remove();
});

bench('heavy upstream, N watchers, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy);
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    detach(removers);
});

bench('heavy upstream, N watchers, with memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy).memo();
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) src.set(i);
    ready();
    detach(removers);
});

// === Observer.all — multiple dependencies, common use case for memo ===

bench('Observer.all over N sources, M watchers, no memo', (ready) => {
    const sources = Array.from({length: 10}, () => Observer.mutable(0));
    const obs = Observer.all(sources).map(arr => arr.reduce((a, b) => a + b, 0));
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) sources[i % sources.length].set(i);
    ready();
    detach(removers);
});

bench('Observer.all over N sources, M watchers, with memo', (ready) => {
    const sources = Array.from({length: 10}, () => Observer.mutable(0));
    const obs = Observer.all(sources).map(arr => arr.reduce((a, b) => a + b, 0)).memo();
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) sources[i % sources.length].set(i);
    ready();
    detach(removers);
});

// === Current-selection pattern — value is itself an OObject ===
// Documented use of memo: when the cached value is an observable, downstream
// watchers follow it for nested mutations.

bench('current-selection (cached value is OObject), N watchers', (ready) => {
    const sel = Observer.mutable(OObject({val: 0}));
    const obs = sel.memo();
    const removers = attach(obs, WATCHERS);
    ready();
    for (let i = 0; i < MUTATIONS; i++) sel.get().val = i;
    ready();
    detach(removers);
});

// === `.get()` behavior ===
// `.get()` on a memoized observer returns the cached value in O(1) when at
// least one watcher is attached. Without a watcher, the cache is inactive
// and `.get()` falls through to recomputing the chain. These benches make
// the difference visible — useful for UI patterns where the framework
// attaches a single watcher (to trigger re-render) and component code
// reads the value many times per render via `.get()`.

const GETS = 1000;

bench('heavy chain, GETS .get() calls, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy);
    ready();
    for (let i = 0; i < GETS; i++) obs.get();
    ready();
});

bench('heavy chain, GETS .get() calls, with memo, no watcher', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy).memo();
    ready();
    for (let i = 0; i < GETS; i++) obs.get();
    ready();
});

bench('heavy chain, GETS .get() calls, with memo + 1 watcher', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy).memo();
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < GETS; i++) obs.get();
    ready();
    remove();
});

// Mixed pattern: a single mutation followed by many `.get()` calls. Mimics
// a UI render cycle — one state change, many reads of derived values.
bench('mutate + GETS .get() reads, no memo', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy);
    ready();
    for (let i = 0; i < MUTATIONS; i++) {
        src.set(i);
        for (let g = 0; g < GETS; g++) obs.get();
    }
    ready();
});

bench('mutate + GETS .get() reads, with memo + 1 watcher', (ready) => {
    const src = Observer.mutable(0);
    const obs = src.map(heavy).memo();
    const remove = obs.watch(() => {});
    ready();
    for (let i = 0; i < MUTATIONS; i++) {
        src.set(i);
        for (let g = 0; g < GETS; g++) obs.get();
    }
    ready();
    remove();
});
