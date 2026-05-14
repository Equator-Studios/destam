import { indexCompare, indexAdd, indexLeading, positionIndex } from '../Array.js';
import OArray from '../Array.js';

const COUNT = 10_000;
const LOOKUPS = 1_000_000;
const ROUNDS = 100;
const entropy = 8;

// Build a realistic index array by appending COUNT elements (same logic as splice)
const buildIndices = (count, randomInserts = false) => {
    const indexes = [];
    const zero = [0, 0];

    for (let i = 0; i < count; i++) {
        let prev, d = 0;
        let start = randomInserts ? Math.floor(Math.random() * (indexes.length + 1)) : indexes.length;

        if (indexes.length === 0) {
            prev = zero;
        } else if (start === indexes.length) {
            prev = indexes[indexes.length - 1];
        } else if (start === 0) {
            prev = indexAdd(indexes[0], -2);
        } else {
            prev = indexes[start - 1];
            d = 1 - indexLeading(indexes[start], prev);
        }

        d += entropy + 1;
        const num = Math.floor(Math.random() * (1 << entropy));
        const idx = indexAdd(prev, num + 1, d);
        indexes.splice(start, 0, idx);
    }

    return indexes;
};

const appendIndexes = buildIndices(COUNT, false);
const randomIndexes = buildIndices(COUNT, true);

const avgLen = idxs => (idxs.reduce((s, a) => s + a.length, 0) / idxs.length).toFixed(2);
console.log(`append index avg length: ${avgLen(appendIndexes)}`);
console.log(`random index avg length: ${avgLen(randomIndexes)}`);
console.log();

// --- indexCompare (binary search) ---
const binarySearch = (indexes, target) => {
    let left = 0, right = indexes.length - 1;
    while (left <= right) {
        const m = (left + right) >> 1;
        const cmp = indexCompare(indexes[m], target);
        if (cmp < 0) left = m + 1;
        else if (cmp > 0) right = m - 1;
        else return m;
    }
    return left;
};

const appendCompareStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) binarySearch(appendIndexes, appendIndexes[i % COUNT]);
const appendCompareTime = performance.now() - appendCompareStart;

const randomCompareStart = performance.now();
for (let i = 0; i < LOOKUPS; i++) binarySearch(randomIndexes, randomIndexes[i % COUNT]);
const randomCompareTime = performance.now() - randomCompareStart;

// --- indexAdd + indexLeading (insert between two existing indices) ---
const appendInsertStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (let i = 1; i < COUNT - 1; i++) {
        const prev = appendIndexes[i - 1];
        const d = 1 - indexLeading(appendIndexes[i], prev) + entropy + 1;
        indexAdd(prev, Math.floor(Math.random() * (1 << entropy)) + 1, d);
    }
}
const appendInsertTime = (performance.now() - appendInsertStart) / ROUNDS;

const randomInsertStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    for (let i = 1; i < COUNT - 1; i++) {
        const prev = randomIndexes[i - 1];
        const d = 1 - indexLeading(randomIndexes[i], prev) + entropy + 1;
        indexAdd(prev, Math.floor(Math.random() * (1 << entropy)) + 1, d);
    }
}
const randomInsertTime = (performance.now() - randomInsertStart) / ROUNDS;

// --- OArray bulk operations (end-to-end) ---
const arrayAppendStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    const arr = OArray();
    for (let i = 0; i < COUNT; i++) arr.push(i);
}
const arrayAppendTime = (performance.now() - arrayAppendStart) / ROUNDS;

const arrayRandomStart = performance.now();
for (let r = 0; r < ROUNDS; r++) {
    const arr = OArray();
    for (let i = 0; i < COUNT; i++) arr.splice(Math.floor(Math.random() * (i + 1)), 0, i);
}
const arrayRandomTime = (performance.now() - arrayRandomStart) / ROUNDS;

console.log(`indexCompare binary search (append indices): ${appendCompareTime.toFixed(1)}ms`);
console.log(`indexCompare binary search (random indices): ${randomCompareTime.toFixed(1)}ms`);
console.log();
console.log(`indexAdd+indexLeading insert (append indices): ${appendInsertTime.toFixed(1)}ms`);
console.log(`indexAdd+indexLeading insert (random indices): ${randomInsertTime.toFixed(1)}ms`);
console.log();
console.log(`OArray push x${COUNT} (end-to-end):           ${arrayAppendTime.toFixed(1)}ms`);
console.log(`OArray random splice x${COUNT} (end-to-end):  ${arrayRandomTime.toFixed(1)}ms`);
