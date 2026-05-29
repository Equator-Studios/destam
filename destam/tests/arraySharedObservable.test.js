import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';

// Regression: a single observable may legitimately be referenced from more than
// one place (the listener "shadow" mechanism exists for exactly this — see the
// "network crazy" case in network.test.js, where the same observable is held by
// both an OObject key and a UUIDMap). That worked for object keys but NOT for
// OArray indices: reusing an existing element instance at another index (e.g. a
// swap done as `splice(a, 1, arr[b])`) builds a shadow chain that
// removeListener() later walks off the end of, throwing
// "Cannot read properties of null (reading 'shadow_')".

const createRng = (seed = 12345) => {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};
};
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

test("OArray tolerates an observable shared across indices under heavy mutation", () => {
	const rng = createRng(1337);
	const doc = OObject({
		items: OArray([
			OObject({ label: 'a' }),
			OObject({ label: 'b' }),
			OObject({ label: 'c' }),
			OObject({ label: 'd' }),
		]),
	});

	// A live listener is required for the shadow bookkeeping to run at all.
	const stop = doc.observer.watch(() => {});

	const ops = ['push', 'pop', 'shift', 'unshift', 'splice', 'swap', 'replace'];
	for (let i = 0; i < 5000; i++) {
		const items = doc.items;
		const len = items.length;
		switch (pick(rng, ops)) {
			case 'push': items.push(OObject({ label: `p${i}` })); break;
			case 'pop': if (len) items.pop(); break;
			case 'shift': if (len) items.shift(); break;
			case 'unshift': items.unshift(OObject({ label: `u${i}` })); break;
			case 'splice': {
				const start = len ? Math.floor(rng() * len) : 0;
				const del = len ? Math.floor(rng() * Math.min(3, len - start)) : 0;
				const adds = Math.floor(rng() * 3);
				const vals = [];
				for (let j = 0; j < adds; j++) vals.push(OObject({ label: `s${i}-${j}` }));
				items.splice(start, del, ...vals);
				break;
			}
			case 'swap': {
				// reuses existing element instances -> same observable briefly at two indices
				if (len < 2) break;
				const a = Math.floor(rng() * len);
				let b = Math.floor(rng() * len);
				if (b === a) b = (b + 1) % len;
				const va = items[a];
				const vb = items[b];
				items.splice(a, 1, vb);
				items.splice(b, 1, va);
				break;
			}
			case 'replace': {
				if (!len) break;
				items[Math.floor(rng() * len)] = OObject({ label: `r${i}` });
				break;
			}
		}
	}

	for (const item of doc.items) assert.ok(item instanceof OObject);
	stop();
});
