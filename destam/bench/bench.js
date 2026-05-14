export default (ROUNDS) => (label, fn, rounds = ROUNDS) => {
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
