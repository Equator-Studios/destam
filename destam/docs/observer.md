# Observer

## Basic usage

An observer is a wrapper around mutating state. Think of it as a box: state goes in, you can read it out with `.get()`, change it with `.set()`, and subscribe to changes with `.watch()`.

```js
const observer = Observer.mutable("my state");

console.log(observer.get()); // "my state"
```

`Observer.mutable` creates a box whose value can change later. `Observer.immutable` also exists for the read-only case.

```js
observer.set("my new state");

console.log(observer.get()); // "my new state"
```

To react to changes, attach a watcher:

```js
observer.watch(() => {
    console.log(observer.get());
});

observer.set("my watched state"); // prints "my watched state"
```

`watch()` takes a callback that fires every time the state changes.

## Transforms
Transforms compute new values on the fly from existing observers. The primary tool is `map`, which produces a new observer derived from the input.

```js
const number = Observer.mutable(1);

const doubled = number.map(x => x * 2);
```

`doubled` is an immutable observer that always reflects `number * 2`. It's immutable because `map` doesn't know how to invert the transformation. Provide a second argument to make it mutable:

```js
const doubled = number.map(x => x * 2, x => x / 2);
```

Now `doubled.set(10)` will write back through to `number.set(5)`. The transform observer behaves like any other observer — readable, writable, and watchable.

Sometimes you want to compute a value from multiple observers. Suppose you have two observers and want their sum:

```js
const a = Observer.mutable(1);
const b = Observer.mutable(2);

const sum = Observer.all([a, b]).map(([a, b]) => a + b);
```

`Observer.all` combines observers into one whose value is an array of the inputs. Changes to any of the inputs trigger the combined observer.

## Event filters

So far we've only talked about flat observers — those holding a single value with no nested structure. Observables (OObject, OArray, etc.) produce observers over a state *tree*, and that tree can be deeply nested. By default a watcher on the root sees mutations anywhere in the tree.

Because trees can get large, destam provides governors — chainable filters that narrow which mutations a watcher fires for.

Here's the baseline (no governors) behavior:

```js
const state = OObject({
	nested: OObject(),
});

state.observer.watch(delta => {
	console.log(delta.path);
});

state.foo = 'baz';        // logs ['foo']
state.nested.bar = 'baz'; // logs ['nested', 'bar']
```

The main governors are:

- **`observer.path(key | keys[])`** — whitelist a property path. Only events under that path reach the watcher. Path also works for hidden (underscore-prefixed) properties as long as you name them explicitly.
- **`observer.ignore(key | keys[])`** — blacklist a property path. Opposite of `path`: drops events under that path and lets everything else through.
- **`observer.shallow(level = 0)`** — cap recursion depth. `shallow(0)` excludes all nested mutations; `shallow(1)` includes one level down, etc. Applied directly to a bare observable's `.observer` (no preceding `.path()`/`.skip()`), depth 0 is the observable's own reference — which never changes — so `shallow()` alone on a root never fires. See [observables.md](observables.md#observerprototypeshallow) for why, and how to get past it.

You can chain them:

- `observer.path('hello').path('world')` — equivalent to `observer.path(['hello', 'world'])`.
- `observer.path('hello').ignore('world')` — fires for `object.hello.foo` but not `object.hello.world`, and obviously not for anything outside `hello`.
- `observer.path('hello').shallow()` — fires for `object.hello.foo` but not `object.hello.deeper.foo`.

Multiple watchers can be attached to the same observer. The order in which they fire for a given mutation is undefined. Each watcher is called synchronously at the moment of the mutation, except that a nested mutation triggered from inside a watcher may be processed after the current one finishes.

```jsx
let object = OObject({
    nested: OObject()
});

object.observer.watch(delta => {
    console.log(delta.value);             // 'value' — the new value
    console.log(delta.parent === object.nested); // true — the parent is the observable that emitted
    console.log(delta.parent !== object); // true
});

object.nested.property = 'value';
```

The delta passed to the watcher includes `delta.path` (the path from the root observer to where the mutation happened) and `delta.parent` (the observable that emitted the mutation). Use these when you need to react to general events but still know where they came from:

```jsx
let object = OObject({
    first: OObject(),
    second: OObject()
});

object.observer.watch(event => console.log(event.path));

object.first.property = 'value';  // logs ['first', 'property']
object.second.property = 'value'; // logs ['second', 'property']
object.property = 'value';        // logs ['property']
```

A complete example showing how multiple governors interact:

```jsx
let object = OObject({
    first: OObject(),
    second: OObject()
});

let observer = object.observer;
observer.path('first').watch(event => console.log('A'));
observer.path('second').watch(event => console.log('B'));
observer.path('_hidden').watch(event => console.log('hidden event'));
observer.skip().shallow().watch(event => console.log('C'));

observer.watch(event => console.log('will be called for everything'));

object.first.property = 'value';
// 'A' fires (mutation inside 'first')
// 'will be called for everything' fires
// 'B' and 'C' do not fire

object.second.property = 'value';
// 'B' fires
// 'will be called for everything' fires

object.property = 'value';
// 'C' fires — .skip() advances past `object`'s own (immutable) reference,
// then .shallow() matches only object's direct properties, not anything nested.
// A bare `observer.shallow()` here (no .skip()) would never fire — see
// observables.md for why.
// 'will be called for everything' fires

object._hidden = 'this is hidden';
// 'hidden event' fires — explicitly subscribed via .path('_hidden')
// 'C' does NOT fire — .skip() is a wildcard mechanism and honors the same
// default governor, so underscore-prefixed properties are excluded from it too
// 'will be called for everything' does NOT fire —
// wildcard watchers ignore underscore-prefixed properties by default
```
