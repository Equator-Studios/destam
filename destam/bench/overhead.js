import OObject from '../Object.js';
import OArray from '../Array.js';
import makeBench from './bench.js';

const N = 10_000;
const ROUNDS = 500;

const bench = makeBench(ROUNDS);

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
