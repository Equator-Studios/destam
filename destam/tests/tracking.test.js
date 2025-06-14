import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import OArray from '../Array.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';
import createNetwork from '../Tracking.js';

import {Insert, Modify, Delete} from '../Events.js';
import { clone } from './clone.js';

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
		expect(object).to.deep.equal(object2);

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

		expect(none).to.equal(obj2[1]);
		expect(ntwo).to.equal(obj2[0]);
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

		expect(prevs).to.deep.equal(['hello', 'world']);
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

		expect(prevs).to.deep.equal(['hello', 'world']);
	});
});

test("track non observer", () => {
	expect(() => createNetwork({})).to.throw();
});

test("tracking garbage events object", () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	expect(() => network.apply([{id: obj.observer.id}])).to.throw();
});

test("tracking garbage events array", () => {
	const obj = OArray();
	const network = createNetwork(obj.observer);

	expect(() => network.apply([{id: obj.observer.id}])).to.throw();
});

test("tracking garbage events uuidmap", () => {
	const obj = OMap();
	const network = createNetwork(obj.observer);

	expect(() => network.apply([{id: obj.observer.id}])).to.throw();
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

	expect(events).to.equal(1);
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

	expect(events).to.equal(2);
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

	expect(events).to.equal(2);
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

	expect(events).to.equal(4);
});

test("tracking pass flush result back", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const value = {};

	const digest = network.digest(() => {
		return value;
	});

	obj.thing = 'thing';
	expect(await digest.flush()).to.equal(value);
});

test("tracking pass flush result back from network", async () => {
	const obj = OObject();
	const network = createNetwork(obj.observer);

	const value = {};

	const digest = network.digest(() => {
		return value;
	});

	obj.thing = 'thing';
	expect((await network.flush())[0]).to.equal(value);
});

test("tracking oobject ref not a string", () => {
	const obj = OObject();

	expect(() => {
		OObject.verify(obj.observer, Insert(null, null, 0));
	}).to.throw();
});

test("tracking oobject already exists", () => {
	const obj = OObject();
	obj.thing = 10;

	expect(() => {
		OObject.verify(obj.observer, Insert(null, 11, 'thing'));
	}).to.throw();
});

test("tracking oobject no exist modify", () => {
	const obj = OObject();

	expect(() => {
		OObject.verify(obj.observer, Modify(null, 11, 'thing'));
	}).to.throw();
});

test("tracking oobject no exist delete", () => {
	const obj = OObject();

	expect(() => {
		OObject.verify(obj.observer, Delete(null, 11, 'thing'));
	}).to.throw();
});

test("tracking omap already exists", () => {
	const obj = OMap();
	const id = UUID();
	obj.set(id, true);

	expect(() => {
		OMap.verify(obj.observer, Insert(null, OObject({
			id,
			value: false,
		}), id));
	}).to.throw();
});

test("tracking omap no exist modify", () => {
	const obj = OMap();
	const id = UUID();

	expect(() => {
		OMap.verify(obj.observer, Modify(null, OObject({
			id,
			value: false,
		}), id));
	}).to.throw();
});

test("tracking omap no exist delete", () => {
	const obj = OMap();
	const id = UUID();

	expect(() => {
		OMap.verify(obj.observer, Delete(null, OObject({
			id,
			value: false,
		}), id));
	}).to.throw();
});

test("tracking oarray already exists", () => {
	const obj = OArray();
	obj.push(1);

	expect(() => {
		OArray.verify(obj.observer, Insert(null, 2, obj.observer.indexes_[0]));
	}).to.throw();
});

test("tracking oarray no exist exists modify", () => {
	const obj = OArray();
	obj.push(1);
	const index = obj.observer.indexes_[0]; // steal the index
	obj.pop();

	expect(() => {
		OArray.verify(obj.observer, Modify(null, 2, index));
	}).to.throw();
});

test("tracking oarray no exist exists delete", () => {
	const obj = OArray();
	obj.push(1);
	const index = obj.observer.indexes_[0]; // steal the index
	obj.pop();

	expect(() => {
		OArray.verify(obj.observer, Delete(null, 2, index));
	}).to.throw();
});

test("tracking duplicates", () => {
	const id = UUID();
	const obj = OObject({});
	const network = createNetwork(obj.observer);

	expect(network.has(id)).to.equal(false);
	obj.thing = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing2 = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing = null;
	expect(network.has(id)).to.equal(true);
	obj.thing2 = null;
	expect(network.has(id)).to.equal(false);
});

test("tracking duplicates 2", () => {
	const id = UUID();
	const obj = OObject({});
	const network = createNetwork(obj.observer);

	expect(network.has(id)).to.equal(false);
	obj.thing = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing2 = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing2 = null;
	expect(network.has(id)).to.equal(true);
	obj.thing = null;
	expect(network.has(id)).to.equal(false);
});

test("tracking duplicates 3", () => {
	const id = UUID();
	const obj = OObject({}, id);
	const network = createNetwork(obj.observer);

	expect(network.has(id)).to.equal(true);
	obj.thing = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing2 = OObject({}, id);
	expect(network.has(id)).to.equal(true);
	obj.thing2 = null;
	expect(network.has(id)).to.equal(true);
	obj.thing = null;
	expect(network.has(id)).to.equal(true);
});

test("tracking network duplicates", () => {
	const id = UUID();
	const obj = OObject({}, id);
	const network = createNetwork(obj.observer);

	network.apply([
		Insert(null, true, 'thing', id),
	]);

	expect(() => {
		network.apply([
			Modify(true, false, 'thing', id),
			Modify(false, true, 'thing', id),
		]);
	}).to.throw();
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
				expect(stuff).to.deep.equal([['value'], ['value2']]);
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

	expect(stuff).to.deep.equal([[['thing']]]);
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

	expect(stuff).to.deep.equal([[['thing']]]);
});
