import {expect} from 'chai';
import test from 'node:test';
import UUID, {setRandom} from '../UUID.js';
import crypto from 'crypto';

setRandom(crypto.randomFillSync);

test ("uuid instanceof", () => {
	expect(UUID() instanceof UUID).to.equal(true);
});

test("uuid create string", () => {
	let id = UUID().toHex();

	expect(id).to.be.a('string');
	expect(id.length).to.equal(32 + 1);
});

test("uuid create", () => {
	let id = UUID();

	expect(id.buffer).to.not.equal(undefined);
});

test("uuid compare", () => {
	const id = UUID();
	const id2 = UUID();
	const long = UUID(16);

	expect(UUID.compare(id, id)).to.equal(true);
	expect(UUID.compare(id, id2)).to.equal(false);
	expect(UUID.compare(id, long)).to.equal(false);
});

test("uuid hex conversions", () => {
	let id = UUID();

	expect(UUID.compare(UUID(id.toHex()), id)).to.equal(true);
});

test("compare with conversions", () => {
	let id = UUID();

	expect(UUID.compare(id.toHex(), id)).to.equal(true);
});

test("convert to bytes from string", () => {
	let id = UUID().toHex();

	expect(UUID(id).toHex()).to.equal(id);
});

test("convert to bytes from string with normal constructor", () => {
	let id = UUID().toHex();

	expect(UUID(id).toHex()).to.equal(id);
});

test("invalid hex string", () => {
	expect(() => UUID("hello world")).to.throw();
	expect(() => UUID("#hello world")).to.throw();
	expect(() => UUID("a00")).to.throw();
	expect(() => UUID(new Uint8Array(0).buffer)).to.throw();
});

test("Int32 uuid", () => {
	expect(UUID(new Int32Array([0])).toHex()).to.equal("#00000000");
});

test("uint8 uuid", () => {
	expect(UUID(new Uint8Array([0, 0])).toHex()).to.equal("#00000000");
});

test("uuid map iterators", () => {
	let map = UUID.Map();

	const element = {id: UUID()};
	map.setElement(element);

	expect(map.size).to.equal(1);
	expect([...map.elements()]).to.deep.equal([element]);
	expect([...map.keys()]).to.deep.equal([element.id]);
	expect([...map.entries()]).to.deep.equal([[element.id, undefined]]);
});

test("uuid map fill", () => {
	let map = UUID.Map();

	for (let i = 0; i < 1000; i++) {
		map.set(UUID(), i);
	}

	expect(map.size).to.equal(1000);

	let arr = [];
	for (let i of map.values()) {
		arr[i] = true;
	}

	for (let i = 0; i < 1000; i++) {
		expect(arr[i]).to.equal(true);
	}

	map.clear();
	expect(map.size).to.equal(0);
});

test("uuid map delete noexist", () => {
	const map = UUID.Map();
	expect(map.delete(UUID())).to.equal(false);
});

test("uuid map delete", () => {
	const map = UUID.Map();
	const id = UUID();

	map.set(id, true);

	expect(map.has(id)).to.equal(true);
	expect(map.delete(id)).to.equal(true);
	expect(map.has(id)).to.equal(false);
});

test("uuid map delete custom comparator", () => {
	const map = UUID.Map();
	const id = UUID();

	map.set(id, true);
	expect(map.delete(id, (elem, id) => UUID.compare(elem.id, id) && elem.id)).to.equal(id);
});
