import {expect} from 'chai';
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

const cmp = (a, b) => expect(indexCompare(a, indexFromSigned(b))).to.equal(0);

test("basic numbers", () => {
	expect(indexFromSigned(-1)).to.deep.equal(indexCreate([255], 0));
	expect(indexFromSigned(1)).to.deep.equal(indexCreate([1], 0));
	expect(indexFromSigned(256)).to.deep.equal(indexCreate([0, 1], 0));
	expect(indexFromSigned(1 << 16)).to.deep.equal(indexCreate([0, 0, 1], 0));
	expect(indexFromSigned(1 << 24)).to.deep.equal(indexCreate([0, 0, 0, 1], 0));
	expect(indexFromSigned(-1 << 8)).to.deep.equal(indexCreate([0, 255], 0));
	expect(indexFromSigned(-1 << 16)).to.deep.equal(indexCreate([0, 0, 255], 0));
});

test("compare", () => {
	expect(indexCompare(indexFromSigned(50000), indexFromSigned(50000))).to.equal(0);
	expect(indexCompare(indexFromSigned(1), indexFromSigned(50000))).to.equal(-1);
	expect(indexCompare(indexFromSigned(50000), indexFromSigned(1))).to.equal(1);
	expect(indexCompare(indexFromSigned(-1000), indexFromSigned(-1001))).to.equal(1);
	expect(indexCompare(indexFromSigned(-1000), indexFromSigned(1001))).to.equal(-1);
	expect(indexCompare(indexFromSigned(1000), indexFromSigned(1000))).to.equal(0);
	expect(indexCompare(indexFromSigned(-1000), indexFromSigned(-1000))).to.equal(0);
	expect(indexCompare(indexCreate([66, 255], 1), indexCreate([66, 255], 1))).to.equal(0);
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
	expect(indexAdd(indexFromSigned(0), 1, -1)).to.deep.equal(indexFromSigned(1 << 1));
	expect(indexAdd(indexFromSigned(0), 1, -8)).to.deep.equal(indexFromSigned(1 << 8));
	expect(indexAdd(indexFromSigned(0), 1, 1)).to.deep.equal(indexCreate([128, 0], 1));
	expect(indexAdd(indexFromSigned(0), 1, 8)).to.deep.equal(indexCreate([1, 0], 1));
	expect(indexAdd(indexFromSigned(0), 1, 16)).to.deep.equal(indexCreate([1, 0, 0], 2));
});

test("leading", () => {
	expect(indexLeading(indexFromSigned(1), indexFromSigned(0))).to.equal(0);
	expect(indexLeading(indexAdd(indexFromSigned(0), 1, 1), indexFromSigned(0))).to.equal(-1);
	expect(indexLeading(indexAdd(indexFromSigned(0), 1, 2), indexFromSigned(0))).to.equal(-2);
	expect(indexLeading(indexAdd(indexFromSigned(0), 1, 8), indexFromSigned(0))).to.equal(-8);
});
