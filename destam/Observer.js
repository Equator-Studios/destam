import {Synthetic} from './Events.js';
import {isSymbol, isInstance, isEqual, createInstance, len, remove, push, callAll, createClass, assert, noop} from './util.js';
export const observerGetter = Symbol();

const immutableSetter = () => {
	assert(false, "Cannot set an immutable observer");
};

/**
 * Constructor for observer objects. See Observer.mutable for a full
 * implementation.
 *
 * Params:
 *   get: The getter for the observer
 *   set: The setter for the observer
 *   register: A callback to register a listener for the observer
 */
const Observer = (get, set, register) => {
	let obj = createInstance(Observer);
	obj.get = get;
	if (set) obj.set = set;
	if (register) obj.register_ = register;

	return obj;
};

export const baseGovernorParent = Symbol();
export const fromPath = Symbol();
export const fromIgnore = Symbol();
export const getRef = Symbol();

const chainGov = (prev, next) => (child, info, entry) => {
	if (isSymbol(info)) info = [prev, info];
	let [gov, curInfo] = info;

	curInfo = gov(child, curInfo, entry);
	if (!curInfo) {
		return 0;
	}

	if (gov === prev && isSymbol(curInfo)) {
		gov = next;

		curInfo = gov(child, curInfo, entry);
		if (!curInfo) {
			return 0;
		}
	}

	return [gov, curInfo];
};

const pathGov = path => (child, info) => {
	if (info === fromPath || info === fromIgnore) return 1;
	if (isSymbol(info)) info = 1;

	if (child.query_ !== path[info - 1]) {
		return 0;
	} else if (info === len(path)) {
		return fromPath;
	} else {
		return info + 1;
	}
};

const getPath = (obs, path, off) => {
	let current = obs.get();

	for (let i = 0; i < len(path) - off && current; i++) {
		const getter = current[getRef];
		if (getter) {
			current = getter(path[i])[0];
		} else {
			current = current[path[i]];
		}
	}

	return current;
};

const setPath = (obs, path, value) => {
	const val = getPath(obs, path, 1);
	const getter = val[getRef];
	if (getter) {
		getter(path[len(path) - 1])[1](value);
	} else {
		val[path[len(path) - 1]] = value;
	}
};

export const shallowListener = (obs, listener) => {
	return obs.register_(listener, (child, info) => isSymbol(info));
};

export const watchGovernor = (child, parent) => {
	// don't mask if we are inheriting frem a path
	if (parent !== fromPath) {
		let str = child.query_;
		return typeof str !== 'string' || str[0] !== '_';
	}

	return true;
};

createClass(Observer, {
	register_: () => noop,
	set: immutableSetter,

	/**
	 * Returns a boolean of whether it's allowed to call the set method.
	 */
	isImmutable () {
		return this.set === immutableSetter;
	},

	/**
	 * Transforms the values of this observer based on the callback functions.
	 *
	 * Examples:
	 *   integer.map(i => i * 10, i => i / 10)
	 *
	 * Params:
	 *   forward: Transform used to get values from the newly created observer.
	 *   backward: Transform used to set values from the newly created observer.
	 */
	map (forward, backward) {
		assert(typeof forward === 'function', "Forward must be a function");
		assert(backward == null || typeof backward === 'function',
			"Backward must be a function or undefined");

		let cache, globalListener;
		const listeners = [];

		return Observer(
			() => {
				if (globalListener) {
					return cache;
				} else {
					return forward(this.get());
				}
			},
			backward && (v => this.set(backward(v))),
			(listener) => {
				if (!len(listeners)) {
					globalListener = this.register_(commit => {
						const val = forward(this.get(), cache, commit);
						if (!isEqual(val, cache)) {
							callAll(listeners, [Synthetic(cache, cache = val)]);
						}
					}, watchGovernor);

					cache = forward(this.get());
				}

				push(listeners, listener);

				return () => {
					if (remove(listeners, listener) && !len(listeners)) {
						globalListener();
						globalListener = 0;
					}
				};
			}
		);
	},

	/**
	 * Creates an observer that will resolve to value a nested observer might have.
	 * If this observer does not nest another observer, then unwrap() will return
	 * resolve to the value of this observer.
	 *
	 * Consider this:
	 *   const observer = Observer.mutable(Observer.mutable(10));
	 *
	 * Examples:
	 *   observer.unwrap() // resolves to 10
	 *
	 * Returns:
	 *  An observer
	 */
	unwrap () {
		const get = () => {
			const val = this.get();
			if (isInstance(val, Observer)) {
				return val;
			}

			return this;
		};

		return Observer(
			() => get().get(),
			v => get().set(v),
			(listener, governor) => {
				let l;
				const update = () => {
					if (l) l();
					const listen = get();
					l = listen !== this && listen.register_(listener, governor);
				};

				const parent = this.register_((commit, args) => {
					listener(commit, args);
					update();
				}, governor);
				update();

				return () => {
					parent();
					if (l) l();
				};
			},
		);
	},

	/**
	 * Defines access control. Essentially proxies mutations into the given
	 * callback.
	 *
	 * Params:
	 *   setter: Callback to process mutation request.
	 */
	setter (setter) {
		return Observer(this.get, value => setter(value, this.set), this.register_);
	},

	/**
	 * Watches the observer for mutations. Will ignore any observer paths that
	 * contain a name prefixed with an underscore (_). The order of deltas
	 * provided within a commit is undefined. Commit listeners are called in
	 * an undefined order. Mutation events are called synchronously after
	 * the mutation has been applied to the observer.
	 *
	 * Params:
	 *   listener: Called when this observer mutates.
	 *
	 * Returns: WatchedObserver
	 */
	watchCommit (listener) {
		assert(typeof listener === 'function', 'watchCommit must be called with a function');

		return WatchedObserver(this.get, this.set,
			this.register_, listener, this.register_(listener, watchGovernor));
	},

	/**
	 * Watches the observer for mutations. Will ignore any observer paths that
	 * contain a name prefixed with an underscore (_). If there are multiple
	 * listeners attached to an Observer, the order in which they are called
	 * is undefined.
	 *
	 * See Observer.prototype.watchCommit for more information.
	 *
	 * Params:
	 *   listener: Called when this observer mutates.
	 *
	 * Returns: WatchedObserver
	 */
	watch (listener) {
		assert(typeof listener === 'function', 'watch must be called with a function');

		return this.watchCommit((commit, network, args) => {
			for (let i = 0; i < len(commit); i++) listener(commit[i], network, args);
		});
	},

	/**
	 * Returns a promise that resolves when the observer mutates into a value
	 * that satisfies the given callback.
	 *
	 * Params:
	 *   isTrue: Callback to decide if the promise should be resolved. If undefined
	 *   is provided as the callback, a callback that checks if the value is not
	 *   null or undefined is assumed.
	 */
	defined (isTrue = val => val != null) {
		return new Promise(ok => {
			const check = () => {
				const val = this.get();
				const done = isTrue(val);
				if (done) ok(val);
				return done;
			};

			if (check()) return;

			const watcher = shallowListener(this, () => {
				if (check()) {
					watcher();
				}
			});
		});
	},

	/**
	 * Defines a depth to how far listeners should listen for in a state tree.
	 * If a depth of 0 is chosen, this observer will not notify watchers for when
	 * nested values change.
	 *
	 * Params:
	 *  level: Depth to search. 0 is the default.
	 */
	shallow (level = 0) {
		return Observer(
			this.get,
			this.set,
			(listener, governor) => this.register_(listener, (child, info, entry) => {
				if (isSymbol(info)) info = [0, info];
				if (info[0] > level) return 0;

				const currentVal = governor(child, info[1], entry);
				if (!currentVal) return 0;

				return [info[0] + 1, currentVal];
			})
		);
	},

	/**
	 * Defines how many levels of nesting notify watchers will invoke for before
	 * additional checks are imposed. This can be useful for looking at a
	 * piece of state from an entire array.
	 *
	 * Suppose we have this state tree:
	 * OArray([
	 *   OObject({state: "state-1"}),
	 *   OObject({state: "state-2"})
	 * ])
	 *
	 * Example:
	 *   state_tree.observer.skip().path('state')
	 *
	 * Returns:
	 *   An observer.
	 */
	skip (level = 1) {
		assert(typeof level === 'number', "Level must be a number");

		return Observer(
			this.get,
			this.set,
			(listener, governor) => this.register_(listener, chainGov((child, info) => {
				if (info === fromPath || info === fromIgnore) return 1;
				if (isSymbol(info)) info = 1;

				if (info < level){
					return info + 1;
				}

				return fromPath;
			}, governor))
		);
	},

	/**
	 * Defines a tree like structure to follow for notify watchers. This can be
	 * used to watch state within an unbound number of nested states.
	 *
	 * Suppose we have this state tree:
	 * OObject({
	 *   state: "state-1",
	 *   children: OArray([
	 *     OObject({
	 *       state: "state-2",
	 *     }),
	 *     OObject({
	 *     	 state: "state-3",
	 *     	 children: OArray([
	 *     	   OObject({
	 *     	     state: "state-4"
	 *     	   })
	 *     	 ])
	 *     })
	 *   ])
	 * })
	 *
	 * Example:
	 *   state_tree.observer.tree('children').path('state')
	 *
	 * Params:
	 *   name: The name of the property that ends up with unbound nesting
	 *
	 * Returns:
	 *   An observer.
	 */
	tree (name) {
		return Observer(
			this.get,
			this.set,
			(listener, governor) => this.register_(listener, chainGov((child, info) => {
				if (info === fromPath || info === fromIgnore) return 1;
				if (isSymbol(info)) info = 1;

				if (info !== 1) {
					return 1;
				}

				if (child.query_ !== name) {
					return baseGovernorParent;
				}

				return 2;
			}, governor))
		);
	},

	/**
	 * Defines a series of paths that notify watchers will be called for.
	 *
	 * See Observer.prototype.path
	 *
	 * Examples:
	 *   object.observer.anyPath('num1', 'num2').map(nums => Math.max(...nums))
	 *   object.observer.anyPath(['nested', 'path'], ['a-different', 'nested-path'])
	 *
	 * Params:
	 *   ...paths: A list of paths to listen for events.
	 *
	 * Returns:
	 *   An observer
	 */
	anyPath (...paths) {
		assert(len(paths), "Observer anyPath must have at least one path");
		paths = paths.map(path => {
			if (!isInstance(path, Array)) {
				path = [path];
			}

			assert(len(path), "No path of an anyPath observer can be 0 length");

			return path;
		});

		return Observer(
			() => paths.map(path => getPath(this, path, 0)),
			value => {
				assert(len(value) === len(paths), "value and path lengths mismatch");

				for (let i = 0; i < len(paths); i++) {
					setPath(this, paths[i], value[i]);
				}
			},
			(listener, governor) => this.register_(listener, (child, info, entry) => {
				if (isSymbol(info)) {
					info = paths.map(path => [chainGov(pathGov(path), governor), info]);
				}

				let ret = false;
				for (const [gov, childInfo] of info) {
					const value = gov(child, childInfo, entry);
					if (value) {
						ret = ret || [];
						push(ret, [gov, value]);
					}
				}

				return ret;
			}),
		);
	},

	/**
	 * Defines a path that notify watchers will be called for.
	 *
	 * See Observer.prototype.anyPath to listen to multiple paths simultaneously.
	 *
	 * Suppose we have this state tree:
	 * OObject({
	 *   state: "state-1"
	 * 	 nested: OObject({
	 * 	   state: "state-2",
	 * 	 })
	 * })
	 *
	 * Examples:
	 *   object.observer.path('state')
	 *   object.observer.path(['state'])
	 *   object.observer.path(['nested', 'state'])
	 *
	 * Params:
	 *   path: the path to listen on. If the path is not an array, it will be
	 *     not inspect nested objects.
	 *
	 * Returns:
	 *   An observer that will only fire for events that happen through the given
	 *     path
	 */
	path (path) {
		if (!isInstance(path, Array)) path = [path];
		assert(len(path), "Observer path must have at least one path");

		return Observer(
			() => getPath(this, path, 0),
			value => setPath(this, path, value),
			(listener, governor) => this.register_(listener, chainGov(pathGov(path), governor)),
		);
	},

	/**
	 * Ignores mutation events that come from the given path. If a mutation event
	 * comes it through the ignored path, that mutation event will be ignored.
	 *
	 * Examples:
	 *   object.observer.path('not-my-problem')
	 *   object.observer.path(['not-my-problem'])
	 *   object.observer.path(['nested', 'not-my-problem'])
	 *
	 * Params:
	 *   path: the path to ignore events on. If not an array, the path will
	 *     be interpreted as a property to ignore
	 *
	 * Returns:
	 *   An observer that will only fire for events that happen through any
	 *     path but the given path
	 */
	ignore (path) {
		if (!isInstance(path, Array)) path = [path];
		assert(len(path), "Observer ignore must have at least one path");

		return Observer(
			this.get,
			this.set,
			(listener, governor) => this.register_(listener, chainGov((child, info) => {
				if (info === fromPath || info === fromIgnore) return 1;
				if (isSymbol(info)) info = 1;

				if (child.query_ !== path[info - 1]) {
					return fromIgnore;
				}

				if (info >= len(path)) {
					return 0;
				}

				return info + 1;
			}, governor))
		);
	},

	/**
	 * Defines a default value for if the observer resolves to undefined or null.
	 *
	 * Examples:
	 *   observer.def(10)
	 *   observer.def(Observer.mutable(10))
	 *
	 * Params:
	 *   def: The value to default to. This can be an observer so that the default
	 *     can mutate after the fact.
	 *
	 * Returns:
	 *   An observer which will default to the given value
	 */
	def (def) {
		if (!isInstance(def, Observer)) {
			return Observer(() => {
				return this.get() ?? def;
			}, this.set, this.register_);
		}

		return Observer(
			() => this.get() ?? def.get(),
			this.set,
			(listener, governor) => {
				const remove = this.register_(listener, governor);

				let defListener = 0;
				const listen = () => {
					if (defListener) defListener();
					defListener = this.get() == null && def.register_(listener, governor);
				};

				shallowListener(this, listen);
				listen();

				return () => {
					remove();
					if (defListener) defListener();
				};
			}
		);
	},

	/**
	 * Creates an observer that memoizes state and collapses all listeners down
	 * to one listener for the parent state. In the case where you may have many
	 * similar observer queries that only differ in the end, this can be used
	 * to reduce overhead of walking the tree everytime a new listener is
	 * attached.
	 *
	 * Additionally, a count can be passed to have the memo create a list of
	 * observers that all have a event order guarantee. If 2 is passed, an
	 * array of two observers will be generated where the first observer
	 * in the array will always have its listeners called before any listeners
	 * defined in the second observer in the array.
	 *
	 * Params:
	 *   count: The number of observers to create to create observers have
	 *     have an event order guarantee among them. If a falsy value is provided
	 *     (or none at all) then a single observer is returned.
	 *
	 * Returns:
	 *   An observer that has the same behavior when memo was not used at all,
	 *     but serves as a transparent performance optimization.
	 */
	memo (count) {
		assert(count == null || typeof count === 'number',
			"Count must be a number or undefined");

		let parentListener;
		let value;
		let info;

		const register = (entry, obs) => {
			entry.parent_?.();
			entry.parent_ = obs?.register_(entry.listener_, entry.governor_, {
				link_: info[0], user_: entry.user_, parent_: info[2],
			});
		};

		const listeners = [];
		const getAll = () => listeners.flat();

		const create = local => Observer(
			() => {
				if (len(getAll())) {
					return value;
				}

				return this.get();
			},
			v => {
				if (len(getAll()) && isEqual(v, value)) {
					return;
				}

				this.set(v);
			},
			(listener, governor) => {
				if (!len(getAll())) {
					value = this.get();

					parentListener = this.register_(commit => {
						value = this.get();

						for (const entry of getAll()) {
							entry.listener_(commit);
						}
					}, (link, user, parent) => {
						if (isSymbol(user)) {
							for (const entry of getAll()) {
								entry.user_ = entry.governor_(link, user, parent);
							}

							return info = [link, user, parent];
						}

						const obs = link.reg_.value?.[observerGetter];
						for (const entry of getAll()) {
							register(entry, obs);
						};

						return 0;
					});
				}

				const entry = {
					listener_: listener,
					governor_: governor,
				};

				const obs = value?.[observerGetter];
				if (info && obs) {
					entry.user_ = governor(...info);
					register(entry, obs);
				}

				push(local, entry);

				return () => {
					if (remove(local, entry)) {
						entry.parent_?.();

						if (!len(getAll())) {
							parentListener();
							parentListener = value = info = 0;
						}
					}
				};
			},
		);

		if (!count) {
			return create(listeners);
		}

		return Array.from(Array(count), () => {
			const local = [];
			push(listeners, local);
			return create(local);
		});
	},

	// Creates an observer that will only call listeners once during a given
	// time period. Only the latest commit will be passed to listeners.
	//
	// If there are any commits pending when the listener is removed, the listener
	// will be invoked with the pending commit right before removal.
	//
	// Params:
	//   ms - Milliseconds to wait before notifying listeners about another event
	throttle (ms) {
		return Observer(
			this.get,
			this.set,
			(listener, governor) => {
				let timer, waiting;

				const remove = this.register_(commit => {
					if (timer) {
						waiting = commit;
						return;
					}

					listener(commit);
					timer = setInterval(() => {
						if (waiting) {
							listener(waiting);
							waiting = 0;
						} else {
							clearInterval(timer);
							timer = 0;
						}
					}, ms);
				}, governor);

				return () => {
					clearInterval(timer);
					if (waiting) {
						listener(waiting);
					}

					remove();
				};
			}
		);
	},

	// Wait will only let data through if there were no changes to that data within a wait period
	wait (ms) {
		return Observer(
			this.get,
			this.set,
			(listener, governor) => {
				let timer, waiting;

				const remove = this.register_(commit => {
					waiting = commit;

					if (timer) {
						clearTimeout(timer);
					}

					timer = setTimeout(() => {
						listener(waiting);
						waiting = timer = 0;
					}, ms);
				}, governor);

				return () => {
					if (timer) clearTimeout(timer);
					if (waiting) listener(waiting);

					remove();
				};
			}
		);
	}
});

const WatchedObserver = (get, set, register, listener, remove) => {
	const o = createInstance(WatchedObserver);
	o.get = get;
	o.set = set;
	o.register_ = register;
	o.listener_ = listener;
	o.remove = remove;
	return o;
};

createClass(WatchedObserver, {
	/**
	 * Defines a callback for when this watcher is about to be removed.
	 * Subequent calls to remove will not trigger a duplicate call to the
	 * given callback.
	 *
	 * Params:
	 *   callback: A callback to be invoked when this watcher is removed.
	 */
	cleanup (callback) {
		let removed = 0;
		return WatchedObserver(
			this.get, this.set, this.register_, this.listener_,
			() => {
				if (removed) return;
				removed = 1;

				this.remove();
				callback();
			}
		);
	},

	/**
	 * Synthetically generates a modify event to the listener for this watcher.
	 */
	call () {
		this.listener_([Synthetic(undefined, this.get())]);
		return this;
	},
}, createInstance(Observer));

/**
 * Immutable observer that always resolves to null.
 */
Observer.NULL = Observer(() => null);

/**
 * Creates an observer wrapping the given value. Given an initial value,
 * the observer can mutate with a call to Observer.prototype.set.
 *
 * See Observer.immutable for a version that creates an immutable observer.
 *
 * Params:
 *   value: Initial value for the observer. If an observer is passed as the
 *   initial value, that observer is returned and no additional observer is
 *   constructed.
 */
Observer.mutable = value => {
	const listeners = [];

	return Observer(() => value, v => {
		if (!isEqual(value, v)) {
			callAll(listeners, [Synthetic(value, value = v)]);
		}
	}, (listener) => {
		push(listeners, listener);
		return () => remove(listeners, listener);
	});
};

/**
 * Creates an immutable observer given the initial value. Calls to
 * Observer.prototype.set will throw an error.
 *
 * See Observer.mutable for a version that creates a mutable observer.
 *
 * Params:
 *   value: Initial value for the observer. If an observer is passed as the
 *   initial value, then the immutable will inherit any value and mutations
 *   of the given observer, but itself will not be able to mutate it.
 */
Observer.immutable = (value) => {
	if (isInstance(value, Observer)){
		return Observer(value.get, null, value.register_);
	} else {
		return Observer(() => value);
	}
};

/**
 * Creates an observer that combines all given observers. This is useful when you
 * have a state that is depednent on many different states. The get() method
 * will return an array of resolved values for the given observers and set()
 * takes an array to set all given observers.
 *
 * Observer.all may also take an observable that resolves to an array. This can be
 * useful if the things you care about are only known at runtime.
 *
 * Examples:
 *   Observer.all([Observer.mutable('value1'), Observer.mutable('value2')]);
 * Example that takes a list of observers representing integers and sums them:
 *   Observer.all(integers).map(ints => ints.reduce((a, c) => a + c, 1));
 *
 * Params:
 *   deps: An array of observers or an observer that resolves to an array of observers
 */
Observer.all = deps => {
	deps = Observer.immutable(deps);

	return Observer(
		() => deps.get().map(obs => obs.get()),
		v => {
			const d = deps.get();
			assert(len(v) === len(d), "Observer all set array length mismatch");

			for (let i = 0; i < len(d); i++) {
				d[i].set(v[i]);
			}
		},
		(listener, governor) => {
			let listeners = [];
			const refresh = () => {
				callAll(listeners);
				listeners = deps.get().map(obs => obs.register_(listener, governor));
			};

			const parent = shallowListener(deps, (commit, args) => {
				refresh();
				listener(commit, args);
			});
			refresh();
			return () => {
				parent();
				callAll(listeners);
			};
		}
	);
};

// Creates an observer that updates when an event listener fires.
//
// Returns:
//   An observer that will keep up to date with latest events from an
//   event listener
Observer.event = (element, type, options) => {
	let value = null;
	return Observer(() => value, 0, (listener, governor) => {
		const cb = e => {
			listener([Synthetic(value, value = e)]);
		};

		element.addEventListener(type, cb, options);
		return () => element.removeEventListener(type, cb, options);
	});
};

// Creates an observer that updates on a timer. The timer will increment a
// integer every time it is triggered. If mulitiple things are listening to
// the timer, the timer will be registered multiple times and the integer
// will increment at arbitrary times. If this is not desirable, use
// Observer.prototype.memo
Observer.timer = (time) => {
	let i = 0;
	return Observer(() => i, 0, (listener, governor) => {
		const interval = setInterval(() => {
			listener([Synthetic(i, ++i)]);
		}, time);

		return () => {
			clearInterval(interval);
		};
	});
};

export default Observer;
