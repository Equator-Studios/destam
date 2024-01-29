# Observer

## Basic Usage

An observer is a wrapper around mutating state.\

Since they are just a box, let's see how we can create a box and extract state from it. Observers provide `get()`` that can be used to retrieve the state its holding.

```js
const observer = Observer.mutable("my state");

console.log(observer.get()) // prints "my state"
```

Observe how Observers provide a constructor for a state that can mutate. The `set()` method can be used to mutate the observer after the fact. If you're wondering, there also exists an immutable constructor.

```js
observer.set("my new state");

console.log(observer.get()) // prints "my new state"
```

We've just mutated the state inside of our Observer box. How can we listen to mutations that happen?

```js
observer.watch(() => {
    console.log(observer.get());
});

observer.set("my watched state"); // prints "my wached state"
```

Every observer provides a `watch()` function. These can be called with a single callback that will be invoked the moment state is changed.

## Transforms
Observers may wrap a piece of state that is incopatible with another piece of code.

## Event filters

Above, we only talked about the simplest kinds of observers: those that can only handle a single value changing and provide no mechanisms for watching specific elements inside the state. This is very useful when talking about observables that can create a directed graph of state. These functions below are meant to be used with observables as they are not supported with the use case above (nor does it make sense). They define ways to filter out data so that our watchers only get called for things we care about.

Since observables represent a tree of state that can have unlimited nesting, event watchers will get events for even nested events all along the state tree as long as the state tree is fully made of observable objects. Because state trees can get quite complex, it's important that we can filter out for changes to the state tree that we care about.

Here's an example with nested observables:
```js
const state = OObject({
	nested: OObject(),
});

state.observer.watch(state => {
	console.log(state.path());
});

// the watcher above will console.log ['foo']
state.foo = 'baz'

// the watcher above will console.log ['nested', 'bar']
state.nested.bar = 'baz';
```

There are functions that we can call onto an `observer` to limit our queries. Here are the important ones:
- `observer.path([path])`
   Suppose we have a nested value within our object graph, we can use `.path` to just respond to events on that nested object. An interesting property of `.path` is that we can actually respond to events that happened under a hidden property (remember that stuff with the prefixed `_`), just as long as your path is that hidden object itself.
- `observer.ignore([path])`
  `.ignore` will not fire events for a specified nested object. It takes the same arguments as `.path` but instead responds to the exact opposite events.
- `observer.shallow(<level>)`
  Sometimes, we are only interested in getting events on just the observable we attached the listener onto and not any of the nested children. This is possible with shallow only responding to events not too deep within the nested tree. The `level` parameter taking how far you want to respond to events with 0 meaning don't look at any nested objects. Will default to 0

We can chain these events like so:
 - `observer.path('hello').path('world')`
    This is just equivelant to `observer.path(['hello', 'world'])`
 - `observer.path('hello').ignore('world')`
   This will respond to events for the property `object.hello.foo = 'bar'` but will not respond to `object.hello.world = "I'm singled out!"` and of course will not respond to `object.help = "me"`
 - `observer.path('hello').shallow()`
   Will respond to `object.hello.foo = "bar"` but not `object.hello.nestedEvenMore.foo = "bar"`

`.watch` does have a return value with two properties that are important to know about:
 - `.remove()` - this will remove the listener, you should make sure to do this
to prevent memory leaks
 - `.call()` - this will forcefully call the `.watch` listener so that any logic implemented can respond to the current state, and not wait for the next time that state to change.

Note that multiple watchers can be added to the same observer and in this case,
the order in which these watchers will be called when a relevent change is made
is undefined. The watcher is guaranteed to be called at the time of the mutation
unless a nested observer mutation happens within a watcher.

```jsx
let object = OObject({
    nested: OObject()
});

object.observer.watch(state => {
    console.log(state.value) // should print 'value' - but this time the event came from the nested object.
    console.log(state.getParent() === object.nested) // state.getParent() will give us the object that generated the event so this statement should be true.
    console.log(state.getParent() !== object) // true
});

object.nested.property = 'value';

console.log(object.property) // prints 'value'
```

This simple level of pathing is enough to spetify most use cases. But what happens if we want to dynamically react to different paths and we can't pre-define them?

```jsx
let object = OObject({
    first: OObject(),
    second: OObject()
});

object.observer.watch(event => console.log(event.path()));

object.first.property = 'value'; // ['first', 'property'] will be printed.
object.second.property = 'value'; // ['second', 'property'] will be printed.
object.property = 'value'; // ['property'] will be printed.
```

The event value we get from watching an observable will let us query the path from the root object (passed in as the parameter) and where the event was actually fired. You can use this whenever you need to react to general events that could be anything, but you still need to know where they came from.

Lets finally look at a complete example:
```jsx
let object = OObject({
    first: OObject(),
    second: OObject()
});

let observer = object.observer;
observer.path('first').watch(event => console.log('A'));
observer.path('second').watch(event => console.log('B'));
observer.path('_hidden').watch(event => console.log('hidden event'));
observer.shallow().watch(event => console.log('C'));

observer.watch(event => console.log('will be called for everything'));

// 'A' will be printed as we changed something within the 'first' object.
// however, 'B' or 'C' won't be called.
object.first.property = 'value'

object.second.property = 'value' // 'B' will be called

// 'C' will be called
// this is a little bit more interesting as the 'shallow' filter is used for this.
// What it does is it denies events from any nested objects except for anything that happens to the root.
// .shallow() can also take an integer specifying how many levels of nesting we want to capture.
object.property = 'value'

// 'hidden event' will be called
// this will call the hook watching this path specifically
// but also bare in mind that this will not call the last listener (the
// one that says "will be called for everything") - it's lying to us!
object._hidden = 'this is hidden';
```
