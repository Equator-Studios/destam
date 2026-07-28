import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';

test("omap instanceof", () => {
	const map = OMap();

	assert.strictEqual(map instanceof OMap, true);
});

test("omap insert", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');

	assert.strictEqual(map.get(id), 'hello');
});

test("omap modify", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');
	map.set(id, 'world');

	assert.strictEqual(map.get(id), 'world');
});

test("omap delete", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');
	map.delete(id);

	assert.strictEqual(map.has(id), false);
});

test("omap ignore duplicate element", () => {
	const map = OMap();

	let elem = OObject({id: UUID()});
	map.setElement(elem);

	const events = [];
	map.observer.watch(event => events.push(event));

	map.setElement(elem);

	assert.strictEqual(map.has(elem.id), true);
	assert.deepStrictEqual(events, []);
});

test("omap modify atomic", () => {
	const map = OMap();

	const id = UUID();
	map.setElement(OObject({id}));

	const elem = OObject({id});

	const events = [];
	map.observer.watch(event => events.push(map.getElement(id)));

	map.setElement(elem);

	assert.deepStrictEqual(events, [elem]);
});

test("omap modify value", () => {
	const map = OMap();

	const id = UUID();
	map.setElement(OObject({id}));

	const elem = OObject({id});

	const events = [];
	map.observer.ignore(elem.id).watch(event => events.push(map.getElement(id)));

	map.setElement(elem);

	assert.deepStrictEqual(events, []);
});

test("omap delete event actually deleted", () => {
	const map = OMap();

	const thing = UUID();
	map.set(thing, true);

	map.observer.watch(state => {
		assert.strictEqual(map.has(thing), false);
	});

	map.delete(thing);
});

test("omap delete event previous", () => {
	const map = OMap();

	const thing = OObject({id: UUID()});
	map.setElement(thing);

	map.observer.watch(state => {
		assert.strictEqual(state.prev, thing);
	});

	map.deleteElement(thing);
});

test("omap uuid path getter", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, "thing");

	const obs = map.observer.path(id);

	assert.strictEqual(obs.get().value, map.get(id));
});

test("omap delete noexist", () => {
	const map = OMap();

	assert.strictEqual(map.delete(UUID()), false);
});

test("omap delete noexist with values", () => {
	const map = OMap();

	for (let i = 0; i < 10; i++) {
		map.set(UUID(), true);
	}

	assert.strictEqual(map.delete(UUID()), false);
});

test("omap clear delta consistentcy", () => {
	const map = OMap();
	const id = UUID();

	map.set(id, {});

	map.observer.watch(delta => {
		assert.strictEqual(map.has(id), false);
	});

	map.clear();
});

test("omap set element from observer", () => {
	const map = OMap();

	const id = UUID();
	map.observer.path(id).set(OObject({
		id
	}));
	assert.strictEqual(map.has(id), true);
});

test("omap re-key moves the element", () => {
	const map = OMap();

	const elem = OObject({id: UUID(), payload: 'kept'});
	map.setElement(elem);

	const before = elem.id;
	elem.id = UUID();

	assert.strictEqual(map.size, 1);
	assert.strictEqual(map.getElement(before), undefined);
	assert.strictEqual(map.getElement(elem.id), elem);
	assert.strictEqual(map.getElement(elem.id).payload, 'kept');
});

test("omap re-key repeatedly", () => {
	const map = OMap();

	const elem = OObject({id: UUID()});
	map.setElement(elem);

	for (let i = 0; i < 3; i++) {
		const before = elem.id;
		elem.id = UUID();

		assert.strictEqual(map.size, 1);
		assert.strictEqual(map.getElement(before), undefined);
		assert.strictEqual(map.getElement(elem.id), elem);
	}
});

test("omap re-key onto a live key", () => {
	const map = OMap();

	const elem = OObject({id: UUID()});
	const other = OObject({id: UUID()});
	map.setElement(elem);
	map.setElement(other);

	const before = other.id;
	assert.throws(() => other.id = elem.id, /already populated/);

	// the assignment lands before the map can object to it, so it gets put
	// back - the map must be left exactly as it was
	assert.strictEqual(UUID.equal(other.id, before), true);
	assert.strictEqual(map.size, 2);
	assert.strictEqual(map.getElement(before), other);
	assert.strictEqual(map.getElement(elem.id), elem);
});

test("omap re-key moves path watchers", () => {
	const map = OMap();

	const a = UUID(), b = UUID();
	const elem = OObject({id: a, v: 1});
	map.setElement(elem);

	// which listeners want a link is decided from its query when the link is
	// made, so a key change has to have the governors recompute
	let atA = 0, atB = 0;
	map.observer.path(a).watch(() => atA++);
	map.observer.path(b).watch(() => atB++);

	elem.id = b;

	atA = atB = 0;
	elem.v = 2;
	assert.strictEqual(atA, 0);
	assert.strictEqual(atB, 1);

	elem.id = a;

	atA = atB = 0;
	elem.v = 3;
	assert.strictEqual(atA, 1);
	assert.strictEqual(atB, 0);
});
