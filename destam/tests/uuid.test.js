import assert from 'node:assert/strict';
import test from 'node:test';
import UUID, {setRandom} from '../UUID.js';
import crypto from 'crypto';

setRandom(crypto.randomFillSync);

test ("uuid instanceof", () => {
	assert.ok(UUID() instanceof UUID);
});

test("uuid create string", () => {
	let id = UUID().toHex();

	assert.strictEqual(typeof id, 'string');
	assert.strictEqual(id.length, 32 + 1);
});

test("uuid create", () => {
	let id = UUID();

	assert.notStrictEqual(id.buffer, undefined);
});

test("uuid equal", () => {
	const id = UUID();
	const id2 = UUID();
	const long = UUID(16);

	assert.strictEqual(UUID.equal(id, id), true);
	assert.strictEqual(UUID.equal(id, id2), false);
	assert.strictEqual(UUID.equal(id, long), false);
});

test("uuid hex conversions", () => {
	let id = UUID();

	assert.strictEqual(UUID.equal(UUID(id.toHex()), id), true);
});

test("uuid automatic hex conversions", () => {
	let id = UUID();

	assert.strictEqual(UUID.equal(id.toHex(), id), true);
});

test("uuid automatic hex conversions inverted", () => {
	let id = UUID();

	assert.strictEqual(UUID.equal(id, id.toHex()), true);
});

test("equal with conversions", () => {
	let id = UUID();

	assert.strictEqual(UUID.equal(id.toHex(), id), true);
});

test("convert to bytes from string", () => {
	let id = UUID().toHex();

	assert.strictEqual(UUID(id).toHex(), id);
});

test("convert to bytes from string with normal constructor", () => {
	let id = UUID().toHex();

	assert.strictEqual(UUID(id).toHex(), id);
});

test("invalid hex string", () => {
	assert.throws(() => UUID("hello world"));
	assert.throws(() => UUID("#hello world"));
	assert.throws(() => UUID("a00"));
	assert.throws(() => UUID(new Uint8Array(0).buffer));
});

test("Int32 uuid", () => {
	assert.strictEqual(UUID(new Int32Array([0])).toHex(), "#00000000");
});

test("uint8 uuid", () => {
	assert.strictEqual(UUID(new Uint8Array([0, 0])).toHex(), "#00000000");
});

test("uuid map iterators", () => {
	let map = UUID.Map();

	const element = {id: UUID()};
	map.setElement(element);

	assert.strictEqual(map.size, 1);
	assert.deepStrictEqual([...map.elements()], [element]);
	assert.deepStrictEqual([...map.keys()], [element.id]);
	assert.deepStrictEqual([...map.entries()], [[element.id, undefined]]);
});

test("uuid map fill", () => {
	let map = UUID.Map();

	for (let i = 0; i < 1000; i++) {
		map.set(UUID(), i);
	}

	assert.strictEqual(map.size, 1000);

	let arr = [];
	for (let i of map.values()) {
		arr[i] = true;
	}

	for (let i = 0; i < 1000; i++) {
		assert.strictEqual(arr[i], true);
	}

	map.clear();
	assert.strictEqual(map.size, 0);
});

test("uuid map delete noexist", () => {
	const map = UUID.Map();
	assert.strictEqual(map.delete(UUID()), false);
});

test("uuid map delete", () => {
	const map = UUID.Map();
	const id = UUID();

	map.set(id, true);

	assert.strictEqual(map.has(id), true);
	assert.strictEqual(map.delete(id), true);
	assert.strictEqual(map.has(id), false);
});

test("uuid map delete custom comparator", () => {
	const map = UUID.Map();
	const id = UUID();

	map.set(id, true);
	assert.strictEqual(map.delete(id, (elem, id) => UUID.equal(elem.id, id) && elem.id), id);
});

test("uuid compare", () => {
	const a = UUID(new Int32Array([0]));
	const lo = UUID(new Int32Array([-1]));
	const hi = UUID(new Int32Array([1]));

	UUID.compare(a, lo);
	UUID.compare(a, a);
	UUID.compare(a, hi);
	UUID.compare(lo, hi);
	UUID.compare(hi, lo);
});

test("uuid compare unequal lengths", () => {
	const a = UUID(new Int32Array([0]));
	const lo = UUID(new Int32Array([1, 0]));
	const hi = UUID(new Int32Array([1, 0, 0]));

	UUID.compare(a, lo);
	UUID.compare(a, a);
	UUID.compare(a, hi);
	UUID.compare(lo, hi);
	UUID.compare(hi, lo);
});

test("uuid map bucket size", () => {
	const map = UUID.Map(null, 4);

	let ids = Array(8).fill(null).map(() => UUID());
	for (const id of ids) map.set(id, 'hello');
	for (const id of ids) map.delete(id);

	assert.strictEqual(map.size, 0);
	assert.strictEqual(map.arr_.length, 4);
});

test("uuid map invalid bucket size", () => {
	assert.throws(() => UUID.Map(null, 5));
});
