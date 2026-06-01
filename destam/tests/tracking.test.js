import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';
import createNetwork from '../Tracking.js';

import {Insert, Modify, Delete} from '../Events.js';
import { clone, withSeededRandom } from './util.js';

const silenceConflicting = fn => () => {
	const originalWarn = console.warn;
	console.warn = (msg, ...args) => {
		if (typeof msg === 'string' && msg.includes('Conflicting id in observer network')) return;
		originalWarn(msg, ...args);
	};
	try {
		return fn();
	} finally {
		console.warn = originalWarn;
	}
};

[
	(name, func) => test(name, async () => {
		let object = OObject();
		let object2 = clone(object);
		const network = createNetwork(object2.observer);

		const tracking = createNetwork(object.observer).digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: network});

			network.apply(decoded);
		}, null);

		await func(object, tracking.flush, object2);
		await tracking.flush();
		assert.deepStrictEqual(object, object2);

		network.remove();
	}),
].forEach(test => {
	test('basic tracking', async (obj1, flush) => {
		obj1.thing = 'hello';
	});

	test("tracking duplicate", async (obj1, flush) => {
		obj1.object = OObject();
		obj1.object2 = obj1.object;
	});

	test("tracking diamond mutate shared", async (obj1, flush) => {
		const shared = OObject();
		obj1.x = shared;
		obj1.y = shared;

		await flush();

		shared.foo = 'bar';
	});

	test("tracking diamond with nested observable", async (obj1, flush) => {
		const shared = OObject();
		obj1.x = shared;
		obj1.y = shared;

		await flush();

		const nested = OObject();
		shared.nested = nested;
		nested.baz = 'qux';
	});

	// Three references into a shared observable, removed in every possible
	// order. Verifies the shadow chain bookkeeping in Network.js survives the
	// full digest+apply round-trip: each delete must propagate cleanly, and
	// mutations on `shared` between deletes must keep both sides in sync. The
	// wrapper asserts deepStrictEqual(object, object2) at the end, and a broken
	// diamond/cycle handler would surface as either divergence or an
	// "already populated" / "unknown reg" error during apply.
	for (const order of [
		['x', 'y', 'z'],
		['x', 'z', 'y'],
		['y', 'x', 'z'],
		['y', 'z', 'x'],
		['z', 'x', 'y'],
		['z', 'y', 'x'],
	]) {
		test(`tracking diamond, three refs, remove in order ${order.join(',')}`, async (obj1, flush) => {
			const shared = OObject();
			obj1.x = shared;
			obj1.y = shared;
			obj1.z = shared;

			await flush();

			let counter = 0;
			shared.foo = counter++;
			await flush();

			for (const ref of order) {
				delete obj1[ref];
				// Mutate while at least one ref still survives, then flush.
				// On the last iteration `shared` is no longer reachable from
				// obj1 so this mutation is invisible to the digest — both
				// sides end up without `shared` and the wrapper's final
				// deep-equal still holds.
				shared.foo = counter++;
				await flush();
			}
		});
	}

	test("utilize refs", async (obj1, flush) => {
		obj1.object = OObject();

		await flush();

		obj1.object2 = obj1.object;
	});

	test("move ref and mutate", async (obj1, flush) => {
		obj1.object = OObject();

		await flush();

		obj1.object2 = obj1.object;
		obj1.object2.hello = 'world';
		delete obj1.object;
	});

	test("move ref and mutate delete first", async (obj1, flush) => {
		obj1.object = OObject();

		await flush();

		obj1.object2 = obj1.object;
		delete obj1.object;
		obj1.object2.hello = 'world';
	});

	test("delete and modify in tree", async (obj1, flush) => {
		obj1.object = OObject({
			object2: OObject({
				hello: 'world'
			})
		});

		await flush();

		obj1.object.object2.dude = 'null';
		delete obj1.object;
	});

	test("modify, delete and add back", async (obj1, flush) => {
		obj1.object = OObject({
			object2: OObject({
				hello: 'world'
			})
		});

		await flush();

		obj1.object.object2.dude = 'null';
		let orig = obj1.object;
		delete obj1.object;
		obj1.object = orig;
	});

	test("delete, modify and add back", async (obj1, flush) => {
		obj1.object = OObject({
			object2: OObject({
				hello: 'world'
			})
		});

		await flush();

		let orig = obj1.object;
		delete obj1.object;
		orig.object2.dude = 'null';
		obj1.object = orig;
	});

	test("delete, modify and add back nested", async (obj1, flush) => {
		obj1.object = OObject({
			object2: OObject({
				hello: 'world'
			})
		});

		await flush();

		let orig = obj1.object;
		delete obj1.object;
		orig.object2.dude = 'null';
		orig.nested = OObject();
		orig.nested.state = 'state';
		obj1.object = orig;
	});

	test("delete, modify and add back nested twice", async (obj1, flush) => {
		obj1.object = OObject({
			object2: OObject({
				hello: 'world'
			})
		});

		await flush();

		let orig = obj1.object;
		delete obj1.object;
		orig.object2.dude = 'null';
		orig.nested = OObject();
		orig.nested.state = OObject();
		orig.nested.state.state = 'state';
		obj1.object = orig;
	});

	test("ref inside object", async (obj1, flush) => {
		obj1.object = OObject();
		obj1.test = OObject();

		await flush();

		let thing = obj1.test;
		delete obj1.test;
		obj1.object.test = thing;
	});

	test("ref inside array", async (obj1, flush) => {
		obj1.array = OArray();
		obj1.object = OObject();
		obj1.object.array = OArray();

		obj1.array.push(OObject());

		await flush();

		let thing = obj1.array[0];
		obj1.array.pop();
		obj1.object.array.push(thing);
	});

	test("object swap", async (obj1, flush, obj2) => {
		const one = OObject({one: 1});
		const two = OObject({two: 2});

		obj1.numbers = OArray([one, two]);

		await flush();

		let none = obj2[0];
		let ntwo = obj2[1];

		obj1.numbers.splice(0, 2, two, one);

		await flush();

		assert.strictEqual(none, obj2[1]);
		assert.strictEqual(ntwo, obj2[0]);
	});

	test ('tracking of two events', async (obj1, flush) => {
		obj1.thing = 'hello';
		obj1.else = 'something else';
	});

	test ('tracking of inserted then modifying element', async (obj1, flush) => {
		obj1.thing = 'hello';
		obj1.thing = 'other';
	});

	test ('tracking basic omap once', async (obj1, flush) => {
		obj1.thing = OMap();
		let id = UUID();
		obj1.thing.set(id, 'hello');
	});

	test ('tracking basic omap', async (obj1, flush) => {
		obj1.thing = OMap();

		await flush();

		let id = UUID();
		obj1.thing.set(id, 'hello');
	});

	test ('omap delete and set', async (obj1, flush) => {
		obj1.thing = OMap();

		let id = UUID();
		obj1.thing.set(id, 'hello');

		await flush();

		obj1.thing.delete(id);
		obj1.thing.set(id, true);
	});

	test ('omap replace', async (obj1, flush, obj2) => {
		obj1.thing = OMap();

		let elem = OObject({id: UUID()});
		obj1.thing.setElement(elem);

		for (let i = 0; i < 3; i++) {
			await flush();

			obj1.thing.deleteElement(elem);
			elem.id = UUID();
			obj1.thing.setElement(elem);
		}
	});

	test ('omap replace element', async (obj1, flush, obj2) => {
		obj1.thing = OMap();

		let elem = OObject({id: UUID()});
		obj1.thing.setElement(elem);

		await flush();
		let elem2 = OObject({id: elem.id});
		obj1.thing.setElement(elem2);

		await flush();
		obj1.thing.deleteElement(elem2);
	});

	test ('omap replace at once', async (obj1, flush, obj2) => {
		obj1.thing = OMap();

		let elem = OObject({id: UUID()});
		obj1.thing.setElement(elem);

		await flush();

		for (let i = 0; i < 3; i++) {
			obj1.thing.deleteElement(elem);
			elem.id = UUID();
			obj1.thing.setElement(elem);
		}
	});

	test ('omap delete and set different id', async (obj1, flush) => {
		obj1.thing = OMap();

		let id = UUID();
		obj1.thing.set(id, 'hello');

		await flush();

		obj1.thing.delete(id);
		obj1.thing.set(UUID(), true);
	});

	test ('tracking omap modify', async (obj1, flush) => {
		obj1.thing = OMap();

		await flush();

		let id = UUID();
		obj1.thing.set(id, 'hello');

		await flush();

		obj1.thing.set(id, 'world');
	});

	test ('tracking of inserted then delete element once', async (obj1, flush) => {
		obj1.thing = 'hello';
		obj1.thing = 'other';
		delete obj1.thing;
	});

	test ('tracking of inserted then delete element', async (obj1, flush) => {
		obj1.thing = 'hello';

		await flush();

		delete obj1.thing;
	});

	test ('tracking of inserted then modify and delete element', async (obj1, flush) => {
		obj1.thing = 'hello';

		await flush();

		obj1.thing = 'other';
		delete obj1.thing;
	});

	test ('tracking of deleted then inserted element once', async (obj1, flush) => {
		obj1.thing = 'hello';

		delete obj1.thing;
		obj1.thing = 'other';
	});

	test ('tracking of deleted then inserted element', async (obj1, flush) => {
		obj1.thing = 'hello';

		await flush();

		delete obj1.thing;
		obj1.thing = 'other';
	});

	test ('tracking of nesting', async (obj1, flush) => {
		obj1.nested = OArray();
		obj1.nested.push(0);
	});

	test ('tracking of nesting double', async (obj1, flush) => {
		obj1.nested = OArray();
		obj1.nested.push(OArray());
		obj1.nested[0].push(0);
	});

	test ('tracking of nesting double once', async (obj1, flush) => {
		obj1.nested = OArray([OArray()]);
		obj1.nested[0].push(0);
	});

	test ('tracking of nesting then deleting', async (obj1, flush) => {
		obj1.nested = OArray();
		obj1.nested.push(OArray());
		obj1.nested[0].push(0);

		await flush();

		obj1.nested[0].push(2);
		delete obj1.nested;
	});

	test ('tracking with null', async (obj1, flush) => {
		obj1.nested = OArray();
		obj1.nested = null;
	});

	test("unlinking then relinking through a network", async (object, flush) => {
		let object2 = OObject();
		object.nested = object2;
		object2.thing = 'hello';

		await flush();
		object.nested = null;
		object.nested = object2;
	});

	test("unlinking then relinking through a network with an array", async (object, flush) => {
		let obj = OObject();
		obj.thing = 'hello';

		object.nested = OArray();
		object.nested.push(obj);

		await flush();

		object.nested.pop(obj);
		object.nested.push(obj);
	});

	test("tracking object swap", async (object, flush) => {
		const one = OObject({one: 1}), two = OObject({two: 2});
		object.numbers = OArray([one, two]);

		await flush();

		object.numbers.splice(0, 2, two, one);
	});

	test("tracking linked delete and insert", async (object, flush) => {
		const original = object.thing = OObject();
		await flush();

		delete object.thing;
		object.thing = original;
	});

	test("tracking linked delete modify and insert", async (object, flush) => {
		const original = object.thing = OObject();
		await flush();

		delete object.thing;
		object.thing = OObject();
		object.thing = original;
	});

	test("tracking eliminate redundant modify", async (object, flush) => {
		object.thing = true;

		await flush();

		object.thing = false;
		object.thing = true;
	});

	test("tracking linked modify and insert", async (object, flush) => {
		const original = object.thing = OObject();
		await flush();

		const redHerring = OObject();
		object.what = redHerring;
		object.thing = redHerring;

		object.thing = original;
	});

	test("weird uuid o_ref indirection", async (object, flush) => {
		const elem = OObject({id: UUID()});
		object.thing = OMap([elem]);
		await flush();

		object.thing2 = elem;
		object.thing = OMap([elem]);
	});

	test("tracking nested changes", async (object, flush) => {
		object.weird = OObject();
		object.weird.other = OObject();
		object.weird.other.param = 'param';
	});

	test("tracking nested changes preinitialized", async (object, flush) => {
		object.weird = OObject({other: null});
		object.weird.other = OObject({other: OObject()});
		object.weird.other.other.param = 'param';
	});

	test("tracking combining properties into child", async (object, flush) => {
		object.one = OObject();
		object.two = OObject();
		await flush();

		object.array = OArray([object.one, object.two]);
	});

	test("tracking combining properties into child then delete", async (object, flush) => {
		object.one = OObject();
		object.two = OObject();
		await flush();

		object.array = OArray([object.one, object.two]);
		delete object.one;
		delete object.two;
	});

	test("tracking combining properties into child then delete before", async (object, flush) => {
		const orig1 = object.one = OObject();
		const orig2 = object.two = OObject();
		await flush();

		delete object.one;
		delete object.two;

		object.array = OArray([orig1, orig2]);
	});

	test("tracking reference base", async (object, flush) => {
		object.object = object;
	});

	test("tracking reference base nested", async (object, flush) => {
		object.object = object;
		await flush();

		object.thing = OObject();
	});

	test("tracking reference nested once", async (object, flush) => {
		object.thing = OObject();
		object.thing2 = OObject({thing: object.thing});
	});

	test("tracking reference nested", async (object, flush) => {
		object.thing = OObject();
		await flush();

		object.thing2 = OObject({thing: object.thing});
	});

	test("tracking reference nested delete", async (object,  flush) => {
		object.thing = OObject();
		await flush();

		const orig = object.thing;
		delete object.thing;
		object.thing2 = OObject({thing: orig});
	});

	test("tracking multiple references circular once", async (object, flush) => {
		object.thing = OObject();
		object.thing.thing = object.thing;
	});

	test("tracking array moved out then deleted two elements", async (object, flush) => {
		object.thing = OArray([
			OObject(),
			OObject()
		]);

		await flush();

		let ref = object.thing[0];
		delete object.thing;
		object.thing2 = ref;
		ref.name = 'thing';
	});

	test("tracking array added then mutated and replaced", async (object, flush) => {
		object.thing = OArray();

		await flush();

		object.thing.push(OObject());
		object.thing[0].hello = 'world';

		object.thing[0] = OObject();
	});

	test("delete then insert many times", async (obj1, flush) => {
		obj1.array = OArray();
		obj1.object = OObject();
		obj1.object.array = OArray();

		obj1.array.push(OObject({
			one: OObject({
				one: OObject(),
				two: OObject()
			}),
			two: OObject({
				one: OObject(),
				two: OObject()
			}),
		}));

		await flush();

		for (let i = 0; i < 10; i++) {
			let thing = obj1.array[0];
			obj1.array.pop();
			obj1.object.array.push(thing);

			await flush();

			thing = obj1.object.array[0];
			obj1.object.array.pop();
			obj1.array.push(thing);

			await flush();
		}
	});

	test("insert then delete many times", async (obj1, flush) => {
		obj1.array = OArray();
		obj1.object = OObject();
		obj1.object.array = OArray();

		obj1.array.push(OObject({
			one: OObject({
				one: OObject(),
				two: OObject()
			}),
			two: OObject({
				one: OObject(),
				two: OObject()
			}),
		}));

		await flush();

		for (let i = 0; i < 10; i++) {
			let thing = obj1.array[0];
			obj1.object.array.push(thing);
			obj1.array.pop();

			await flush();

			thing = obj1.object.array[0];
			obj1.array.push(thing);
			obj1.object.array.pop();

			await flush();
		}
	});

	test("insert then delete then insert many times", async (obj1, flush) => {
		obj1.array = OArray();
		obj1.object = OObject();
		obj1.object.array = OArray();

		obj1.array.push(OObject({
			one: OObject({
				one: OObject(),
				two: OObject()
			}),
			two: OObject({
				one: OObject(),
				two: OObject()
			}),
		}));

		await flush();

		for (let i = 0; i < 10; i++) {
			let thing = obj1.array[0];
			obj1.array.pop();
			obj1.object.array.push(thing);

			await flush();

			thing = obj1.object.array[0];
			obj1.array.push(thing);
			obj1.object.array.pop();

			await flush();
		}
	});

	test("network unlinked observable", async (obj1, flush) => {
		obj1.value = {observable: OObject()};

		await flush();
	});

	test("modify temporarily removed", async (obj1, flush) => {
		let val = OObject();
		obj1.value = val;

		await flush();
		delete obj1.value;
		val.thing = 'thing';
		obj1.value = val;
	});

	test("modify temporarily removed observer", async (obj1, flush) => {
		let val = OObject();
		obj1.value = val;

		await flush();
		delete obj1.value;
		val.thing = OObject();
		obj1.value = val;
	});

	test("modify temporarily removed relink", async (obj1, flush) => {
		let val = OObject();
		obj1.value = val;

		await flush();
		obj1.value = 0;
		val.thing = 'thing';
		obj1.value = val;
	});

	test("modify temporarily removed observer relink", async (obj1, flush) => {
		let val = OObject();
		obj1.value = val;

		await flush();
		obj1.value = 0;
		val.thing = OObject();
		obj1.value = val;
	});

	test("modify to same value", async (obj1, flush) => {
		obj1.value = "hello";

		await flush();
		obj1.value = "dude";
		obj1.value = "hello";
	});

	test('object prev', async (obj1, flush, obj2) => {
		obj1.thing = 'hello';
		await flush();

		let prevs = [];
		obj2.observer.watch(delta => prevs.push(delta.prev));

		obj1.thing = 'world';
		await flush();

		delete obj1.thing;
		await flush();

		assert.deepStrictEqual(prevs, ['hello', 'world']);
	});

	test('array prev', async (obj1, flush, obj2) => {
		let arr = OArray([0, 0]);
		// do weird things with the index
		arr.splice(1, 0, 'hello');
		arr.splice(0, 1);
		arr.splice(1, 1);
		obj1.arr = arr;
		await flush();

		let prevs = [];
		obj2.observer.watch(delta => prevs.push(delta.prev));

		arr[0] = 'world';
		await flush();

		arr.splice(0, 1);
		await flush();

		assert.deepStrictEqual(prevs, ['hello', 'world']);
	});
});

test("track non observer", () => {
	assert.throws(() => createNetwork({}));
});

test("tracking garbage events object", () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	assert.throws(() => network.apply([{id: obj.observer.id}]));
});

test("tracking garbage events array", () => {
	const obj = OArray();
	const network = createNetwork(obj.observer);

	assert.throws(() => network.apply([{id: obj.observer.id}]));
});

test("tracking garbage events uuidmap", () => {
	const obj = OMap();
	const network = createNetwork(obj.observer);

	assert.throws(() => network.apply([{id: obj.observer.id}]));
});

test("tracking remove network with digest", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let events = 0;
	const digest = network.digest(() => {
		events++;
	});

	obj.thing = 'thing';
	await digest.flush();

	network.remove();

	obj.thing2 = 'thing';
	await digest.flush();

	assert.strictEqual(events, 1);
});

test("tracking remove network with multiple digest", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let events = 0;
	const digest = network.digest(() => {
		events++;
	});

	const digest2 = network.digest(() => {
		events++;
	});

	obj.thing = 'thing';
	await digest.flush();
	await digest2.flush();

	network.remove();

	obj.thing2 = 'thing';
	await digest.flush();
	await digest2.flush();

	assert.strictEqual(events, 2);
});

test("tracking flush network with digest", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let events = 0;
	const digest = network.digest(() => {
		events++;
	});

	obj.thing = 'thing';
	await network.flush();

	obj.thing2 = 'thing';
	await network.flush();

	assert.strictEqual(events, 2);
});

test("tracking flush network with multiple digest", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let events = 0;
	network.digest(() => {
		events++;
	});

	network.digest(() => {
		events++;
	});

	obj.thing = 'thing';
	await network.flush();

	obj.thing2 = 'thing';
	await network.flush();

	assert.strictEqual(events, 4);
});

test("tracking pass flush result back", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const value = {};

	const digest = network.digest(() => {
		return value;
	});

	obj.thing = 'thing';
	assert.strictEqual(await digest.flush(), value);
});

test("tracking pass flush result back from network", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const value = {};

	const digest = network.digest(() => {
		return value;
	});

	obj.thing = 'thing';
	assert.strictEqual((await network.flush())[0], value);
});

test("tracking oobject ref not a string", () => {
	const obj = OObject();

	assert.throws(() => {
		OObject.verify(obj.observer, Insert(null, null, 0));
	});
});

test("tracking oobject already exists", () => {
	const obj = OObject();
	obj.thing = 10;

	assert.throws(() => {
		OObject.verify(obj.observer, Insert(null, 11, 'thing'));
	});
});

test("tracking oobject no exist modify", () => {
	const obj = OObject();

	assert.throws(() => {
		OObject.verify(obj.observer, Modify(null, 11, 'thing'));
	});
});

test("tracking oobject no exist delete", () => {
	const obj = OObject();

	assert.throws(() => {
		OObject.verify(obj.observer, Delete(null, 11, 'thing'));
	});
});

test("tracking omap already exists", () => {
	const obj = OMap();
	const id = UUID();
	obj.set(id, true);

	assert.throws(() => {
		OMap.verify(obj.observer, Insert(null, OObject({
			id,
			value: false,
		}), id));
	});
});

test("tracking omap no exist modify", () => {
	const obj = OMap();
	const id = UUID();

	assert.throws(() => {
		OMap.verify(obj.observer, Modify(null, OObject({
			id,
			value: false,
		}), id));
	});
});

test("tracking omap no exist delete", () => {
	const obj = OMap();
	const id = UUID();

	assert.throws(() => {
		OMap.verify(obj.observer, Delete(null, OObject({
			id,
			value: false,
		}), id));
	});
});

test("tracking oarray already exists", () => {
	const obj = OArray();
	obj.push(1);

	assert.throws(() => {
		OArray.verify(obj.observer, Insert(null, 2, obj.observer.indexes_[0]));
	});
});

test("tracking oarray no exist exists modify", () => {
	const obj = OArray();
	obj.push(1);
	const index = obj.observer.indexes_[0]; // steal the index
	obj.pop();

	assert.throws(() => {
		OArray.verify(obj.observer, Modify(null, 2, index));
	});
});

test("tracking oarray no exist exists delete", () => {
	const obj = OArray();
	obj.push(1);
	const index = obj.observer.indexes_[0]; // steal the index
	obj.pop();

	assert.throws(() => {
		OArray.verify(obj.observer, Delete(null, 2, index));
	});
});

test("tracking duplicates", silenceConflicting(() => {
	const id = UUID();
	const obj = OObject({});
	const network = createNetwork(obj.observer);

	assert.strictEqual(network.has(id), false);
	obj.thing = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing2 = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing = null;
	assert.strictEqual(network.has(id), true);
	obj.thing2 = null;
	assert.strictEqual(network.has(id), false);
}));

test("tracking duplicates 2", silenceConflicting(() => {
	const id = UUID();
	const obj = OObject({});
	const network = createNetwork(obj.observer);

	assert.strictEqual(network.has(id), false);
	obj.thing = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing2 = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing2 = null;
	assert.strictEqual(network.has(id), true);
	obj.thing = null;
	assert.strictEqual(network.has(id), false);
}));

test("tracking duplicates 3", silenceConflicting(() => {
	const id = UUID();
	const obj = OObject({}, id);
	const network = createNetwork(obj.observer);

	assert.strictEqual(network.has(id), true);
	obj.thing = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing2 = OObject({}, id);
	assert.strictEqual(network.has(id), true);
	obj.thing2 = null;
	assert.strictEqual(network.has(id), true);
	obj.thing = null;
	assert.strictEqual(network.has(id), true);
}));

{
	const perms = arr => arr.length <= 1 ? [[...arr]] :
		arr.flatMap((_, i) => perms([...arr.slice(0, i), ...arr.slice(i + 1)]).map(p => [arr[i], ...p]));

	for (const order of perms(['thing', 'thing2', 'thing3'])) {
		test(`tracking conflicting ids N=3 remove order [${order.join(',')}]`, silenceConflicting(() => {
			const id = UUID();
			const obj = OObject({});
			const network = createNetwork(obj.observer);

			obj.thing = OObject({}, id);
			obj.thing2 = OObject({}, id);
			obj.thing3 = OObject({}, id);

			for (let i = 0; i < order.length; i++) {
				obj[order[i]] = null;
				assert.strictEqual(network.has(id), i < order.length - 1);
			}
		}));
	}

	for (const order of perms(['thing', 'thing2', 'thing3', 'thing4'])) {
		test(`tracking conflicting ids N=4 remove order [${order.join(',')}]`, silenceConflicting(() => {
			const id = UUID();
			const obj = OObject({});
			const network = createNetwork(obj.observer);

			obj.thing = OObject({}, id);
			obj.thing2 = OObject({}, id);
			obj.thing3 = OObject({}, id);
			obj.thing4 = OObject({}, id);

			for (let i = 0; i < order.length; i++) {
				obj[order[i]] = null;
				assert.strictEqual(network.has(id), i < order.length - 1);
			}
		}));
	}
}

test("tracking network duplicates", () => {
	const id = UUID();
	const obj = OObject({}, id);
	const network = createNetwork(obj.observer);

	network.apply([
		Insert(null, true, 'thing', id),
	]);

	assert.throws(() => {
		network.apply([
			Modify(true, false, 'thing', id),
			Modify(false, true, 'thing', id),
		]);
	});
});

test("tracking flush mutations during digest", () => new Promise((ok, err) => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const stuff = [];
	network.digest((changes) => {
		stuff.push(changes[0].path);

		if (stuff.length === 1) {
			obj.value2 = 1;
		} else {
			try {
				assert.deepStrictEqual(stuff, [['value'], ['value2']]);
				ok();
			} catch (e) {
				err(e);
			}
		}
	}, 0);

	obj.value = 1;
}));

test("tracking constraint network", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer.shallow(1));

	const stuff = [];
	const digest = network.digest(changes => {
		stuff.push(changes.map(delta => delta.path));
	});

	obj.thing = OObject();
	await digest.flush();

	obj.thing.thing = 'thing';
	await digest.flush();

	assert.deepStrictEqual(stuff, [[['thing']]]);
});

test("tracking constraint network with dummy", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer.shallow(1));

	const stuff = [];
	const digest = network.digest(changes => {
		stuff.push(changes.map(delta => delta.path));
	});

	obj.thing = OObject();
	await digest.flush();

	let rem = obj.thing;
	delete obj.thing;

	rem.thing = 'thing';
	obj.thing = rem;

	await digest.flush();

	assert.deepStrictEqual(stuff, [[['thing']]]);
});

// === Tests for digest() with async (promise-returning) callbacks ===

test("digest async callback resolves through flush", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let callbackInvocations = 0;
	let resolveCallback;
	const callbackBarrier = new Promise(r => { resolveCallback = r; });

	const digest = network.digest(async commit => {
		callbackInvocations++;
		await callbackBarrier;
		return 'done';
	}, null);

	obj.thing = 'hello';
	const flushPromise = digest.flush();

	// Sync runs the body (and invokes the callback) synchronously before
	// awaiting any internal promise returned by the callback.
	assert.strictEqual(callbackInvocations, 1, "callback should have been invoked synchronously");

	resolveCallback();
	const result = await flushPromise;
	assert.strictEqual(result, 'done');

	digest.remove();
	network.remove();
});

test("digest async callback that rejects propagates the error", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const digest = network.digest(async commit => {
		throw new Error('boom');
	}, null);

	obj.thing = 'hello';

	await assert.rejects(digest.flush(), /boom/);

	digest.remove();
	network.remove();
});

test("changes during async sync are picked up by a subsequent flush", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const allCommits = [];
	const resolvers = [];

	// Each callback invocation pushes its own resolver onto `resolvers`, so
	// they don't overwrite each other across invocations.
	const digest = network.digest(async commit => {
		allCommits.push(commit.map(d => d.ref));
		await new Promise(r => resolvers.push(r));
	}, null);

	obj.a = 1;
	const firstFlush = digest.flush();

	// First callback is now awaiting resolvers[0]. Mutate while sync is
	// in flight — these changes should accumulate into the digest's
	// changes map.
	obj.b = 2;

	resolvers[0]();
	await firstFlush;

	// In passive mode (time=null) post-sync `reset` does NOT auto-schedule
	// a next sync even though changes.size > 0. An explicit flush picks
	// them up.
	const secondFlush = digest.flush();
	resolvers[1]();
	await secondFlush;

	assert.deepStrictEqual(allCommits, [['a'], ['b']]);

	digest.remove();
	network.remove();
});

test("flush during pending async sync doesn't reinvoke the callback", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let callbackInvocations = 0;
	let resolveCallback;
	const digest = network.digest(async commit => {
		callbackInvocations++;
		await new Promise(r => { resolveCallback = r; });
	}, null);

	obj.thing = 'hello';
	const firstFlush = digest.flush();

	// Calling flush() again while the first is still pending should not
	// invoke the callback a second time.
	digest.flush();
	assert.strictEqual(callbackInvocations, 1,
		"callback should not be invoked twice while first sync is pending");

	// Release and let everything settle.
	resolveCallback();
	await firstFlush;

	digest.remove();
	network.remove();
});

test("digest.remove() during pending async sync still releases dummies", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	let resolveFirstCallback;
	let callCount = 0;
	// The first invocation blocks on a Promise (simulating an async flush
	// in progress). Subsequent invocations (triggered by the follow-up sync
	// queued via wantsSync) return undefined so they complete synchronously
	// and don't hang the test.
	const digest = network.digest(commit => {
		callCount++;
		if (callCount === 1) {
			return new Promise(r => { resolveFirstCallback = r; });
		}
	}, null);

	obj.child = OObject();
	const cache = obj.child;
	const firstFlush = digest.flush();

	// Delete child while the first sync is in flight — creates a dummy in
	// cache's reg.listeners_ and pushes it onto the digest's `dummies`
	// array (waiting for the next sync to unref it).
	delete obj.child;

	// Remove the digest mid-sync. Sync is in progress so this can't process
	// dummies immediately, but it queues a follow-up sync via wantsSync that
	// must process them once the in-flight sync completes.
	digest.remove();

	// Release the still-pending first callback. Resolution triggers `reset`,
	// which runs the queued follow-up sync — that's where the dummy gets
	// unref'd.
	resolveFirstCallback();
	await firstFlush;

	assert.strictEqual(cache.observer.listeners_.size, 0,
		"dummy should be cleaned up after digest.remove() even when sync was pending");

	network.remove();
});

test("re-entrant flush combines multiple digests into one transaction", async () => {
	const obj1 = OObject();
	const obj2 = OObject();
	const net1 = createNetwork(obj1.observer);
	const net2 = createNetwork(obj2.observer);

	const TYPE_1 = 0;
	const TYPE_2 = 1;

	let inFlush = false;
	const transactions = [];

	const orchestrate = (flushType, changes, observerRefs) => {
		if (inFlush) return [changes, observerRefs];
		inFlush = true;

		return (async () => {
			try {
				const networks = [net1, net2];
				const both = await Promise.all([TYPE_1, TYPE_2].map(type => {
					if (type === flushType) {
						return Promise.resolve([changes, observerRefs]);
					}

					return networks[type].flush().then(digests => digests[0]);
				}));

				transactions.push(both);
			} finally {
				inFlush = false;
			}
		})();
	};

	const digest1 = net1.digest((changes, observerRefs) =>
		orchestrate(TYPE_1, changes, observerRefs), null);
	const digest2 = net2.digest((changes, observerRefs) =>
		orchestrate(TYPE_2, changes, observerRefs), null);

	obj1.a = 1;
	obj2.b = 2;

	await net1.flush();

	assert.strictEqual(transactions.length, 1);

	const [[changes1, refs1], [changes2, refs2]] = transactions[0];

	assert.strictEqual(changes1.length, 1);
	assert.strictEqual(changes1[0].ref, 'a');
	assert.strictEqual(changes1[0].value, 1);
	assert.strictEqual(typeof refs1, 'function');

	assert.strictEqual(changes2.length, 1);
	assert.strictEqual(changes2[0].ref, 'b');
	assert.strictEqual(changes2[0].value, 2);
	assert.strictEqual(typeof refs2, 'function');

	// And the next round, triggered from the *other* side, should work the
	// same way — proves the guard resets and isn't tied to TYPE_1 being the
	// initiator.
	obj1.c = 3;
	obj2.d = 4;
	await net2.flush();

	assert.strictEqual(transactions.length, 2);
	const [[c1, ], [c2, ]] = transactions[1];
	assert.strictEqual(c1[0].ref, 'c');
	assert.strictEqual(c2[0].ref, 'd');

	digest1.remove();
	digest2.remove();
	net1.remove();
	net2.remove();
});

// When a child observable is removed during a digest cycle, a dummy is
// inserted into the child's reg to keep events routing to the digest until
// it next syncs. The concern: when the digest is removed, its share of the
// dummy's refs_ must be unref'd as part of that removal — we can't rely on
// future events arriving at remove_ to clean up, because once the digest
// is out of network.eventListeners_, remove_ is no longer called on it.
test("digest removed while dummy is active unrefs immediately", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const digest = network.digest(() => {}, null);

	obj.child = OObject({foo: 'bar'});
	await digest.flush();

	const cache = obj.child;
	delete obj.child;

	// Exercise the dummy's event-routing role — mutate the orphan while
	// the dummy is active. The dummy in cache's reg is what carries this
	// event to the still-attached digest.
	cache.myValue = 'whatever';

	// At this point the dummy should be in cache's reg.listeners_.
	assert.ok(
		cache.observer.listeners_.size > 0,
		"expected dummy in cache.observer.listeners_ after delete (mid-digest)"
	);

	// Remove the digest. This must unref the dummy as part of the
	// removal — no further events are coming to clean it up.
	digest.remove();

	assert.strictEqual(
		cache.observer.listeners_.size, 0,
		"expected dummy to be unref'd and removed on digest.remove()"
	);

	network.remove();
});

test("tracking multi-digest fuzzer", withSeededRandom(() => {
	const N = 5;
	const ITERATIONS = 500;

	const source = OObject();
	const sourceNetwork = createNetwork(source.observer);

	const replicas = [];
	const digests = [];

	for (let i = 0; i < N; i++) {
		const replica = clone(source);
		const replicaNetwork = createNetwork(replica.observer);

		const digest = sourceNetwork.digest((changes, observerRefs) => {
			const decoded = clone(changes, {observerRefs, observerNetwork: replicaNetwork});
			replicaNetwork.apply(decoded);
		}, null);

		replicas.push({obj: replica, network: replicaNetwork});
		digests.push(digest);
	}

	const keys = ['a', 'b', 'c', 'd', 'e'];
	let counter = 0;

	for (let i = 0; i < ITERATIONS; i++) {
		const existingKeys = Object.keys(source);

		if (existingKeys.length > 0 && Math.random() < 0.2) {
			delete source[existingKeys[Math.floor(Math.random() * existingKeys.length)]];
		} else if (Math.random() < 0.3) {
			source[keys[Math.floor(Math.random() * keys.length)]] = OObject({value: counter++});
		} else {
			source[keys[Math.floor(Math.random() * keys.length)]] = counter++;
		}

		digests[Math.floor(Math.random() * digests.length)].flush();
	}

	// drain all digests in one synchronous pass
	for (const d of digests) d.flush();

	for (const {obj} of replicas) {
		assert.deepStrictEqual(source, obj);
	}

	for (const {network} of replicas) network.remove();
	sourceNetwork.remove();
}));
