import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';
import createNetwork from '../Tracking.js';

import { clone } from './clone.js';

[
	(name, func) => test('tracking duplex: ' + name, async () => {
		let object = OObject();
		let object2 = clone(object);

		const network = createNetwork(object.observer)
		const network2 = createNetwork(object2.observer);

		const packetizer = network.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network2});

			network2.apply(decoded, network2);
		}, 0, arg => arg === network);

		const packetizer2 = network2.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network});

			network.apply(decoded, network);
		}, 0, arg => arg === network2);

		await func(object, object2, packetizer.flush, packetizer2.flush);
		await packetizer.flush();
		await packetizer2.flush();
		expect(object).to.deep.equal(object2);

		network.remove();
		network2.remove();
	}),
	(name, func) => test('tracking triplex: ' + name, async () => {
		let object = OObject();
		let object2 = clone(object);
		let object3 = clone(object);

		const network = createNetwork(object.observer)
		const network2 = createNetwork(object2.observer);
		const network3 = createNetwork(object3.observer);

		const packetizer = network.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network2});

			network2.apply(decoded, network2);
		}, 0, arg => arg === network);

		const packetizer2 = network2.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network});

			network.apply(decoded, network);
		}, 0, arg => arg === network2);

		const packetizer3 = network.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network3});

			network3.apply(decoded);
		}, 0);

		await func(object, object2, packetizer.flush, packetizer2.flush);
		await packetizer.flush();
		await packetizer2.flush();
		await packetizer3.flush();
		expect(object).to.deep.equal(object2);

		network.remove();
		network2.remove();
		network3.remove();
	}),
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
});
