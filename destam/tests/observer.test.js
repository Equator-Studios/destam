import {expect} from 'chai';
import test from 'node:test';
import Observer from '../Observer.js';
import OObject from '../Object.js';
import OArray from '../Array.js';

test("Observer.mutable getter", () => {
	const value = Observer.mutable('hello');

	expect(value.get()).to.equal('hello');
});

test("Observer.mutable getter and setter", () => {
	const value = Observer.mutable('hello');
	value.set('world');

	expect(value.get()).to.equal('world');
});

test("Observer.mutable events", () => {
	const value = Observer.mutable('hello');

	const events = [];
	value.watch(event => {
		events.push(event.value);
	});

	value.set('previous');
	value.set('world');

	expect(value.get()).to.equal('world');
	expect(events).to.deep.equal(['previous', 'world']);
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

	expect(events).to.deep.equal([0, 1, 0, 1]);
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

	expect(events).to.deep.equal([0, 1, 2]);
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

	expect(events).to.deep.equal([0, 1]);
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

	expect(events).to.deep.equal([0, 1, 0, 1]);
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

	expect(() => value.set(0)).to.throw();
	expect(events).to.deep.equal([0, 1]);
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

	expect(() => value.set(0)).to.throw();
	expect(events).to.deep.equal([0, 1]);
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

	expect(events).to.deep.equal([0, 1, 0, 1]);
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

	expect(events).to.deep.equal([0, 1, 0, 1]);
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

	expect(() => value.set(0)).to.throw();
	expect(events).to.deep.equal([0, 1]);
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

	expect(() => value.set(0)).to.throw();
	expect(events).to.deep.equal([0, 1]);
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

	expect(states).to.deep.equal(['default', '1', '2', 'default', '3']);
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

	expect(states).to.deep.equal(['default', '1', '2', 'second', 'third']);
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

	expect(states).to.deep.equal(['default', 'other default', '1', '2', 'other default', '3']);
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
	expect(observer.get()).to.deep.equal(["hello", "world"]);
	expect(() => observer.set([1, 2, 3])).to.throw();

	watcher();

	expect(values).to.deep.equal([[0, 0], [10, 0], [10, 100], [100, 100], ["hello", 100], ["hello", "world"]]);
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

	expect(values).to.deep.equal([10, 110, 200]);
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

	expect(vals).to.deep.equal([[false, false], [true, false], [true, true], [false, true], []]);
});

test("observer.all set", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const all = Observer.all([one, two]);

	all.set([1, 2]);

	expect(one.get()).to.equal(1);
	expect(two.get()).to.equal(2);
});

test("observer.all set invalid array", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const all = Observer.all([one, two]);

	expect(() => {
		all.set([1]);
	}).to.throw();
});

test("observer.all set variable array", () => {
	const one = Observer.mutable(0);
	const two = Observer.mutable(0);
	const three = Observer.mutable(0);

	const arr = Observer.mutable([one, two])
	const all = Observer.all(arr);

	arr.set([one, two, three]);

	all.set([1, 2, 3]);

	expect(one.get()).to.equal(1);
	expect(two.get()).to.equal(2);
	expect(three.get()).to.equal(3);
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

	expect(stuff).to.deep.equal([
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

	expect(() => {
		all.set([1, 2]);
	}).to.throw();
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

	expect(vals).to.deep.equal(["dude", "hello"]);
	expect(vals2).to.deep.equal([]);
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

	expect(vals).to.deep.equal(["one-dude", "two-dude", "three-dude"]);
});

test("observer immutable", () => {
	const obs = Observer.immutable('hello');

	expect(obs.isImmutable()).to.equal(true);

	expect(obs.get()).to.equal("hello");
	expect(() => obs.set("new value")).to.throw();
});

test("observer immutable assign and remove listener", () => {
	const obs = Observer.immutable('hello');

	const listener = obs.watch(() => {});
	listener();
});

test("observer immutable of other observer", () => {
	const obs = Observer.mutable("hello");
	const imm = Observer.immutable(obs);

	expect(imm.isImmutable()).to.equal(true);

	expect(imm.get()).to.equal("hello");
	expect(() => imm.set("new value")).to.throw();

	const vals = [];
	imm.watch(delta => {
		vals.push(delta.value);
	});

	obs.set("value");
	expect(imm.get()).to.equal("value");
	expect(vals).to.deep.equal(["value"]);
});

test("observer setter", () => {
	const obs = Observer.mutable('hello').setter((val, set) => val !== 'ignore' && set(val));

	expect(obs.get()).to.equal("hello");
	obs.set("ignore");
	expect(obs.get()).to.equal("hello");
	obs.set("other");
	expect(obs.get()).to.equal("other");
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

			expect(cb).to.equal(callback);
		},
	}, "event", options);


	const vals = [];
	const watcher = obs.watch(val => {
		vals.push(val.value);
	});

	callback('hello');
	callback('world');

	watcher();

	expect(obs.get()).to.equal('world');
	expect(events).to.have.ordered.members(["event", options, "event", options]);
	expect(vals).to.have.ordered.members(["hello", "world"]);
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

	expect(vals).to.deep.equal(["val", "val 2", "val 3", "val 4"]);
});

test("observer unwrap", () => {
	let obs = Observer.mutable("hello").unwrap();

	expect(obs.get()).to.equal("hello");
	obs.set("other val");
	expect(obs.get()).to.equal("other val");
	let second = Observer.mutable("second");
	obs.set(second);
	expect(obs.get()).to.equal("second");
	second.set("mutated second");
	expect(obs.get()).to.equal("mutated second");
	obs.set("from obs");
	expect(second.get()).to.equal("from obs");
	expect(obs.get()).to.equal("from obs");
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
	expect(second.get()).to.equal("after");
	expect(vals).to.deep.equal(["second", "hello", third, "reset"]);
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

	expect(obs.isImmutable()).to.equal(true);

	expect(obs.get()).to.equal(2);
	orig.set(4);
	expect(obs.get()).to.equal(8);
	expect(() => obs.set(8)).to.throw();
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

	expect(calls).to.equal(2);
	expect(val).to.equal(4);
});

test("observer double map", () => {
	let orig = Observer.mutable(false);
	let obs = orig.map(x => !x).map(x => !x);

	expect(obs.isImmutable()).to.equal(true);

	const vals = [];
	obs.watch(state => {
		vals.push(obs.get());
	});

	orig.set(true);
	orig.set(false);

	expect(vals).to.deep.equal([true, false]);
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

	expect(vals).to.deep.equal([1, 2]);
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

	expect(vals).to.deep.equal([0, 2, 4, 8, 4, 2]);
	expect(vals2).to.deep.equal([0, 2, 4, 8, 4, 2]);
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

	expect(vals).to.deep.equal(["hello", "world", "hello 2", "hello 3"]);
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

	expect(vals).to.deep.equal(["hello", "world", "hello 2", "world 2", "hello 3", "world 3", "hello 4"]);
});

test("observer anyPath", () => {
	let tree = OObject();

	let obs = tree.observer.anyPath('one', 'two', 'three');

	const vals = [];
	const watcher = obs.watch(delta => {
		vals.push(delta.value);
	});

	tree.one = "one";
	tree.two = "two";
	tree.five = "five";
	tree.three = "three";
	tree.four = "four";

	watcher();

	expect(vals).to.deep.equal(["one", "two", "three"]);

	expect(obs.get()).to.deep.equal(["one", "two", "three"]);
	obs.set(["one m", "two m", "three m"]);
	expect(obs.get()).to.deep.equal(["one m", "two m", "three m"]);
	expect(() => tree.observer.anyPath([])).to.throw();
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

	expect(vals).to.deep.equal([1, 3, 6]);
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

	expect(vals).to.deep.equal([1, 2]);
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

	expect(vals).to.deep.equal([4, 6, 7]);
});

test("observer wait immediate remove", async () => {
	let obs = Observer.mutable(0);

	const watcher = obs.wait(5).watch(() => {});
	watcher();
});

test("observer timer", async () => {
	const timer = Observer.timer(10);
	expect(timer.get()).to.equal(0);

	const vals = [];
	const watcher = timer.watch(delta => {
		vals.push(delta.value);
	});

	await new Promise(ok => setTimeout(ok, 25));
	watcher();

	expect(vals).to.deep.equal([1, 2]);
	expect(timer.get()).to.equal(2);
});

test("observer watch non function", () => {
	const obs = Observer.mutable();

	expect(() => obs.watch(1)).to.throw();
	expect(() => obs.watchCommit(1)).to.throw();
});

test("observer timer in map and unwrap", async () => {
	const activated = Observer.mutable(false);
	const obs = activated.map(a => a ? Observer.timer(10) : 'not-activated').unwrap();

	const states = [];
	let remove = obs.effect(val => (states.push(val), null));

	activated.set(true);
	await new Promise(ok => setTimeout(ok, 25));
	remove();

	expect(states).to.deep.equal(['not-activated', 0, 1, 2]);
});

test("observer selector", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
	selected.set(1);
	expect(one.get()).to.equal(true);
	expect(two.get()).to.equal(false);
	selected.set(2);
	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(true);
	selected.set(null);
	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
});

test("observer selector set selected", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
	one.set(1);
	expect(one.get()).to.equal(true);
	expect(two.get()).to.equal(false);
	two.set(2);
	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(true);
});

test("observer selector custom values", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector('yes', 'no');

	const one = selector(1);
	const two = selector(2);

	expect(one.get()).to.equal('no');
	expect(two.get()).to.equal('no');
	selected.set(1);
	expect(one.get()).to.equal('yes');
	expect(two.get()).to.equal('no');
	selected.set(2);
	expect(one.get()).to.equal('no');
	expect(two.get()).to.equal('yes');
	selected.set(null);
	expect(one.get()).to.equal('no');
	expect(two.get()).to.equal('no');
});

test("observer duplicate selector", () => {
	const selected = Observer.mutable(null);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(1);

	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
	selected.set(1);
	expect(one.get()).to.equal(true);
	expect(two.get()).to.equal(true);
	selected.set(null);
	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
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

	expect(events).to.deep.equal([1, true, 1, false, 2, true, 2, false]);
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

	expect(events).to.deep.equal([1, true, 1, true, 1, false, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, true, 1, false, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, true, 1, false, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, true, 1, false, 1, false]);
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

	expect(events).to.deep.equal([1, true, 1, true, 1, false, 1, false]);
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

	expect(registers).to.equal(1);
	expect(removes).to.equal(1);
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

	expect(registers).to.equal(1);
	expect(removes).to.equal(1);
});

test("observer selector initial selector", () => {
	const selected = Observer.mutable(1);
	const selector = selected.selector();

	const one = selector(1);
	const two = selector(2);

	expect(one.get()).to.equal(true);
	expect(two.get()).to.equal(false);
	selected.set(null);
	expect(one.get()).to.equal(false);
	expect(two.get()).to.equal(false);
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
	expect(events).to.deep.equal([1, false, 2, true]);
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

	expect(vals).to.deep.equal([1, 2, 3]);
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

	expect(vals).to.deep.equal([]);
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

	expect(vals).to.deep.equal([]);
});

test("observer empty path", () => {
	const obs = Observer.mutable();

	expect(obs).to.deep.equal(obs.path([]));
});

test("Observer lifetimes null remove", () => {
	let obs = Observer.mutable();

	let count = 0;
	obs = obs.lifetime(() => {
		count++;
	});

	obs.watch(() => {});
	obs.watch(() => {});

	expect(count).to.equal(1);
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

	expect(count).to.equal(0);
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

	expect(count).to.equal(2);
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

	expect(count).to.equal(2);
	expect(removeCount).to.equal(2);
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

	expect(states).to.deep.equal([0, 1, 2, 3]);
	expect(removed).to.equal(true);
});

test("observer NULL", () => {
	const nil = Observer.NULL;
	expect(nil.get()).to.equal(null);
});

test("observer NULL register listener", () => {
	const nil = Observer.NULL;
	const listener = nil.watch(() => {});
	listener();
});
