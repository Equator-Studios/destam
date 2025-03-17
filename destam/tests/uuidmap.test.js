import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import OMap from '../UUIDMap.js';
import UUID from '../UUID.js';

test("omap instanceof", () => {
	const map = OMap();

	expect(map instanceof OMap).to.equal(true);
});

test("omap insert", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');

	expect(map.get(id)).to.equal('hello');
});

test("omap modify", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');
	map.set(id, 'world');

	expect(map.get(id)).to.equal('world');
});

test("omap delete", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, 'hello');
	map.delete(id);

	expect(map.has(id)).to.equal(false);
});

test("omap ignore duplicate element", () => {
	const map = OMap();

	let elem = OObject({id: UUID()});
	map.setElement(elem);

	const events = [];
	map.observer.watch(event => events.push(event));

	map.setElement(elem);

	expect(map.has(elem.id)).to.equal(true);
	expect(events).to.have.members([]);
});

test("omap modify atomic", () => {
	const map = OMap();

	const id = UUID();
	map.setElement(OObject({id}));

	const elem = OObject({id});

	const events = [];
	map.observer.watch(event => events.push(map.getElement(id)));

	map.setElement(elem);

	expect(events).to.have.members([elem]);
});

test("omap modify value", () => {
	const map = OMap();

	const id = UUID();
	map.setElement(OObject({id}));

	const elem = OObject({id});

	const events = [];
	map.observer.ignore(elem.id).watch(event => events.push(map.getElement(id)));

	map.setElement(elem);

	expect(events).to.have.members([]);
});

test("omap delete event actually deleted", () => {
	const map = OMap();

	const thing = UUID();
	map.set(thing, true);

	map.observer.watch(state => {
		expect(map.has(thing)).to.equal(false);
	});

	map.delete(thing);
});

test("omap delete event previous", () => {
	const map = OMap();

	const thing = OObject({id: UUID()});
	map.setElement(thing);

	map.observer.watch(state => {
		expect(state.prev).to.equal(thing);
	});

	map.deleteElement(thing);
});

test("omap uuid path getter", () => {
	const map = OMap();

	let id = UUID();
	map.set(id, "thing");

	const obs = map.observer.path(id);

	expect(obs.get().value).to.equal(map.get(id));
});

test("omap delete noexist", () => {
	const map = OMap();

	expect(map.delete(UUID())).to.equal(false);
});

test("omap delete noexist with values", () => {
	const map = OMap();

	for (let i = 0; i < 10; i++) {
		map.set(UUID(), true);
	}

	expect(map.delete(UUID())).to.equal(false);
});

test("omap clear delta consistentcy", () => {
	const map = OMap();
	const id = UUID();

	map.set(id, {});

	map.observer.watch(delta => {
		expect(map.has(id)).to.equal(false);
	});

	map.clear();
});

test("omap set element from observer", () => {
	const map = OMap();

	const id = UUID();
	map.observer.path(id).set(OObject({
		id
	}));
	expect(map.has(id)).to.equal(true);
});
