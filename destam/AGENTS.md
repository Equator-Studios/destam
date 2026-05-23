# Destam — Agent Reference

Dense, factual reference for destam, written for coding agents reading the package directly. The longer-form prose docs live in `docs/`; this file is a single-page API reference with semantics, signatures, and gotchas in one place. Read `docs/intro.md` first if you're new to the concepts.

---

## Mental Model

- **Observable** — a container of state (OObject, OArray, OMap) that mutates like ordinary JS but emits deltas. Has a singleton `.observer` getter.
- **Observer** — a wrapper around a value that may change. The unit you `.watch()`, `.get()`, `.set()`, transform, and filter. Multiple observers can derive from the same observable.
- **Delta** — one atomic mutation (Insert / Modify / Delete / Synthetic). Has `.value`, `.prev`, `.path`, `.parent`, `.id`, `.ref`, `.inverse`.
- **Commit** — an unordered array of deltas representing one atomic transaction. Position-independent — deltas in a commit may be reordered without changing meaning.
- **State tree** — observables nested inside other observables. Listeners on the root see deltas from anywhere in the tree, but **only if every layer is itself an observable** — plain JS objects in between break the link.
- **Network** — a UUID-indexed mirror of a state tree that can `apply()` external commits. Used for serialization, replication, undo/redo.

### Cost model

- **Subscription (`.watch()`) is expensive.** Governors compile into a tree-walk that places direct registrations along the way. Cost scales with the area of the tree the listener cares about.
- **Mutations are cheap.** Each mutation walks only the listeners directly registered at the mutated link — no tree traversal, no governor evaluation per delta.

Optimize for fewer/shallower subscriptions, not fewer mutations.

### Diamonds and cycles

destam handles object graphs with shared references and cycles:

- Multiple paths to the same observable (`obj.x = shared; obj.y = shared`) — mutations on the shared observable fire **exactly once** per logical change, not once per path. `delta.path` reflects whichever path is the active registration.
- Cycles (`obj.next = obj`, or `a → b → a`) — registration terminates at the cycle, no infinite recursion.
- Removing references in any order leaves the remaining ones correctly wired up. Removing the last reference cleans up fully.

---

## Entry Points

```js
import {
    Observer,        // observer constructors + prototype methods
    OObject,         // observable object
    OArray,          // observable array
    OMap,            // observable map keyed by UUID
    UUID,            // UUID type
    Network,         // namespace: low-level network primitives
    createNetwork,   // creates a Tracker over an observer
    Insert, Modify, Delete, Synthetic,  // delta classes
} from 'destam';
```

### Naming conventions

destam uses two distinct underscore conventions that look similar but mean opposite things:

- **Leading `_` (`obj._foo`)** is a *runtime* convention. OObject treats these as private from wildcard observers — `.watch()` and `.skip()` ignore them by default. Users put ephemeral, non-broadcast state here. Visible only through explicit `.path('_foo')`.
- **Trailing `_` (`self.foo_`)** is a *build* convention — a hint to the minifier that this property can be mangled. The pre-bundled CDN distribution of destam mangles all trailing-underscore properties into short names; the npm distribution leaves them legible. Trailing-underscore properties are **not hidden** from npm consumers — they're real API surface, just labelled "internal / mangleable." Reach into them when you need to; just know that name stability is not guaranteed across the pre-bundled distribution.

Public API uses neither: `observer.id`, `observable.observer`, `reg.id`, `reg.value`, etc.

---

## Observables

### OObject

Proxy that behaves like a JS object. `instanceof OObject` works. Use bracket notation, `delete`, `Object.keys`, etc.

```js
const state = OObject({ name: 'alex', count: 0 });
state.count = 1;                  // emits Modify
state.newProp = 'hi';             // emits Insert
delete state.name;                // emits Delete
state instanceof OObject;         // true
```

**Underscore-prefixed properties (`_foo`, `$foo`) are private.** They mutate normally but are ignored by `.watch()`, `.watchCommit()`, `.effect()`, and all wildcard governors (`.skip()`, default). They are still visible through an explicit `.path('_foo')`. This is the standard mechanism for stashing observer-internal state that should not propagate over the network.

### OArray

Proxy that behaves like a JS array. `Array.isArray()` returns true. Supports `push`, `pop`, `shift`, `unshift`, `splice`, indexed access, `length`. Does **not** support `sort` (would break delta semantics — sort is `undefined`).

```js
const arr = OArray([1, 2, 3]);
arr.push(4);                      // emits Insert
arr.splice(0, 1);                 // emits Delete
arr[0] === 2;                     // true
```

Array indices shift when items are inserted/removed. To get a stable handle on a position, use:

```js
import { positionIndex } from 'destam/Array.js';
const ref = positionIndex(arr, 0);  // stable reference even after splices
arr.observer.path(ref).watch(...);
```

### OMap

Map keyed by UUID. Used when you need observables keyed by identity rather than property name. See `UUIDMap.js`.

---

## Observer — Construction

| Constructor | Signature | Description |
|---|---|---|
| `Observer.mutable(value)` | `(any) → Observer` | Wraps `value` with get/set. If `value` is already an Observer, returns it unchanged. |
| `Observer.immutable(value)` | `(any) → Observer` | Read-only. If passed an Observer, follows it for reads but `.set()` throws. |
| `Observer.all(deps)` | `(Observer[] \| Observer<Observer[]>) → Observer` | Combines observers. `.get()` returns an array of resolved values; `.set(arr)` calls `.set` on each. Reactive to changes in any dep. The deps argument can itself be an observer of an array — useful when the dependency list isn't known up front. |
| `Observer.timer(ms)` | `(number) → Observer<number>` | Increments on a setInterval. Multiple watchers create multiple intervals — use `.memo()` to share. |
| `Observer.event(elem, type, options)` | `(EventTarget, string, EventInit?) → Observer` | DOM event observable. |
| `Observer.NULL` | constant | Immutable observer that always returns null. |
| `observable.observer` | getter | Returns the singleton observer for an observable. Always the same reference. Immutable (cannot replace the observable itself). |

---

## Observer — Watching

All watch methods return a **remove function**. Call it to unsubscribe.

| Method | Signature | Behavior |
|---|---|---|
| `.watch(fn)` | `(delta → void) → removeFn` | Called once per delta. Ignores underscore-prefixed paths by default. |
| `.watchCommit(fn)` | `((commit, args) → void) → removeFn` | Called once per commit with the full delta array. Use when you need atomicity. |
| `.effect(fn)` | `(value, commit, meta → cleanup?) → removeFn` | Called immediately with current value, and on every subsequent change. The callback may return a cleanup function that runs before each re-invocation and on removal. Models React-style effects. |
| `.defined(predicate?)` | `((value → bool)?) → Promise<value>` | Resolves when the predicate returns truthy. Default predicate is `v => v != null`. One-shot. |

```js
observer.watch(delta => {
    console.log(delta.path, delta.value);
});

observer.effect(value => {
    const handle = setInterval(() => doStuff(value), 1000);
    return () => clearInterval(handle);  // runs before next invocation or on removal
});

const value = await observer.defined();  // waits until non-null
```

The order in which multiple watchers fire for the same delta is **undefined**. Mutations inside a watcher are synchronous; they may re-enter the same listener on a different observable.

---

## Observer — get / set

```js
observer.get()                    // current value
observer.set(newValue)            // throws if observer.isImmutable()
observer.isImmutable()            // true if .set is the immutable setter
```

`get()` returns `undefined` on observers that have multiple targets or no single value (e.g. after `.skip()` or `.tree()`). Downstream operators (`.map()`, `.bool()`, `.path()`) propagate the `undefined` transparently. If you need the actual data in a multi-target case, close over the underlying observable directly: `obs.skip().map(() => array.length)`.

---

## Observer — Governors

Governors filter which deltas reach a watcher. They compose left-to-right. Some advance the **governor pointer** (changes what `.get()` resolves to); others act as pure filters.

| Method | Advances pointer? | Effect |
|---|---|---|
| `.path(key \| key[])` | yes | Whitelist: only deltas through this path. Recursive — descendants of the path are included. |
| `.ignore(key)` | no | Blacklist: drops deltas through this property (and its descendants). Pure filter. |
| `.shallow(depth = 0)` | no | Caps recursion depth. `shallow(0)` fires only for the observer itself, no nested children. |
| `.skip(level = 1)` | yes (multi-target) | Wildcard `.path()` — looks past any property at this level. Used to iterate through arrays / maps. `.get()` returns `undefined`. |
| `.tree(name)` | yes (multi-target) | Recursive descent through a named child property (typically `'children'`). `.get()` returns `undefined`. |

**Default governor:** `.watch`, `.watchCommit`, and `.effect` automatically ignore properties whose name starts with `_` or `$`. `.path('_foo')` overrides this for that specific path.

**Composition rules:**

```js
observer.path('a').path('b')              // ≡ observer.path(['a', 'b'])
observer.path('a').shallow()              // ≡ observer.shallow(1).path('a')  (only direct children of a)
observer.path('a').ignore('a')            // listener never fires (ignore wins)
observer.ignore('a').path('a')            // listener fires (path advances past ignore's domain)
observer.path('array').skip().path('name')// fires on .name of any array element
observer.tree('children').path('name')    // fires on .name anywhere in the tree
```

**`positionIndex` for arrays:** array indices are not stable references. Use `positionIndex(array, currentIndex)` from `destam/Array.js` to get a stable handle.

---

## Observer — Transforms

| Method | Returns | Notes |
|---|---|---|
| `.map(forward, backward?)` | Observer | Transform values. With `backward`, the new observer is mutable and `.set` writes back through. Without it, immutable. Equal values are deduplicated (no delta emitted). |
| `.unwrap()` | Observer | Resolves to the value inside a nested observer. If the contained value is not an observer, behaves transparently. |
| `.bool(yes = true, no = false)` | Observer | Coerces to boolean and returns one of two values. |
| `.setter(fn)` | Observer | Intercepts `.set` calls: `fn(newValue, parentSet)` decides whether/how to forward. Used for access control or transformation. |
| `.lifetime(cb)` | Observer | `cb` is called when the first watcher attaches; its return value (if a function) is called when the last watcher detaches. Used for resource setup/teardown. |
| `.memo(count?)` | Observer or Observer[] | Holds a **single shared upstream subscription** regardless of how many watchers attach downstream, caching the parent's value for reuse. Primary purpose: optimize chains where upstream does meaningful per-evaluation work (e.g. a `.map()` reduce). With `count`, returns an array of `count` independent memoized observers all sharing one upstream sub. Two consequences worth knowing: (1) `Observer.timer` creates N intervals without `.memo()` and 1 shared interval with it; (2) if the cached value is itself an observable, downstream watchers follow it for nested mutations (useful for "current selection" patterns). **Requires a meaningful `.get()` — see Gotchas.** |
| `.throttle(ms)` | Observer | At most one watcher invocation per `ms` window. Only the latest commit is delivered. Pending commits are flushed on removal. |
| `.wait(ms)` | Observer | Waits for `ms` of silence before invoking. Restarts the timer on every event. Pending commits flush on removal. |

---

## Deltas — Event Types

All four event types share the same prototype shape. Created via `Insert(prev, value, ref, id)` etc.

| Type | When |
|---|---|
| `Insert` | A new property/index appeared. `prev` is `undefined`. |
| `Modify` | An existing property/index changed. Both `prev` and `value` are meaningful. |
| `Delete` | A property/index was removed. `value` is `undefined`. |
| `Synthetic` | A value-level change (no key/index — e.g. on an `Observer.mutable`). Used internally and for `Observer.event`. |

### Delta fields

```js
delta.value        // new value
delta.prev         // previous value
delta.ref          // property name (OObject) or position bytes (OArray)
delta.id           // UUID of the observable that changed
delta.path         // full path through the state tree (getter)
delta.parent       // the observable that emitted this delta (getter)
delta.inverse      // the delta that undoes this one (getter); Insert↔Delete, Modify reversed
```

Path and parent are **getters** that require the delta to still be attached to a network — they throw "orphaned event" if accessed after the network has been torn down. Clone deltas with `clone()` from `destam` if you need to keep them around (see `Tracking.js` usage).

---

## Networks

A network is a UUID-indexed map of every observable reachable from a root observer. Used for serialization, replication, and undo/redo.

```js
import { createNetwork } from 'destam';

const obj = OObject({ nested: OObject() });
const network = createNetwork(obj.observer);

network.has(id)                   // is this UUID known?
network.get(id)                   // returns { id, value, reg, ... } element
network.size                      // number of known observables
network.remove()                  // tears down; required to avoid leaks
```

### digest

Aggregates events over a time period into a single commit.

```js
const digest = network.digest((commit, observerRefs, args) => {
    // commit:        array of deltas
    // observerRefs(reg): true if the observable already existed in the network
    //                    before this digest cycle (serialize as a UUID-only reference).
    //                    false if it was added during this cycle (serialize its full state).
    // args:          optional metadata passed via .apply(commit, args)
}, timeoutMs?, ignorePredicate?);
```

- With `timeoutMs`: auto-flushes on the throttle schedule.
- Without `timeoutMs`: passive mode — you must call `digest.flush()` manually.
- `ignorePredicate(args)`: when truthy for a given commit's args, that commit is excluded. Used to break echo loops when applying remote events.

`digest.flush()` immediately produces a commit from pending changes. `digest.remove()` tears down the digest (auto-flushes any pending changes first).

### apply

```js
network.apply(commit, args?)      // applies external deltas to the state tree
```

Atomic — if any delta in the commit references an unknown id or a duplicate link, the entire commit throws and nothing is applied. `args` is passed through to listeners (and to digest `ignore` predicates) — use it to mark events as "from the remote" so your own digest doesn't echo them back.

### Typical sync loop

```js
const local  = OObject();
const remote = OObject();  // mirror

const localNet  = createNetwork(local.observer);
const remoteNet = createNetwork(remote.observer);

// remote → local
const apply = (commit, args) => localNet.apply(clone(commit), 'remote');

// local → remote (filtered to not echo)
const digest = localNet.digest(
    commit => sendToRemote(clone(commit)),
    100,
    args => args === 'remote'
);
```

### Undo / Redo

```js
const history = [];
const digest = network.digest(commit => history.push(clone(commit)));

// undo last
network.apply(history.pop().map(d => d.inverse));
```

---

## Identity (UUIDs)

Every observable has a UUID accessible via `observable.observer.id`. Position in the tree doesn't matter — events identify their target by id, so moving observables around preserves listener correctness.

```js
const uuid = new UUID();          // random, 128 bits (4 × Int32)
const uuid = new UUID(8);         // 256 bits — useful if used as a security token
const uuid = new UUID('#deadbeef...');  // from hex string
uuid.toHex()                      // → '#...'
uuid.toString()                   // → same as toHex
```

UUIDs are backed by `Int32Array`. Hot paths should pass UUID objects through APIs that accept them — avoid `.toHex()` outside of display/persistence/interop.

The size argument defaults to 128 bits. Pass `new UUID(8)` for 256 bits if a UUID is doubling as a security token (e.g. session keys).

`UUID.Map` is a content-keyed hash map over UUIDs — use it instead of a native `Map` when keys arrive freshly decoded (e.g. from the network) and can't be cached as strings. `UUID.Map(null, minAllocation)` preallocates the backing table; pass `nextPow2(expectedCount / 0.8)` if you know the size up front.

---

## Common Patterns

### Listening to a specific nested path

```js
state.observer.path(['user', 'profile', 'name']).watch(delta => {
    console.log('name is now', delta.value);
});
```

### Reacting to "any element of an array"

```js
arr.observer.skip().path('status').watch(delta => {
    // fires for any element's .status changing
});
```

### Computed values from multiple observers

```js
const total = Observer.all([price, quantity]).map(([p, q]) => p * q);
total.watch(delta => updatePrice(delta.value));
```

### Side effect with cleanup

```js
const unwatch = state.observer.path('url').effect(url => {
    const ws = new WebSocket(url);
    return () => ws.close();
});
// later: unwatch();
```

### Wait for a value to be set

```js
const session = await state.observer.path('session').defined();
```

### Resource-managed observer

```js
const live = baseObserver.lifetime(() => {
    const sub = openExternalSubscription();
    return () => sub.close();  // runs when last watcher detaches
});

// while there is at least one watcher, the subscription is open
```

### Reacting to structural changes (length, size, keys)

The observer of an observable (`arr.observer`, `obj.observer`) is an immutable handle to the observable itself. Its **own** value never changes — you can't `.set()` the array reference, only mutate its contents. So depth-limited governors anchored at the root don't fire at all:

```js
// WRONG — never fires. The root's "value" (the observable) never changes;
// .shallow(0) explicitly excludes the nested elements where the action is.
arr.observer.shallow().map(() => arr.length).watch(...);
```

To get an observer that fires when the array is structurally modified (push, splice, delete) but not when individual items mutate internally, advance the governor pointer **past** the immutable root with `.skip()`, then apply `.shallow()`:

```js
// RIGHT — .skip() advances past the immutable root into the array's elements,
// .shallow() prevents recursion into those elements.
arr.observer.skip().shallow().map(() => arr.length).watch(len => {
    console.log('array length is now', len);
});
```

Same pattern for OObject key changes:

```js
// fires on Insert/Delete of top-level properties, not on nested mutations
obj.observer.skip().shallow().map(() => Object.keys(obj)).watch(...);
```

The mental model: `.skip()` is what lets you "look at the interesting thing" on an observable. The root observer represents the container; `.skip()` represents its contents.

### Avoiding echo loops in replication

Pass an `args` value to `network.apply(commit, args)` and exclude it via the digest's third argument:

```js
network.digest(commit => sendToPeer(commit), 100, args => args === 'fromPeer');
network.apply(incoming, 'fromPeer');
```

---

## Gotchas

- **`.skip()` / `.tree()` `.get()` returns `undefined`.** These governors target multiple things; there is no single value to return. Downstream operators (`.map`, `.path`, `.bool`) propagate the `undefined`. If you need the underlying data inside a derived computation, close over the observable directly rather than using `.get()`.
- **`.memo()` after `.skip()` / `.tree()` doesn't work.** `.memo()` genuinely depends on its parent having a single value to anchor on — it's the one operator that does. Multi-target chains don't have one, so `.memo()` placed after `.skip()` or `.tree()` cannot do its job. Apply `.memo()` before any `.skip()` / `.tree()` in the chain, or collapse the multi-target chain to a concrete value with `.map()` first: `obs.skip().path('name').map(() => state.array.map(e => e.name)).memo()`.
- **`.shallow()` on an observable root never fires.** `arr.observer` / `obj.observer` are immutable handles to the observable. Their own value (the observable reference) never changes. `.shallow(0)` excludes nested events, so anchoring `.shallow()` at the root captures nothing. Use `.skip().shallow()` instead — `.skip()` advances past the immutable root into the actual contents. Canonical case: `arr.observer.skip().shallow().map(() => arr.length)`. See "Reacting to structural changes" under Common Patterns.
- **Plain objects break state trees.** `OObject({ user: { name: OObject() } })` — the inner `OObject` is isolated. Listeners on the root won't see its mutations because the middle `user` is plain. Make every layer an observable.
- **Array indices are not stable.** Use `positionIndex(arr, i)` for paths into arrays that may splice.
- **Underscore properties are hidden by default.** Wildcard listeners (`.watch`, `.skip()`, default) skip them. Use `.path('_foo')` explicitly to observe them.
- **`Observer.timer` creates one interval per watcher.** Use `.memo()` to share.
- **Networks leak if not removed.** `network.remove()` when done; same for `digest.remove()`.
- **`.set` is no-op on equal values.** Equality is deep-ish (`isEqual`). No delta is emitted when the new value equals the old.
- **`set` on `observable.observer` throws.** Observable observers are immutable handles to the observable itself. Mutate properties of the observable instead.
- **`watch` listener order is undefined.** Don't rely on it.
- **`watch` is delta-per-call; `watchCommit` is commit-per-call.** Use `watchCommit` if you need to see related deltas together (atomicity).
- **Cloning deltas.** `delta.path` and `delta.parent` are network-dependent. To persist deltas (e.g. for undo history), clone them with `clone()` (see `Tracking.js` / tests for usage). After cloning, `path` and `parent` may be unavailable.
- **`Observer.mutable` deduplicates.** Setting the same value twice in a row emits no delta. Use `.watchCommit` and inspect commits if you need to know about every `.set` call regardless.

---

## File Map

| File | Contains |
|---|---|
| `Observer.js` | All observer methods and constructors. Look here for governor/transform semantics. |
| `Object.js` | `OObject` implementation. |
| `Array.js` | `OArray` implementation, `positionIndex`. |
| `UUIDMap.js` | `OMap` implementation. |
| `UUID.js` | UUID class, hex serialization. |
| `Events.js` | `Insert`, `Modify`, `Delete`, `Synthetic`, `path`/`parent`/`inverse` getters. |
| `Network.js` | Low-level link/reg internals used by observables. Rarely touched directly. |
| `Tracking.js` | `createNetwork` (Tracker), `digest`, `apply`. |
| `tests/*.test.js` | Canonical usage examples — read these for precise semantics on edge cases. |

When in doubt about a specific method's behavior, the JSDoc in `Observer.js` is the authoritative source. The tests are the second-best source.
