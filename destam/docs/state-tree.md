# State trees

## State trees vs. a store
State trees are destam's version of a store. Typically a store is an immutable data structure where modifications happen at the root. In that model, reactivity is easy: you only have to listen for changes to the root, because everything underneath is immutable. Unfortunately, immutability can be slow and cumbersome. State trees offer a way of grouping state into a system that can react to mutations without forcing everything to be replaced on every change.

## Creating a state tree
State trees aren't a special data structure with special rules. A state tree is just a collection of observables nested inside one another. An observable groups together state into an object, and those observables can be nested arbitrarily. A state tree is all the state stored in a root observable plus everything nested below it.

```js
const stateTree = OObject({
	user: OObject({
		email: 'bill@example.com',
		name: 'bill',
	}),
	projects: OArray(),
});
```

In this example, the root observable has two children: a `user` observable holding user state, and a `projects` observable holding the user's projects. Because of this nesting, an implicit link is created between all observables in the tree, and a listener attached to `stateTree` will respond to mutations anywhere within. This only works when observables are nested directly inside one another — a plain JS object in the middle breaks the link:

```js
const state = OObject({
	user: {
		paymentInfo: OObject({
			creditCard: ...,
			expiry: ...,
		}),
	},
});
```

`user` is a plain object, not an observable, so the implicit link is broken. Mutations to `paymentInfo` will not propagate up to listeners on `state`.

## Governors

State trees can get arbitrarily complex, and for performance it's important that listeners only fire when a mutation happens within the part of the tree they care about. Governors are created by calling chainable methods on an observer derived from an observable.

```js
const stateTree = OObject({
	user: OObject({
		email: 'bill@example.com',
		name: 'bill',
	}),
	projects: OArray(),
});

stateTree.observer.path("user").watch(() => {
	console.log("Something in the user has changed!");
});
```

Here we attach a listener with a `path` governor so it only fires for mutations under `user`. Changes to `projects`, or changes to top-level properties of `stateTree` itself, won't reach this listener.

We could have done something superficially similar by attaching the listener directly to the nested `user` observable:

```js
stateTree.user.observer.watch(() => {
	console.log("Something in the user has changed with a direct attach!");
});
```

The difference shows up when the entire `user` observer gets swapped out. The `path` governor stays anchored at `stateTree.observer.path("user")` — it follows whatever observable is currently at that path. The direct attach holds a reference to the *original* `user` observable, so it follows that object around even if it's reassigned to a different location, and stops firing if it's detached from the tree.

```js
stateTree.user = OObject({
	email: 'bob@example.com',
	name: 'bob',
});
```

The first listener is notified of this change (it sees the new `user`). The second listener stays attached to the original `user` object and keeps following it. Both behaviors are valid — pick whichever matches what you're actually trying to observe.

## Chaining governors

Governors can be chained to express more complex queries about what a listener should fire for.

```js
const tree = OArray([
	OObject({
		state: 0
	}),
	OObject({
		state: 1
	}),
]);

tree.observer.skip().path('state').watch(() => {
	console.log("One of the states has changed within the array");
});
```

Here, `skip()` says "I don't care which element of the array — look at all of them," and then `path('state')` narrows down to the `state` property within each element.

See [governors.md](governors.md) for more.
