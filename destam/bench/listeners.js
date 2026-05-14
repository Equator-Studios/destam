import OObject from '../Object.js';
import OArray from '../Array.js';

const ROUNDS = 200;
const WIDTH = 100;
const DEPTH = 100;
const LISTENERS = 1_000;

const bench = (label, fn, rounds = ROUNDS) => {
    const times = [];

    const run = () => {
        const checkpoints = [];
        const ready = () => checkpoints.push(performance.now());
        const start = performance.now();
        fn(ready);
        checkpoints.push(performance.now());
        if (times.length === 0) for (let i = 0; i < checkpoints.length; i++) times.push(0);
        let prev = start;
        for (let i = 0; i < checkpoints.length; i++) {
            times[i] += checkpoints[i] - prev;
            prev = checkpoints[i];
        }
    };

    for (let i = 0; i < 5; i++) run();
    times.fill(0);
    for (let i = 0; i < rounds; i++) run();

    const segments = times.map(t => (t / rounds).toFixed(3) + 'ms');
    console.log(`${label}: ${segments.join('  →  ')}`);
};

// --- Tree builders ---

const makeFlat = (width) => {
    const obj = OObject();
    for (let i = 0; i < width; i++) obj['k' + i] = i;
    return obj;
};

const makeDeep = (depth) => {
    let leaf = OObject({ value: 0 });
    let root = leaf;
    for (let i = 0; i < depth; i++) {
        const parent = OObject({ child: root });
        root = parent;
    }
    return { root, leaf };
};

const makeWide = (width) => {
    const root = OObject();
    for (let i = 0; i < width; i++) root['c' + i] = OObject({ value: i });
    return root;
};

const makeBalanced = (depth, branching = 4) => {
    if (depth === 0) return OObject({ value: 0 });
    const obj = OObject();
    for (let i = 0; i < branching; i++) obj['c' + i] = makeBalanced(depth - 1, branching);
    return obj;
};

const leaves = (node, depth, branching = 4) => {
    if (depth === 0) return [node];
    return Array.from({length: branching}, (_, i) =>
        leaves(node['c' + i], depth - 1, branching)).flat();
};

console.log('(construct  →  attach  →  fire)\n');

bench('flat object, 1 listener', (ready) => {
    const obj = makeFlat(WIDTH);
    ready();
    const remove = obj.observer.watch(() => {});
    ready();
    obj.k0 = 99;
    remove();
});

bench('flat object, N listeners', (ready) => {
    const obj = makeFlat(WIDTH);
    ready();
    const removers = Array.from({length: LISTENERS}, () => obj.observer.watch(() => {}));
    ready();
    obj.k0 = 99;
    for (const r of removers) r();
});

bench('deep chain, 1 listener on root', (ready) => {
    const { root, leaf } = makeDeep(DEPTH);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    leaf.value = 99;
    remove();
});

bench('deep chain, N listeners on root', (ready) => {
    const { root, leaf } = makeDeep(DEPTH);
    ready();
    const removers = Array.from({length: LISTENERS}, () => root.observer.watch(() => {}));
    ready();
    leaf.value = 99;
    for (const r of removers) r();
});

bench('wide tree, 1 listener on root', (ready) => {
    const root = makeWide(WIDTH);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    root['c0'].value = 99;
    remove();
});

bench('wide tree, 1 listener per child', (ready) => {
    const root = makeWide(WIDTH);
    ready();
    const removers = [];
    for (let i = 0; i < WIDTH; i++) removers.push(root['c' + i].observer.watch(() => {}));
    ready();
    for (let i = 0; i < WIDTH; i++) root['c' + i].value = 99;
    for (const r of removers) r();
});

bench('balanced tree (depth=3, branching=4), 1 listener on root', (ready) => {
    const obj = makeBalanced(3, 4);
    ready();
    const remove = obj.observer.watch(() => {});
    ready();
    for (const leaf of leaves(obj, 3, 4)) leaf.value = 99;
    remove();
});
