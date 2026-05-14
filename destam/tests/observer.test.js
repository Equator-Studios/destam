import assert from 'node:assert/strict';
import test from 'node:test';
import Observer from '../Observer.js';
import OObject from '../Object.js';
import OArray from '../Array.js';

test("Observer.mutable getter", () => {
	const value = Observer.mutable('hello');

	assert.strictEqual(value.get(), 'hello');
});

test("Observer.mutable getter and setter", () => {
	const value = Observer.mutable('hello');
	value.set('world');

	assert.strictEqual(value.get(), 'world');
});

test("Observer.mutable events", () => {
	const value = Observer.mutable('hello');

	const events = [];
	value.watch(event => {
		events.push(event.value);
	});

	value.set('previous');
	value.set('world');

	assert.strictEqual(value.get(), 'world');
	assert.deepStrictEqual(events, ['previous', 'world']);
});

test("Observer.mutable event order", () => {
	const value = Observer.mutable();

	const events = [];
	value.watch(event => {
		events.push(0);
		value.set(1);
	});

	value.watch(event => {
		events.push(1);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1, 0, 1]);
});

test("Observer.mutable event nested remove", () => {
	const value = Observer.mutable();

	const events = [];
	const watcher = value.watch(event => {
		events.push(0);
	});

	value.watch(event => {
		events.push(1);
		watcher();
	});

	value.watch(event => {
		events.push(2);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1, 2]);
});

test("Observer.mutable event nested remove", () => {
	const value = Observer.mutable();

	const events = [];
	value.watch(event => {
		events.push(0);
		watcher();
	});

	const watcher = value.watch(event => {
		events.push(1);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1]);
});

test("Observer.mutable event remove value", () => {
	const value = Observer.mutable();
	const watcher = value.watch(event => {});

	assert.strictEqual(watcher(), undefined);
});

test("Observer.mutable event opposite order", () => {
	const value = Observer.mutable();

	const events = [];
	value.watch(event => {
		events.push(0);
	});

	value.watch(event => {
		events.push(1);
		value.set(1);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1, 0, 1]);
});

test("Observer.mutable event throw", () => {
	const value = Observer.mutable();

	const events = [];
	value.watch(event => {
		events.push(0);
		throw new Error("oops");
	});

	value.watch(event => {
		events.push(1);
	});

	assert.throws(() => value.set(0));
	assert.deepStrictEqual(events, [0, 1]);
});

test("Observer.mutable event throw opposite", () => {
	const value = Observer.mutable();

	const events = [];
	value.watch(event => {
		events.push(0);
	});

	value.watch(event => {
		events.push(1);
		throw new Error("oops");
	});

	assert.throws(() => value.set(0));
	assert.deepStrictEqual(events, [0, 1]);
});

test("Observer.mutable memo event order", () => {
	const value = Observer.mutable().memo();

	const events = [];
	value.watch(event => {
		events.push(0);
		value.set(1);
	});

	value.watch(event => {
		events.push(1);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1, 0, 1]);
});

test("Observer.mutable memo event opposite order", () => {
	const value = Observer.mutable().memo();

	const events = [];
	value.watch(event => {
		events.push(0);
	});

	value.watch(event => {
		events.push(1);
		value.set(1);
	});

	value.set(0);

	assert.deepStrictEqual(events, [0, 1, 0, 1]);
});

test("Observer.mutable memo event throw", () => {
	const value = Observer.mutable().memo();

	const events = [];
	value.watch(event => {
		events.push(0);
		throw new Error("oops");
	});

	value.watch(event => {
		events.push(1);
	});

	assert.throws(() => value.set(0));
	assert.deepStrictEqual(events, [0, 1]);
});

test("Observer.mutable memo event throw opposite", () => {
	const value = Observer.mutable().memo();

	const events = [];
	value.watch(event => {
		events.push(0);
	});

	value.watch(event => {
		events.push(1);
		throw new Error("oops");
	});

	assert.throws(() => value.set(0));
	assert.deepStrictEqual(events, [0, 1]);
});

test ("observer def", () => {
	const obj = OObject();

	let observer = obj.observer.path("hello").def("default");

	const states = [];
	const watcher = observer.effect(val => (states.push(val), null));

	obj.hello = '1';
	obj.hello = '2';
	obj.hello = undefined;
	obj.hello = '3';

	watcher();

	assert.deepStrictEqual(states, ['default', '1', '2', 'default', '3']);
});

test ("observer def mutable", () => {
	const obj = OObject();

	let def = Observer.mutable("default");
	let observer = obj.observer.path("hello").def(def);

	const states = [];
	const watcher = observer.effect(val => (states.push(val), null));

	obj.hello = '1';
	def.set("second");
	obj.hello = '2';
	obj.hello = undefined;
	def.set("third");

	watcher();

	assert.deepStrictEqual(states, ['default', '1', '2', 'second', 'third']);
});

test ("default observable value", () => {
	const obj = OObject();

	let def = Observer.mutable("default");
	let observer = obj.observer.path("hello").def(def);

	const states = [];
	const watcher = observer.effect(val => (states.push(val), null));

	def.set("other default");

	obj.hello = '1';
	obj.hello = '2';
	obj.hello = undefined;
	obj.hello = '3';

	def.set('what is up');

	watcher();

	assert.deepStrictEqual(states, ['default', 'other default', '1', '2', 'other default', '3']);
});

test("observer all", () => {
	const object = OObject({value: 0});
	const object2 = OObject({value: 0});

	const observer = Observer.all([object.observer.path('value'), object2.observer.path('value')])
	const values = [];
	const watcher = observer.effect(val => (values.push(val), null));

	object.value = 10;
	object2.value = 100;
	object.value = 100;

	observer.set(["hello", "world"]);
	assert.deepStrictEqual(observer.get(), ["hello", "world"]);
	assert.throws(() => observer.set([1, 2, 3]));

	watcher();

	assert.deepStrictEqual(values, [[0, 0], [10, 0], [10, 100], [100, 100], ["hello", 100], ["hello", "world"]]);
});

test("observer all with map", () => {
	const object = OObject({value: 0});
	const object2 = OObject({value: 0});

	const observer = Observer.all([object.observer.path('value'), object2.observer.path('value')]).map(([a, b]) => a + b);
	const values = [];
	const watcher = observer.watch(state => {
		values.push(observer.get());
	});

	object.value = 10;
	object2.value = 100;
	object.value = 100;

	watcher();

	assert.deepStrictEqual(values, [10, 110, 200]);
});

test("observer with observer dependiences", () => {
	const obs = Observer.mutable([]);
	const all = Observer.all(obs);

	const vals = [];
	const watcher = all.watch(state => {
		vals.push(all.get());
	});

	const one = Observer.mutable(false);
	const two = Observer.mutable(false);

	obs.set([one, two]);

	one.set(true);
	two.set(true);
	one.set(false);

	obs.set([]);

	one.set(false);
	two.set(true);

	assert.deepStrictEqual(vals, [[false, false], [true, false], [true, true], [false, true], []]);
});

test("observer.all set", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const all = Observer.all([one, two]);

	all.set([1, 2]);

	assert.strictEqual(one.get(), 1);
	assert.strictEqual(two.get(), 2);
});

test("observer.all set invalid array", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const all = Observer.all([one, two]);

	assert.throws(() => {
		all.set([1]);
	});
});

test("observer.all set variable array", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const three = Observer.mutable(0);

	const arr = Observer.mutable([one, two])
	const all = Observer.all(arr);

	arr.set([one, two, three]);

	all.set([1, 2, 3]);

	assert.strictEqual(one.get(), 1);
	assert.strictEqual(two.get(), 2);
	assert.strictEqual(three.get(), 3);
});

test("observer.all set variable array remove", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const three = Observer.mutable(0);

	const arr = Observer.mutable([one, two])
	const all = Observer.all(arr);

	const stuff = [];
	const watcher = all.watch(delta => {
		stuff.push(all.get());
	});

	arr.set([one, two, three]);
	watcher();

	all.set([1, 2, 3]);

	assert.deepStrictEqual(stuff, [
		[0, 0, 0],
	]);
});

test("observer.all set variable array invalid array", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const three = Observer.mutable(0);

	const arr = Observer.mutable([one, two])
	const all = Observer.all(arr);

	arr.set([one, two, three]);

	assert.throws(() => {
		all.set([1, 2]);
	});
});

test("observer memo", () => {
	const obs = Observer.mutable(null);
	const memo = obs.memo();

	const vals = [];
	const watcher = memo.watch(delta => {
		vals.push(delta.value);
	});

	const vals2 = [];
	const watcher2 = memo.watch(delta => {
		vals2.push(delta.value);
	});

	watcher2();
	watcher2();

	obs.set("dude");
	memo.set("hello");
	memo.set("hello");

	watcher();

	assert.deepStrictEqual(vals, ["dude", "hello"]);
	assert.deepStrictEqual(vals2, []);
});

test("observer memo multiple", () => {
	const obs = Observer.mutable(null);

	const [one, two, three] = obs.memo(3);

	let vals = [];
	two.watch(delta => {
		vals.push("two-" + delta.value);
	});

	one.watch(delta => {
		vals.push("one-" + delta.value);
	});

	three.watch(delta => {
		vals.push("three-" + delta.value);
	});

	obs.set("dude");

	assert.deepStrictEqual(vals, ["one-dude", "two-dude", "three-dude"]);
});

test("observer immutable", () => {
	const obs = Observer.immutable('hello');

	assert.strictEqual(obs.isImmutable(), true);

	assert.strictEqual(obs.get(), "hello");
	assert.throws(() => obs.set("new value"));
});

test("observer immutable assign and remove listener", () => {
	const obs = Observer.immutable('hello');

	const listener = obs.watch(() => {});
	listener();
});

test("observer immutable of other observer", () => {
	const obs = Observer.mutable("hello");
	const imm = Observer.immutable(obs);

	assert.strictEqual(imm.isImmutable(), true);

	assert.strictEqual(imm.get(), "hello");
	assert.throws(() => imm.set("new value"));

	const vals = [];
	imm.watch(delta => {
		vals.push(delta.value);
	});

	obs.set("value");
	assert.strictEqual(imm.get(), "value");
	assert.deepStrictEqual(vals, ["value"]);
});

test("observer setter", () => {
	const obs = Observer.mutable('hello').setter((val, set) => val !== 'ignore' && set(val));

	assert.strictEqual(obs.get(), "hello");
	obs.set("ignore");
	assert.strictEqual(obs.get(), "hello");
	obs.set("other");
	assert.strictEqual(obs.get(), "other");
});

test("observer event", () => {
	const events = [];
	const options = {};
	let callback;

	const obs = Observer.event({
		addEventListener: (type, cb, options) => {
			events.push(type, options);
			callback = cb;
		},
		removeEventListener: (type, cb, options) => {
			events.push(type, options);

			assert.strictEqual(cb, callback);
		},
	}, "event", options);


	const vals = [];
	const watcher = obs.watch(val => {
		vals.push(val.value);
	});

	callback('hello');
	callback('world');

	watcher();

	assert.strictEqual(obs.get(), 'world');
	assert.deepStrictEqual(events, ["event", options, "event", options]);
	assert.deepStrictEqual(vals, ["hello", "world"]);
});

test("observer tree", () => {
	const tree = OObject({
		children: OArray([
			OObject({
				children: OArray([
					OObject()
				])
			}),
			OObject({})
		])
	});

	let vals = [];
	tree.observer.tree('children').path('val').watch(delta => {
		vals.push(delta.value);
	});

	tree.hello = "hello";
	tree.val = "val";
	tree.children[0].hello = "hello";
	tree.children[0].val = "val 2";
	tree.children[1].hello = "hello";
	tree.children[1].val = "val 3";
	tree.children[0].children[0].hello = "hello";
	tree.children[0].children[0].val = "val 4";

	assert.deepStrictEqual(vals, ["val", "val 2", "val 3", "val 4"]);
});

test("observer unwrap", () => {
	let obs = Observer.mutable("hello").unwrap();

	assert.strictEqual(obs.get(), "hello");
	obs.set("other val");
	assert.strictEqual(obs.get(), "other val");
	let second = Observer.mutable("second");
	obs.set(second);
	assert.strictEqual(obs.get(), "second");
	second.set("mutated second");
	assert.strictEqual(obs.get(), "mutated second");
	obs.set("from obs");
	assert.strictEqual(second.get(), "from obs");
	assert.strictEqual(obs.get(), "from obs");
});

test("observer unwrap events", () => {
	const orig = Observer.mutable("hello");
	let obs = orig.unwrap();

	let vals = [];
	let watcher = obs.watch(delta => {
		vals.push(obs.get());
	});

	let second = Observer.mutable("second");
	obs.set(second);

	const third = Observer.mutable();

	second.set("hello");
	second.set(third);
	orig.set("reset");
	second.set("after");

	watcher();
	assert.strictEqual(second.get(), "after");
	assert.deepStrictEqual(vals, ["second", "hello", third, "reset"]);
});

test("observer unwrap watcher remove", () => {
	const orig = Observer.mutable("hello");
	let obs = orig.unwrap();

	orig.set(Observer.mutable());

	const watcher = obs.watch(() => {});
	watcher();
});

test("observer map", () => {
	let orig = Observer.mutable(1);
	let obs = orig.map(x => x * 2);

	assert.strictEqual(obs.isImmutable(), true);

	assert.strictEqual(obs.get(), 2);
	orig.set(4);
	assert.strictEqual(obs.get(), 8);
	assert.throws(() => obs.set(8));
});

test("observer map call frequency", () => {
	let calls = 0;
	let orig = Observer.mutable(1);
	let obs = Observer(() => {
		calls++;
		return orig.get();
	}, orig.set.bind(orig), orig.register_.bind(orig)).map(x => x * 2);

	let val;
	obs.watch(() => {
		val = obs.get();
	});

	orig.set(2);

	assert.strictEqual(calls, 1);
	assert.strictEqual(val, 4);
});

test("observer double map", () => {
	let orig = Observer.mutable(false);
	let obs = orig.map(x => !x).map(x => !x);

	assert.strictEqual(obs.isImmutable(), true);

	const vals = [];
	obs.watch(state => {
		vals.push(obs.get());
	});

	orig.set(true);
	orig.set(false);

	assert.deepStrictEqual(vals, [true, false]);
});

test("observer map and memo duplicate value", () => {
	let orig = Observer.mutable(0);
	let obs = orig.map(x => x >> 1).memo();

	const vals = [];
	obs.watch(state => {
		vals.push(obs.get());
	});

	orig.set(2);
	orig.set(3);
	orig.set(4);
	orig.set(5);

	assert.deepStrictEqual(vals, [1, 2]);
});

test("observer mutable map and memo", () => {
	let orig = Observer.mutable(1);
	let obs = orig.map(x => x * 2, x => x / 2).memo();

	let vals = [];
	let watcher = obs.watch(delta => {
		vals.push(obs.get());
	});

	let vals2 = [];
	let watcher2 = obs.watch(delta => {
		vals2.push(obs.get());
	});

	orig.set(0);
	orig.set(1);
	orig.set(2);
	obs.set(8);
	obs.set(4);
	obs.set(2);
	orig.set(1);

	watcher();
	watcher2();

	assert.deepStrictEqual(vals, [0, 2, 4, 8, 4, 2]);
	assert.deepStrictEqual(vals2, [0, 2, 4, 8, 4, 2]);
});

test("observer skip", () => {
	let tree = OObject({
		nested: OObject({
			nested: OObject(),
			nested2: OObject(),
		}),
		nested2: OObject({
			nested: OObject(),
			nested2: OObject(),
		})
	});

	const vals = [];
	const watcher = tree.observer.skip().path("hello").watch(state => {
		vals.push(state.value);
	});

	tree.hello = "hello";
	tree.world = "world";
	tree.nested.hello = "hello 2";
	tree.nested.world = "world 2";
	tree.nested2.hello = "hello 3";
	tree.nested2.world = "world 3";
	tree.nested.nested.hello = "dude";
	tree.nested.nested.world = "dude";

	watcher();

	assert.deepStrictEqual(vals, ["hello", "world", "hello 2", "hello 3"]);
});

test("observer skip multiple", () => {
	let tree = OObject({
		nested: OObject({
			nested: OObject(),
			nested2: OObject(),
		}),
		nested2: OObject({
			nested: OObject(),
			nested2: OObject(),
		})
	});

	const vals = [];
	const watcher = tree.observer.skip(2).path("hello").watch(state => {
		vals.push(state.value);
	});

	tree.hello = "hello";
	tree.world = "world";
	tree.nested.hello = "hello 2";
	tree.nested.world = "world 2";
	tree.nested2.hello = "hello 3";
	tree.nested2.world = "world 3";
	tree.nested.nested.hello = "hello 4";
	tree.nested.nested.world = "world 4";

	watcher();

	assert.deepStrictEqual(vals, ["hello", "world", "hello 2", "world 2", "hello 3", "world 3", "hello 4"]);
});

test("observer throttle", async () => {
	let obs = Observer.mutable(0);

	const vals = [];
	const watcher = obs.throttle(0).watch(state => {
		vals.push(state.value);
	});

	obs.set(1);
	obs.set(2);
	obs.set(3);
	await new Promise(ok => setTimeout(ok, 0));
	obs.set(4);
	obs.set(5);
	obs.set(6);
	await new Promise(ok => setTimeout(ok, 0));
	await new Promise(ok => setTimeout(ok, 0));

	watcher();

	assert.deepStrictEqual(vals, [1, 3, 6]);
});

test("observer throttle remove while watching", async () => {
	let obs = Observer.mutable(0);

	const vals = [];
	const watcher = obs.throttle(0).watch(state => {
		vals.push(state.value);
	});

	obs.set(1);
	obs.set(2);
	watcher();

	assert.deepStrictEqual(vals, [1, 2]);
});

test("observer wait", async () => {
	let obs = Observer.mutable(0);

	const vals = [];
	const watcher = obs.wait(5).watch(state => {
		vals.push(state.value);
	});

	obs.set(1);
	await new Promise(ok => setTimeout(ok, 1));
	obs.set(2);
	await new Promise(ok => setTimeout(ok, 1));
	obs.set(3);
	await new Promise(ok => setTimeout(ok, 1));
	obs.set(4);
	await new Promise(ok => setTimeout(ok, 10));
	obs.set(5);
	await new Promise(ok => setTimeout(ok, 1));
	obs.set(6);
	await new Promise(ok => setTimeout(ok, 10));
	obs.set(7);
	watcher();

	assert.deepStrictEqual(vals, [4, 6, 7]);
});

test("observer wait immediate remove", async () => {
	let obs = Observer.mutable(0);

	const watcher = obs.wait(5).watch(() => {});
	watcher();
});

test("observer timer", async () => {
	const timer = Observer.timer(10);
	assert.strictEqual(timer.get(), 0);

	const vals = [];
	const watcher = timer.watch(delta => {
		vals.push(delta.value);
	});

	await new Promise(ok => setTimeout(ok, 25));
	watcher();

	assert.deepStrictEqual(vals, [1, 2]);
	assert.strictEqual(timer.get(), 2);
});

test("observer watch non function", () => {
	const obs = Observer.mutable();

	assert.throws(() => obs.watch(1));
	assert.throws(() => obs.watchCommit(1));
});

test("observer timer in map and unwrap", async () => {
	const activated = Observer.mutable(false);
	const obs = activated.map(a => a ? Observer.timer(10) : 'not-activated').unwrap();

	const states = [];
	let remove = obs.effect(val => (states.push(val), null));

	activated.set(true);
	await new Promise(ok => setTimeout(ok, 25));
	remove();

	assert.deepStrictEqual(states, ['not-activated', 0, 1, 2]);
});

test("observer selector", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
	selected.set(1);
	assert.strictEqual(one.get(), true);
	assert.strictEqual(two.get(), false);
	selected.set(2);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), true);
	selected.set(null);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
});

test("observer selector set selected", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
	one.set(true);
	assert.strictEqual(one.get(), true);
	assert.strictEqual(two.get(), false);
	two.set(true);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), true);
});

test("observer selector deselect by setting defValue", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	one.set(true);
	assert.strictEqual(one.get(), true);
	assert.strictEqual(two.get(), false);
	one.set(false);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
	assert.strictEqual(selected.get(), null);
});

test("observer selector set selected custom values", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector('one', 'two');

	const one = selector(1);
	const two = selector(2);

	assert.strictEqual(one.get(), 'two');
	assert.strictEqual(two.get(), 'two');
	one.set('one');
	assert.strictEqual(one.get(), 'one');
	assert.strictEqual(two.get(), 'two');
	two.set('one');
	assert.strictEqual(one.get(), 'two');
	assert.strictEqual(two.get(), 'one');
});

test("observer selector custom values", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector('yes', 'no');

	const one = selector(1);
	const two = selector(2);

	assert.strictEqual(one.get(), 'no');
	assert.strictEqual(two.get(), 'no');
	selected.set(1);
	assert.strictEqual(one.get(), 'yes');
	assert.strictEqual(two.get(), 'no');
	selected.set(2);
	assert.strictEqual(one.get(), 'no');
	assert.strictEqual(two.get(), 'yes');
	selected.set(null);
	assert.strictEqual(one.get(), 'no');
	assert.strictEqual(two.get(), 'no');
});

test("observer duplicate selector", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);

	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
	selected.set(1);
	assert.strictEqual(one.get(), true);
	assert.strictEqual(two.get(), true);
	selected.set(null);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
});

test("observer selector events", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(2, two.get()));

	selected.set(1);
	selected.set(2);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, false, 2, true, 2, false]);
});

test("observer selector events double remove", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);

	const events = [];
	const watcher = one.watch(delta => events.push(1, one.get()));

	watcher();
	watcher();

	assert.deepStrictEqual(events, []);
});

test("observer duplicate selector events", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(1, two.get()));

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, true, 1, false, 1, false]);
});

test("observer duplicate selector events remove first", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);

	const events = [];
	const watcher = one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(1, two.get()));

	watcher();

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, false]);
});

test("observer duplicate selector events remove second", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	const watcher = two.watch(delta => events.push(1, two.get()));

	watcher();

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, false]);
});

test("observer duplicate selector 3 events remove first", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);
	const three = selector(1);

	const events = [];
	const watcher = one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(1, two.get()));
	three.watch(delta => events.push(1, three.get()));

	watcher();

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, true, 1, false, 1, false]);
});

test("observer duplicate selector 3 events remove second", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);
	const three = selector(1);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	const watcher = two.watch(delta => events.push(1, two.get()));
	three.watch(delta => events.push(1, three.get()));

	watcher();

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, true, 1, false, 1, false]);
});

test("observer duplicate selector 3 events remove third", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);
	const three = selector(1);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(1, two.get()));
	const watcher = three.watch(delta => events.push(1, three.get()));

	watcher();

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, true, 1, false, 1, false]);
});

test("observer duplicate selector events multiple listeners", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	one.watch(delta => events.push(1, one.get()));

	selected.set(1);
	selected.set(null);

	assert.deepStrictEqual(events, [1, true, 1, true, 1, false, 1, false]);
});

test("observer selector cleanup", () => {
	let registers = 0;
	let removes = 0;
	const selected = Observer(() => null, null, l => {
		registers++;
		return () => removes++;
	});
	const selector = selected.selector();

	const one = selector(1).watch(() => {});
	const two = selector(2).watch(() => {});

	one();
	two();

	assert.strictEqual(registers, 1);
	assert.strictEqual(removes, 1);
});

test("observer selector cleanup multiple listeners", () => {
	let registers = 0;
	let removes = 0;
	const selected = Observer(() => null, null, l => {
		registers++;
		return () => removes++;
	});
	const selector = selected.selector();

	const sel = selector(1);
	const one = sel.watch(() => {});
	const two = sel.watch(() => {});

	one();
	two();

	assert.strictEqual(registers, 1);
	assert.strictEqual(removes, 1);
});

test("observer selector initial selector", () => {
	const selected = Observer.mutable(1);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	assert.strictEqual(one.get(), true);
	assert.strictEqual(two.get(), false);
	selected.set(null);
	assert.strictEqual(one.get(), false);
	assert.strictEqual(two.get(), false);
});

test("observer selector initial selector events", () => {
	const selected = Observer.mutable(1);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	const events = [];
	one.watch(delta => events.push(1, one.get()));
	two.watch(delta => events.push(2, two.get()));

	selected.set(2);
	assert.deepStrictEqual(events, [1, false, 2, true]);
});

test("observer effect", () => {
	const selected = Observer.mutable(1);

	const vals = [];
	const effect = selected.effect(val => {
		vals.push(val);
	});

	selected.set(2);
	selected.set(3);

	effect();

	assert.deepStrictEqual(vals, [1, 2, 3]);
});

test("observer effect cleanup", () => {
	const selected = Observer.mutable(1);

	const vals = [];
	const effect = selected.effect(val => {
		vals.push(val);

		return () => {
			let i = vals.indexOf(val);
			vals.splice(i, 1);
		};
	});

	selected.set(2);
	selected.set(3);

	effect();

	assert.deepStrictEqual(vals, []);
});

test("observer effect self modify", () => {
	const selected = Observer.mutable(false);

	selected.effect(val => {
		if (!val) selected.set(true);
	});

	selected.set(false);
});

test("observer effect cleanup once", () => {
	const selected = Observer.mutable(1);

	const vals = [];
	const effect = selected.effect(val => {
		vals.push(val);

		return () => {
			let i = vals.indexOf(val);
			vals.splice(i, 1);
		};
	});

	effect();

	assert.deepStrictEqual(vals, []);
});

test("observer empty path", () => {
	const obs = Observer.mutable();

	assert.deepStrictEqual(obs, obs.path([]));
});

test("Observer lifetimes null remove", () => {
	let obs = Observer.mutable();

	let count = 0;
	obs = obs.lifetime(() => {
		count++;
	});

	obs.watch(() => {});
	obs.watch(() => {});

	assert.strictEqual(count, 1);
});

test("Observer lifetimes", () => {
	let obs = Observer.mutable();

	let count = 0;
	obs = obs.lifetime(() => {
		count++;

		return () => {
			count--;
		};
	});

	let one = obs.watch(() => {});
	let two = obs.watch(() => {});

	one();
	two();

	assert.strictEqual(count, 0);
});

test("Observer lifetimes double free", () => {
	let obs = Observer.mutable();

	let count = 0;
	obs = obs.lifetime(() => {
		count++;

		return () => {
			count--;
		};
	});

	let one = obs.watch(() => {});
	let two = obs.watch(() => {});

	one();
	two();
	one();
	two();

	assert.strictEqual(count, 0);
});

test("Observer lifetimes multiple null remove", () => {
	let obs = Observer.mutable();

	let count = 0;
	obs = obs.lifetime(() => {
		count++;
	});

	let one = obs.watch(() => {});
	one();

	let two = obs.watch(() => {});
	two();

	assert.strictEqual(count, 2);
});

test("Observer lifetimes multiple", () => {
	let obs = Observer.mutable();

	let count = 0;
	let removeCount = 0;
	obs = obs.lifetime(() => {
		count++;

		return () => {
			removeCount++;
		};
	});

	let one = obs.watch(() => {});
	one();

	let two = obs.watch(() => {});
	two();

	assert.strictEqual(count, 2);
	assert.strictEqual(removeCount, 2);
});

test("observer lifetimes reentrant", () => {
	let obs = Observer.mutable(0);
	let mirror = Observer.mutable();

	let removed;
	obs = obs.lifetime(() => () => removed = true);

	obs = obs.lifetime(() => {
		return obs.effect(val => mirror.set(val));
	});

	const states = [];
	const remove = obs.effect(val => (states.push(val), null));

	obs.set(1);
	obs.set(2);
	obs.set(3);

	remove();

	assert.deepStrictEqual(states, [0, 1, 2, 3]);
	assert.strictEqual(removed, true);
});

test("observer NULL", () => {
	const nil = Observer.NULL;
	assert.strictEqual(nil.get(), undefined);
});

test("observer NULL register listener", () => {
	const nil = Observer.NULL;
	const listener = nil.watch(() => {});
	listener();
});

test("immutability after shallow", () => {
	const obj = Observer.immutable().shallow();
	assert.strictEqual(obj.isImmutable(), true);
});

test("map set to undefined", () => {
	const obs = Observer.mutable(1)

	let vals = [];
	const map = obs.map(a => a);
	map.watch(() => {
		vals.push(map.get());
	});

	obs.set(undefined);

	assert.deepStrictEqual(vals, [undefined]);
});

test("map no cache", () => {
	const obs = Observer.mutable(1)

	const map = obs.map(a => a);
	assert.strictEqual(map.get(), 1);
});

test("mutable recursion", () => {
	const obs = Observer.mutable(0);

	obs.effect(num => {
		if (num >= 10) return;
		obs.set(num + 1);
	});

	assert.strictEqual(obs.get(), 10);
});

test("unwrap mutable recursion", () => {
	const obs = Observer.mutable(Observer.mutable(0)).unwrap();

	obs.effect(num => {
		if (num >= 10) return;
		obs.set(num + 1);
	});

	assert.strictEqual(obs.get(), 10);
});

test("bool coerse", () => {
	const val = Observer.mutable(0);

	const stuff = [];
	val.bool().effect(val => {
		stuff.push(val);
	});

	val.set(1);
	val.set(2);
	val.set(0);

	assert.deepStrictEqual(stuff, [false, true, false]);
});

test("bool values", () => {
	const val = Observer.mutable(0);

	const stuff = [];
	val.bool('yes', 'no').effect(val => {
		stuff.push(val);
	});

	val.set(1);
	val.set(2);
	val.set(0);

	assert.deepStrictEqual(stuff, ['no', 'yes', 'no']);
});

test("get after map remove", () => {
	const val = Observer.mutable(0);
	const map = val.map(x => x);


	const listener = map.effect(() => {});
	listener();

	assert.strictEqual(map.get(), 0);
	val.set(2);
	assert.strictEqual(map.get(), 2);
	val.set(3);
	assert.strictEqual(map.get(), 3);
});

test("recursive get in map", () => {
	const val = Observer.mutable(0);

	const map = val.map(val => {
		if (val === 0) return map.get();
		return val;
	});

	const vals = [];
	const listener = map.effect(val => {vals.push(val)});

	val.set(1);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.deepStrictEqual(vals, [undefined, 1, 2, 5]);
});

test("recursive get in map call freq", () => {
	const val = Observer.mutable(0);

	let freq = 0;
	const map = val.map(val => {
		freq++;
		if (val === 0) return map.get();
		return val;
	});

	const vals = [];
	const listener = map.effect(val => {vals.push(val)});

	val.set(1);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.strictEqual(freq, 5);
});

test("recursive get in map call freq 2", () => {
	const val = Observer.mutable(0);

	let freq = 0;
	const map = val.map(val => {
		freq++;
		if (val === 0) return map.get();
		return val;
	});

	const vals = [];
	const listener = map.watch(() => {vals.push(map.get())});

	val.set(1);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.strictEqual(freq, 4);
});

test("recursive get in map call freq 3", () => {
	const val = Observer.mutable(1);

	let freq = 0;
	const map = val.map(val => {
		freq++;
		if (val === 0) return map.get();
		return val;
	});

	const vals = [];
	const listener = map.watch(() => {vals.push(map.get())});

	val.set(0);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.strictEqual(freq, 4);
});

test("recursive get in map and unwrap", () => {
	const val = Observer.mutable(0);

	const map = val.map(val => {
		const prev = map.get();
		if (prev) {
			if (val !== 0) prev.set(val);
			return prev;
		} else {
			return Observer.mutable(val);
		}
	});

	const vals = [];
	const listener = map.unwrap().effect(val => {vals.push(val)});

	val.set(1);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.deepStrictEqual(vals, [0, 1, 2, 5]);
});

test("recursive get in map and unwrap 2", () => {
	const val = Observer.mutable(0);

	const map = val.map(val => {
		const prev = map.get();
		if (prev) {
			if (val !== 0) prev.set(val);
			return prev;
		} else {
			return Observer.mutable(val);
		}
	});

	const vals = [];
	const unwrap = map.unwrap();
	const listener = unwrap.watch(val => {vals.push(unwrap.get())});

	val.set(1);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.deepStrictEqual(vals, [1, 2, 5]);
});

test("recursive get in map and unwrap 3", () => {
	const val = Observer.mutable(1);

	const map = val.map(val => {
		const prev = map.get();
		if (prev) {
			if (val !== 0) prev.set(val);
			return prev;
		} else {
			return Observer.mutable(val);
		}
	});

	const vals = [];
	const unwrap = map.unwrap();
	const listener = unwrap.watch(val => {vals.push(unwrap.get())});

	val.set(0);
	val.set(2);
	val.set(0);
	val.set(5);

	assert.deepStrictEqual(vals, [2, 5]);
});

test("throwing map get twice", () => {
	const val = Observer.mutable(1).map(x => {
		throw new Error("Oh no");
	});

	assert.throws(() => val.get());
	assert.throws(() => val.get());
});

test("throwing map get twice with watch", () => {
	const val = Observer.mutable(1).map(x => {
		throw new Error("Oh no");
	});

	val.watch(() => {});

	assert.throws(() => val.get());
	assert.throws(() => val.get());
});

test("throwing map set twice", () => {
	const base = Observer.mutable(1);
	const val = base.map(x => {
		throw new Error("Oh no");
	});

	val.watch(() => {});

	assert.throws(() => base.set(2));
	assert.throws(() => base.set(3));
});

test("throwing map set then get", () => {
	const base = Observer.mutable(1);
	const val = base.map(x => {
		throw new Error("Oh no");
	});

	val.watch(() => {});

	assert.throws(() => base.set(2));
	assert.throws(() => val.get());
});
