import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import {Insert, Modify, Delete} from '../Events.js';

test("event invert instanceof", () => {
	expect(Insert().inverse).to.be.an.instanceOf(Delete);
	expect(Modify().inverse).to.be.an.instanceOf(Modify);
	expect(Delete().inverse).to.be.an.instanceOf(Insert);
});

test("recursive events", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		if (obj.value > 10) return;

		obj.value++;
	});

	obj.value = 0;
	expect(obj.value).to.equal(11);
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
	expect(obj.value).to.equal(11);
	expect(before).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
	expect(after).to.deep.equal([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
});

test("throw in right context", () => {
	let obj = OObject();

	obj.observer.watch(() => {
		if (obj.value > 10) return;

		if (obj.value === 1) {
			obj.value++;
		} else {
			expect(() => obj.value++).to.throw();
		}

		if (obj.value === 2) {
			throw new Error();
		}
	});

	obj.value = 0;
	expect(obj.value).to.equal(11);
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
		// chai's expect(...).to.throw seems to be broken and we can't use it
		// if we try to throw a falsy value
		thrown = e;
	}

	expect(thrown).to.equal(undefined);
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

	expect(thrown).to.equal(0);
});
