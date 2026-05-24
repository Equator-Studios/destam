# Destam - Delta State Manager

A state management library that doesn't consider mutation as taboo and generalizes mutation events through deltas.

```js
const state = OObject({
	name: 'John Doe',
	address: 'Tokyo',
});

state.observer.path('address').watch(delta => {
	console.log(`${delta.parent.name}'s address changed to ${delta.value}`);
});

state.address = 'Toronto';
```

Destam provides no-nonsense state containers that act like ordinary JavaScript arrays and objects through a proxy interface. These containers reduce all state changes to an optimal series of deltas that can later be undone or replayed.

Deltas can be used to optimally:
 - Update the DOM to synchronize with the application's state
 - Send over the wire to synchronize with other computers
 - Implement realtime collaboration
 - Update the database

See [the introduction](docs/intro.md).

Documentation is split between multi-line comments in the source code (for specific function and feature documentation) and the markdown files in `docs/` (for high-level ideas). It's recommended to read everything under `docs/` before starting an application with destam.

## Breaking changes
Destam is still under development; breaking changes can and will be made while it stays on version 0. Major breaking changes with widespread effects aren't expected.
