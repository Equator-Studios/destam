# Observer network

The technology that brings observers to the next level above other similar
javascript libraries managing application state are built in handling for
synchronization of observer state trees and delta creation.

Suppose we have a client-server architecture and we want to have application
state that is synched between the client and the server. We want this to create
a collaborative envirnoment between clients where any state changes that happen
on one client will be visible on all the others as well as the server to
save into its database. If the client makes any changes to its state, those
changes are automatically relayed to the server so that it can record those
changes into its database.

Observers are already modelled after atomic updates that happen throughout the
state tree. In a watch handler, an observer event is passed with three event
types describing the type of mutations that can happen to an observer tree. Those
events being `Insert`, `Update` and `Remove`.

`Insert` describes a newly inserted element that doesn't exist yet.
`Update` updates an existing element that mutates to a different value.
`Delete` deletes an existing element.

However, these primitives are not enough to describe what can happen during a
given slice of time. An unsorted list of multiple of these events can be
compiled that describes a series of mutations to change any one state tree into
another state tree.

## Event commits

Multiple events can even be generated from a single mutation observed from
javascript for the case of `Array.prototype.slice`. Remember, slice can add,
remove and delete elements at the same time. Observers are equipped to handle
this case and any case in which an atomic is required for the correctness of
an application.

Although commits are simply just an array of events, this is an unsorted array
and the order of events inside the commit does not matter and events
can be shuffled without affecting correctness.

Note that the simpler `watch` funciton that we have been exposed to up until
this point is simply a helper method provided that will iterate all events
in a commit and call the `watch` function for each one in listeners that aren't
interested in atomic updates. We can use `watchCommit` function to see the full
commit.

```js
// initialize an observable array starting with one element.
const arr = OArray([0]);

arr.observer.watchCommit(commit => {
	console.log(commit);
});

arr.observer.watch(commit => {
	// will be invoked three times as an iteration of the events that would be
	// received by the listener above.
});

// the splice below will generate the commit list in the above watcher.
// - Modify of the first element in the array to 1
// - Insert of an element into position 1 of value 2
// - Insert of an element into position 0 of value 2
// Remember that events are encoded to be position indepentent. Any of the above
// events can come in any order.
arr.splice(0, 1, [1, 2, 3]);

```

## Event ids

Events describe what happens to an object, but how do we know what object exactly
the events are targetting? Observables are all assigned a UUID that uniquely
identifies an object within a state tree that we might want to mutate parts about.
Every event records the UUID of the object that it is intending to mutate.

The benefit of tagging every observable with a UUID is that it makes the position
of the specific state within the state tree not matter (it can move around freely
and events will still apply to the same object). This can be important in the
case where a client moves a piece of state elsewhere (to reorder or otherwise)
while another client can mutate state within that moving piece of state without
failing a transaction.

Note that to get the UUID of an existing observable, `<observable>.observer.id`
property can be used. Not all observers have ids, only observers that are
derived from observables implement this.

```js
const obj = OObject({
	nested: OObject(),
});

arr.observer.watch(event => {
	// this event listener will be invoked twice with similar events except that
	// one event will have a observable id of `obj`, and the other for
	// `obj.nested`.

	assert(event.id === obj.observer.id || event.id === obj.nested.observer.id);
});

obj.state = 1;
obj.nested.state = 1;

```

## createNetwork

Now that we know that we can get a list of events from an observable watcher,
and how we can identify the object we wish to mutate we can now create a system
to essentially "replay" these events in an entirely new state tree. This
state tree can live in the same javascript context or it can live be across the
internet if the events are serialized.

In order to apply events to a state tree, we need to create an index of all
ids that are relevant to a transaction. We can't replay events if we're having
trouble finding the things to mutate after all. `createNetwork` allows us to
construct this index.

```js
const obj = OObject();
const network = createNetwork(obj.observer);
```

A network here is essentially just a giant hash map associating each id in the
state tree with its actual observable object. In fact, this network extends
the functionally of `UUID.Map`!
```js
assert(network.get(obj.observer.id) === obj);
```

This network will automatically be updated as the state tree updates.
```js
obj.nested = OObject();
assert(network.get(obj.nested.observer.id) === obj.nested);
```

Because neworks are dynamically changing depending on the observable it's based
on, it will leak resources if you keep it around without using it anymore. The
JavaScript GC will be confused in this case. Use the `remove` method to unregister
any ties it has to the state tree and the GC will be happy to clean it up now.
```js
network.remove();
```

Tying this all together we can maintain a seperate state tree that will always
have the same state as our original tree. We can use the `apply` convenience
method to apply a commit for us.

```js
// create a deep clone of the original state tree. Networks assume that the
// two state trees are initialized to be the same.
const duplicate = clone();

// we want to apply our state to the duplicate network, not the original network
// belonging to the object above or else we would try to apply deltas to itself.
// Observers are robust against this case (i.e. an error will be thrown) but it
// won't do what we want.
const dupNetwork = createNetwork(duplicate);

obj.observer.watchCommit(commit => {
	// networks require that both state trees be completely seperate in memory.
	// If an object was shared within memory, it would essentiall collapse parts
	// of the network to be one and the same and it would be functially equivelant
	// to trying to apply events to itself.
	const cloned = clone(commit);

	dupNetwork.apply(cloned);
});

obj.state = 2;

// the mutation will be replaceted on `duplicate`.
assert(duplicate.state === 2);
```

In many cases, it's important that we don't update the duplicate state tree as
the commits are created. This not only would not be correct as there are edge
cases with parts of state trees being momentarily detached but also this would
simply be too granular especially if the commits are being serialized to go over
the internet. Networks provide a `digest` function that will collect all events
that happen within a time period and squash them into a big commit when ready.

Note that the `digest` method is a property of a network and we can't simply
accumulate commits into some mega array to apply at a later time. Since commits
are guaranteed to have an unordered list of mutations, applying mutations to
the same element cannot happen within the same commit as those commits would
become position depentent.

`digest` is implemented optimally and will commit mutations the least amount
of mutations that are required to recreate the state at the other end.

In particular, observer networks are robust against multiple references. For
this implementaiton to be performant, it is built upon `createNetwork`.

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

## multiple references

Observable networks can deduplicate observables that are referenced multiple
times. This is important to keep observer networks handle state applications
even after the state has moved around the tree which can be common if multiple
parties are contributing to a central state tree.

Consider this:
```js
const obj = OObject();
const obj2 = OObject();

obj.reference1 = obj;
obj.reference2 = obj;
```

Both `reference1` and `reference2` are the same object. When mutating any
property from within any of these references, it's expected to see that the
changes are seen on both references. Networks handle this case by encoding
what objects already exist within a network and what references were just created.

```js
network.digest((commit, observerRefs) => {
	dupNetwork.apply(clone(commit, {observerRefs, observerNetwork: dupNetwork}));
})
```

Networks will automatically keep track of what references you need to serialize
new, and which ones you can reference again to be put onto different parts of
the tree. `observerRefs` is a callback where we can ask the question if we
knew about the observable before, or if it's new for this digest.

# Undo / Redo

Since network events specify what changed about a network these events can
be trivially stored and used later. `Event.prototype.invert` can be used
to invert events such that they cancel out their effects after the fact. Cloning
the events as you build the history is required for correct behiavior in
non trivial situations especially if you want to selectively revert some commits
but not others unlike in a strict undo/redo operation.

```js
const history = [];

network.digest((commit) => {
	history.push(clone(commit));
}, 0);

// ... state changes and the history is built

for (let i = history.length - 1; i >= 0; i++) {
	network.apply(history[i].map(delta => delta.inverse));
}

// all those changes are undone.
```

# Automatic flushing
Destam network digests don't require applications to automatically flush them.
Flushes can happen at any point in the application lifetime - even asynchronously.
For almost all applications, just scheduling a periodic flush during idle is enough
for a robust flushing mechanism:
```js
const network = createNetwork(stateTree);
const digest = network.digest(...);

setInterval(() => {
	digest.flush();
}, 1000);
```
However, this method is obviously naive. It will try to flush changes even
though nothing changed.

## Reactivity-aware flushing
We can be a little bit more precise about this by leveraging the core reactivity
model:
```js
stateTree.observer.throttle(1000).watch(() => {
	digest.flush();
});
```
With this method, now the network will only flush at most once a second and will
remain quiet if there are no changes occurring. This is helpful for real-time
collaboration.
```js
stateTree.observer.wait(1000).watch(() => {
	digest.flush();
});
```
This method will only flush if there is a period of inactivity for a second
second. Better for slower pace document editing software.

For a built in solution digest() accepts a timeout as a second paramater:
```js
network.digest(commit => {
	// flushes automatically with the same timing semantics as throttle.
}, 1000);
```
The built in approach benefits in two ways:
1. cleaning up is simpler: You only need to remember to remove the digest, not
the flush listener as well.
2. This is a little bit higher performance. Attaching listeners to objects are
not free. Everytime the state tree mutates, the listener has to explore those
mutations. Digest will reuse its existing event stream.
