import OObject from '../Object.js';
import OArray from '../Array.js';

const N = 10_000;
const ROUNDS = 500;

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

    if (times.length === 1) {
        console.log(`${label}: ${(times[0] / rounds).toFixed(3)}ms`);
    } else {
        const segments = times.map(t => (t / rounds).toFixed(3) + 'ms');
        console.log(`${label}: ${segments.join('  →  ')}`);
    }
};

console.log(`(set  →  delete)\n`);

bench(`native object (${N} props)`, (ready) => {
    const obj = {};
    for (let i = 0; i < N; i++) obj['k' + i] = i;
    ready();
    for (let i = 0; i < N; i++) delete obj['k' + i];
});

bench(`OObject (${N} props)`, (ready) => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj['k' + i] = i;
    ready();
    for (let i = 0; i < N; i++) delete obj['k' + i];
});

console.log(`\n(push  →  pop)\n`);

bench(`native array (${N} elements)`, (ready) => {
    const arr = [];
    for (let i = 0; i < N; i++) arr.push(i);
    ready();
    for (let i = 0; i < N; i++) arr.pop();
});

bench(`OArray (${N} elements)`, (ready) => {
    const arr = OArray();
    for (let i = 0; i < N; i++) arr.push(i);
    ready();
    for (let i = 0; i < N; i++) arr.pop();
});

console.log(`\n(random splice)\n`);

bench(`native array (${N} elements)`, () => {
    const arr = [];
    for (let i = 0; i < N; i++) arr.splice(Math.floor(Math.random() * (arr.length + 1)), 0, i);
});

bench(`OArray (${N} elements)`, () => {
    const arr = OArray();
    for (let i = 0; i < N; i++) arr.splice(Math.floor(Math.random() * (arr.length + 1)), 0, i);
});
