# Destam Governors

Governors are a declarative, composable mechanism for narrowing listeners down to the properties that actually matter. Using them effectively is the difference between a high-performance application and one that re-renders everything on every mutation.

## Modeling your program state

To use governors well, you need a clear mental model of your state tree. Governors compose in a way that almost acts like a schema — not for validating types, but for selecting which parts of the tree a listener cares about.

For brevity, the examples below show the conceptual state with plain object/array literals. In real code you'd construct the tree with `OObject` and `OArray` so it's a proper [state tree](state-tree.md) with a working `.observer`.

```js
const state = OObject({
	array: OArray([
		OObject({ name: 'item1' }),
		OObject({ name: 'item2' }),
		OObject({ name: 'item3' }),
	]),
	property: 'property',
	nestedProperties: OObject({
		prop1: 1,
		prop2: 2,
	}),
});

const observer = state.observer;
```

## `.path()` and `.ignore()`

These are the two simplest governors — both operate directly on property names.

### Observer.prototype.path

`path()` is a whitelist: it narrows the observer to a specific property. To target just `property`:

```js
observer.path('property');
```

The resulting observer only reacts to changes under `property`. Note that `path()` is recursive — it includes descendants of the target:

```js
// this observer fires for changes to state.nestedProperties.prop1, .prop2, etc.
observer.path('nestedProperties');
```

### Observer.prototype.ignore

`ignore()` is the opposite — a blacklist. It listens to everything except the specified property and its descendants.

```js
// reacts to all changes EXCEPT under `property` and its descendants.
observer.ignore('property');
```

## Chaining governors

With those two governors in hand, you can compose more interesting queries:

```js
observer.path('nestedProperties').ignore('prop1');
```

### The governor pointer

To understand chained governors, you need to know what each one is *targeting*. `path('foo')` operates on the value of property `foo` — so the property it operates on is relative to whatever the previous governor was pointing at. Each governor in the chain has a target. Some governors can target multiple things at once — that's called a *multi-target observer* and has its own behavior (see [Multi-target observers](#multi-target-observers)).

`path()` advances the governor pointer. In this example:

```js
observer.path('nestedProperties');
```

The resulting observer targets the object stored at `state.nestedProperties`:

```js
observer.path('nestedProperties').get() === state.nestedProperties;
```

`ignore()` does *not* advance the pointer:

```js
observer.ignore('property').get() === state;
```

The observer still references the base `state` object — `ignore` only acts as a filter for events. This is useful for masking information that should be excluded from a specific listener.

A common use case is collaborative apps where the user sends events to the server, but the server doesn't want to echo them back: `ignore` can scope the broadcast to exclude those specific properties.

Putting it together, the chained example:

```js
observer.path('nestedProperties').ignore('prop1');
```

The `path` advances the pointer to `nestedProperties`. The `ignore` doesn't advance the pointer, so `.get()` still returns `nestedProperties`, but events for `prop1` (a property of `nestedProperties`) are filtered out.

## `.skip()` and `.shallow()`

Like `path`/`ignore`, these two governors complement each other.

### `.shallow()`

`shallow()` puts a depth cap on how far down events propagate. It does not advance the pointer — it's purely a filter. An interesting identity:

```js
observer.path('property').shallow();

// is functionally equivalent to

observer.shallow(1).path('property');
```

`shallow()` takes a depth as a parameter (default 0). In the first example, `path()` advances the pointer into `property`, then `shallow()` says "I only care about direct changes to this property, not its descendants." In the second example, `shallow(1)` says "look one level deep from `state`," and then `path()` narrows that down to `property`. The reason `shallow` needs `+1` in the second version is that `path()` hadn't yet advanced the pointer when `shallow` was applied — so the depth is measured from `state`, not from `state.property`.

Since `shallow()` doesn't advance the pointer, `.get()` still works on the result and returns the base object:

```js
observer.shallow().get() === state;
```

## Default governor

`.watch()`, `.watchCommit()`, and `.effect()` apply a default governor that ignores any property whose name starts with an underscore. This is how destam supports OObject's "private" property convention — underscore-prefixed properties don't fire wildcard listeners, but they can still be explicitly observed via `.path()`.

```js
const obj = OObject();

obj.observer.watch(console.log);                              // wildcard
obj.observer.path('_privateVariable').watch(console.log);     // explicit

obj.publicVariable = 1;       // fires the wildcard listener
obj._privateVariable = 1;     // fires the path-specific listener
obj._myOtherPrivate = 1;      // fires neither
```

### `.skip()`

`skip()` is a wildcard equivalent of `path()` — it advances the governor pointer past one level without singling out a property. The result is an observer targeting "every value at this level."

Like other wildcard mechanisms, `skip()` honors the default governor: underscore-prefixed properties are ignored.

Suppose you want to react to changes in the `name` of every element of `state.array`. Without `skip()`, you'd have to write:

```js
observer.path('array').path(positionIndex(state.array, 0)).path('name')
```

This works, but only targets the first element. `positionIndex` (from `destam/Array`) is needed because array indices shift when items are inserted or removed — `positionIndex` turns the index at the current moment into a stable reference that survives reordering.

Using `skip()` you can target all elements at once:

```js
observer.path('array').skip().path('name');
```

Now the observer fires for the `name` of any array element. The chain has multiple targets — see [Multi-target observers](#multi-target-observers) for what that means for `.get()`.

## `Observer.prototype.memo`

`.memo()` memoizes the value at a point in an observer chain. Watchers attached to the memo register against the *cached value*, not against the chain that produced it. The memo is the boundary between the upstream network and downstream consumers.

The most useful case is the "current selection" pattern — the cached value is itself an observable, and downstream watchers follow it for nested mutations:

```js
const current = Observer.mutable(OObject({name: 'foo'}));

current.memo().watch(delta => {
	// fires when `current` is reassigned (a new observable is held)
	// AND when the currently-held observable mutates internally
});

current.set(OObject({name: 'bar'}));  // watcher fires
current.get().name = 'baz';           // watcher also fires
```

Without `.memo()`, watchers would only see the outer `.set()` — the inner observable's mutations wouldn't propagate through `Observer.mutable`. With memo, the watcher tracks "whichever observable is currently held" and reacts to changes in its contents.

When the cached value is a primitive, downstream watchers fire only when the cached value itself changes (i.e. when the parent emits a new value that isn't equal to the previous one).

### Memo amortizes upstream work

A side effect of registering against the cached value is that all downstream watchers share one upstream subscription. The chain producing the value runs once per emission regardless of how many watchers attach below:

```js
const sum = Observer.all(sources).map(arr => heavy(arr)).memo();

sum.watch(...);
sum.watch(...);
sum.watch(...);
// `heavy` still runs only once per emission of `sources`
```

This makes memo useful for chains that do real per-evaluation work (a `.map()` reduce, an `Observer.all` join) with multiple consumers attached.

### `Observer.timer`

`Observer.timer` creates a new `setInterval` per subscriber. Without `.memo()`, N watchers on a timer get N independent intervals that may drift relative to each other. With `.memo()`, all watchers share one interval and fire in sync:

```js
const t = Observer.timer(1000).memo();
t.watch(...);
t.watch(...);  // both receive ticks from the same interval
```

### `.memo(count)`

Calling `.memo()` with a positive integer returns an array of memoized observers that share one upstream subscription and have a defined event order: listeners on `memos[0]` fire before listeners on `memos[1]`, and so on.

```js
const [a, b, c] = observer.path('expensive').memo(3);
// three distinct downstream lifetimes, one shared upstream subscription,
// deterministic ordering between them
```

## Multi-target observers
What if we are working with an observer that has multiple targets? Which element are we actually referencing? What will it return? Consider our observer again:
```js
observer.path('array').skip().path('name').get()
```
There is no single answer here, so `.get()` simply returns `undefined`. Destam does
not crash and does not require any special "fix-up" governor — the lack of a single
value just propagates through the chain like any other undefined.

Downstream operators behave consistently with this:
- `.path('foo')` on an `undefined` value resolves to `undefined` (just like `({}).foo.bar` would throw — but destam's path traversal stops cleanly).
- `.map(forward)` calls `forward(undefined)`. If your forward function uses the value, handle the `undefined` case. If it closes over the underlying state, you can ignore the argument entirely:

```js
observer.path('array').skip().path('name').map(() => {
	return state.array.map(element => element.name);
}).get() === ['item1', 'item2', 'item3']
```

Here, the `.map()` callback ignores its argument and reads the state directly
through closure. This is the canonical pattern for producing an aggregate value
from a multi-target observer: use the chain for *event filtering* (so that watchers
fire when any matching item changes), and use closure access to the underlying
state for the *value*.

Let's consider a potential gotcha:
```js
observer.path('array').skip().map(() => {
	return state.array;
}).path('name').get() === undefined
```
Here, we try to repair the chain right after `.skip()`. The `.path()` after the
`.map()` ends up calling `.name` on the returned array, which is `undefined`.
`.map()` is transparent to governors — any governor defined after the `.map()`
operates on what the `.map()`'s parent sees, not on the value `.map()` returns.
The `.path('name')` actually filters events for `name` properties on the original
target, not on the array.

## The `.memo()` footgun

`.memo()` is unusual among the operators because it genuinely depends on its
parent having a single value. It caches that value to deduplicate downstream
work, and if the value happens to be an observable, it follows it to deliver
nested events. A multi-target chain doesn't have a single value to cache, so
`.memo()` placed after `.skip()` or `.tree()` cannot do its job.

```js
// BROKEN — .memo() has no single value to anchor on.
const memoed = observer.path('array').skip().path('name').memo();
memoed.path('first').watch(...);
```

**Rules to avoid it:**
- Apply `.memo()` before any `.skip()` / `.tree()` in the chain, not after.
- If you need to memoize a derived value across a multi-target chain, collapse
  the chain into a concrete value with `.map()` first, then memo:

```js
// OK — map collapses the multi-target chain into a single concrete value
observer.path('array').skip().path('name').map(() => state.array.map(e => e.name)).memo()
```

## `.tree()`

`.tree()` is the most powerful governor — it descends through arbitrarily deep, recursively-nested structures. Use it when your data is shaped like a tree (a node with a list of children, where each child has the same shape).

Suppose `state.array` has tree-shaped elements:

```js
state.array = [
	{ name: 'item1' },
	{
		name: 'item2',
		children: [
			{ name: 'item2-child1' },
			{
				name: 'item2-child2',
				children: [
					{ name: 'item2-child2-child1' },
					{ name: 'item2-child2-child2' },
					{ name: 'item2-child2-child3' },
				],
			},
		],
	},
	{
		name: 'item3',
		children: [
			{ name: 'item3-child1' },
			{ name: 'item3-child2' },
			{ name: 'item3-child3' },
		],
	},
];
```

To react to changes to any `name` anywhere in the tree, not just one level:

```js
observer.path('array').tree('children').path('name');
```

`.tree(name)` takes the property name that recursively contains children — typically `children`.

The resulting observer has multiple targets — every `{ children, name }` node anywhere in the tree. That means `.get()` returns `undefined` (see [Multi-target observers](#multi-target-observers)). Composing `.path('name')` on top narrows the events to mutations on the `name` property of any of those nodes.
