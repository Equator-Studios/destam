import OObject from '../Object.js';
import OArray from '../Array.js';
import createNetwork from '../Tracking.js';
import { clone } from '../tests/clone.js';
import makeBench from './bench.js';

const N = 1_000;
const ROUNDS = 500;
const bench = makeBench(ROUNDS);

console.log('(setup  →  apply  →  teardown)\n');

// Modify: src pre-populated, dst mirrors src, apply N modify commits
bench(`OObject ${N} Modify applies`, (ready) => {
    const src = OObject();
    for (let i = 0; i < N; i++) src['k' + i] = 0;

    const dst = OObject(null, src.observer.id);
    for (let i = 0; i < N; i++) dst['k' + i] = 0;
    const network = createNetwork(dst.observer);

    const commits = [];
    const stop = src.observer.watchCommit(c => commits.push(c));
    for (let i = 0; i < N; i++) src['k' + i] = i + 1;
    stop();

    ready();
    for (const commit of commits) network.apply(commit);
    ready();
    network.remove();
});

// Insert: src and dst both empty, apply N insert commits
bench(`OObject ${N} Insert applies`, (ready) => {
    const src = OObject();
    const dst = OObject(null, src.observer.id);
    const network = createNetwork(dst.observer);

    const commits = [];
    const stop = src.observer.watchCommit(c => commits.push(c));
    for (let i = 0; i < N; i++) src['k' + i] = i;
    stop();

    ready();
    for (const commit of commits) network.apply(commit);
    ready();
    network.remove();
});

// Delete: src and dst both pre-populated, apply N delete commits
bench(`OObject ${N} Delete applies`, (ready) => {
    const src = OObject();
    for (let i = 0; i < N; i++) src['k' + i] = i;

    const dst = OObject(null, src.observer.id);
    for (let i = 0; i < N; i++) dst['k' + i] = i;
    const network = createNetwork(dst.observer);

    const commits = [];
    const stop = src.observer.watchCommit(c => commits.push(c));
    for (let i = 0; i < N; i++) delete src['k' + i];
    stop();

    ready();
    for (const commit of commits) network.apply(commit);
    ready();
    network.remove();
});

console.log();

// OArray Insert: src and dst both empty, apply N insert commits
bench(`OArray ${N} Insert applies`, (ready) => {
    const src = OArray();
    const dst = OArray(null, src.observer.id);
    const network = createNetwork(dst.observer);

    const commits = [];
    const stop = src.observer.watchCommit(c => commits.push(c));
    for (let i = 0; i < N; i++) src.push(i);
    stop();

    ready();
    for (const commit of commits) network.apply(commit);
    ready();
    network.remove();
});

// OArray Modify: clone src into dst so fractional indices match, apply N modify commits
bench(`OArray ${N} Modify applies`, (ready) => {
    const src = OArray();
    for (let i = 0; i < N; i++) src.push(0);

    const dst = clone(src);
    const network = createNetwork(dst.observer);

    const commits = [];
    const stop = src.observer.watchCommit(c => commits.push(c));
    for (let i = 0; i < N; i++) src[i] = i + 1;
    stop();

    ready();
    for (const commit of commits) network.apply(commit);
    ready();
    network.remove();
});
