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

### `.skip()`
`.skip()` is basically a fancy way to force advancing the governor pointer. Like
with `.path()` instead of singling out a property, we basically don't care about
any individual thing and target everything. Consider an array we have in the
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

## Broken Chains
What if we are working with an observer that has multiple targets? Which element are we actually referencing? What will it return? Consider our observer again:
```js
observer.path('array').skip().path('name').get()
```
Will actually just throw an error. In debug builds, the assert "Cannot get a
broken observer chain" will be thrown. Since destam does not assume what you
actual want to happen with multiple targets, an error will be thrown. But destam
does not make it impossible to define application-specific behavior for this
observer to essentially fix the broken chain. In this case, it's probably
reasonably to have .get() return an array of all the names. Let's define this behavior
with `.map()`.

```js
observer.path('array').skip().path('name').map(() => {
	return state.array.map(element => element.name);
}).get() === ['item1', 'item2', 'item3']
```
`.map()` will basically know it's running on a broken chain and instead of crashing,
it will return `undefined` as the value. This is okay though, we can just
reference the state directly through the closure.

Let's consider a potential gotcha with this:
```js
observer.path('array').skip().map(() => {
	return state.array;
}).path('name').get() === undefined
```
Here, we try to repair the chain right after `.skip()`. The `.path()` won't function properly after the `.map()` because `.path()` will see an array and if you try to get the `name` property of an array reference you get undefined:
```js
[].name === undefined
```
Note that this will not drop performance. `.map()` basically is transparent to governors. Any governors that are defined after the map() will effect what .map() looks at. So the `.path('name')` will look past the .map() and make it only fire for `name` properties.

## `.tree()`
`.tree()` is one of those wildcard observers that might seem out of place, but can really demonstrate the power of governors in destam. `.tree()` is meant to track.

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
`{children: [], name: String }` nodes. That means `.get()` will break because of
a [broken chain](#broken-chains) but `.path()` can be composed on top of that to instead target the `name` of each node instead of the nodes themselves.
