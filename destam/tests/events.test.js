import assert from 'node:assert/strict';
import test from 'node:test';
import OObject from '../Object.js';
import {Insert, Modify, Delete} from '../Events.js';

test("event invert instanceof", () => {
	assert.ok(Insert().inverse instanceof Delete);
	assert.ok(Modify().inverse instanceof Modify);
	assert.ok(Delete().inverse instanceof Insert);
});

test("recursive events", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		if (obj.value > 10) return;

		obj.value++;
	});

	obj.value = 0;
	assert.strictEqual(obj.value, 11);
});

test("recursive events other listeners", () => {
	let obj = OObject();

	let before = [], after = [];
	obj.observer.watch(() => {
		before.push(obj.value);
	});

	obj.observer.watch(() => {
		if (obj.value > 10) return;

		obj.value++;
	});

	obj.observer.watch(() => {
		after.push(obj.value);
	});

	obj.value = 0;
	assert.strictEqual(obj.value, 11);
	assert.deepStrictEqual(before, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
	assert.deepStrictEqual(after, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
});

test("throw in right context", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		if (obj.value > 10) return;

		if (obj.value === 1) {
			obj.value++;
		} else {
			assert.throws(() => obj.value++);
		}

		if (obj.value === 2) {
			throw new Error();
		}
	});

	obj.value = 0;
	assert.strictEqual(obj.value, 11);
});

test("throw undefined", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		throw undefined;
	});

	let thrown = "fail";
	try {
		obj.value = 0;
	} catch (e) {
		thrown = e;
	}

	assert.strictEqual(thrown, undefined);
});

test("throw 0", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		throw 0;
	});

	let thrown = "fail";
	try {
		obj.value = 0;
	} catch (e) {
		thrown = e;
	}

	assert.strictEqual(thrown, 0);
});
