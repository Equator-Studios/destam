# Observer network

What sets destam apart from most JavaScript state libraries is built-in machinery for synchronizing observer state trees and constructing deltas.

Imagine a client-server architecture where you want application state synced between client and server. You want a collaborative environment where state changes on any client are visible to all the others and recorded by the server. Whenever a client makes a change, those changes are automatically relayed to the server so it can persist them.

Observers are already modeled around atomic updates that happen throughout the state tree. The delta passed into a watch handler is one of four event types describing what kind of mutation happened:

- `Insert` — a new property/index was created.
- `Modify` — an existing property/index changed value.
- `Delete` — a property/index was removed.
- `Synthetic` — a value-level change with no key (used internally and for non-observable observers like `Observer.mutable`).

These primitives aren't enough to describe everything that can happen during a slice of time. Multiple events combined form a commit — an unordered list of mutations describing the transition from one state tree to another.

## Event commits

A single JS-level operation can produce multiple events. For example, `Array.prototype.splice` can simultaneously add, remove, and modify elements. Observers handle this and any other case where atomicity matters for correctness.

A commit is an unordered array of events — the order doesn't affect the result of applying it, and events can be shuffled freely without affecting correctness.

The `watch` function we've used so far is a helper that iterates events out of a commit and calls your callback once per event. Use `watchCommit` instead when you need to see the whole commit at once:

```js
// initialize an observable array with one element.
const arr = OArray([0]);

arr.observer.watchCommit(commit => {
	console.log(commit);
});

arr.observer.watch(event => {
	// will be invoked three times — once per event in the commit above.
});

// the splice below generates the following commit:
// - Modify the existing element at position 0 to 1
// - Insert a new element at position 1 with value 2
// - Insert a new element at position 2 with value 3
// Events within a commit are position-independent and may arrive in any order.
arr.splice(0, 1, 1, 2, 3);
```

## Event ids

Events describe what happens to an object, but how does the framework know which object an event targets? Every observable is assigned a UUID that uniquely identifies it, and every event records the UUID of the observable it's mutating.

Tagging every observable with a UUID means the observable's position in the state tree doesn't matter — it can move around freely and events still apply to the same object. This is important when one client moves a piece of state to a different location while another client is mutating state inside it: the mutation lands on the right object regardless.

The UUID of an existing observable is accessed via `observable.observer.id`. Not all observers expose this — only those derived directly from an observable.

```js
const obj = OObject({
	nested: OObject(),
});

obj.observer.watch(event => {
	// the listener fires twice: once for the mutation on obj,
	// once for the mutation on obj.nested. Each event's id
	// identifies the observable that emitted it.

	assert(event.id === obj.observer.id || event.id === obj.nested.observer.id);
});

obj.state = 1;
obj.nested.state = 1;
```

## createNetwork

With a list of events from a watcher and a way to identify the target of each event, we can build a system to "replay" events into an entirely new state tree. That tree can live in the same JS context or, if the events are serialized, on another machine across the internet.

To apply events to a state tree, the framework needs an index of all UUIDs relevant to a transaction — you can't replay events if you can't find the observables to mutate. `createNetwork` constructs this index.

```js
const obj = OObject();
const network = createNetwork(obj.observer);
```

A network is a hash map associating each id in the state tree with its observable. In fact, it extends `UUID.Map`:

```js
assert(network.get(obj.observer.id) === obj);
```

The network updates automatically as the state tree changes:

```js
obj.nested = OObject();
assert(network.get(obj.nested.observer.id) === obj.nested);
```

Because networks track an observable's tree dynamically, they hold references that prevent garbage collection. Call `remove()` when you're done so the GC can clean up:

```js
network.remove();
```

Putting it together, you can maintain a separate state tree that always mirrors the original. Use the `apply` convenience method to apply a commit:

```js
// Deep-clone the original tree as the starting state.
// Networks assume both state trees start identical.
const duplicate = clone(obj);

// Apply changes to the duplicate's network, not the original's — applying
// deltas to the network they came from would attempt to mutate state into
// itself. Observers throw rather than silently misbehave in this case.
const dupNetwork = createNetwork(duplicate.observer);

obj.observer.watchCommit(commit => {
	// Both state trees must be completely separate in memory. If they
	// shared observables, applying a commit to one would mutate the other
	// directly — equivalent to applying events to themselves.
	const cloned = clone(commit);

	dupNetwork.apply(cloned);
});

obj.state = 2;

// the mutation is replicated on the duplicate tree.
assert(duplicate.state === 2);
```

Often you don't want to apply each commit as it happens. There are edge cases where parts of the state tree are momentarily detached during a multi-step operation, and per-mutation updates are too fine-grained when commits are being serialized over the network. Networks provide a `digest` function that collects events over a time window and squashes them into one combined commit.

`digest` is a method on the network because you can't simply accumulate commits into an array and apply them later — commits are unordered, so multiple mutations to the same element across two commits would lose their ordering and produce inconsistent results.

`digest` is implemented optimally — it emits the minimum number of mutations needed to recreate the resulting state at the other end.

Observer networks also handle multiple references correctly. For performance, the digest is built directly on top of `createNetwork`.

```js
const duplicate = clone();
const dupNetwork = createNetwork(duplicate);

const digest = network.digest(commit => {
	const cloned = clone(commit);
	dupNetwork.apply(cloned);
});

obj.state = 2;

// the mutation hasn't been applied to the duplicate network yet.
assert(duplicate.state === undefined);

obj.state = 3; // oops, actually I meant 3
obj.state2 = 4;

// run the digest.
digest.flush();

assert(duplicate.state === 3);
assert(duplicate.state2 === 4);

// The commit from the digest would look like:
// - Insert property 'state' as 3
// - Insert property 'state2' as 4
// Note that we don't have an Insert and Modify in the same commit.
```

## Multiple references

Observable networks deduplicate observables that are referenced multiple times. This matters for keeping network state applications consistent — especially when multiple parties contribute to the same shared state tree and observables move around or end up referenced from multiple locations.

Consider this:

```js
const obj = OObject();
const obj2 = OObject();

obj.reference1 = obj2;
obj.reference2 = obj2;
```

Both `reference1` and `reference2` point at the same observable. Mutating any property of `obj2` should be visible through both references. Networks handle this by keeping track of which observables are already known and which are newly introduced in the current digest.

```js
network.digest((commit, observerRefs) => {
	dupNetwork.apply(clone(commit, {observerRefs, observerNetwork: dupNetwork}));
});
```

The network automatically tracks which references need to be serialized as new observables and which can be referred to by id because the receiving side already has them. `observerRefs` is the callback that answers the question "did we know about this observable before this digest started?"

# Conflict resolution

The basic synchronization story destam ships with is server-authoritative: a
central process orders events, peers `.apply()` what they're told, and `args`
plus the digest's `ignore` predicate prevent echo loops. This covers most
collaborative apps — the kind where a backend exists and clients trust it to
arbitrate.

For offline-first or peer-to-peer use, where two clients can mutate the same
state while disconnected and have to merge on reconnect, destam doesn't ship a
full conflict resolution layer in the box. But the underlying data structures
are already shaped to do most of the work, so a small sync library on top can
finish the job.

## What destam already gives you for free

**UUID-based identity.** Every observable has a stable UUID independent of
where it sits in the tree. Two clients concurrently moving the same observable
to different parents both produce deltas that reference the same id — applying
them in any order converges (the last move wins, but no data is lost in the
process). Same goes for renaming, attaching, detaching: the object identity
survives.

**Probabilistic position ordering in OArray.** When you insert an element into
an `OArray`, the position is encoded as a byte string generated to lie strictly
between the bytes of its neighbors. The encoder mixes in random low-order bits
so that two clients independently inserting "between A and B" produce different
byte strings with overwhelming probability. Those byte strings have a total
order, the same on every peer, so the resulting sequence converges:

```js
// client 1 (offline)
arr.splice(0, 0, 'C');   // position generated between start and 'A'
// client 2 (offline)
arr.splice(0, 0, 'D');   // independently generated position in the same range
```

Both inserts survive after reconnect, both clients agree on whether C or D
ends up first (whichever has the lexicographically smaller position bytes),
and no per-element tombstone bookkeeping is needed. This is the same property
LSEQ and Logoot give you, just baked into the data structure rather than
maintained by a sync layer.

The default entropy is tuned for single-writer use. For offline-first apps
where many writers may insert into the same slot concurrently while
disconnected, increase the `entropy` constant in `Array.js` — every extra bit
roughly halves the collision probability at the cost of one bit per position.
Most apps won't need to touch it.

**Multiple references.** Already covered above — diamonds and shared references
serialize correctly via `observerRefs`, so a peer-to-peer sync layer doesn't
have to think about graph structure separately.

## What a sync library on top would add

A real offline-first or peer-to-peer layer needs:

- **Per-(id, ref) timestamp metadata.** OObject sets are last-writer-wins by
  field. The library keeps a side store of "the latest timestamp we've
  accepted for `(reg.id, propertyName)`", checks incoming deltas against it,
  and drops stragglers.
- **Tombstones for deletes.** A deleted key needs to remember "deleted at T"
  so a late-arriving Insert with time < T is rejected.
- **A transport.** Websocket, WebRTC, IndexedDB replication — whatever moves
  bytes between peers. destam stays transport-agnostic.

Destam handles the data-structure side of the problem (identity, position
ordering, delta encoding, diff transport via digest). The conflict policy
sits in a thin layer above. If you need stronger semantics than LWW (true
CRDT preservation of all concurrent writes on the same field, vector clocks
for causal ordering), that goes in the same layer — destam doesn't need to
change.

## When you need different behavior

`OArray`'s convergence assumes lexicographic ordering of random position
bytes is acceptable for your application. If you need specific semantics for
how concurrently-inserted items relate to each other — e.g. "always group by
inserting client" or "always insert before the cursor of the other peer" —
write your own array-like observable. The `Network.js` link/reg machinery is
the same regardless of what data structure sits on top of it; `OArray` is one
implementation among possible others.

# Undo / Redo

Because network events describe exactly what changed, they can be stored and replayed later. `Event.prototype.invert` returns an inverted delta — applying the inverse cancels out the original change. Cloning events as you build the history is required for correct behavior in non-trivial situations, especially if you want to selectively revert specific commits rather than doing a strict linear undo/redo.

```js
const history = [];

network.digest(commit => {
	history.push(clone(commit));
}, 0);

// ... state changes happen and the history accumulates

for (let i = history.length - 1; i >= 0; i--) {
	network.apply(history[i].map(delta => delta.inverse));
}

// all those changes are undone.
```

# Automatic flushing

Destam network digests don't have to be flushed automatically — flushes can happen at any point, including asynchronously. For most applications, a periodic flush during idle time is enough:

```js
const network = createNetwork(stateTree);
const digest = network.digest(...);

setInterval(() => {
	digest.flush();
}, 1000);
```

This is naive though — it tries to flush even when nothing has changed.

## Reactivity-aware flushing

You can be more precise by leveraging the reactivity model:

```js
stateTree.observer.throttle(1000).watch(() => {
	digest.flush();
});
```

Now the network flushes at most once per second, and stays quiet when nothing is changing. Good for real-time collaboration.

```js
stateTree.observer.wait(1000).watch(() => {
	digest.flush();
});
```

This variant only flushes after a full second of inactivity. Better for slower-paced document editing.

For a built-in solution, `digest()` accepts a timeout as a second parameter:

```js
network.digest(commit => {
	// flushes automatically with the same timing semantics as throttle.
}, 1000);
```

The built-in approach has two advantages:

1. **Cleanup is simpler.** You only need to remove the digest, not also a separate flush listener.
2. **It's slightly faster.** Attaching listeners isn't free — every mutation has to walk the listener structure. The built-in digest reuses its existing event stream rather than adding an extra watcher.
