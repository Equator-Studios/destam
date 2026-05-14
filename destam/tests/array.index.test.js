import assert from 'node:assert/strict';
import test from 'node:test';
import {indexLeading, indexCompare, indexAdd} from '../Array.js';

const signedLen = i => {
	if (i < 0) i = -i;
	return i <= 0x7F ? 1 : i <= 0x7FFF ? 2 : i <= 0x7FFFFF ? 3 : 4;
};

const indexCreate = (arr, dec) => {
	arr.unshift(dec);
	return arr;
};

const indexFromSigned = (i) => {
	const n = signedLen(i);
	const num = [0];
	for (let ii = 0; ii < n; ii++) {
		num[ii + 1] = i & 0xFF;
		i >>= 8;
	}

	return num;
};

const cmp = (a, b) => assert.strictEqual(indexCompare(a, indexFromSigned(b)), 0);

test("basic numbers", () => {
	assert.deepStrictEqual(indexFromSigned(-1), indexCreate([255], 0));
	assert.deepStrictEqual(indexFromSigned(1), indexCreate([1], 0));
	assert.deepStrictEqual(indexFromSigned(256), indexCreate([0, 1], 0));
	assert.deepStrictEqual(indexFromSigned(1 << 16), indexCreate([0, 0, 1], 0));
	assert.deepStrictEqual(indexFromSigned(1 << 24), indexCreate([0, 0, 0, 1], 0));
	assert.deepStrictEqual(indexFromSigned(-1 << 8), indexCreate([0, 255], 0));
	assert.deepStrictEqual(indexFromSigned(-1 << 16), indexCreate([0, 0, 255], 0));
});

test("compare", () => {
	assert.strictEqual(indexCompare(indexFromSigned(50000), indexFromSigned(50000)), 0);
	assert.strictEqual(indexCompare(indexFromSigned(1), indexFromSigned(50000)), -1);
	assert.strictEqual(indexCompare(indexFromSigned(50000), indexFromSigned(1)), 1);
	assert.strictEqual(indexCompare(indexFromSigned(-1000), indexFromSigned(-1001)), 1);
	assert.strictEqual(indexCompare(indexFromSigned(-1000), indexFromSigned(1001)), -1);
	assert.strictEqual(indexCompare(indexFromSigned(1000), indexFromSigned(1000)), 0);
	assert.strictEqual(indexCompare(indexFromSigned(-1000), indexFromSigned(-1000)), 0);
	assert.strictEqual(indexCompare(indexCreate([66, 255], 1), indexCreate([66, 255], 1)), 0);
});

test("add", () => {
	cmp(indexAdd(indexFromSigned(0), 0), 0);
	cmp(indexAdd(indexFromSigned(0), 1), 1);
	cmp(indexAdd(indexFromSigned(-1), 1), 0);
	cmp(indexAdd(indexFromSigned(1000), 1000), 2000);
	cmp(indexAdd(indexFromSigned(-2000), 1000), -1000);
	cmp(indexAdd(indexFromSigned(0), -1), -1);
	cmp(indexAdd(indexFromSigned(0), -1000), -1000);

	cmp(indexAdd(indexFromSigned(-2000), -1000), -3000);
	cmp(indexAdd(indexFromSigned(-128), -1), -129);
});

test("add with base", () => {
	assert.deepStrictEqual(indexAdd(indexFromSigned(0), 1, -1), indexFromSigned(1 << 1));
	assert.deepStrictEqual(indexAdd(indexFromSigned(0), 1, -8), indexFromSigned(1 << 8));
	assert.deepStrictEqual(indexAdd(indexFromSigned(0), 1, 1), indexCreate([128, 0], 1));
	assert.deepStrictEqual(indexAdd(indexFromSigned(0), 1, 8), indexCreate([1, 0], 1));
	assert.deepStrictEqual(indexAdd(indexFromSigned(0), 1, 16), indexCreate([1, 0, 0], 2));
});

test("leading", () => {
	assert.strictEqual(indexLeading(indexFromSigned(1), indexFromSigned(0)), 0);
	assert.strictEqual(indexLeading(indexAdd(indexFromSigned(0), 1, 1), indexFromSigned(0)), -1);
	assert.strictEqual(indexLeading(indexAdd(indexFromSigned(0), 1, 2), indexFromSigned(0)), -2);
	assert.strictEqual(indexLeading(indexAdd(indexFromSigned(0), 1, 8), indexFromSigned(0)), -8);
});
