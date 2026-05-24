import assert from 'node:assert/strict';
import test from 'node:test';
import {Insert} from '../Events.js';
import OObject from '../Object.js';
import OArray, {positionIndex} from '../Array.js';

const assertMembers = (actual, expected) => {
	assert.strictEqual(actual.length, expected.length);
	const rem = [...actual];

	for (const exp of expected) {
		const i = rem.findIndex(a => a === exp);
		assert.ok(i !== -1);
		rem.splice(i, 1);
	}
};

test("initialized with nested object", () => {
	let nested = OObject({});
	let object = OObject({
		nested
	});

	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assert.strictEqual(object.one, '1');
	assert.strictEqual(object.two, '2');
	assert.strictEqual(object.three, '3');
	assert.strictEqual(nested.one, '1');
	assert.strictEqual(nested.two, '2');
	assert.strictEqual(nested.three, '3');
	assertMembers(events, ['1', '2', '3', '1', '2', '3']);
});

test("nested object attached", () => {
	let nested = OObject({});
	let object = OObject({});

	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.nested = nested;

	object.one = '1';
	object.two = '2';
	object.three = '3';

	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assert.strictEqual(object.one, '1');
	assert.strictEqual(object.two, '2');
	assert.strictEqual(object.three, '3');
	assert.strictEqual(nested.one, '1');
	assert.strictEqual(nested.two, '2');
	assert.strictEqual(nested.three, '3');
	assertMembers(events, [nested, '1', '2', '3', '1', '2', '3']);
});

test("nested object attached and overriden", () => {
	let nested = OObject({});
	let nested2 = OObject({});
	let object = OObject({});

	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.nested = nested;

	object.one = '1';
	object.two = '2';
	object.three = '3';

	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	object.nested = nested2;

	nested2.one = '1';
	nested2.two = '2';
	nested2.three = '3';

	nested.one = null;
	nested.two = null;
	nested.three = null;

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assertMembers(events, [nested, '1', '2', '3', '1', '2', '3', nested2, '1', '2', '3']);
});

test("initialized with hidden nested object", () => {
	let nested = OObject({});
	let object = OObject({
		_nested: nested
	});

	const events = [];
	object.observer.watch(event => {
		//we should only be seeing insert events
		if (event instanceof Insert) {
			events.push(event.value);
		}
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['_nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assertMembers(events, ['1', '2', '3']);
});

test("nested hidden object attached", () => {
	let nested = OObject({});
	let object = OObject({});

	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object._nested = nested;

	object.one = '1';
	object.two = '2';
	object.three = '3';

	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['_nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assertMembers(events, ['1', '2', '3']);
});

test("nested hidden object attached and overriden", () => {
	let nested = OObject({});
	let nested2 = OObject({});
	let object = OObject({});

	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	object._nested = nested;
	nested.one = '1';
	nested.two = '2';
	nested.three = '3';

	object._nested = nested2;
	nested2.one = '1';
	nested2.two = '2';
	nested2.three = '3';

	assert.deepStrictEqual(new Set(Object.keys(object)), new Set(['_nested', 'one', 'two', 'three']));
	assert.deepStrictEqual(new Set(Object.keys(nested)), new Set(['one', 'two', 'three']));
	assertMembers(events, ['1', '2', '3']);
});

test("nested pathing", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	assert.deepStrictEqual(paths, [['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("paths true", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.path('nest').watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	assert.deepStrictEqual(paths, [['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("paths false", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.path('nothing').watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	assert.deepStrictEqual(paths, []);
});

test("path ignore", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore('nest').watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	assert.deepStrictEqual(paths, [['whatever']]);
});

test("path ignore multiple", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	assert.deepStrictEqual(paths, [['nest', 'two'], ['nest', 'three'], ['whatever']]);
});

test("path ignore with hidden", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object._whatever = 'whatever';
	nest._whatever = 'whatever';

	assert.deepStrictEqual(paths, [['nest', 'two'], ['nest', 'three']]);
});

test("path ignore with skip", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).skip(2).watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object._whatever = 'whatever';
	nest._whatever = 'whatever';

	assert.deepStrictEqual(paths, [['nest', 'two'], ['nest', 'three']]);
});

test("skip ignore underscore", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.skip(Infinity).watch(event => {
		paths.push(event.path);
	});

	object._whatever = 'whatever';
	nest._whatever = 'whatever';

	assert.deepStrictEqual(paths, []);
});

test("path ignore with tree", () => {
	let nest = OObject({});
	let object = OObject({
		nest,
		tree: OArray([
			OObject()
		]),
	});

	const paths = [];
	object.observer.ignore('nest').tree('tree').watch(event => {
		paths.push(event.path);
	});

	object.nest.hello = "hello";
	object.tree[0].hello = "hello";

	assert.deepStrictEqual(paths, [['tree', positionIndex(object.tree, 0), 'hello']]);
});

test("nested pathing", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path);
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	assert.deepStrictEqual(paths, [['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("nested pathing 2", () => {
	let nest = OObject({});
	let nest2 = OObject({});
	let object = OObject({nest, nest2});

	const paths = [];
	object.observer.ignore('nest').skip().path('thing').watch(event => {
		paths.push(event.path);
	});

	nest.thing = '1';
	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	nest2.one = 'hello';
	nest2.thing = 'thing';

	assert.deepStrictEqual(paths, [['nest2', 'thing']]);
});

test("nested pathing 3", () => {
	let nest = OObject({});
	let nest2 = OObject({});
	let object = OObject({nest, nest2});

	const paths = [];
	object.observer.ignore('nest').path(['nest2', 'thing']).watch(event => {
		paths.push(event.path);
	});

	nest.thing = '1';
	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	nest2.one = 'hello';
	nest2.thing = 'thing';

	assert.deepStrictEqual(paths, [['nest2', 'thing']]);
});

test("handle circles", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path);
	});

	object.next = object2;
	object2.next = object;

	object.one = '1';
	object.two = '2';
	object.three = '3';

	assert.deepStrictEqual(paths, [['next'], ['next', 'next'], ['one'], ['two'], ['three']]);
	assert.strictEqual(object.next.next.next.next.one, '1');
	assert.strictEqual(object.next.next.two, '2');
	assert.strictEqual(object.next.next.next.next.next.next.three, '3');
});

test("handle diamond", () => {
	let root = OObject({});
	let shared = OObject({});

	const paths = [];
	root.observer.watch(event => {
		paths.push(event.path);
	});

	root.x = shared;
	root.y = shared;

	shared.foo = 'bar';

	// Two paths to the same observable form a diamond. A mutation on the
	// shared observable fires exactly once — through whichever path is the
	// active registration (the first one assigned, here x).
	assert.deepStrictEqual(paths, [
		['x'],
		['y'],
		['x', 'foo'],
	]);
});

test("handle diamond with nested observable", () => {
	let root = OObject({});
	let shared = OObject({});
	let nested = OObject({});

	const paths = [];
	root.observer.watch(event => {
		paths.push(event.path);
	});

	root.x = shared;
	root.y = shared;
	shared.nested = nested;

	nested.baz = 'qux';

	// Diamond handling extends through the subtree — assigning and mutating
	// observables under `shared` fires once per logical change, through the
	// active path.
	assert.deepStrictEqual(paths, [
		['x'],
		['y'],
		['x', 'nested'],
		['x', 'nested', 'baz'],
	]);
});

// Three references to the same observable form a shadow chain. The active is
// registered; the other two are shadows. Each test below removes the three
// references in a different order and verifies that:
//   1. While at least one reference is alive, mutations on `shared` fire
//      exactly once (no duplicates), with `delta.path[0]` being one of the
//      still-alive references.
//   2. After all three references are removed, mutations on `shared` fire
//      zero times.
// These exercise the shadow chain bookkeeping: promotion of the head when the
// active is removed, mid-chain unlinking when a non-active reference is
// removed, and full cleanup when the last reference is removed.
for (const order of [
	['x', 'y', 'z'],
	['x', 'z', 'y'],
	['y', 'x', 'z'],
	['y', 'z', 'x'],
	['z', 'x', 'y'],
	['z', 'y', 'x'],
]) {
	test(`diamond, three refs, remove in order ${order.join(',')}`, () => {
		const shared = OObject({});
		const obj = OObject({});

		let captured = [];
		obj.observer.watch(event => {
			// Only collect events from mutating shared.foo — ignore the
			// setup events (paths of length 1 for the x/y/z assignments).
			if (event.path.length === 2 && event.path[1] === 'foo') {
				captured.push(event.path);
			}
		});

		obj.x = shared;
		obj.y = shared;
		obj.z = shared;

		const remaining = new Set(['x', 'y', 'z']);
		let counter = 0;
		const mutateAndCheck = () => {
			captured = [];
			shared.foo = counter++;
			if (remaining.size > 0) {
				assert.strictEqual(captured.length, 1,
					`expected 1 event after mutation, got ${captured.length} (remaining: ${[...remaining]})`);
				assert.ok(remaining.has(captured[0][0]),
					`expected path[0] in {${[...remaining]}}, got '${captured[0][0]}'`);
			} else {
				assert.strictEqual(captured.length, 0,
					`expected no events after all refs removed, got ${captured.length}`);
			}
		};

		mutateAndCheck();
		for (const ref of order) {
			delete obj[ref];
			remaining.delete(ref);
			mutateAndCheck();
		}
	});
}

test("array in object shallow after map", () => {
	const obj = OObject({
		arr: OArray(),
	});

	const events = [];
	const obs = obj.observer.path('arr').map(arr => [...arr]).shallow(1);
	obs.watch(event => {
		events.push(obs.get());
	});

	obj.arr.push(1);
	obj.arr.push(2);

	assert.deepStrictEqual(events, [[1], [1, 2]]);
});
