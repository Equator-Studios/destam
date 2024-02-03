import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import OArray, {indexPosition} from '../Array.js';
import UUID from '../UUID.js';
import OMap from '../UUIDMap.js';
import createNetwork from '../Tracking.js';

import { stringify, parse, clone } from './clone.js';

[
	(name, callback) => test("forward " + name, () => {
		const object = OObject();
		const object2 = parse(stringify(object));
		const network = createNetwork(object2.observer);

		object.observer.watch(event => {
			network.apply([clone(event)]);
		});

		callback(object, object2);

		expect(object).to.deep.equal(object2);
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
			network.apply([events[i].invert()]);
		}

		expect(object2).to.deep.equal(OObject());
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
			const path = event.path().splice(1);
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

		watcher.remove();

		expect(paths).to.deep.equal([[0], [1], [2], [3], [4], [2], [2, 'hello'], [2, 'hello'], [2, 'hello']]);
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

	expect(object.map.delete(elem.id)).to.equal(true);

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

	expect(object.dude).to.deep.equal(object2);
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

	expect (() => {
		object.event = 'event';
	}).to.throw();

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

	expect(object).to.deep.equal(object2);

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

	expect(object).to.deep.equal(object2);

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

	expect (() => {
		object.push('event');
	}).to.throw();

	network.remove();
});

test("try to operate network on a different tree if nested", () => {
	let object = OObject();
	let unrelated = clone(object);
	const network = createNetwork(unrelated.observer);

	object.nested = OObject();

	expect(() => {
		object.observer.watch(event => {
			network.apply([clone(event)]);
		});

		object.nested.hello = 'world';
	}).to.throw();

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
		paths.push(event.path(object2));
	});

	const nested = OObject();
	object.nested = nested;

	nested.hello = 'world';
	nested.hello = 'edited';
	delete nested.hello;

	expect({...object}).to.deep.equal({...object2});
	expect(paths).to.deep.equal([['nested'], ['nested', 'hello'], ['nested', 'hello'], ['nested', 'hello']]);

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

	expect(() => object.next = 'next').to.throw();
	expect(object2.next).to.equal(undefined);

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
	expect(object.nested.whatever).to.equal(object2.whatever);
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
	expect(object.nested.whatever).to.equal('hello');
	expect(object2.whatever).to.equal(undefined);
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

	expect(object2.length).to.equal(2);
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

	expect(object2.length).to.equal(1);
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
		expect(() => network.apply([clone(event)])).to.throw();
	});

	object.thing = thing;

	expect(Object.keys(object2)).to.deep.equal(['thing']);
	network.remove();
});

test("conflicting ids omap", () => {
	let object = OMap();
	let object2 = clone(object);
	const network = createNetwork(object2.observer);

	const thing = OObject();

	object.observer.watch(event => {
		network.apply([clone(event)]);
		expect(() => network.apply([clone(event)])).to.throw();
	});

	let id = UUID();
	object.set(id, thing);
	network.remove();
});
