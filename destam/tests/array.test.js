import assert from 'node:assert/strict';
import test from 'node:test';
import OArray, {indexPosition, positionIndex} from '../Array.js';
import OObject from '../Object.js';
import {Insert} from '../Events.js';

test("reverse and sort not accessible", () => {
	let arr = OArray();
	assert.throws(() => arr.sort())
	assert.throws(() => arr.reverse())
});

test("array insert single item", () => {
	let arr = OArray();

	arr.push(1);

	assert.strictEqual(arr.length, 1);
	assert.strictEqual(arr[0], 1);
});

test("initialized basic observable array property reads", () => {
	let arr = OArray([1, 2, 3, 4, 5]);

	assert.strictEqual(arr.length, 5);
	assert.deepStrictEqual([...arr], [1, 2, 3, 4, 5]);
});

test("basic observable array property reads", () => {
	let arr = OArray();
	arr.push(1, 2, 3, 4, 5);

	assert.strictEqual(arr.length, 5);
	assert.deepStrictEqual([...arr], [1, 2, 3, 4, 5]);
});

test("basic observable array property reads overriden", () => {
	let arr = OArray();
	arr.push(1, 2, 3, 4, 5);

	assert.strictEqual(arr.length, 5);
	assert.deepStrictEqual([...arr], [1, 2, 3, 4, 5]);

	arr[0] = 6;
	arr[1] = 7;
	arr[2] = 8;
	arr[3] = 9;
	arr[4] = 10;

	assert.strictEqual(arr.length, 5);
	assert.deepStrictEqual([...arr], [6, 7, 8, 9, 10]);
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

	assert.deepStrictEqual(events, [1, 2, 3, 4, 5]);
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

	assert.deepStrictEqual(events, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("propper return values for OArray.splice", () => {
	let arr = OArray([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

	assert.deepStrictEqual(arr.splice(0, 1), [1]);
	assert.deepStrictEqual(arr.splice(0, 2), [2, 3]);
	assert.deepStrictEqual(arr.splice(0, 2, 'hello', 'world'), [4, 5]);
	assert.deepStrictEqual(arr.splice(1, 4), ['world', 6, 7, 8]);
	assert.deepStrictEqual(arr.splice(1, 2, 'other', 'garbage'), [9, 10]);
	assert.deepStrictEqual(arr.splice(1, 2), ['other', 'garbage']);
	assert.strictEqual(arr.pop(), 'hello');
	assert.strictEqual(arr.length, 0);
});

test("shift / unshift", () => {
	let arr = OArray();

	arr.unshift(1);
	arr.unshift(3);
	arr.unshift(2);

	assert.strictEqual(arr.pop(), 1);
	assert.strictEqual(arr.shift(), 2);
	assert.strictEqual(arr.shift(), 3);
});

test("should be instanceof itself", () => {
	let arr = OArray();

	assert.ok(arr instanceof OArray);
});

test("must test as an array", () => {
	let arr = OArray();

	assert.strictEqual(Object.prototype.toString.call(arr), '[object Array]');
	assert.strictEqual(Array.isArray(arr), true);
});

test("array pathing", () => {
	let object = OArray();

	const paths = [];
	object.observer.watch(event => {
		paths.push(indexPosition(object, event.path[0]));
	});

	object.push('1');
	object.push('2');
	object.push('3');

	assert.deepStrictEqual(paths, [0, 1, 2]);
});

test("array pathing for deleted objects", () => {
	let object = OArray();

	let events = [];
	object.observer.watch(event => {
		events.push(indexPosition(object, event.path));
	});

	object.push('init');
	object.pop();

	assert.deepStrictEqual(events, [0, 0]);
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

	assert.deepStrictEqual([...obj], [0, 1, 2, 3, 4, 6, 5]);
});

test("array empty splice", () => {
	const obj = OArray();

	obj.push(0);
	obj.push(1);
	obj.push(2);
	obj.push(3);
	obj.push(4);
	obj.push(5);

	assert.deepStrictEqual(obj.splice(), [0, 1, 2, 3, 4, 5]);
	assert.deepStrictEqual([...obj], []);
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

	assert.deepStrictEqual([...obj], [0]);
	assert.deepStrictEqual(vals, [0]);
});

test("array path no value", () => {
	const obj = OArray([0, 1]);
	assert.strictEqual(obj.observer.path([positionIndex(obj, 0)]).get(), 0)

	const index = positionIndex(obj, 1);
	assert.strictEqual(obj.observer.path([index]).get(), 1);

	obj.splice(1, 1);
	assert.strictEqual(obj.observer.path([index]).get(), undefined);

	obj.push(1);

	const index2 = positionIndex(obj, 0);
	obj.splice(0, 1);

	assert.strictEqual(obj.observer.path([index2]).get(), undefined);
});

test("array modify event previous value", () => {
	const obj = OArray();
	obj.push(100);

	let prev;
	obj.observer.watch(thing => {
		prev = thing.prev;
	});

	obj[0] = 200;

	assert.deepStrictEqual(prev, 100);
});

test("array delete check during listener", () => {
	const obj = OArray();

	obj.push('thing');

	let has;
	obj.observer.watch(state => {
		has = obj.length > 0;
	});

	obj.splice(0, 1);

	assert.strictEqual(has, false);
});

test("array delete check previous value", () => {
	const obj = OArray();

	obj.push('thing');

	let prev;
	obj.observer.watch(state => {
		prev = state.prev;
	});

	obj.splice(0, 1);

	assert.strictEqual(prev, 'thing');
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

	let obs1 = obj.observer.path([positionIndex(obj, 0)]);
	let obs2 = obj.observer.path([positionIndex(obj, 1)]);
	let obs3 = obj.observer.path([positionIndex(obj, 2)]);

	assert.strictEqual(obs1.get(), obj[0]);
	assert.strictEqual(obs2.get(), obj[1]);
	assert.strictEqual(obs3.get(), obj[2]);
});

test("array path setter", () => {
	const obj = OArray(["hello", "third thing"]);
	obj.splice(1, 0, "world");

	let obs1 = obj.observer.path([positionIndex(obj, 0)]);
	let obs2 = obj.observer.path([positionIndex(obj, 1)]);
	let obs3 = obj.observer.path([positionIndex(obj, 2)]);

	obs1.set("new value 1");
	obs2.set("new value 2");
	obs3.set("new value 3");

	assert.strictEqual(obs1.get(), obj[0]);
	assert.strictEqual(obs2.get(), obj[1]);
	assert.strictEqual(obs3.get(), obj[2]);
});

test("array path setter events", () => {
	const obj = OArray(["hello", "third thing"]);
	obj.splice(1, 0, "world");

	const vals = [];
	obj.observer.watch(delta => {
		vals.push(delta.value);
	});

	let obs1 = obj.observer.path([positionIndex(obj, 0)]);
	let obs2 = obj.observer.path([positionIndex(obj, 1)]);
	let obs3 = obj.observer.path([positionIndex(obj, 2)]);

	obs1.set("new value 1");
	obs2.set("new value 2");
	obs3.set("new value 3");

	assert.deepStrictEqual(vals, ["new value 1", "new value 2", "new value 3"]);
});

test("array fill", () => {
	const arr = OArray([1, 2, 3]);

	const vals = [];
	arr.observer.watch(delta => {
		vals.push(delta.value);
	})

	arr.fill(null);

	assert.deepStrictEqual([...arr], [null, null, null]);
	assert.deepStrictEqual(vals, [null, null, null]);
});

test("array out of bounds", () => {
	const arr = OArray([1]);

	assert.throws(() => arr[3] = 'val');
	assert.throws(() => arr['0hello'] = 'val');
});

test("array observer and lifetime", () => {
	const arr = OArray();

	const obs = arr.observer.lifetime(() => {
		arr.push(0);

		return () => arr.push(1);
	});

	assert.deepStrictEqual([...arr], []);
	const watch = obs.watch(() => {});
	arr.push(3);
	assert.deepStrictEqual([...arr], [0, 3]);
	watch();
	assert.deepStrictEqual([...arr], [0, 3, 1]);

	assert.strictEqual(obs.get(), arr);
});

test("array splice bigger array listen items", () => {
	const obj = OArray([OObject()]);

	const special = OObject();
	obj.splice(0, 1, special, OObject());

	const events = [];
	const stop = obj.observer.watch(delta => {
		events.push(delta.value);
	});

	obj.pop();
	special.value = 'val';
	obj.pop();

	assert.deepStrictEqual(events, [undefined, 'val', undefined]);

	stop();
});

test("array splice smaller array listen items", () => {
	const special = OObject();
	const obj = OArray([OObject(), special, OObject()]);

	obj.splice(0, 2, OObject());

	const events = [];
	const stop = obj.observer.watch(delta => {
		events.push(delta.value);
	});

	obj.pop();
	special.value = 'val';
	obj.pop();

	assert.deepStrictEqual(events, [undefined, undefined]);

	stop();
});

test("OArray splice while watched", () => {
	const items = OArray([OObject(), OObject(), OObject()]);
	const stop = items.observer.watch(() => {});

	items.splice(0, 2, OObject());
	items.pop();
	items.pop();

	stop();
});

test("OArray fuzz", () => {
	let s = 1234 >>> 0;
	const rng = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};

	const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

	const items = OArray([
		OObject({ label: 'a' }),
		OObject({ label: 'b' }),
		OObject({ label: 'c' }),
		OObject({ label: 'd' }),
	]);

	const ops = ['push', 'pop', 'shift', 'unshift', 'splice', 'swap', 'replace'];
	for (let i = 0; i < 5000; i++) {
		const len = items.length;
		switch (pick(rng, ops)) {
			case 'push': items.push(OObject({ label: `p${i}` })); break;
			case 'pop': if (len) items.pop(); break;
			case 'shift': if (len) items.shift(); break;
			case 'unshift': items.unshift(OObject({ label: `u${i}` })); break;
			case 'splice': {
				const start = len ? Math.floor(rng() * len) : 0;
				const del = len ? Math.floor(rng() * Math.min(3, len - start)) : 0;
				const adds = Math.floor(rng() * 5);
				const vals = [];
				for (let j = 0; j < adds; j++) vals.push(OObject({ label: `s${i}-${j}` }));
				items.splice(start, del, ...vals);
				break;
			}
			case 'swap': {
				// reuses existing element instances -> same observable briefly at two indices
				if (len < 2) break;
				const a = Math.floor(rng() * len);
				let b = Math.floor(rng() * len);
				if (b === a) b = (b + 1) % len;
				const va = items[a];
				const vb = items[b];
				items[b] = va;
				items[a] = vb;
				break;
			}
			case 'replace': {
				if (!len) break;
				items[Math.floor(rng() * len)] = OObject({ label: `r${i}` });
				break;
			}
		}
	}

	for (let i = 0; i < items.length; i++) {
		assert.strictEqual(items.observer.indexes_[i].observer_, items[i].observer);
	}
});

