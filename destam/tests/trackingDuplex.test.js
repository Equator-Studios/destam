import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';
import createNetwork from '../Tracking.js';

import { clone, withSeededRandom } from './util.js';

const trackersMultiNetwork = (func, n, invert) => {
	const objects = [OObject()];
	for (let i = 1; i < n; i++) {
		objects.push(clone(objects[0]));
	}

	const flushers = Array.from({length: n}, () => []);
	const digests = [];
	const networks = [];

	for (let i = 1; i < n; i++) {
		const network = createNetwork(objects[0].observer);
		const peerNetwork = createNetwork(objects[i].observer);
		networks.push(network, peerNetwork);

		const a = {}, b = {};

		const d1 = network.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: peerNetwork});
			peerNetwork.apply(decoded, b);
			return changes.length > 0;
		}, null, arg => arg === a);

		const d2 = peerNetwork.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network});
			network.apply(decoded, a);
			return changes.length > 0;
		}, null, arg => arg === b);

		flushers[0].push(() => d1.flush());
		flushers[i].push(() => d2.flush());
		digests.push(d1, d2);
	}

	{
		let objs = objects;
		let flushs = flushers.map(fs => () => fs.forEach(f => f()));

		if (invert) {
			objs = [objs[1], objs[0], ...objs.slice(2)];
			flushs = [flushs[1], flushs[0], ...flushs.slice(2)];
		}

		func(objs, flushs);
	}

	while (digests.map(d => d.flush()).some(Boolean));

	for (let i = 1; i < n; i++) {
		assert.deepStrictEqual(objects[0], objects[i]);
	}

	for (const net of networks) net.remove();
};

const trackers = (func, n, invert) => {
	const objects = [OObject()];
	for (let i = 1; i < n; i++) {
		objects.push(clone(objects[0]));
	}

	const networks = objects.map(obj => createNetwork(obj.observer));

	const digests = [];
	for (let i = 1; i < n; i++) {
		const network = networks[0];
		const otherNetwork = networks[i];

		const a = {}, b = {};
		digests.push(
			network.digest((changes, observerRefs) => {
				const decoded = clone(changes, {observerRefs, observerNetwork: otherNetwork});

				otherNetwork.apply(decoded, b);
				return changes.length > 0;
			}, null, arg => arg === a),
			otherNetwork.digest((changes, observerRefs) => {
				const decoded = clone(changes, {observerRefs, observerNetwork: network});

				network.apply(decoded, a);
				return changes.length > 0;
			}, null, arg => arg === b),
		);
	}

	{
		let objs = objects;
		let flushs = networks.map(d => () => d.flush());

		if (invert) {
			objs = [objs[1], objs[0], ...objs.slice(2)];
			flushs = [flushs[1], flushs[0], ...flushs.slice(2)];
		}

		func(objs, flushs);
	}

	while (digests.map(d => d.flush()).some(Boolean));

	for (let i = 1; i < n; i++) {
		assert.deepStrictEqual(objects[0], objects[i]);
	}

	for (const net of networks) net.remove();
};


[
	(name, func) => test('tracking duplex: ' + name, () => trackers(func, 2, false)),
	(name, func) => test('tracking duplex inverted: ' + name, () => trackers(func, 2, true)),
	(name, func) => test('tracking triplex: ' + name, () => trackers(func, 3, false)),
	(name, func) => test('tracking triplex inverted: ' + name, () => trackers(func, 3, true)),
	(name, func) => test('tracking 4: ' + name, () => trackers(func, 4, false)),
	(name, func) => test('tracking 4 inverted: ' + name, () => trackers(func, 4, true)),
	(name, func) => test('tracking 4 multi-network: ' + name, () => trackersMultiNetwork(func, 4, false)),
	(name, func) => test('tracking 4 multi-network inverted: ' + name, () => trackersMultiNetwork(func, 4, true)),
].forEach(test => {
	test('basic', ([one, two]) => {
		one.a = 'a';
		two.b = 'b';
	});

	test('edit other', ([one, two], [flush]) => {
		one.obj = OObject();
		flush();
		two.obj.prop = "prop";
	});

	test('edit other inverse', ([two, one], [_, flush]) => {
		one.obj = OObject();
		flush();
		two.obj.prop = "prop";
	});

	test('delete and edit other', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		let orig = two.obj;
		delete one.obj;
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 1.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		flush();
		two.obj = orig;
	});

	test('delete and edit other 1.5 add back', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		let orig = two.obj;
		orig.prop = "prop";
		let putBack = one.obj;
		delete one.obj;
		flush();
		one.obj = putBack;
		flush();
		two.obj = orig;
	});

	test('delete and edit other 2', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		delete one.obj;
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 2.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		flush();
		two.obj = orig;
	});

	test('delete and edit other 2.5 add back', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		let putBack = one.obj;
		delete one.obj;
		flush();
		one.obj = putBack;
		flush();
		two.obj = orig;
	});

	test('delete and edit other 3', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		delete one.obj;
		flush();
		flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 3.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		flush();
		flush2();
		two.obj = orig;
	});

	test('delete and edit other 3.5 add back', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		let putBack = one.obj;
		delete one.obj;
		flush();
		flush2();
		one.obj = putBack;
		flush();
		flush2();
		two.obj = orig;
	});

	test('replace and edit other', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		let orig = two.obj;
		one.obj = OObject();
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other 2', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		one.obj = OObject();
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other 3', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		one.obj = OObject();
		flush();
		flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other 1.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		let orig = two.obj;
		orig.prop = "prop";
		one.obj = OObject();
		flush();
		two.obj = orig;
	});

	test('replace and edit other 2.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		one.obj = OObject();
		flush();
		two.obj = orig;
	});

	test('replace and edit other 3.5', ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		flush();
		flush2();
		let orig = two.obj;
		orig.prop = "prop";
		one.obj = OObject();
		flush();
		flush2();
		two.obj = orig;
	});


	test('replace with reference and edit other', ([one, two], [flush, flush2]) => {
		one.obj = one.obj2 = OObject();
		flush();
		flush2();
		let orig = two.obj;
		one.obj = OObject();
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace with reference and edit other inverted', ([two, one], [flush2, flush]) => {
		one.obj = one.obj2 = OObject();
		flush();
		flush2();
		let orig = two.obj;
		one.obj = OObject();
		flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('increment number', ([one, two], [flush, flush2]) => {
		one.num = 0;

		for (let i = 0; i < 5; i++) {
			one.num++;
			flush();

			two.num++;
			flush2();
		}

		assert.strictEqual(two.num, 10);
	});

	test('object replacement', ([one, two], [flush, flush2]) => {
		two.observer.watch(delta => {
			if (delta.value.value) return;

			two[delta.path[0]] = OObject({value: delta.value});
		});

		one.one = 1;
		one.two = 2;
		one.three = 3;

		flush();
		flush2();

		one.one.prop = "prop";
	});

	test('big busy array', withSeededRandom((objects, flush) => {
		objects[0].array = OArray();
		flush[0]();
		flush[1]();

		for (let i = 0; i < 25; i++) {
			const obj = objects[Math.floor(Math.random() * objects.length)];
			obj.array.splice(Math.floor(obj.array.length * Math.random()), 0, Math.random());

			flush[Math.floor(Math.random() * flush.length)]();
		}
	}));

	test('big busy array and delete', withSeededRandom((objects, flush) => {
		objects[0].array = OArray();
		flush[0]();
		flush[1]();

		const pendingDeletes = new Set();

		for (let i = 0; i < 100; i++) {
			const obj = objects[Math.floor(Math.random() * objects.length)];

			if (Math.random() < .2 && obj.array.length > 0) {
				const start = Math.floor(Math.random() * obj.array.length);
				let pos = -1;
				for (let j = 0; j < obj.array.length; j++) {
					const candidate = (start + j) % obj.array.length;
					if (!pendingDeletes.has(obj.array[candidate])) {
						pos = candidate;
						break;
					}
				}
				if (pos >= 0) {
					pendingDeletes.add(obj.array[pos]);
					obj.array.splice(pos, 1);
				}
			} else {
				obj.array.splice(Math.floor(obj.array.length * Math.random()), 0, Math.random());
			}

			flush[Math.floor(Math.random() * flush.length)]();
		}
	}));
});
