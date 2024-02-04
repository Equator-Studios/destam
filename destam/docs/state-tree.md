# State trees

## State trees vs a store
State trees are destam's version of a store. Typically a store is an immutable data stucture where any modifications that happen happen on the root of store. In these cases, reactivity is easy because all you have to do is listen when the store changes since you know everything within the store is immutable. Unfortunately, immutability can be really slow and also combersome. State trees offer a way of grouping together state into a system that can react to mutations.

## Creating a state tree
State trees are not a special data structure with special considerations. State trees are just a bunch of observers. Observers are used to group together state into an object, but they can also be nested. A state tree represents the idea of all the state stored in observer and all observers that are nested to it.

```js
const stateTree = OObject({
	user: OObject({
		email: 'bill@example.com',
		name: 'bill',
	}),
	projects: OArray(),
});
```

In the example above, there is an observable object that has two children: one named `user` that is another observer with state about the user. The other named `projects` storing the user's projects. Because of this nesting, there is an implicit link created for all observables in the state tree and any listener attached to the `stateTree` object will respond to all mutations anywhere in the state tree. However, this only works if there is objects are nested directly without any middle man. Consider this:

```js
const state = OObject({
	user: {
		paymentInfo: OObject({
			creditCard: ...,
			expiry: ...,
		});
	},
});
```

The `user` is not an observable and so the implicit link is broken. Any mutation that happens in the payment information will not be seen in the root `state`.

## Governors

State trees can be arbitrarily complex and for performance it can be really important to make sure that listeners are only called when a mutation happens only within a specific portion of the state tree. Governors are created by calling functions on an observer derived from a observable.

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

Here, we attach a listener with governor that will make sure to only attach the listener for the user object. Any mutations that happen to projects will not be seen by this listener nor any additions to the base `stateTree` itself.

However, we could have done the same thing attaching the listener directly to the nested `user` observer:

```js
stateTree.user.observer.watch(() => {
	console.log("Something in the user has changed with a direct attach!");
});
```

But what's the difference? In the case of using the `path` governor, the path governor will also respond to events when the entire `user` observer has been switched out, since the second example directly attaches the listener, it has no way to know that the parent observer has changed.

```js
stateTree.user = OObject({
	email: 'bob@example.com',
	name: 'bob',
});
```

The first listener will be notified of this change, however the second listener will continue to listen to the original user object and essentially follow it around. Both are valid ways of programing and both listener types will have their uses.

## Chaining governors

Governors can be changed to create more complex decision trees as to what a listener should attach to.

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

In the example, we use the `skip` governer to skip a decision and basically look at everything because we have the array. Then once we are looking at individual items in the array, we will then invoke the `tree` governor to look at specifically the `state`.

## List of governors
- path
- shallow
- tree
- skip
- anyPath
- path
- ignore

Documentation for these governers can be found within the source code.
