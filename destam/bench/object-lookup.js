import OObject from '../Object.js';
import {observerGetter} from '../Observer.js';
import makeBench from './bench.js';

const N = 10_000;
const ROUNDS = 500;

const bench = makeBench(ROUNDS);

const keys = Array.from({length: N}, (_, i) => 'k' + i);

console.log('(set N props)\n');

bench(`OObject set via proxy`, () => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj[keys[i]] = i;
});

bench(`OObject set via cached reg.setProp_`, () => {
    const obj = OObject();
    const reg = obj[observerGetter];
    const init = reg.init_;
    for (let i = 0; i < N; i++) reg.setProp_(init, keys[i], i);
});

bench(`OObject set via fresh reg.setProp_`, () => {
    const obj = OObject();
    for (let i = 0; i < N; i++) {
        const reg = obj[observerGetter];
        reg.setProp_(reg.init_, keys[i], i);
    }
});

console.log('\n(get N props)\n');

let sink = 0;

bench(`OObject get via proxy`, (ready) => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj[keys[i]] = i;
    ready();
    for (let i = 0; i < N; i++) sink += obj[keys[i]];
});

bench(`OObject get via cached reg.getProp_`, (ready) => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj[keys[i]] = i;
    const reg = obj[observerGetter];
    const init = reg.init_;
    ready();
    for (let i = 0; i < N; i++) sink += reg.getProp_(init, keys[i]);
});

bench(`OObject get via fresh reg.getProp_`, (ready) => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj[keys[i]] = i;
    ready();
    for (let i = 0; i < N; i++) {
        const reg = obj[observerGetter];
        sink += reg.getProp_(reg.init_, keys[i]);
    }
});

if (sink === Number.MAX_SAFE_INTEGER) console.log('');
