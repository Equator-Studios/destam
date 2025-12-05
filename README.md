# Destam · Delta State Manager

Destam is a small state management library that:

- Lets you **mutate** state directly (no forced immutability / cloning)
- Tracks all changes as **deltas** (Insert / Modify / Delete)
- Gives you **Observers** that can:
  - expose current state
  - notify you when it changes (`.watch`, `.watchCommit`, `.effect`, etc.)
  - narrow what you listen to with **governors** (`.path`, `.ignore`, `.shallow`, `.skip`, `.tree`, …)
- Works with **observable objects** (`OObject`) and **observable arrays** (`OArray`), which behave like normal JS objects/arrays but are fully tracked.

You can use those deltas to:

- Update a UI or DOM efficiently
- Sync state across tabs, clients, or to a server
- Implement undo/redo or time‑travel
- Sync to a DB or a document store

## Install

```bash
npm install destam
# or
yarn add destam
```

## Quick Start Guide: Observer

An **Observer**, the core concept behind destam, is simply a box around a value that:

- Stores a value
- Can be updated, if it’s mutable
- Notifies listeners

### Creating a simple mutable observer

```js
import { Observer } from 'destam';

const count = Observer.mutable(0);

console.log(count.get()); // 0

count.set(1);
console.log(count.get()); // 1
```

### Watching changes

`.watch` lets you subscribe to changes. The callback gets called **every time the value is mutated**.

```js
const count = Observer.mutable(0);

const stop = count.watch(event => {
  // For basic mutable observers:
  // event.value = new value
  // event.prev  = previous value
  console.log('count changed from', event.prev, 'to', event.value);
});

count.set(1); // logs: count changed from 0 to 1
count.set(2); // logs: count changed from 1 to 2

// stop listening
stop();
```

A few things to know about `.watch`:

- It returns a **cleanup function**. Call it to unsubscribe.
- It runs **synchronously** right when the mutation happens.
- If multiple watchers are attached, they all get run (order is not guaranteed stable, and they can re‑trigger changes).

There are more Observer helpers (`.map`, `.memo`, `.throttle`, `.wait`, `.unwrap`, etc.), but for a quick start, `mutable`, `get`, `set`, and `watch` are enough. See the rest of the documentation for more details.

## Observable Objects: OObject

`OObject` is a JS object that:

- Behaves like a normal object
- Has a built‑in Observer through `.observer` so you can use to watch mutations to any property
- Emits **Insert / Modify / Delete** deltas when it changes

### Creating an observable object

```js
import { OObject } from 'destam';

const state = OObject({
  name: 'John Doe',
  address: 'Tokyo',
});
```

You can read and write properties like a normal object:

```js
console.log(state.name);  // "John Doe"
state.name = 'Jane Doe';  // mutation is tracked
delete state.address;     // also tracked
```

### Getting the object’s Observer

Every observable exposes `.observer`:

```js
const obs = state.observer;
console.log(obs.get() === state); // true
```

### Watching OObject changes with `.watch`

For observables like `OObject` and `OArray`, `.watch` receives **delta objects**:

- `Insert(prev, value, ref, id)`
- `Modify(prev, value, ref, id)`
- `Delete(prev, value, ref, id)`

Where (for `OObject`):

- `event.ref`   – the property name (string)
- `event.value` – new value
- `event.prev`  – previous value
- `event.path`  – full path from the root observer (array of keys)
- `event.parent`– the observable that was mutated (here: `state`)

Example:

```js
import { Insert, Modify, Delete } from 'destam';

state.observer.watch(event => {
  if (event instanceof Insert) {
    console.log('INSERT', event.path, '->', event.value);
  } else if (event instanceof Modify) {
    console.log('MODIFY', event.path, 'from', event.prev, 'to', event.value);
  } else if (event instanceof Delete) {
    console.log('DELETE', event.path, 'prev was', event.prev);
  }
});

state.name = 'Jane Doe';   // MODIFY ["name"] from "John Doe" to "Jane Doe"
state.age = 42;            // INSERT ["age"] -> 42
delete state.age;          // DELETE ["age"] prev was 42
```

### Narrowing what you watch with `.path`

Observers can be narrowed using **governors**. The most important one to start with: `.path`.

```js
// Only react when "address" changes:
state.observer
  .path('address')
  .watch(event => {
    console.log(`${event.parent.name}'s address changed to ${event.value}`);
  });

state.address = 'Toronto';
// logs: "John Doe's address changed to Toronto"

state.occupation = 'Electrician';
// No log, because .watch was narrowed and only listens for updates
// to state.address
```

Some key points:

- `state.observer` sees **everything** under `state`.
- `state.observer.path('address')` only sees changes at/under `state.address`.
- `.path` works for nested properties too (you can pass an array path).


## Observable Arrays: OArray

`OArray` is a JS array that:

- Behaves like a normal array (`push`, `splice`, indexing, `Array.isArray`, `instanceof`, etc.)
- Emits deltas for element insertions, modifications, and deletions
- Uses stable **logical indexes** internally so you can track items even when the array shifts

### Creating an observable array

```js
import { OArray } from 'destam';

const arr = OArray([1, 2, 3]);

console.log(arr.length);   // 3
console.log([...arr]);     // [1, 2, 3]

arr.push(4);               // tracked
arr[0] = 10;               // tracked
arr.splice(1, 2, 'a', 'b'); // tracked (insert + delete/modify)
```

It still behaves like an array:

```js
console.log(Array.isArray(arr));      // true
console.log(arr instanceof OArray);   // true
```

> Note: `sort` and `reverse` are intentionally disabled (they throw) because they’re not implemented for stable indexing.

### Watching OArray changes with `.watch`

The `.observer` for an `OArray` also gives you `Insert`, `Modify`, `Delete` deltas. The difference vs. `OObject` is the **ref**: in arrays it’s a *stable index token* instead of a numeric JS index.

Example:

```js
import { Insert } from 'destam';

const arr = OArray([1, 2, 3]);

arr.observer.watch(event => {
  if (event instanceof Insert) {
    console.log('Inserted value', event.value, 'at ref', event.ref);
  } else {
    console.log(event.constructor.name, 'prev=', event.prev, 'value=', event.value);
  }
});

arr.push(4);
// Insert at logical end

arr[0] = 10;
// Modify of first element

arr.splice(1, 2);
// Deletes / modifies depending on what changed
```

You rarely need to care about the exact internal index encoding. There are helpers if you need to map between numeric positions and refs.

### Mapping positions ↔ refs (`indexPosition` / `positionIndex`)

From `Array.js` Destam exports:

- `indexPosition(array, ref)` – given a ref from an event, returns the numeric position *at that moment*.
- `positionIndex(array, pos)` – given a numeric position, returns the stable ref for that element (useful in `.path` governors).

Example: tracking *which index* changed in a watcher:

```js
import { indexPosition } from 'destam/Array.js';

const arr = OArray();

arr.observer.watch(event => {
  const idx = indexPosition(arr, event.path[0]); // path[0] is the ref
  console.log('Change at index', idx, '->', event.value);
});

arr.push('a'); // logs: Change at index 0 -> a
arr.push('b'); // logs: Change at index 1 -> b
arr.push('c'); // logs: Change at index 2 -> c
```

### Watching a specific array element with `.path`

To watch a specific element stably (even if the array shifts), you **convert the numeric index to a ref** using `positionIndex` and then use `.path` with that ref:

```js
import { positionIndex } from 'destam/Array.js';

const arr = OArray(['hello', 'third thing']);
arr.splice(1, 0, 'world'); // arr = ["hello", "world", "third thing"]

// Grab stable refs for each position:
const ref0 = positionIndex(arr, 0);
const ref1 = positionIndex(arr, 1);
const ref2 = positionIndex(arr, 2);

// Create observers for each position:
const o0 = arr.observer.path([ref0]);
const o1 = arr.observer.path([ref1]);
const o2 = arr.observer.path([ref2]);

console.log(o0.get(), o1.get(), o2.get()); // "hello", "world", "third thing"

// Update via observers:
o0.set('new value 1');
o1.set('new value 2');
o2.set('new value 3');

// These are equivalent to writing directly: arr[0] = ..., etc.
console.log([...arr]); // ["new value 1", "new value 2", "new value 3"]
```

Under the hood, these `.path([ref])` observers:

- Resolve the ref into a numeric index **at call time**
- Read/write the proper element
- Emit the `Modify` deltas

## Understanding `.watch`

You’ll see `.watch` in three main situations:

1. **Plain Observer (single value)**  
   - Created with `Observer.mutable()`, `.map`, `.all`, etc.
   - `watch(cb)` calls `cb(event)` whenever `.set` is called.
   - `event.value` and `event.prev` are the new/previous values.

2. **Observable Object (`OObject`)**  
   - `state.observer.watch(cb)` gets **per‑property** events:
     - `Insert`, `Modify`, or `Delete`
     - `event.ref` is the property name
     - `event.path` is path from root observer (array of keys)

3. **Observable Array (`OArray`)**  
   - `arr.observer.watch(cb)` gets **per‑element** events:
     - `Insert`, `Modify`, or `Delete`
     - `event.ref` is a *stable index ref*
     - Use `indexPosition(arr, event.ref)` to get the numeric index.

In all three:

- `.watch` returns a function to unsubscribe.
- Multiple listeners can be attached.
- Events are emitted synchronously on mutation.


## Where to go next

If you want to dig deeper:

- **Observers & governors**: `docs/observer.md`, `docs/governors.md`
- **Observables & state trees**: `docs/observables.md`, `docs/state-tree.md`
- **Networks, commits, undo/redo & syncing**: `docs/network.md`, `Tracking.js`

But for most use cases, you can start with:

- `Observer.mutable` + `.get()`, `.set()`, `.watch()`
- `OObject` + `.observer.watch()` / `.observer.path(...)`
- `OArray` + `.observer.watch()`, `indexPosition`, `positionIndex`

and only pull in the more advanced stuff when you actually need it.

## Repository structure

```bash
./
├── README.md <- this readme
├── destam <- The core destam library (Observer, OArray, OObject, etc)
│   └── ...
└── destam-react <- Library containing specialized Observer integration tools for React
    └── ...
```

Documentation:
- [destam](destam/README.md)
- [destam-react](destam-react/README.md)
