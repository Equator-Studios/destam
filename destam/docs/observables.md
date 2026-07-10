# Observables

Observables in destam are objects that hold pieces of information you can subscribe to via an observer. The distinction is: an observer *tracks* a piece of state that can change, while an observable *holds* state that can be tracked.

## OObject
An OObject is a proxy that behaves like a regular JavaScript object. You can assign properties with dot or bracket notation, delete them, and check `instanceof` — all the usual things.

```js
const state = OObject({
	value1: 1,
	value2: 2,
});

// assign a value:
state.value1 = 2;
// or use brackets:
state["value1"] = 2;

// create a new property:
state.value3 = 3;

// delete a property:
delete state.value2;

// instanceof:
state instanceof OObject;
```

Because OObjects behave like plain objects, you can drop them into most existing code and algorithms will keep working unchanged.

## OArray
destam also provides an array-like observable.

```js
const array = OArray([]);

array.push(1);
array.push(2);
array.push(3);
array.splice(0, 2);

array[0] === 3;

// looks and behaves like an array
Array.isArray(array);

// instanceof works as expected
array instanceof OArray;
```

Like OObjects, an OArray mimics its plain-JS counterpart closely enough to be used interchangeably in most code.

## Observers from observables
Once you have an observable, you can get an observer from it via the `observer` getter.

```js
const observer = state.observer;
```

This observer represents the entire observable. The getter is idempotent — every call returns the same instance:

```js
state.observer === state.observer;
```

Calling `.get()` on this observer returns the observable itself:

```js
observer.get() === state; // true
```

You can't call `.set()` on an observer derived from an observable — destam can't magically replace the observable reference in your code. These observers are immutable:

```js
observer.set(myNewState); // throws

observer.isImmutable() === true;
```

## Listening for mutations
By default, watching an observable's observer fires for any mutation anywhere within the observable.

```js
observer.watch(delta => {
	if (delta instanceof Insert) console.log('Insert', delta.path);
	if (delta instanceof Modify) console.log('Modify', delta.path);
	if (delta instanceof Delete) console.log('Delete', delta.path);
});

state.myValue = 1;       // Insert ["myValue"]
state.myValue = 2;       // Modify ["myValue"]
delete state.myValue;    // Delete ["myValue"]

// fires for any property
state.myOtherProperty = 1; // Insert ["myOtherProperty"]
```

### Recursive by default
You can build out more complex state by nesting observables inside one another.

```js
state.myNestedObserver = OObject();         // Insert ["myNestedObserver"]
state.myNestedObserver.value = 1;           // Insert ["myNestedObserver", "value"]
```

A listener on `state.observer` sees mutations anywhere in the nested tree. This is the foundation of a [state tree](state-tree.md) — see that doc for more.

## Governors
To narrow down which mutations a listener sees, use a governor. Governors are chainable methods on an observer that filter or scope events.

### observer.prototype.path
`path()` narrows a listener to a specific property. For example, to only react to changes to `myValue`:

```js
observer.path('myValue').watch(delta => {
	console.log("myValue changed to: " + delta.value);
});

state.myValue = 1; // logs "myValue changed to: 1"

// delta.path is still reported as ["myValue"] — path() narrows
// which events you receive, it doesn't rewrite delta.path.
```

Unlike the raw `state.observer`, observers returned from `path()` are mutable — you can `.set()` through them:

```js
observer.path('myValue').set(2);
// equivalent to:
state.myValue = 2;
```

### observer.prototype.shallow
`shallow()` caps how deep listeners look. Sometimes you don't care about an entire subtree — you just want to know when a top-level property changed.

```js
observer.shallow(1).watch(() => {
	// fires when a direct property of state changes, but not for
	// mutations inside any of those properties' subtrees
});
```

The depth argument matters: `shallow(0)` means "only fire for mutations of the observer itself, not any nested properties." Since an observable's root observer is immutable (its *value* never changes — you can't `.set()` a new observable in its place), `shallow(0)` on a root never fires at all:

```js
observer.shallow().watch(() => {
	// never called — the root observer's own value can't change
});
```

This isn't a destam limitation being worked around — it's a hard boundary of the language, not a design choice. There is no way to attach a listener to a plain variable binding:

```js
let state = OObject({ value: 1 });

// there is no version of this that could ever notify a listener —
// reassigning a `let` has no hook in JS, in any framework:
state = OObject({ value: 2 });
```

`observer.shallow()` on a root is asking for exactly that notification. It can't exist for a bare `let`/`const`, so destam is honest about it and fires nothing rather than faking a level of reactivity the language can't actually provide.

If you genuinely need "tell me when the thing I'm looking at gets swapped for a different object," you can't get it from a variable — you have to hold the reference inside something that has its own `.set()` destam can hook, instead of a bare `=`. That's what `Observer.mutable` is for:

```js
const current = Observer.mutable(OObject({ value: 1 }));

current.memo().watch(() => {
	// fires when current.set(...) points at a different object,
	// AND when the currently-held object mutates internally
});

current.set(OObject({ value: 2 }));   // fires — genuine reassignment
current.get().value = 3;              // also fires — memo follows the held observable
```

`.memo()` (see [governors.md](governors.md#observerprototypememo)) is what turns "which object is this" into something with its own hookable identity — the cost is going through `Observer.mutable`'s `.set()` instead of a plain `=`.

### Why this is worth the friction

It's tempting to wish `observer.shallow()` on a root would "just work" for direct properties, folding `.skip()` in automatically. It deliberately doesn't, and the payoff shows up in generic code: a function that accepts "some Observer" and does `observer.skip().shallow().watch(cb)` behaves correctly whether it's handed a plain `oobj.observer` (never fires — the object can never be swapped out, which is the *correct* answer) or an `Observer.mutable(oobj.observer).memo()` (fires on both property mutations and reassignment) — with no special-casing in the consumer either way. Repointability is something the *caller* opts into by choosing what to construct and hand in, not something every downstream consumer has to detect or guard against. A "warn if this never fires" diagnostic would break exactly this pattern, since "never fires" is also the correct, common behavior for a plain non-repointable observer — the two cases are indistinguishable at runtime by design.

To observe structural changes at the top level of an observable (e.g. tracking `arr.length`), see the "Reacting to structural changes" pattern in AGENTS.md.

### observer.prototype.ignore
Where `path()` acts as a whitelist, `ignore()` is a blacklist. It listens to everything *except* the specified property and its descendants.

```js
observer.ignore("myValue").watch(() => {
	// fires for changes to any property other than myValue
});

state.myValue = 1;       // ignored
state.myOtherValue = 1;  // fires
```

Ignoring a property also ignores everything underneath it — listener recursion stops as soon as a parent is being ignored.

### Combining governors
Governors can be chained. For example, fire when `myNestedObserver` itself is reassigned but not for mutations inside it:

```js
observer.path("myNestedObserver").shallow().watch(() => { ... });

state.myNestedObserver = OObject();   // fires
state.myNestedObserver.value = 1;     // does not fire
```

Combining `path()` and `ignore()` requires understanding which advances the governor pointer and which is a pure filter. `path()` advances the pointer (it changes what subsequent governors are scoped to), while `ignore()` is a filter that applies wherever it appears in the chain.

```js
// Filter has no effect — we're already only listening to myNestedObserver:
observer.ignore("myValue").path("myNestedObserver");

// Ignore takes precedence — listener never fires:
observer.ignore("myNestedObserver").path("myNestedObserver");

// Order matters. Path advances into myNestedObserver, then ignore filters
// a property of THAT (a nested myNestedObserver inside the first one):
observer.path("myNestedObserver").ignore("myNestedObserver");

state.myNestedObserver.myNestedObserver = OObject(); // ignored
state.myNestedObserver = OObject();                  // fires
```
