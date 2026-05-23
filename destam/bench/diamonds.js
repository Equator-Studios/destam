import OObject from '../Object.js';
import OArray from '../Array.js';
import makeBench from './bench.js';

const ROUNDS = 200;
const FANOUT = 100;
const LISTENERS = 100;

const bench = makeBench(ROUNDS);

// --- Tree builders ---

// Heavy diamond: one shared observable referenced from many parent slots.
// Highlights the cost of dedup at registration (or the cost of redundant
// registrations + duplicate fire) on the same listener walking through many
// paths to the same target.
const makeDiamondHeavy = (fanout) => {
    const shared = OObject({ value: 0 });
    const root = OObject();
    for (let i = 0; i < fanout; i++) root['p' + i] = shared;
    return { root, shared };
};

// Diamond chain: each parent has two paths to its child (left & right), and
// the same pattern repeats. Stresses the diamond-detection logic deeper.
const makeDiamondChain = (depth) => {
    let leaf = OObject({ value: 0 });
    let root = leaf;
    for (let i = 0; i < depth; i++) {
        const parent = OObject({ left: root, right: root });
        root = parent;
    }
    return { root, leaf };
};

// Tight loop: a.next = b; b.next = a;
const makeTightLoop = () => {
    const a = OObject({});
    const b = OObject({});
    a.next = b;
    b.next = a;
    return { a, b };
};

// Self loop: a.self = a;
const makeSelfLoop = () => {
    const a = OObject({});
    a.self = a;
    return a;
};

// A chain of nodes where every node points back at the root, creating
// many small loops superimposed on a flat tree.
const makeManyLoops = (fanout) => {
    const root = OObject({});
    for (let i = 0; i < fanout; i++) root['c' + i] = OObject({ back: root });
    return root;
};

console.log('(construct  →  attach  →  fire  →  cleanup)\n');

bench('diamond heavy (fanout=100), 1 listener on root', (ready) => {
    const { root, shared } = makeDiamondHeavy(FANOUT);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    shared.value = 99;
    ready();
    remove();
});

bench('diamond heavy (fanout=100), N listeners on root', (ready) => {
    const { root, shared } = makeDiamondHeavy(FANOUT);
    ready();
    const removers = Array.from({length: LISTENERS}, () => root.observer.watch(() => {}));
    ready();
    shared.value = 99;
    ready();
    for (const r of removers) r();
});

// depth=10 gives 2^10=1024 paths to the leaf — enough to make old impl's
// path-fanning visible without OOMing it (depth=20 = 1M registrations).
bench('diamond chain (depth=10), 1 listener on root', (ready) => {
    const { root, leaf } = makeDiamondChain(10);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    leaf.value = 99;
    ready();
    remove();
});

bench('diamond chain (depth=10), N listeners on root', (ready) => {
    const { root, leaf } = makeDiamondChain(10);
    ready();
    const removers = Array.from({length: LISTENERS}, () => root.observer.watch(() => {}));
    ready();
    leaf.value = 99;
    ready();
    for (const r of removers) r();
});

bench('tight loop (a↔b), 1 listener on root', (ready) => {
    const { a, b } = makeTightLoop();
    ready();
    const remove = a.observer.watch(() => {});
    ready();
    a.foo = 99;
    ready();
    remove();
});

bench('tight loop (a↔b), N listeners on root', (ready) => {
    const { a, b } = makeTightLoop();
    ready();
    const removers = Array.from({length: LISTENERS}, () => a.observer.watch(() => {}));
    ready();
    a.foo = 99;
    ready();
    for (const r of removers) r();
});

bench('self loop, 1 listener', (ready) => {
    const a = makeSelfLoop();
    ready();
    const remove = a.observer.watch(() => {});
    ready();
    a.foo = 99;
    ready();
    remove();
});

bench('many small loops (fanout=100), 1 listener on root', (ready) => {
    const root = makeManyLoops(FANOUT);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    root.c0.tag = 99;
    ready();
    remove();
});

bench('many small loops (fanout=100), N listeners on root', (ready) => {
    const root = makeManyLoops(FANOUT);
    ready();
    const removers = Array.from({length: LISTENERS}, () => root.observer.watch(() => {}));
    ready();
    root.c0.tag = 99;
    ready();
    for (const r of removers) r();
});
