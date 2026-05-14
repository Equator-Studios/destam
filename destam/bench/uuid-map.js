import UUID from '../UUID.js';

const COUNT = 10_000;
const LOOKUPS = 1_000_000;
const ROUNDS = 100;

const uuids = Array.from({length: COUNT}, () => UUID());
const nextPow2 = n => 1 << Math.ceil(Math.log2(n));
const prealloc = nextPow2(COUNT / 0.8) * 4;
const elems = uuids.map(id => ({id, value: true}));
const hexKeys = uuids.map(id => id.rawHex());

// --- UUID.Map (default minAllocation) ---
const uuidMapPopStart = performance.now();
const uuidMap = UUID.Map();
for (const elem of elems) uuidMap.setElement(elem);
const uuidMapPopTime = performance.now() - uuidMapPopStart;

const uuidMapStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) uuidMap.getElement(uuids[i % COUNT]);
const uuidMapTime = performance.now() - uuidMapStart;

const uuidMapDelStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (const elem of elems) uuidMap.setElement(elem);
    for (const id of uuids) uuidMap.delete(id);
}
const uuidMapDelTime = (performance.now() - uuidMapDelStart) / ROUNDS;

// --- UUID.Map (preallocated minAllocation) ---
const uuidMapPrePopStart = performance.now();
const uuidMapPre = UUID.Map(null, prealloc);
for (const elem of elems) uuidMapPre.setElement(elem);
const uuidMapPrePopTime = performance.now() - uuidMapPrePopStart;

const uuidMapPreStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) uuidMapPre.getElement(uuids[i % COUNT]);
const uuidMapPreTime = performance.now() - uuidMapPreStart;

const uuidMapPreDelStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (const elem of elems) uuidMapPre.setElement(elem);
    for (const id of uuids) uuidMapPre.delete(id);
}
const uuidMapPreDelTime = (performance.now() - uuidMapPreDelStart) / ROUNDS;

// --- native Map (cached rawHex key) ---
const nativeMapPopStart = performance.now();
const nativeMap = new Map();
for (let i = 0; i < COUNT; i++) nativeMap.set(hexKeys[i], true);
const nativeMapPopTime = performance.now() - nativeMapPopStart;

const nativeMapStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) nativeMap.get(hexKeys[i % COUNT]);
const nativeMapTime = performance.now() - nativeMapStart;

const nativeMapDelStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (let i = 0; i < COUNT; i++) nativeMap.set(hexKeys[i], true);
    for (const key of hexKeys) nativeMap.delete(key);
}
const nativeMapDelTime = (performance.now() - nativeMapDelStart) / ROUNDS;

// --- native Map (rawHex() computed at lookup) ---
const nativeMapDynStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) nativeMap.get(uuids[i % COUNT].rawHex());
const nativeMapDynTime = performance.now() - nativeMapDynStart;

const nativeMapDynDelStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (const id of uuids) nativeMap.set(id.rawHex(), true);
    for (const id of uuids) nativeMap.delete(id.rawHex());
}
const nativeMapDynDelTime = (performance.now() - nativeMapDynDelStart) / ROUNDS;

const fmt = (pop, lookup, del) =>
    `populate ${pop.toFixed(1)}ms  lookup ${lookup.toFixed(1)}ms  delete ${del.toFixed(1)}ms`;

console.log(`UUID.Map (default):              ${fmt(uuidMapPopTime, uuidMapTime, uuidMapDelTime)}`);
console.log(`UUID.Map (preallocated ${prealloc}):  ${fmt(uuidMapPrePopTime, uuidMapPreTime, uuidMapPreDelTime)}`);
console.log(`native Map (cached key):         ${fmt(nativeMapPopTime, nativeMapTime, nativeMapDelTime)}`);
console.log(`native Map (rawHex() on each):   ${fmt(nativeMapPopTime, nativeMapDynTime, nativeMapDynDelTime)}`);
