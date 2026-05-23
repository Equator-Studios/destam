import OObject from '../Object.js';
import OArray from '../Array.js';
import makeBench from './bench.js';

const ROUNDS = 200;
const WIDTH = 100;
const DEPTH = 100;
const LISTENERS = 1_000;

const bench = makeBench(ROUNDS);

// --- Tree builders ---

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

console.log('(construct  →  attach  →  fire  →  cleanup)\n');

bench('deep chain, 1 listener on root', (ready) => {
    const { root, leaf } = makeDeep(DEPTH);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    leaf.value = 99;
    ready();
    remove();
});

bench('deep chain, N listeners on root', (ready) => {
    const { root, leaf } = makeDeep(DEPTH);
    ready();
    const removers = Array.from({length: LISTENERS}, () => root.observer.watch(() => {}));
    ready();
    leaf.value = 99;
    ready();
    for (const r of removers) r();
});

bench('wide tree, 1 listener on root', (ready) => {
    const root = makeWide(WIDTH);
    ready();
    const remove = root.observer.watch(() => {});
    ready();
    root['c0'].value = 99;
    ready();
    remove();
});

bench('wide tree, 1 listener per child', (ready) => {
    const root = makeWide(WIDTH);
    ready();
    const removers = [];
    for (let i = 0; i < WIDTH; i++) removers.push(root['c' + i].observer.watch(() => {}));
    ready();
    for (let i = 0; i < WIDTH; i++) root['c' + i].value = 99;
    ready();
    for (const r of removers) r();
});

bench('balanced tree (depth=3, branching=4), 1 listener on root', (ready) => {
    const obj = makeBalanced(3, 4);
    ready();
    const remove = obj.observer.watch(() => {});
    ready();
    for (const leaf of leaves(obj, 3, 4)) leaf.value = 99;
    ready();
    remove();
});

console.log('\n(setup  →  add  →  mutate  →  delete  →  cleanup)\n');

bench('object: 0 listeners, add/mutate/delete WIDTH properties', (ready) => {
    const obj = OObject();
    ready();
    for (let i = 0; i < WIDTH; i++) obj['k' + i] = i;
    ready();
    for (let i = 0; i < WIDTH; i++) obj['k' + i] = i + 1;
    ready();
    for (let i = 0; i < WIDTH; i++) delete obj['k' + i];
    ready();
});

bench('object: N listeners, add/mutate/delete WIDTH properties', (ready) => {
    const obj = OObject();
    const removers = Array.from({length: LISTENERS}, () => obj.observer.watch(() => {}));
    ready();
    for (let i = 0; i < WIDTH; i++) obj['k' + i] = i;
    ready();
    for (let i = 0; i < WIDTH; i++) obj['k' + i] = i + 1;
    ready();
    for (let i = 0; i < WIDTH; i++) delete obj['k' + i];
    ready();
    for (const r of removers) r();
});

bench('array: 0 listeners, push/modify/pop WIDTH elements', (ready) => {
    const arr = OArray();
    ready();
    for (let i = 0; i < WIDTH; i++) arr.push(i);
    ready();
    for (let i = 0; i < WIDTH; i++) arr[i] = i + 1;
    ready();
    while (arr.length > 0) arr.pop();
    ready();
});

bench('array: N listeners, push/modify/pop WIDTH elements', (ready) => {
    const arr = OArray();
    const removers = Array.from({length: LISTENERS}, () => arr.observer.watch(() => {}));
    ready();
    for (let i = 0; i < WIDTH; i++) arr.push(i);
    ready();
    for (let i = 0; i < WIDTH; i++) arr[i] = i + 1;
    ready();
    while (arr.length > 0) arr.pop();
    ready();
    for (const r of removers) r();
});
