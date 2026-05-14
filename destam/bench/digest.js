import OObject from '../Object.js';
import OArray from '../Array.js';
import Tracker from '../Tracking.js';

const ROUNDS = 500;
const N = 1_000;

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

    const segments = times.map(t => (t / rounds).toFixed(3) + 'ms');
    console.log(`${label}: ${segments.join('  →  ')}`);
};

console.log('(construct  →  mutate  →  flush)\n');

// --- single property, N mutations (all coalesce into one Modify) ---
bench(`single prop, ${N} mutations → 1 delta`, (ready) => {
    const obj = OObject({ value: 0 });
    const tracker = Tracker(obj.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) obj.value = i;
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});

// --- N properties, 1 mutation each (no coalescing, N deltas) ---
bench(`${N} props, 1 mutation each → ${N} deltas`, (ready) => {
    const obj = OObject();
    const tracker = Tracker(obj.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) obj['k' + i] = i;
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});

// --- N properties, N mutations each (N deltas, each coalesced from N) ---
bench(`${N} props, ${N} mutations each → ${N} deltas`, (ready) => {
    const obj = OObject();
    const tracker = Tracker(obj.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) obj['k' + i] = j;
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
}, 10);

// --- Insert + Delete same prop (cancels out → 0 deltas) ---
bench(`insert then delete same prop → 0 deltas`, (ready) => {
    const obj = OObject();
    const tracker = Tracker(obj.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) {
        obj['k' + i] = i;
        delete obj['k' + i];
    }
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});

// --- Delete + re-Insert same prop (coalesces to Modify) ---
bench(`delete then re-insert same prop → Modify`, (ready) => {
    const obj = OObject();
    for (let i = 0; i < N; i++) obj['k' + i] = i;
    const tracker = Tracker(obj.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) {
        delete obj['k' + i];
        obj['k' + i] = i * 2;
    }
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});

// --- OArray: N pushes (N Insert deltas, no coalescing) ---
bench(`OArray ${N} pushes → ${N} deltas`, (ready) => {
    const arr = OArray();
    const tracker = Tracker(arr.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) arr.push(i);
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});

// --- OArray: push then pop same element (Insert+Delete cancels) ---
bench(`OArray ${N} push+pop pairs → 0 deltas`, (ready) => {
    const arr = OArray();
    const tracker = Tracker(arr.observer);
    const deltas = [];
    const listener = tracker.digest(d => deltas.push(...d));
    ready();
    for (let i = 0; i < N; i++) {
        arr.push(i);
        arr.pop();
    }
    ready();
    listener.flush();
    listener.remove();
    tracker.remove();
});
