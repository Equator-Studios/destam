import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import OArray, {indexPosition} from '../Array.js';
import UUID from '../UUID.js';
import OMap from '../UUIDMap.js';
import createNetwork from '../Tracking.js';

import { stringify, parse, clone, withSeededRandom } from './util.js';

[
	(name, callback) => test("forward " + name, () => {
		const object = OObject();
		const object2 = parse(stringify(object));
		const network = createNetwork(object2.observer);

		object.observer.watch(event => {
			network.apply([clone(event)]);
		});

		callback(object, object2);

		assert.deepStrictEqual(object, object2);
		network.remove();
	}),
	(name, callback) => test("forward commit" + name, () => {
		const object = OObject();
		const object2 = parse(stringify(object));
		const network = createNetwork(object2.observer);

		object.observer.watchCommit(commit => {
			network.apply(clone(commit));
		});

		callback(object, object2);

		assert.deepStrictEqual(object, object2);
		network.remove();
	}),
	(name, callback) => test("invert " + name, () => {
		const object = OObject();
		const object2 = parse(stringify(object));
		const network = createNetwork(object2.observer);

		const events = [];

		object.observer.watch(event => {
			const cloned = clone(event);
			network.apply([cloned]);
		});

		object2.observer.watch(event => {
			events.push(event);
		});

		callback(object, object2);

		for (let i = events.length - 1; i >= 0; i--) {
			network.apply([events[i].inverse]);
		}

		assert.deepStrictEqual(object2, OObject());
		network.remove();
	}),
	(name, callback) => test("invert commit" + name, () => {
		const object = OObject();
		const object2 = parse(stringify(object));
		const network = createNetwork(object2.observer);

		const events = [];

		object.observer.watchCommit(commit => {
			const cloned = clone(commit);
			network.apply(cloned);
		});

		object2.observer.watchCommit(commit => {
			events.push(commit);
		});

		callback(object, object2);

		for (let i = events.length - 1; i >= 0; i--) {
			network.apply(events[i].map(d => d.inverse));
		}

		assert.deepStrictEqual(object2, OObject());
		network.remove();
	}),
].forEach(test => {
	test("basic object network insert", (object) => {
		object.hello = 'world';
	});

	test("basic object network modify", (object) => {
		object.hello = 'world';
		object.hello = 'modified';
	});

	test("basic object network delete", (object) => {
		object.hello = 'world';
		object.hello = 'modified';
		delete object.hello;
	});

	test("basic array network insert", (object) => {
		let array = object.array = OArray();

		array.push('world');
	});

	test("basic array network insert and modify", (object) => {
		let array = object.array = OArray();

		array.push('world');
		array[0] = 'modified';
	});

	test("basic array network delete", (object) => {
		let array = object.array = OArray();
		array.push('hello');
		array[0] = 'modified';
		array.pop();
	});

	test("network array inserts", (object) => {
		let array = object.array = OArray();
		array.push(1);
		array.push(2);
		array.push(3);
		array.push(4);
		array.push(5);

		array.splice(2, 0, 6);
		array.splice(1, 0, 20, 30);
		array.splice(7, 0, 8);
	});

	test("network array inserts nested", (object) => {
		let array = object.array = OArray();
		array.push(1);
		array.push(2);
		array.push(3);
		array.push(4);
		array.push(5);

		const nested = OObject();
		array.splice(2, 0, nested);

		nested.hello = 'world';
		nested.hello = 'edited';
	});

	test("unlinking then relinking through a network", (object) => {
		let test = OObject();
		object.nested = test;
		test.thing = 'hello';
		object.nested = null;
		object.nested = test;
	});

	test("network array inserts nested and delete", (object, object2) => {
		let array = object.array = OArray();

		const paths = [];
		const watcher = object2.observer.path('array').watch(event => {
			const path = event.path.splice(1);
			if (path.length) path[0] = indexPosition(array, path[0]);
			paths.push(path);
		});

		array.push(1);
		array.push(2);
		array.push(3);
		array.push(4);
		array.push(5);

		const nested = OObject();
		array.splice(2, 0, nested);

		nested.hello = 'world';
		nested.hello = 'edited';
		delete nested.hello;

		watcher();

		assert.deepStrictEqual(paths, [[0], [1], [2], [3], [4], [2], [2, 'hello'], [2, 'hello'], [2, 'hello']]);
	});

	test("network remove then add back", (object) => {
		object.id = 'test';
		delete object.id;
		object.id = 'test2';
	});

	test("network remove then add back observable", (object) => {
		let obj = OObject();
		object.obj = obj;
		delete object.obj;
	});

	test("network array heavy nesting", (object) => {
		const obj = OArray([0, 0]);
		object.obj = obj;

		for (let i = 0; i < 128; i++) {
			obj.splice(1, 0, 0);
		}
	});

	test("network array push many", (object) => {
		const obj = OArray([]);
		object.obj = obj;

		for (let i = 0; i < 1024 * 8; i++) {
			obj.push(i);
		}
	});

	test("network array unshift many", (object) => {
		const obj = OArray();
		object.obj = obj;

		for (let i = 0; i < 1024 * 8; i++) {
			obj.unshift(i);
		}
	});

	test("network array prepend many times", (object) => {
		const obj = OArray();
		object.obj = obj;

		for (let i = 0; i < 128; i++) {
			obj.unshift(i);
		}
	});

	test("network omap delete", object => {
		const map = object.map = OMap();

		let id = UUID();
		map.set(id, true);
		map.delete(id);
	});

	test("network omap clear", object => {
		const map = object.map = OMap();

		let id = UUID();
		map.set(id, true);
		map.clear();
	});
});

test("network basic tracking", () => {
	let object = OObject();
	let network = createNetwork(object.observer);

	object.obj = OObject();
	delete object.obj;

	network.remove();
});

test("network basic tracking with relink", () => {
	let object = OObject();
	let network = createNetwork(object.observer);

	object.obj = OObject();
	object.obj = OObject();
	delete object.obj;

	network.remove();
});

test("network internal loop", () => {
	let object = OObject();
	let network = createNetwork(object.observer);

	const elem = OObject({});
	elem.elem = elem;

	object.elem = elem;

	network.remove();
});

test("network crazy", () => {
	let object = OObject();
	let network = createNetwork(object.observer);
	let network2 = createNetwork(object.observer);

	object.map = OMap();

	const elem = OObject({
		id: UUID()
	});

	elem.elem = elem;

	object.map.setElement(elem);
	object.elem = elem;

	network.remove();

	assert.strictEqual(object.map.delete(elem.id), true);

	network2.remove();

	object.elem = null;
});

test("basic object network child insert", () => {
	let object = OObject();
	object.dude = OObject({});
	let object2 = clone(object.dude);
	const network = createNetwork(object2.observer);

	object.observer.path('dude').watch(event => {
		network.apply([clone(event)]);
	});

	object.hello = 'world';
	object.dude.one = 'one';
	object.dude.two = 'two';

	assert.deepStrictEqual(object.dude, object2);
	network.remove();
});

test("duplicate insert event object", () => {
	let object = OObject();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		const cloned = [clone(event)];
		network.apply(cloned);
		network.apply(cloned);
	});

	assert.throws(() => {
		object.event = 'event';
	});

	network.remove();
});

test("network operate from event", () => {
	let object = OArray();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		if (event.value === 'two') return;
		object.push('two');
	});

	object.observer.watch(event => {
		network.apply([clone(event)]);
	});

	object.push('one');

	assert.deepStrictEqual(object, object2);

	network.remove();
});

test("network operate from event 2", () => {
	let object = OArray();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		network.apply([clone(event)]);
	});

	object.observer.watch(event => {
		if (event.value === 'two') return;
		object.push('two');
	});

	object.push('one');

	assert.deepStrictEqual(object, object2);

	network.remove();
});

test("duplicate insert event array", () => {
	let object = OArray();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		const cloned = [clone(event)];
		network.apply(cloned);
		network.apply(cloned);
	});

	assert.throws(() => {
		object.push('event');
	});

	network.remove();
});

test("try to operate network on a different tree if nested", () => {
	let object = OObject();
	let unrelated = clone(object);
	const network = createNetwork(unrelated.observer);

	object.nested = OObject();

	assert.throws(() => {
		object.observer.watch(event => {
			network.apply([clone(event)]);
		});

		object.nested.hello = 'world';
	});

	network.remove();
});

test("network delete", () => {
	let object = OObject();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		network.apply([clone(event)]);
	});

	const paths = [];
	object2.observer.watch(event => {
		paths.push(event.path);
	});

	const nested = OObject();
	object.nested = nested;

	nested.hello = 'world';
	nested.hello = 'edited';
	delete nested.hello;

	assert.deepStrictEqual({...object}, {...object2});
	assert.deepStrictEqual(paths, [['nested'], ['nested', 'hello'], ['nested', 'hello'], ['nested', 'hello']]);

	network.remove();
});

test("only apply events to a child", () => {
	let object = OObject();
	let object2 = clone(object);

	let base = createNetwork(object2.observer);
	object.observer.watch(event => {
		base.apply([clone(event)]);
	});

	object.object = OObject();
	base.remove();
	base = createNetwork(object2.object.observer);

	assert.throws(() => object.next = 'next');
	assert.strictEqual(object2.next, undefined);

	base.remove();
});

test("non root", () => {
	let object = OObject();

	object.nested = OObject();
	let object2 = clone(object.nested);
	const network = createNetwork(object2.observer);

	object.nested.observer.watchCommit(commit => {
		network.apply(clone(commit));
	});

	object.nested.whatever = 'hello';
	assert.strictEqual(object.nested.whatever, object2.whatever);
	network.remove();
});

test("non root through path", () => {
	let object = OObject();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.nested = OObject();

	object.observer.path('network').watchCommit(commit => {
		network.apply(clone(commit));
	});

	object.nested.whatever = 'hello';
	assert.strictEqual(object.nested.whatever, 'hello');
	assert.strictEqual(object2.whatever, undefined);
	network.remove();
});

test("duplicate ids", () => {
	let object = OArray();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	object.observer.watch(event => {
		network.apply([clone(event)]);
		try {
			network.apply([clone(event)]);
		} catch (e) {}
	});

	object.push("hello");
	object.push("world");

	assert.strictEqual(object2.length, 2);
	network.remove();
});

test("conflicting ids array", () => {
	let object = OArray();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	const thing = OObject();
	thing.thing = 'thing';

	object.observer.watch(event => {
		network.apply([clone(event)]);
		try {
			event.id = UUID();
			network.apply([clone(event)]);
		} catch (e) {}
	});

	object.push(thing);

	assert.strictEqual(object2.length, 1);
	network.remove();
});

test("conflicting ids object", () => {
	let object = OObject();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	const thing = OObject();
	thing.thing = 'thing';

	object.observer.watch(event => {
		network.apply([clone(event)]);
		assert.throws(() => network.apply([clone(event)]));
	});

	object.thing = thing;

	assert.deepStrictEqual(Object.keys(object2), ['thing']);
	network.remove();
});

test("conflicting ids omap", () => {
	let object = OMap();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	const thing = OObject();

	object.observer.watch(event => {
		network.apply([clone(event)]);
		assert.throws(() => network.apply([clone(event)]));
	});

	let id = UUID();
	object.set(id, thing);
	network.remove();
});

test("network digest timeout", async () => {
	const obj = OObject();
	const net = createNetwork(obj.observer);

	let called = false;
	net.digest((changes) => {
		called = true;
	}, 0);

	obj.one = 1;
	obj.two = 2;

	await new Promise(ok => setTimeout(ok, 10));
	assert.strictEqual(called, true);
});

test("network digest timeout flush anyway", async () => {
	const obj = OObject();
	const net = createNetwork(obj.observer);

	let called = false;
	net.digest((changes) => {
		called = true;
	}, 0);

	obj.one = 1;
	obj.two = 2;
	await net.flush();

	assert.strictEqual(called, true);
});

test("network OArray fuzz", withSeededRandom(async () => {
	const pick = arr => arr[Math.floor(Math.random() * arr.length)];

	const source = OArray([
		OObject({ label: 'a' }),
		OObject({ label: 'b' }),
		OObject({ label: 'c' }),
		OObject({ label: 'd' }),
	]);
	const target = parse(stringify(source));
	const network = createNetwork(target.observer);
	const sourceNetwork = createNetwork(source.observer);

	sourceNetwork.digest((changes, observerRefs) => {
		network.apply(clone(changes, {observerRefs, observerNetwork: network}));
	});

	const ops = ['push', 'pop', 'shift', 'unshift', 'splice', 'swap', 'replace'];
	for (let i = 0; i < 5000; i++) {
		const len = source.length;
		switch (pick(ops)) {
			case 'push': source.push(OObject({ label: `p${i}` })); break;
			case 'pop': if (len) source.pop(); break;
			case 'shift': if (len) source.shift(); break;
			case 'unshift': source.unshift(OObject({ label: `u${i}` })); break;
			case 'splice': {
				const start = len ? Math.floor(Math.random() * len) : 0;
				const del = len ? Math.floor(Math.random() * Math.min(3, len - start)) : 0;
				const adds = Math.floor(Math.random() * 5);
				const vals = [];
				for (let j = 0; j < adds; j++) vals.push(OObject({ label: `s${i}-${j}` }));
				source.splice(start, del, ...vals);
				break;
			}
			case 'swap': {
				if (len < 2) break;
				const a = Math.floor(Math.random() * len);
				let b = Math.floor(Math.random() * len);
				if (b === a) b = (b + 1) % len;
				const va = source[a];
				const vb = source[b];
				source[b] = va;
				source[a] = vb;
				break;
			}
			case 'replace': {
				if (!len) break;
				source[Math.floor(Math.random() * len)] = OObject({ label: `r${i}` });
				break;
			}
		}

		await sourceNetwork.flush();
	}

	assert.deepStrictEqual(source, target);
	sourceNetwork.remove();
	network.remove();
}));
