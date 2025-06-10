import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';
import createNetwork from '../Tracking.js';

import { clone } from './clone.js';

const trackers = async (func, n) => {
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

	await func(objects, networks.map(d => () => d.flush()));

	while (true) {
		if ((await Promise.all(digests.map(d => d.flush()))).indexOf(true) === -1) break;
	}

	for (let i = 1; i < n; i++) {
		expect(objects[0]).to.deep.equal(objects[i]);
	}

	for (const net of networks) net.remove();
}

[
	(name, func) => test('tracking duplex: ' + name, async () => trackers(func, 2)),
	(name, func) => test('tracking triplex: ' + name, async () => trackers(func, 3)),
	(name, func) => test('tracking 4: ' + name, async () => trackers(func, 4)),
].forEach(test => {
	test('basic', ([one, two]) => {
		one.a = 'a';
		two.b = 'b';
	});

	test('edit other', async ([one, two], [flush]) => {
		one.obj = OObject();
		await flush();
		two.obj.prop = "prop";
	});

	test('edit other inverse', async ([two, one], [_, flush]) => {
		one.obj = OObject();
		await flush();
		two.obj.prop = "prop";
	});

	test('delete and edit other', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 1.5', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		two.obj = orig;
	});

	test('delete and edit other 2', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 2.5', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		two.obj = orig;
	});

	test('delete and edit other 3', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		await flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other 3.5', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		await flush2();
		two.obj = orig;
	});

	test('delete and edit other invert', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other invert 1.5', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		two.obj = orig;
	});

	test('delete and edit other invert 2', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other invert 2.5', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		two.obj = orig;
	});

	test('delete and edit other invert 3', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		await flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other invert 3.5', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		orig.prop = "prop";
		delete one.obj;
		await flush();
		await flush2();
		two.obj = orig;
	});

	test('replace and edit other', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other 2', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other 3', async ([one, two], [flush, flush2]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		await flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other invert', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other invert 2', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other invert 3', async ([two, one], [flush2, flush]) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		await flush2();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace with reference and edit other', async ([one, two], [flush, flush2]) => {
		one.obj = one.obj2 = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace with reference and edit other', async ([two, one], [flush2, flush]) => {
		one.obj = one.obj2 = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('increment number', async ([one, two], [flush, flush2]) => {
		one.num = 0;

		for (let i = 0; i < 5; i++) {
			one.num++;
			await flush();

			two.num++;
			await flush2();
		}

		expect(two.num).to.equal(10);
	});

	test('object replacement', async ([one, two], [flush, flush2]) => {
		two.observer.watch(delta => {
			if (delta.value.value) return;

			two[delta.path[0]] = OObject({value: delta.value});
		});

		one.one = 1;
		one.two = 2;
		one.three = 3;

		await flush();
		await flush2();

		one.one.prop = "prop";
	});

	test('big busy array', async (objects, flush) => {
		objects[0].array = OArray();
		await flush[0]();

		for (let i = 0; i < 25; i++) {
			const obj = objects[Math.floor(Math.random() * objects.length)];
			obj.array.splice(Math.floor(obj.array.length * Math.random()), 0, Math.random());

			await flush[Math.floor(Math.random() * flush.length)]();
		}
	});

	// TODO: No conflict resolution yet
	/*
	test('big busy array and delete', async (objects, flush) => {
		objects[0].array = OArray();
		await flush[0]();

		for (let i = 0; i < 100; i++) {
			const obj = objects[Math.floor(Math.random() * objects.length)];

			if (Math.random() < .2) {
				obj.array.splice(Math.floor(obj.array.length * Math.random()), 1);
			} else {
				obj.array.splice(Math.floor(obj.array.length * Math.random()), 0, Math.random());
			}

			await flush[Math.floor(Math.random() * flush.length)]();
		}
	});
	*/
});
