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
