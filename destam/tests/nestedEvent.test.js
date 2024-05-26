import {expect} from 'chai';
import test from 'node:test';
import {Insert} from '../Events.js';
import OObject from '../Object.js';
import OArray, {positionIndex} from '../Array.js';

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

	expect (Object.keys(object)).to.have.members(['nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (nested.one).to.equal('1');
	expect (nested.two).to.equal('2');
	expect (nested.three).to.equal('3');
	expect (events).to.have.members(['1', '2', '3', '1', '2', '3']);
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

	expect (Object.keys(object)).to.have.members(['nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (nested.one).to.equal('1');
	expect (nested.two).to.equal('2');
	expect (nested.three).to.equal('3');
	expect (events).to.have.members([nested, '1', '2', '3', '1', '2', '3']);
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

	expect (Object.keys(object)).to.have.members(['nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (events).to.have.members([nested, '1', '2', '3', '1', '2', '3', nested2, '1', '2', '3']);
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

	expect (Object.keys(object)).to.have.members(['_nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (events).to.have.members(['1', '2', '3']);
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

	expect (Object.keys(object)).to.have.members(['_nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (events).to.have.members(['1', '2', '3']);
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

	expect (Object.keys(object)).to.have.members(['_nested', 'one', 'two', 'three']);
	expect (Object.keys(nested)).to.have.members(['one', 'two', 'three']);
	expect (events).to.have.members(['1', '2', '3']);
});

test("nested pathing", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path(object));
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	expect(paths).to.deep.equal([['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("paths true", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.path('nest').watch(event => {
		paths.push(event.path(object));
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	expect(paths).to.deep.equal([['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("paths false", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.path('nothing').watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	expect(paths).to.deep.equal([]);
});

test("path ignore multiple", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore('nest').watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	expect(paths).to.deep.equal([['whatever']]);
});

test("path ignore", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object.whatever = 'whatever';

	expect(paths).to.deep.equal([['nest', 'two'], ['nest', 'three'], ['whatever']]);
});

test("path ignore with hidden", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object._whatever = 'whatever';
	nest._whatever = 'whatever';

	expect(paths).to.deep.equal([['nest', 'two'], ['nest', 'three']]);
});

test("path ignore with skip", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.ignore(['nest', 'one']).skip().watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	object._whatever = 'whatever';
	nest._whatever = 'whatever';

	expect(paths).to.deep.equal([['nest', 'two'], ['nest', 'three'], ['_whatever'], ['nest', '_whatever']]);
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
		paths.push(event.path());
	});

	object.nest.hello = "hello";
	object.tree[0].hello = "hello";

	expect(paths).to.deep.equal([['tree', positionIndex(object.tree, 0), 'hello']]);
});

test("nested pathing", () => {
	let nest = OObject({});
	let object = OObject({nest});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path());
	});

	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	expect(paths).to.deep.equal([['nest', 'one'], ['nest', 'two'], ['nest', 'three']]);
});

test("nested pathing 2", () => {
	let nest = OObject({});
	let nest2 = OObject({});
	let object = OObject({nest, nest2});

	const paths = [];
	object.observer.ignore('nest').path('thing').watch(event => {
		paths.push(event.path());
	});

	nest.thing = '1';
	nest.one = '1';
	nest.two = '2';
	nest.three = '3';

	nest2.one = 'hello';
	nest2.thing = 'thing';

	expect(paths).to.deep.equal([['nest2', 'thing']]);
});

test("handle circles", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object2.next = object;

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect(paths).to.deep.equal([['next'], ['next', 'next'], ['one'], ['two'], ['three']]);
	expect(object.next.next.next.next.one).to.equal('1');
	expect(object.next.next.two).to.equal('2');
	expect(object.next.next.next.next.next.next.three).to.equal('3');
});

test("array in object shallow after map", () => {
	const obj = OObject({
		arr: OArray(),
	});

	const events = [];
	const obs = obj.observer.path('arr').map(arr => [...arr]).shallow();
	obs.watch(event => {
		events.push(obs.get());
	});

	obj.arr.push(1);
	obj.arr.push(2);

	expect(events).to.deep.equal([[1], [1, 2]]);
});
