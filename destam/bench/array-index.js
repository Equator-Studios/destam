import { indexCompare, indexAdd, indexLeading } from '../Array.js';
import OArray from '../Array.js';
import makeBench from './bench.js';

const COUNT = 10_000;
const LOOKUPS = 1_000_000;
const ROUNDS = 100;
const entropy = 8;

const bench = makeBench(ROUNDS);

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

bench('indexCompare binary search (append indices)', () => {
    for (let i = 0; i < LOOKUPS; i++) binarySearch(appendIndexes, appendIndexes[i % COUNT]);
}, 1);

bench('indexCompare binary search (random indices)', () => {
    for (let i = 0; i < LOOKUPS; i++) binarySearch(randomIndexes, randomIndexes[i % COUNT]);
}, 1);

console.log();

bench('indexAdd+indexLeading insert (append indices)', () => {
    for (let i = 1; i < COUNT - 1; i++) {
        const prev = appendIndexes[i - 1];
        const d = 1 - indexLeading(appendIndexes[i], prev) + entropy + 1;
        indexAdd(prev, Math.floor(Math.random() * (1 << entropy)) + 1, d);
    }
});

bench('indexAdd+indexLeading insert (random indices)', () => {
    for (let i = 1; i < COUNT - 1; i++) {
        const prev = randomIndexes[i - 1];
        const d = 1 - indexLeading(randomIndexes[i], prev) + entropy + 1;
        indexAdd(prev, Math.floor(Math.random() * (1 << entropy)) + 1, d);
    }
});

console.log();

bench(`OArray push x${COUNT} (end-to-end)`, () => {
    const arr = OArray();
    for (let i = 0; i < COUNT; i++) arr.push(i);
});

bench(`OArray random splice x${COUNT} (end-to-end)`, () => {
    const arr = OArray();
    for (let i = 0; i < COUNT; i++) arr.splice(Math.floor(Math.random() * (i + 1)), 0, i);
});
