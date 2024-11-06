import {Synthetic} from './Events.js';
import {isSymbol, isInstance, isEqual, createInstance, len, remove, push, callAll, createClass, assert, noop, call, callListeners} from './util.js';
import {observerGetter} from './util.js';
export {observerGetter} from './util.js';

const immutableSetter = () => {
	assert(false, "Cannot set an immutable observer");
};

export const baseGovernorParent = Symbol();
export const fromPath = Symbol();
export const fromIgnore = Symbol();
export const getRef = Symbol();

const chainGov = (prev, next) => (info, child, entry) => {
	if (isSymbol(info)) info = [prev, info];
	let [gov, curInfo] = info;

	curInfo = gov(curInfo, child, entry);
	if (!curInfo) {
		return 0;
	}

	if (gov === prev && isSymbol(curInfo)) {
		gov = next;

		curInfo = gov(curInfo, child, entry);
		if (!curInfo) {
			return 0;
		}
	}

	return [gov, curInfo];
};

const pathGov = path => (info, child) => {
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

const registerMemo = (entry, obs, info) => {
	entry.parent_?.();
	if (!obs) return entry.parent_ = obs;

	if (!entry.user_) {
		entry.user_ = entry.governor_(...info);
	}

	entry.parent_ = obs?.register_(entry.listener_, entry.governor_, {
		link_: info[1], user_: entry.user_, parent_: info[2],
	});
};

export const shallowListener = (obs, listener) => {
	return obs.register_(listener, isSymbol);
};

export const watchGovernor = (info, child) => {
	// don't mask if we are inheriting frem a path
	if (info !== fromPath) {
		let str = child.query_;
		return typeof str !== 'string' || str[0] !== '_';
	}

	return true;
};

const listenerContext = () => {
	let processingListeners;

	return (listeners, commit, args) => {
		if (processingListeners) {
			call(processingListeners);
		}

		processingListeners = listeners.slice();
		processingListeners.args_ = args;
		processingListeners.event_ = commit();
		callListeners(processingListeners);

		processingListeners = 0;
	};
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
const Observer = createClass((get, set, register) => {
	let obj = createInstance(Observer);
	obj.get = get;
	if (set) obj.set = set;
	if (register) obj.register_ = register;

	return obj;
}, {
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
	 * If the transform produces the same value, deltas will not be produced.
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

		let cache;
		let parentListener;
		const listeners = [];
		const invokeListeners = listenerContext();

		return Observer(
			() => {
				if (len(listeners)) {
					return cache;
				} else {
					return forward(this.get());
				}
			},
			backward && (v => this.set(backward(v))),
			listener => {
				if (!parentListener) {
					parentListener = this.register_((commit, args) => {
						const value = forward(this.get());

						if (!isEqual(value, cache)) {
							invokeListeners(listeners, () => (cache = value, commit), args);
						}
					}, watchGovernor);
					cache = forward(this.get());
				}

				push(listeners, listener);

				return () => {
					if (remove(listeners, listener) && !len(listeners)) {
						parentListener();
						cache = parentListener = 0;
					}
				};
			},
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
		const get = type => {
			const val = this.get();
			if (isInstance(val, Observer)) {
				return type ? val.get() : val;
			}

			return type ? val : this;
		};

		return Observer(
			() => get(1),
			v => get().set(v),
			(listener, governor) => {
				let l;
				const update = () => {
					if (l) l();
					const listen = get();
					l = listen !== this && listen.register_(listener, governor);
				};

				const parent = this.register_((commit, args) => {
					update();
					listener(commit, args);
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
	 * Attaches a listener to this observer for lifetime events. When the first
	 * listener is attached to the observer (with .watch or .watchCommit) the
	 * callback will be invoked. The returned callback (if given) will be invoked
	 * once all watchers are subsequently removed.
	 *
	 * Params:
	 *   cb: Callback that will be invoked upon the first listener attachment
	 *
	 * Returns:
	 *   An observer that should be functionally identicle to the current one.
	 */
	lifetime (cb) {
		let cbRemove;
		let count = 0;

		return Observer(this.get, this.set, (...args) => {
			if (count === 0) {
				cbRemove = cb();
				assert(cbRemove == null || typeof cbRemove === 'function',
					'Lifetime listener must return a nullish value or a function');
			}
			count++;

			const remove = this.register_(...args);
			return () => {
				count--;
				assert(count >= 0);
				remove();

				if (cbRemove && count === 0) {
					cbRemove();
					cbRemove = 0;
				}
			};
		});
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
	 * Listens on the observer for to do side effects. This function is a helper
	 * on top of watchCommit to provide an API that is easier to work with for
	 * side effects that need a cleanup handler. The provided listener is called
	 * immediately with the current value of observer, as well as the listener
	 * being updated for any further mutations to the observer. The listener
	 * may return a callback that will be invoked when the effects handler
	 * has resources to clean up.
	 *
	 * Params:
	 *   listener: Called when the listener should setup its effects. The listener
	 *   can then return a callback that will be invoked upon cleanup.
	 *
	 * Returns: WatchedObserver
	 */
	effect (listener) {
		assert(typeof listener === 'function', 'effect must be called with a function');

		const get = this.get;
		const reg = this.register_(commit => {
			if (listenerContext) listenerContext();
			listenerContext = listener(get(), commit);
			assert(listenerContext == null || typeof listenerContext === 'function',
				'Effect listener must return a nullish value or a function');
		}, watchGovernor);

		let listenerContext = listener(get());
		assert(listenerContext == null || typeof listenerContext === 'function',
			'Effect listener must return a nullish value or a function');

		return WatchedObserver(get, this.set, this.register_, listener, () => {
			reg();
			if (listenerContext) listenerContext();
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
			(listener, governor) => this.register_(listener, (info, child, entry) => {
				if (isSymbol(info)) info = [0, info];
				if (info[0] > level) return 0;

				const currentVal = governor(info[1], child, entry);
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
			(listener, governor) => this.register_(listener, chainGov(info => {
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
			(listener, governor) => this.register_(listener, chainGov((info, child) => {
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
			(listener, governor) => this.register_(listener, (info, child, entry) => {
				if (isSymbol(info)) {
					info = paths.map(path => [chainGov(pathGov(path), governor), info]);
				}

				let ret = false;
				for (const [gov, childInfo] of info) {
					const value = gov(childInfo, child, entry);
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

		if (!len(path)) {
			return this;
		}

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
			(listener, governor) => this.register_(listener, chainGov((info, child) => {
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
	 * This optimizes a selection pattern to be O(1) instead of O(n) where n
	 * is the number of selectable items.
	 *
	 * Consider:
	 *   You have a list of items that you want to be selectable where you have
	 *   an observer that controls which item it currently selected. Let's assume
	 *   that we want to have a radio button selection for your favorite animal
	 *   A naiive approach would be to use map():
	 *
	 *   const selected = Observer.mutable(null);
	 *   createRadioButton(selected.map(sel => sel === 'dog'));
	 *   createRadioButton(selected.map(sel => sel === 'cat'));
	 *   createRadioButton(selected.map(sel => sel === 'guinea pig'));
	 *
	 *   In this approach, every time we update the selection, the map function
	 *   for all items will be invoked. This will run in O(n) time and invoke
	 *   all three map functions. Instead, let's use selector().
	 *
	 *   const selector = selected.selector();
	 *   createRadioButton(selector('dog'));
	 *   createRadioButton(selector('cat'));
	 *   createRadioButton(selector('guinea pig'));
	 *
	 *   Here, when we change the selection, selector() will only update the
	 *   last selected item and the new item to be selected. We have reduced the
	 *   amount of computations to at most two.
	 *
	 * Params:
	 *   selValue: The value to be used when the current selector is selected.
	 *     This is optional and defaults to true.
	 *   defValue: The value to be used when the current selector is unselected.
	 *     This is optional and defaults to false.
	 *
	 * Returns:
	 *   A function that takes the item to be compared to when deciding what
	 *   should be selected as its only parameter.
	 */
	selector (selValue = true, defValue = false) {
		const map = new Map();
		let prevSel = this.get();
		let selectionListener;
		const invokeListeners = listenerContext();

		return sel => Observer(
			() => isEqual(sel, this.get()) ? selValue : defValue,
			val => {
				assert(val === selValue);
				this.set(sel);
			},
			listener => {
				if (!selectionListener) selectionListener = shallowListener(this, (commit, args) => {
					const val = this.get();
					if (isEqual(val, prevSel)) return;

					invokeListeners(
						(map.get(prevSel) || []).concat(map.get(val) || []),
						() => (prevSel = val, commit), args);
				});

				let arr = map.get(sel);
				if (!arr) {
					map.set(sel, arr = [listener]);
				} else {
					push(arr, listener);
				}

				return () => {
					if ((
								(len(arr) === 1 && arr[0] === listener) ||
								(remove(arr, listener) && !len(arr))
							) && map.delete(sel) && map.size === 0) {
						selectionListener();
						selectionListener = 0;
					}
				};
			},
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
	 * Note that events will not be forwarded if the value that the observer
	 * resolves to the same value.
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
		const invokeListeners = listenerContext();

		let numListeners = 0;
		const create = (local, getAll) => Observer(
			() => {
				if (numListeners) {
					return value;
				}

				return this.get();
			},
			v => {
				if (numListeners && isEqual(v, value)) {
					return;
				}

				this.set(v);
			},
			(listener, governor) => {
				if (!numListeners) {
					parentListener = this.register_((commit, args) => {
						invokeListeners(getAll(), () => {
							value = this.get();
							return commit;
						}, args);
					}, (user, link, parent) => {
						if (isSymbol(user)) return info = [user, link, parent];

						const obs = link.reg_.value?.[observerGetter];
						for (const entry of getAll()) {
							registerMemo(entry, obs, info);
						}
					});

					value = this.get();
				}

				const entry = {
					listener_: listener,
					governor_: governor,
				};

				if (info) {
					registerMemo(entry, value?.[observerGetter], info);
				}

				push(local, entry);
				numListeners++;

				return () => {
					if (remove(local, entry)) {
						numListeners--;
						entry.parent_?.();

						if (!numListeners) {
							parentListener();
							parentListener = value = info = 0;
						}
					}
				};
			},
		);

		const listeners = [];
		if (!count) {
			return create(listeners, () => listeners);
		}

		return Array.from(Array(count), () => {
			const local = [];
			push(listeners, local);
			return create(local, () => listeners.flat());
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
							return waiting = 0;
						} else {
							clearInterval(timer);
							return timer = 0;
						}
					}, ms);
				}, governor);

				return () => {
					clearInterval(timer);
					if (waiting) {
						listener(waiting);
					}

					return remove();
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

const WatchedObserver = createClass((get, set, register, listener, remove) => {
	const o = createInstance(WatchedObserver);
	o.get = get;
	o.set = set;
	o.register_ = register;
	o.listener_ = listener;
	o.remove = remove;
	return o;
}, {
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
Observer.NULL = Observer(noop);

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
	const invokeListeners = listenerContext();

	return Observer(() => value, v => {
		if (isEqual(value, v)) return;
		invokeListeners(listeners, () => [Synthetic(value, value = v)]);
	}, l => {
		push(listeners, l);
		return () => remove(listeners, l);
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
	if (isInstance(deps, Observer)) {

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
	} else {
		return Observer(
			() => deps.map(obs => obs.get()),
			v => {
				assert(len(v) === len(deps), "Observer all set array length mismatch");

				for (let i = 0; i < len(deps); i++) {
					deps[i].set(v[i]);
				}
			},
			(listener, governor) => {
				const listeners = deps.map(obs => obs.register_(listener, governor));
				return () => callAll(listeners);
			}
		);
	}
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

		return () => clearInterval(interval);
	});
};

export default Observer;
