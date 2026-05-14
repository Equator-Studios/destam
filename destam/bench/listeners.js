import OObject from '../Object.js';
import OArray from '../Array.js';

const ROUNDS = 200;
const WIDTH = 100;   // children per node for wide tree
const DEPTH = 100;   // levels for deep chain
const LISTENERS = 1_000;

const bench = (label, fn, rounds = ROUNDS) => {
    // warmup
    for (let i = 0; i < 5; i++) fn();
    const start = performance.now();
    for (let i = 0; i < rounds; i++) fn();
    console.log(`${label}: ${((performance.now() - start) / rounds).toFixed(3)}ms`);
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

// collect all leaves of a balanced tree
const leaves = (node, depth, branching = 4) => {
    if (depth === 0) return [node];
    return Array.from({length: branching}, (_, i) =>
        leaves(node['c' + i], depth - 1, branching)).flat();
};

console.log('=== Attaching listeners ===\n');

bench('flat object, 1 listener on root', () => {
    const obj = makeFlat(WIDTH);
    const remove = obj.observer.watch(() => {});
    remove();
});

bench('flat object, N listeners on root', () => {
    const obj = makeFlat(WIDTH);
    const removers = Array.from({length: LISTENERS}, () => obj.observer.watch(() => {}));
    for (const r of removers) r();
});

bench('deep chain, 1 listener on root', () => {
    const { root } = makeDeep(DEPTH);
    const remove = root.observer.watch(() => {});
    remove();
});

bench('wide tree, 1 listener per child', () => {
    const root = makeWide(WIDTH);
    const removers = [];
    for (let i = 0; i < WIDTH; i++) removers.push(root['c' + i].observer.watch(() => {}));
    for (const r of removers) r();
});

bench('wide tree, 1 listener on root', () => {
    const root = makeWide(WIDTH);
    const remove = root.observer.watch(() => {});
    remove();
});

console.log('\n=== Firing events ===\n');

bench('flat object, 1 listener, mutate 1 prop', () => {
    const obj = makeFlat(WIDTH);
    const remove = obj.observer.watch(() => {});
    obj.k0 = 99;
    remove();
});

bench('flat object, N listeners, mutate 1 prop', () => {
    const obj = makeFlat(WIDTH);
    const removers = Array.from({length: LISTENERS}, () => obj.observer.watch(() => {}));
    obj.k0 = 99;
    for (const r of removers) r();
});

bench('deep chain, 1 listener on root, mutate leaf', () => {
    const { root, leaf } = makeDeep(DEPTH);
    const remove = root.observer.watch(() => {});
    leaf.value = 99;
    remove();
});

bench('wide tree, 1 listener on root, mutate 1 child', () => {
    const root = makeWide(WIDTH);
    const remove = root.observer.watch(() => {});
    root['c0'].value = 99;
    remove();
});

bench('wide tree, 1 listener per child, mutate all children', () => {
    const root = makeWide(WIDTH);
    const removers = [];
    for (let i = 0; i < WIDTH; i++) removers.push(root['c' + i].observer.watch(() => {}));
    for (let i = 0; i < WIDTH; i++) root['c' + i].value = 99;
    for (const r of removers) r();
});

bench('balanced tree (depth=3, branching=4), 1 listener on root, mutate all leaves', () => {
    const obj = makeBalanced(3, 4);
    const remove = obj.observer.watch(() => {});
    for (const leaf of leaves(obj, 3, 4)) leaf.value = 99;
    remove();
}, ROUNDS);
