# Destam Governors
Governors are a declarative, composable feature in destam to allow you to narrow down your listeners to properties that actually matter. Using governors effectively will be the difference between a high performance application and not.

## Modeling your program state
To understand how to construct governors, you first need a robust mental model of your program state. Governors compose in a way that almost acts like a schema for your data. Instead of the schema being there to make sure your data types are correct and formatted correctly, this "schema" is used to select which parts of the state tree should be listened on.

For the sake of brevity and clarity, I'm going to drop the OArray and OObject wrappers. Keep in mind that you need to construct a [state tree](state-tree.md) in order to create functioning governors.

```js
const state = {
	array: [
		{
			name: 'item1',
		},
		{
			name: 'item2',
		},
		{
			name: 'item3',
		}
	],
	property: 'property',
	nestedProperties: {
		prop1: 1,
		prop2: 2,
	}
};

const observer = state.observer;
```

## `.path()` and `.ignore()` observers.
Let's introduce our first two observers. These observers are interesting and
importantly easy to understand because they operate directly on object properties.

### Observer.prototype.path
`path()` is the most simple of the governors. It's basically a whitelist for which properties you want to look at. Suppose we just want to look at `property`
```js
observer.path('property')
```
This will create an observer that will only react to changes made to the `property` property. Note that `path()` will still exhibit recursive behavior.
```js
// this observer will still fire for changes made to state.nestedProperties.prop1, etc...
observer.path('nestedProperties');
```

### Observer.prototype.ignore
`ignore()` is the opposite of `path()`. It will take a property value just like `path()` except it's like a blacklist. It listen to all other properties but the one specified.
```js
// will react to all changes throughout the tree except for the `property` property and all its descendants.
observer.ignore(`property`)
```

## Governor Chaining
Armed with the knowledge of your first two governors, let's try to compose them to create more interesting queries.
```js
observer.path('nestedProperties').ignore(`prop1`)
```
### Understanding the governor pointer
In order to understand this basic example, you have to understand what each of the
governors are trying to target. If you take something like `path()`, the
property of the path is dependent on what object it targets. Each governor as a
result will target something. The cool thing about this is that a governor may
have multiple targets. This is called a [broken chain](#broken-chains) and has
is own ramifications.

For the case of `path()` path will advance the governor pointer. In this example:
```js
observer.path(`nestedProperties`);
```
The observer that results from this governor will target the object that
`nestedProperties` is set to. We can confirm this by getting the value of the
observer.
```js
observer.path(`nestedProperties`).get() === state.nestedProperties;
```
On the contrary, `ignore()` will not advance the governor pointer.
```js
observer.ignore(`property`).get() === state;
```
Here, the observer is still referencing the base `state` object, but the ignore
is essentially acting as a filter for events. This can be useful to masking
non-important information.

A common example of why you would want to ignore a value is for distributed user
states in collaborative platforms. The user may send events to the server, but
the server doesn't want to reflect those events back to the user.

Let's consider the initial example:
```js
observer.path('nestedProperties').ignore(`prop1`);
```
Understanding that the first of the composed governors will advance the governor
pointer to start referencing the `nestedProperties` object instead of the base
object. Since `ignore()` does not advance the pointer, it will still target
`nestedProperties` with `.get()` but will now ignore any changes to `prop1` to
any listeners attached to this observer.

## `.skip()` and `.shallow()`
Similar to `.skip()`/`.ignore()` these governors are like ying and yang.

### `.shallow()`
`.ignore()` is very simple, it will simply put a depth cap on how far down you want
to search. It will not advance the observer pointer at all. It's basically acting
as a filter much like `.ignore()`. Here's an interesting equality to consider:
```js
observer.path('property').shallow();

// will be functionally equivalent to

observer.shallow(1).path('property');
```
Note that `.shallow()` takes a depth as its parameter. With the first example,
we call `.path()` and advance the pointer into the `property`, and then .shallow()
says: "I don't care about anything else, I just want this property". In the second
equivalent example, we first call `.shallow(1)`. This will make an observer
that will respond to any property changes of the `state` for any property. However,
we then call `.path()` later to single out the property we care about. The important
thing here to conceptualize is that we have to create a deeper `.shallow()` call with the second example is that we are calling that before `.path()` which advances the pointer.

Note that since `.shallow()` does not advance the pointer, .get() will work and will
just target the base object.
```js
observer.shallow().get() === state;
```

## Default governor
Watching destam state trees through the standard .watch()/.watchCommit()/.effect()
will by default use a governor that will ignore any string query member that starts
with an underscore. This is used to target OObject underscore variables. Underscore
variables are meant to act as "private" variables that shouldn't call public listeners
(wildcard listeners that just want to capture everything). However, when explicitly
listened on (using the .path() governor), you can still observe these variables.
```js
const obj = OObject();

obj.observer.watch(console.log); // public variable
obj.observer.path('_privateVariable').watch(console.log); // my single private variable

// the console log for the public listener will invoke with an event for publicVirable.
obj.publicVariable = 1;

// the console log listening to the specific private variable will get invoked.
obj._privateVariable = 1;

// will trigger none of the listeners
obj._myOtherPrivate = 1;

```

### `.skip()`
`.skip()` is basically a fancy way to force advancing the governor pointer. Like
with `.path()` instead of singling out a property, we basically don't care about
any individual item. They are meant to be wildcard governors meant to capture
everything* up to a certain depth.

\*: Since this is a wildcard governor, the same rules for the
[default gorvernor](#default-governor) apply. Underscore properties will be
ignored.

Consider an array we have in the
above example state. What happens if we want to target the `name` of each element?
Let's start with what we know:
```js
observer.path('array').path(positionIndex(state.array, 0)).path('name')
```
Note the call to `positionIndex` exported by `destam/Array`. We have this because
array indexes shift. `positionIndex` will take the index at this instant in time,
and turn it into a stable reference even if the array shifts around.

With this observer, we will get `name` updates, but only for the first element.
Let's instead use `.skip()` to instead target all elements:
```js
observer.path('array').skip().path('name')
```
Now we will get any update to any of the names in the array. But what happens to
.get()?

## `Observer.prototype.memo`

`.memo()` is primarily an optimization. It caches the parent's value so that
work done upstream is shared between all watchers attached downstream.

Consider a chain that does meaningful work in a `.map()`:

```js
const total = state.observer.path('items').map(items =>
	items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

total.watch(...);
total.watch(...);
```

Without `.memo()`, the `.map()` callback runs once per watcher per change — twice
in this example. Adding `.memo()` caches the current value while at least one
watcher is attached, so the chain above runs once and the cached value is reused:

```js
const sharedTotal = total.memo();

sharedTotal.watch(...);
sharedTotal.watch(...);
// the reduce runs once per change, not twice
```

### Consequences of a shared upstream subscription

The way `.memo()` achieves this is by maintaining a single subscription up the
chain no matter how many watchers attach below. Usually this is invisible — the
chain runs once instead of N times and that's it. But when the upstream chain
has *per-subscription side effects*, `.memo()` ends up changing observable
behavior as a natural consequence of that single shared subscription. Two cases
worth knowing about:

**`Observer.timer(ms)`** creates a new `setInterval` per subscriber. Without
`.memo()`, N watchers on a timer means N independent intervals that may drift
relative to each other. With `.memo()`, all watchers share one interval and
fire in sync:

```js
const t = Observer.timer(1000).memo();
t.watch(...);
t.watch(...);  // both receive ticks from the same interval
```

**Nested observables.** If the value cached by `.memo()` is itself an
observable, watchers attached after `.memo()` will follow that observable for
nested mutations. This makes `.memo()` useful for "current selection" style
patterns where the value pointed to is a whole observable subtree:

```js
const current = Observer.mutable(OObject({name: 'foo'}));

current.memo().watch(delta => {
	// fires when `current` is reassigned AND when the inner object mutates
});
```

### `.memo(count)`

Calling `.memo()` with a positive integer returns an array of that many memoized
observers all sharing one upstream subscription. Useful when you need to hand
out distinct lifetimes (e.g. one per consumer) but want to pay for the upstream
chain once.

```js
const [a, b, c] = observer.path('expensive').memo(3);
// three distinct downstream lifetimes, one shared upstream subscription
```

### When to reach for it

`.memo()` is an optimization, not a correctness primitive. Adding it never
changes behavior — only performance characteristics. It pays off when:
1. The chain above does meaningful work per evaluation (a non-trivial `.map()`).
2. There are multiple watchers attached below that would otherwise repeat that work.

If only one watcher is ever attached, `.memo()` adds overhead for nothing.

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
`.tree()` is one of those observers that might seem out of place, but can really demonstrate the power of governors in destam. `.tree()` is meant to track data in a tree based structure.

Let's change our state up a little bit. Let's flesh out the `array` in our state
so that it actually has some interesting nesting going on:
```js
state.array = [
	{
		name: 'item1',
	},
	{
		name: 'item2',
		children: [
			{ name: 'item2-child1' }
			{
				name: 'item2-child2',
				children: [
					{ name: 'item2-child2-child1' }
					{ name: 'item2-child2-child2' }
					{ name: 'item2-child2-child3' }
				]
			}
		]
	},
	{
		name: 'item3',
		children: [
			{ name: 'item3-child1' }
			{ name: 'item3-child2' }
			{ name: 'item3-child3' }
		]
	}
];
```
Suppose we want to react to changes made to any of the names in the tree, not just
one level of it. `.tree()` helps us do that.
```js
observer.path('array').tree('children').path('name')
```
`.tree()` takes a parameter of the property that it can look more deeply into. This is typically `children` going by programming conventions.

Note how `tree()` will now have multiple targets all referring to these
`{children: [], name: String }` nodes. That means `.get()` will return `undefined`
(see [Multi-target observers](#multi-target-observers)) but `.path()` can be
composed on top of that to instead target the `name` of each node instead of the
nodes themselves.
