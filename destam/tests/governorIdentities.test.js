import OObject from '../Object.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import Observer from '../Observer.js';

const names = ['a', 'b', 'c', 'd'];

const createState = (obj, level) => {
	for (let name of names) {
		if (level === 0) {
			obj[name] = Math.random();
		} else {
			obj[name] = OObject();
			createState(obj[name], level - 1);
		}
	}
};

// Sentinel for "createObs1 should produce no events." Returns an
// event-less observer regardless of the argument passed in, so the harness
// can always call `createObs2(state.observer)` uniformly; the non-empty
// assertion is skipped when this is the comparison observer.
const noEvents = () => Observer.immutable();

const createTest = (createObs1, createObs2) => () => {
	const state = OObject();

	const states1 = [];
	createObs1(state.observer).watch(delta => {
		states1.push(delta.path);
	});

	const states2 = [];
	createObs2(state.observer).watch(delta => {
		states2.push(delta.path);
	});

	createState(state, 4);

	if (createObs2 !== noEvents) {
		assert.ok(states1.length > 0, "expected events — degenerate test if empty");
	}
	assert.deepStrictEqual(states1, states2);
};

test("governor identities skip", createTest(
	o => o.skip().skip().shallow(),
	o => o.skip(2).shallow()
));

test("governor identities skip infinity", createTest(
	o => o.skip(Infinity),
	o => o,
));

test("governor identities shallow infinity", createTest(
	o => o.shallow(Infinity),
	o => o,
));

test("governor identities skip and shallow", createTest(
	o => o.skip().shallow(),
	o => o.shallow(1)
));

// `.shallow()` (default depth 0) anchored at an OObject's root observer
// fires for nothing — the root observer's own value (the observable reference)
// never changes, and `shallow(0)` excludes nested mutations. So any chain
// starting with `obj.observer.shallow()` is equivalent to an immutable
// observer. The variants below exercise different governors composed after
// `shallow()` to confirm none of them can "unstick" the cap.
test("governor identities shallow ≡ immutable", createTest(
	o => o.shallow(),
	noEvents,
));

test("governor identities shallow(0) ≡ immutable", createTest(
	o => o.shallow(0),
	noEvents,
));

test("governor identities shallow then path ≡ immutable", createTest(
	o => o.shallow().path('a'),
	noEvents,
));

test("governor identities shallow then ignore ≡ immutable", createTest(
	o => o.shallow().ignore('a'),
	noEvents,
));

test("governor identities shallow then skip ≡ immutable", createTest(
	o => o.shallow().skip(),
	noEvents,
));

test("governor identities shallow composed ≡ immutable", createTest(
	o => o.shallow().shallow(),
	noEvents,
));

test("governor identities multi path", createTest(
	o => o.path(['a', 'b']),
	o => o.path('a').path('b')
));

test("governor identities shallow and path", createTest(
	o => o.shallow(1).path('a'),
	o => o.path('a').shallow(),
));

test("governor identities ignore order", createTest(
	o => o.ignore('a').ignore('b'),
	o => o.ignore('b').ignore('a'),
));

test("governor identities ignore path", createTest(
	o => o.ignore(['a', 'b']).path('a'),
	o => o.path('a').ignore('b'),
));

test("governor identities shallow and ignore", createTest(
	o => o.skip().shallow().ignore('a'),
	o => o.skip().ignore('a').shallow(),
));

test("governor identities multiple shallow", createTest(
	o => o.skip().shallow().shallow(),
	o => o.skip().shallow(),
));

test("governor identities multiple shallow depth", createTest(
	o => o.skip().shallow(1).shallow(),
	o => o.skip().shallow().shallow(1).shallow(),
));

test("governor identities exclusive path/ignore", createTest(
	o => o.ignore('a').path('a'),
	noEvents,
));

test("governor identities exclusive path/ignore and shallow", createTest(
	o => o.shallow(4).ignore('a').path('a'),
	noEvents,
));

test("governor identities path/ignore inclusive", createTest(
	o => Observer.all([
		o.path('a'),
		o.ignore('a'),
	]),
	o => o,
));

test("governor identities memo", createTest(
	o => o.memo(),
	o => o,
));

test("governor identities memo multiple", createTest(
	o => o.memo().memo(),
	o => o,
));

test("governor identities map and unwrap", createTest(
	o => o.map(a => a.observer).unwrap(),
	o => o,
));

test("governor identities map random", createTest(
	o => o.map(a => Math.random()),
	o => o,
));

// `.memo()` over a mutable holding an observable is the same as explicitly
// extracting the held value's observer and unwrapping. This is the "current
// selection" pattern — both paths produce a watcher that tracks whichever
// observable is currently held and reacts to its internal mutations.
test("governor identities memo on observable-holding mutable", createTest(
	o => Observer.mutable(o.get()).memo(),
	o => Observer.mutable(o.get()).map(obj => obj.observer).unwrap(),
));

// Wrapping an observer in `Observer.immutable` only changes whether `.set()`
// throws — it doesn't intercept the read or event path, so the event stream
// is identical to the wrapped observer.
test("governor identities Observer.immutable wrap ≡ original", createTest(
	o => Observer.immutable(o),
	o => o,
));

// `.path([])` short-circuits in the constructor and returns the parent
// observer unchanged. (Note: `.ignore([])` is NOT symmetric — it asserts
// the path is non-empty.)
test("governor identities empty path ≡ original", createTest(
	o => o.path([]),
	o => o,
));

// `.skip(0)` advances the pointer zero levels and should be a no-op.
test("governor identities skip(0) ≡ original", createTest(
	o => o.skip(0),
	o => o,
));

// Multi-level path can be expressed in any of several equivalent forms.
test("governor identities three-level path ≡ multi-key path", createTest(
	o => o.path('a').path('b').path('c'),
	o => o.path(['a', 'b', 'c']),
));

// `.map(Observer.immutable)` wraps each emitted value in a fresh immutable
// observer; `.unwrap()` undoes the wrap. The event stream is preserved.
test("governor identities map immutable then unwrap ≡ original", createTest(
	o => o.map(Observer.immutable).unwrap(),
	o => o,
));

// `.map(f).map(g)` ≡ `.map(x => g(f(x)))` — function composition. Direct
// test rather than the createTest harness because the harness's state tree
// has non-numeric leaves, which makes it awkward to define meaningful f
// and g. A simple numeric source makes the composition obvious.
test("Observer map composition: .map(f).map(g) ≡ .map(g∘f)", () => {
	const f = x => x + 1;
	const g = x => x * 2;

	const src1 = Observer.mutable(0);
	const events1 = [];
	src1.map(f).map(g).watch(delta => events1.push(delta.value));

	const src2 = Observer.mutable(0);
	const events2 = [];
	src2.map(x => g(f(x))).watch(delta => events2.push(delta.value));

	for (let i = 1; i <= 5; i++) {
		src1.set(i);
		src2.set(i);
	}

	assert.ok(events1.length > 0, "expected events — degenerate test if empty");
	assert.deepStrictEqual(events1, events2);
});
