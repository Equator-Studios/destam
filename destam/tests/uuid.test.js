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

	const element = {_id: UUID()};
	map.setElement(element);

	assert.strictEqual(map.size, 1);
	assert.deepStrictEqual([...map.elements()], [element]);
	assert.deepStrictEqual([...map.keys()], [element._id]);
	assert.deepStrictEqual([...map.entries()], [[element._id, undefined]]);
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
	assert.strictEqual(map.delete(id, (elem, id) => UUID.equal(elem._id, id) && elem._id), id);
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

// A uuid's last word is its creation time, and is the one word deliberately kept
// non-zero so that a uuid is never all-zero
const TRUNCATES_TO_ZERO = 2 ** 32 * 412;

const atTime = (time, fn) => {
	const now = Date.now;
	Date.now = () => time;
	try {
		return fn();
	} finally {
		Date.now = now;
	}
};

test("uuid timestamp truncating to zero is the case under test", () => {
	assert.strictEqual(TRUNCATES_TO_ZERO | 0, 0);
	assert.ok(TRUNCATES_TO_ZERO > 1, "and it is not caught by a guard on the value");
	assert.strictEqual(Math.max(TRUNCATES_TO_ZERO, 1), TRUNCATES_TO_ZERO);
});

test("uuid timestamp word is never zero", () => {
	for (const size of [2, 4, 8]) {
		const id = atTime(TRUNCATES_TO_ZERO, () => UUID(size));
		assert.notStrictEqual(id.buffer[size - 1], 0, `size ${size} stored a zero timestamp word`);
	}
});

test("uuid timestamp word is never zero at the epoch either", () => {
	assert.notStrictEqual(atTime(0, () => UUID()).buffer[3], 0);
});

test("uuid timestamp word is never zero across a full 2**32 period", () => {
	// walk the boundary rather than only landing on it, so an off-by-one in the
	// guard shows up as well
	const base = TRUNCATES_TO_ZERO;
	for (const offset of [-2, -1, 0, 1, 2]) {
		const id = atTime(base + offset, () => UUID());
		assert.notStrictEqual(id.buffer[3], 0, `offset ${offset} stored a zero timestamp word`);
	}
});

test("uuid timestamp word is otherwise the truncated clock", () => {
	// the guard must not perturb any reading that does not truncate to zero
	for (const offset of [1, 1234, -1]) {
		const time = TRUNCATES_TO_ZERO + offset;
		assert.strictEqual(atTime(time, () => UUID()).buffer[3], time | 0, `offset ${offset}`);
	}
});

test("uuid is never all zero", () => {
	// The random source supplies every word but the last, so this only says
	// anything if it yields zeros — otherwise the assertion passes on the random
	// bytes alone and never exercises the timestamp guard at all.
	setRandom(bytes => bytes.fill(0));
	try {
		const id = atTime(TRUNCATES_TO_ZERO, () => UUID());
		assert.ok([...id.buffer].some(word => word !== 0), 'produced an all-zero uuid');
		assert.notStrictEqual(id.toHex(), '#' + '0'.repeat(32));
	} finally {
		setRandom(crypto.randomFillSync);
	}
});

test("uuid created on the boundary still round-trips through hex", () => {
	const id = atTime(TRUNCATES_TO_ZERO, () => UUID());
	assert.strictEqual(UUID.compare(UUID(id.toHex()), id), 0);
	assert.ok(UUID.equal(UUID(id.toHex()), id));
});
