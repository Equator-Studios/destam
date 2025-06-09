# Observables

Observables in destam are objects that hold many different pieces of information
that can be then listened on to create an observer. The primary difference between
an observable and an observer is that an observer is supposed to track a piece
of information, while an observable holds information that can be tracked by an
observer.

## OObject
An OObject in destam is a proxy object that mimics a regular javascript objects.
Like javascript objects, you can assign variables to them using the dot operator
or square bracket indexing operators.
```js
const state = OObject({
	value1: 1,
	value2: 2,
});

// reset a value:
state.value1 = 2;
// or use brackets:
state["value1"] = 2;

// create a brand new value:
state.value3 = 3;

// delete a value:
delete value2;

// instanceof:
state instanceof OObject
```
This isn't anything different from a standard javascript object. This means that
you can use these objects in place of a standard javascript object and many
existing algorithms will continue to work without any major changes.

## OArray
Similarly, destam provides a built in array-like observable.
```js
const array = OArray([]);

array.push(1);
array.push(2);
array.push(3);
array.splice(0, 2);

array[0] === 3;

// peering in, the object appears to be an array
Array.isArray(array);

// instanceof works as expected.
array instanceof OArray
```
Like OObjects, an OArray mimics a base javascript primitive and they can be used
mostly interchangeably.

## Observers from Observables
Now that we created some observables, we can get an observer from them.
```js
const observer = state.observer;
```
Every observable in destam gives you an `observer` getter which will get the
observer representing the object. By default, this observer represents the entire
object.
```js
state.observer === state.observer;
```
Note that for every observable, there will be an observer singleton. Observers
derived from observable will always have the same memory reference.

```js
observer.get() === state; // true
```
Getting the value of the observer will just get you back the standard observable.
Note that you can't set these observers.
```js
// this will throw an error!
observer.set(myNewState);
```
Destam will not know how to magically update the observable reference you've created
within your own program state. Observers directly created from an observable are
immutable.
```js
observer.isImmutable() === true
```

## Narrowing down observers
Listening on an observer derived from a observable will give you any mutation that
happens on that observer. By default, observers capture everything.
```js
observer.watch(delta => {
	if (delta instanceof Insert) {
		console.log('Insert', delta.path);
	}

	if (delta instanceof Modify) {
		console.log('Modify', delta.path);
	}

	if (delta instanceof Delete) {
		console.log('Delete', delta.path);
	}
});

state.myValue = 1; // Insert: ["myValue"]
state.myValue = 2; // Modify: ["myValue"]
delete state.myValue; // Delete ["myValue"]

// this goes for any property on this object
state.myOtherProperty = 1; // Insert: ["myOtherProperty"]
```
### Recursive by default
Far more complex states can be created by simply attaching another observable to
an existing observable.

```js
state.myNestedObserver = OObject(); // Insert: ["myNestedObserver"]
state.myNestedObserver.value = 1; // Insert: ["myNestedObserver", "value"]
```
By building out observables by nesting them in this way, you create something
called a [state tree](state-tree.md). Check out the documentation for state trees
to find more information.

## Governors
To narrow down what we see we use something called a governor. These govern which
properties we care about.

### observer.prototype.path
path() is your best friend when it comes to narrowing down changes to only what you
want to listen to. For instance, if we only want to look for changes to myValue:
```js
observer.path('myValue').watch(delta => {
	console.log("myValue changed to: " + delta.value);
});

state.myValue = 1; // myValue changed to: 1
// note that combined with the listener above, it would also print:
// Insert ["myValue"]

// Note that the path the delta would report would be the same as the one without
// the path(). The path() is only there to narrow events, not change their behavior.
// delta.path === ["myValue"]

observer.path('myValue').set(2);
// Note that the observer returned from path() are mutable. Observers derived from
// an immutable observer aren't necessarily immutable themselves.

// The code above is equivelant to:
state.myValue = 2;
// both versions will call listeners just the same.
```

### observer.prototype.shallow
shallow() is another powerful tool that lets you tame those big state trees. Sometimes,
we aren't interested in listening to a change to an entire subtree, we just want to
see if one property changed.

First, let's see how we can use shallow() to disable destam's default recursive
behavior.

```js
observer.shallow(1).watch(() => {
	// will be called when a property changes for the state object, but none of
	// its descendants
})
```
Note that we have to provide shallow with an explicit depth here, we don't want
to just look at the base observer itself, we want to look one layer down to the
properties of the observer.
```js
observer.shallow().watch(() => {
	// will never be called
});

// the above listener will never be called when:
observer.isImmutable() === true
// this is true for any observer, even those not derived from an observable
```

### observer.prototype.ignore
path() acts as a whitelist, we specify which properties we care about. However,
we can use ignore() as a blacklist. This lets us ignore one property, while still
listening to events from all the others.
```js
observer.ignore("myValue").watch(() => {
	// will be called when any of the other properties change but the ignored value.
});

state.myValue = newValue; // ignored by the above listener
state.myOtherValue = 1; // the listener above will react to this.
```
Note that ignoring a property, all nested properties will be ignored too. Listener
recursion only works when all the parents are being listened on as well.

### Combining governors
Where it gets interesting is that we can combine governors:
```js
observer.path("myNestedObserver").shallow().watch(() => {
	// will be called when myNestedObserver changes itself, but none of its descendants.
});

state.myNestedObserver = OObject(); // our event listener is called
state.myNestedObserver.value = 1; // this will now invoke the above listener.
```

Note, that combining a path() with an ignore() doesn't do anything useful:
```js
// we're already only checking for 'myNestedObserver', doesn't matter if we
// explicitly ignore 'myValue'.
observer.ignore("myValue").path("myNestedObserver")

// however, if we ignore() and path() the same property, the observer will never
// fire. The ignore() in this sense takes precedence.
observer.ignore("myNestedObserver").path("myNestedObserver");

// Note that the order of these governors is significant. ignore() is special: it will not
// advance the governor pointer, it's simply there as an extra constraint. However,
// path() will advance the governor pointer.
observer.path("myNestedObserver").ignore("myNestedObserver");

state.myNestedObserver.myNestedObserver = OObject(); // the above observer will ignore this
state.myNestedObserver = OObject(); // however, it will not ignore this.
```
