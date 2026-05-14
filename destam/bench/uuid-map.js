import UUID from '../UUID.js';
import makeBench from './bench.js';

const COUNT = 10_000;
const LOOKUPS = 1_000_000;
const ROUNDS = 5;

const bench = makeBench(ROUNDS);

const uuids = Array.from({length: COUNT}, () => UUID());
const nextPow2 = n => 1 << Math.ceil(Math.log2(n));
const preallocBase = nextPow2(COUNT / 0.8);
const elems = uuids.map(id => ({id, value: true}));
const hexKeys = uuids.map(id => id.rawHex());

const uuidMapBench = (label, minAllocation) => bench(label, (ready) => {
    const map = UUID.Map(null, minAllocation);
    for (const elem of elems) map.setElement(elem);
    ready();
    for (let i = 0; i < LOOKUPS; i++) map.getElement(uuids[i % COUNT]);
    ready();
    for (const id of uuids) map.delete(id);
});

// Each bench: setElement → getElement x LOOKUPS → delete
uuidMapBench('UUID.Map (default)', undefined);
uuidMapBench(`UUID.Map (preallocated x1 ${preallocBase})`, preallocBase);
uuidMapBench(`UUID.Map (preallocated x2 ${preallocBase * 2})`, preallocBase * 2);
uuidMapBench(`UUID.Map (preallocated x4 ${preallocBase * 4})`, preallocBase * 4);
uuidMapBench(`UUID.Map (preallocated x8 ${preallocBase * 8})`, preallocBase * 8);

bench('native Map (cached key)', (ready) => {
    const map = new Map();
    for (let i = 0; i < COUNT; i++) map.set(hexKeys[i], true);
    ready();
    for (let i = 0; i < LOOKUPS; i++) map.get(hexKeys[i % COUNT]);
    ready();
    for (const key of hexKeys) map.delete(key);
});

bench('native Map (rawHex() on each)', (ready) => {
    const map = new Map();
    for (const id of uuids) map.set(id.rawHex(), true);
    ready();
    for (let i = 0; i < LOOKUPS; i++) map.get(uuids[i % COUNT].rawHex());
    ready();
    for (const id of uuids) map.delete(id.rawHex());
});
