import {expect} from 'chai';
import test from 'node:test';
import OArray, {indexPosition, positionIndex} from '../Array.js';
import {Insert} from '../Events.js';

test("reverse and sort not accessible", () => {
	let arr = OArray();
	expect(() => arr.sort()).to.throw()
	expect(() => arr.reverse()).to.throw()
});

test("array insert single item", () => {
	let arr = OArray();

	arr.push(1);

	expect(arr.length).to.equal(1);
	expect(arr[0]).to.equal(1);
});

test("initialized basic observable array property reads", () => {
	let arr = OArray([1, 2, 3, 4, 5]);

	expect(arr.length).to.be.equal(5);
	expect([...arr]).to.be.deep.equal([1, 2, 3, 4, 5]);
});

test("basic observable array property reads", () => {
	let arr = OArray();
	arr.push(1, 2, 3, 4, 5);

	expect(arr.length).to.be.equal(5);
	expect([...arr]).to.be.deep.equal([1, 2, 3, 4, 5]);
});

test("basic observable array property reads overriden", () => {
	let arr = OArray();
	arr.push(1, 2, 3, 4, 5);

	expect(arr.length).to.be.equal(5);
	expect([...arr]).to.be.deep.equal([1, 2, 3, 4, 5]);

	arr[0] = 6;
	arr[1] = 7;
	arr[2] = 8;
	arr[3] = 9;
	arr[4] = 10;

	expect(arr.length).to.be.equal(5);
	expect([...arr]).to.be.deep.equal([6, 7, 8, 9, 10]);
});

test("array basic events", () => {
	let arr = OArray([1, 2, 3, 4, 5]);

	let events = [];
	arr.observer.watch(event => {
		if (event instanceof Insert) {
			events.push(event.value);
		}
	});

	arr.push(1, 2, 3, 4, 5);

	expect(events).to.deep.equal([1, 2, 3, 4, 5]);
});

test("array basic events override", () => {
	let arr = OArray([1, 2, 3, 4, 5]);

	let events = [];
	arr.observer.watch(event => {
		events.push(event.value);
	});

	arr.push(1, 2, 3, 4, 5);
	arr[0] = 6;
	arr[1] = 7;
	arr[2] = 8;
	arr[3] = 9;
	arr[4] = 10;

	expect(events).to.deep.equal([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("propper return values for OArray.splice", () => {
	let arr = OArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

	expect(arr.splice(0, 1)).to.deep.equal([1]);
	expect(arr.splice(0, 2)).to.deep.equal([2, 3]);
	expect(arr.splice(0, 2, 'hello', 'world')).to.be.deep.equal([4, 5]);
	expect(arr.splice(1, 4)).to.deep.equal(['world', 6, 7, 8]);
	expect(arr.splice(1, 2, 'other', 'garbage')).to.deep.equal([9, 10]);
	expect(arr.splice(1, 2)).to.deep.equal(['other', 'garbage']);
	expect(arr.pop()).to.equal('hello');
	expect(arr.length).to.equal(0);
});

test("shift / unshift", () => {
	let arr = OArray();

	arr.unshift(1);
	arr.unshift(3);
	arr.unshift(2);

	expect(arr.pop()).to.equal(1);
	expect(arr.shift()).to.equal(2);
	expect(arr.shift()).to.equal(3);
});

test("should be instanceof itself", () => {
	let arr = OArray();

	expect(arr).to.be.an.instanceOf(OArray);
});

test("must test as an array", () => {
	let arr = OArray();

	expect(Object.prototype.toString.call(arr)).to.equal('[object Array]');
	expect(Array.isArray(arr)).to.equal(true);
});

test("array pathing", () => {
	let object = OArray();

	const paths = [];
	object.observer.watch(event => {
		paths.push(indexPosition(object, event.path(object)[0]));
	});

	object.push('1');
	object.push('2');
	object.push('3');

	expect(paths).to.deep.equal([0, 1, 2]);
});

test("array pathing for deleted objects", () => {
	let object = OArray();

	let events = [];
	object.observer.watch(event => {
		events.push(indexPosition(object, event.path(object)));
	});

	object.push('init');
	object.pop();

	expect(events).to.deep.equal([0, 0]);
});

test("insert before end", () => {
	const obj = OArray();

	obj.push(0);
	obj.push(1);
	obj.push(2);
	obj.push(3);
	obj.push(4);
	obj.push(5);

	obj.splice(5, 0, 6);

	expect([...obj]).to.deep.equal([0, 1, 2, 3, 4, 6, 5]);
});

test("array empty splice", () => {
	const obj = OArray();

	obj.push(0);
	obj.push(1);
	obj.push(2);
	obj.push(3);
	obj.push(4);
	obj.push(5);

	expect(obj.splice()).to.deep.equal([0, 1, 2, 3, 4, 5]);
	expect(obj).to.deep.equal([]);
});

test("array splice identical", () => {
	const obj = OArray();

	let vals = [];
	obj.observer.watch(delta => {
		vals.push(delta.value);
	});

	obj.push(0);
	obj[0] = 0;
	obj.splice(0, 1, 0);

	expect(obj).to.deep.equal([0]);
	expect(vals).to.deep.equal([0]);
});

test("array path no value", () => {
	const obj = OArray([0, 1]);
	expect(obj.observer.path(positionIndex(obj, 0)).get()).to.equal(0)

	const index = positionIndex(obj, 1);
	expect(obj.observer.path(index).get()).to.equal(1);

	obj.splice(1, 1);
	expect(obj.observer.path(index).get()).to.equal(null);

	obj.push(1);

	const index2 = positionIndex(obj, 0);
	obj.splice(0, 1);

	expect(obj.observer.path(index2).get()).to.equal(null);
});

test("array modify event previous value", () => {
	const obj = OArray();
	obj.push(100);

	let prev;
	obj.observer.watch(thing => {
		prev = thing.prev;
	});

	obj[0] = 200;

	expect(prev).to.deep.equal(100);
});

test("array delete check during listener", () => {
	const obj = OArray();

	obj.push('thing');

	let has;
	obj.observer.watch(state => {
		has = obj.length > 0;
	});

	obj.splice(0, 1);

	expect(has).to.equal(false);
});

test("array delete check previous value", () => {
	const obj = OArray();

	obj.push('thing');

	let prev;
	obj.observer.watch(state => {
		prev = state.prev;
	});

	obj.splice(0, 1);

	expect(prev).to.equal('thing');
});

test("array heavy nesting", () => {
	const obj = OArray([0, 0]);

	for (let i = 0; i < 128; i++) {
		obj.splice(1, 0, 0);
	}
});

test("append many times", () => {
	const obj = OArray();

	for (let i = 0; i < 512; i++) {
		obj.push(i);
	}
});

test("prepend many times", () => {
	const obj = OArray();

	for (let i = 0; i < 512; i++) {
		obj.unshift(i);
	}
});

test("array path getter", () => {
	const obj = OArray(["hello", "third thing"]);
	obj.splice(1, 0, "world");

	let obs1 = obj.observer.path(positionIndex(obj, 0));
	let obs2 = obj.observer.path(positionIndex(obj, 1));
	let obs3 = obj.observer.path(positionIndex(obj, 2));

	expect(obs1.get()).to.equal(obj[0]);
	expect(obs2.get()).to.equal(obj[1]);
	expect(obs3.get()).to.equal(obj[2]);
});

test("array path setter", () => {
	const obj = OArray(["hello", "third thing"]);
	obj.splice(1, 0, "world");

	let obs1 = obj.observer.path(positionIndex(obj, 0));
	let obs2 = obj.observer.path(positionIndex(obj, 1));
	let obs3 = obj.observer.path(positionIndex(obj, 2));

	obs1.set("new value 1");
	obs2.set("new value 2");
	obs3.set("new value 3");

	expect(obs1.get()).to.equal(obj[0]);
	expect(obs2.get()).to.equal(obj[1]);
	expect(obs3.get()).to.equal(obj[2]);
});

test("array path setter events", () => {
	const obj = OArray(["hello", "third thing"]);
	obj.splice(1, 0, "world");

	const vals = [];
	obj.observer.watch(delta => {
		vals.push(delta.value);
	});

	let obs1 = obj.observer.path(positionIndex(obj, 0));
	let obs2 = obj.observer.path(positionIndex(obj, 1));
	let obs3 = obj.observer.path(positionIndex(obj, 2));

	obs1.set("new value 1");
	obs2.set("new value 2");
	obs3.set("new value 3");

	expect(vals).to.deep.equal(["new value 1", "new value 2", "new value 3"]);
});

test("array fill", () => {
	const arr = OArray([1, 2, 3]);

	const vals = [];
	arr.observer.watch(delta => {
		vals.push(delta.value);
	})

	arr.fill(null);

	expect(arr).to.deep.equal([null, null, null]);
	expect(vals).to.deep.equal([null, null, null]);
});

test("array out of bounds", () => {
	const arr = OArray([1]);

	expect(() => arr[3] = 'val').to.throw();
	expect(() => arr['0hello'] = 'val').to.throw();
});
