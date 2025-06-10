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

		let a = {}, b = {};

		digests.push(
			network.digest((changes, observerRefs) => {
				const decoded = clone(changes, {observerRefs, observerNetwork: otherNetwork});

				otherNetwork.apply(decoded, b);
			}, null, arg => arg === a),
			otherNetwork.digest((changes, observerRefs) => {
				const decoded = clone(changes, {observerRefs, observerNetwork: network});

				network.apply(decoded, a);
			}, null, arg => arg === b),
		);
	}

	await func(objects[0], objects[1], digests[0].flush, digests[1].flush);
	await digests[1].flush();
	await digests[0].flush();
	await Promise.all(digests.map(d => d.flush()));

	for (let i = 1; i < n; i++) {
		expect(objects[0]).to.deep.equal(objects[i]);
	}

	for (const net of networks) net.remove();
}

[
	(name, func) => test('tracking duplex: ' + name, async () => trackers(func, 2)),
	(name, func) => test('tracking triplex: ' + name, async () => trackers(func, 3)),
].forEach(test => {
	test('basic', (one, two) => {
		one.a = 'a';
		two.b = 'b';
	});

	test('edit other', async (one, two, flush) => {
		one.obj = OObject();
		await flush();
		two.obj.prop = "prop";
	});

	test('edit other inverse', async (two, one, _, flush) => {
		one.obj = OObject();
		await flush();
		two.obj.prop = "prop";
	});

	test('delete and edit other', async (one, two, flush, flush2) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('delete and edit other invert', async (two, one, flush2, flush) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		delete one.obj;
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other', async (one, two, flush, flush2) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace and edit other invert', async (two, one, flush2, flush) => {
		one.obj = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace with reference and edit other', async (one, two, flush, flush2) => {
		one.obj = one.obj2 = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('replace with reference and edit other', async (two, one, flush2, flush) => {
		one.obj = one.obj2 = OObject();
		await flush();
		await flush2();
		let orig = two.obj;
		one.obj = OObject();
		await flush();
		orig.prop = "prop";
		two.obj = orig;
	});

	test('increment number', async (one, two, flush, flush2) => {
		one.num = 0;

		for (let i = 0; i < 5; i++) {
			one.num++;
			await flush();

			two.num++;
			await flush2();
		}

		expect(two.num).to.equal(10);
	});

	test('object replacement', async (one, two, flush, flush2) => {
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
});
