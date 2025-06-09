import {Synthetic} from './Events.js';
import {isInstance, isEqual, createInstance, len, remove, push, callAll, createClass, assert, noop, call, callListeners} from './util.js';
import {observerGetter} from './util.js';
export {observerGetter} from './util.js';

const immutableSetter = () => {
	assert(false, "Cannot set an immutable observer");
};

const brokenChain = () => {
	assert(false, "Cannot get a broken observer chain");
};

export const defaultGovernor = Symbol();
export const getRef = Symbol();

const chainGov = (prev, next) => (info, child, entry) => {
	let gov;
	if (info === defaultGovernor) {
		gov = prev;
	} else {
		gov = info.a;
		info = info.b;
	}

	info = gov(info, child, entry);
	if (!info) {
		return 0;
	}

	if (gov === prev && info === defaultGovernor) {
		gov = next;

		info = gov(info, child, entry);
		if (!info) {
			return 0;
		}
	}

	return {a: gov, b: info};
};

const andGov = (prev, next) => (info, child, entry) => {
	let parentInfo;
	if (info === defaultGovernor) {
		parentInfo = info;
	} else {
		parentInfo = info.b;
		info = info.a;
	}

	info = prev(info, child, entry);
	if (!info) {
		return 0;
	}

	parentInfo = next(parentInfo, child, entry);
	if (!parentInfo) {
		return 0;
	}

	return {a: info, b: parentInfo};
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

export const shallowListener = (obs, listener) => {
	return obs.register_(listener, noop);
};

export const watchGovernor = (info, child) => {
	let str = child.query_;
	return typeof str !== 'string' || str[0] !== '_';
};

const runListeners = (context, listeners, commit, args) => {
	let proc = context.processingListeners_;
	if (proc) call(proc);

	proc = listeners.slice();
	proc.args_ = args;
	proc.event_ = commit();
	callListeners(context.processingListeners_ = proc);
	context.processingListeners_ = 0;
};

const defGet = (self) => self.parent_.get();
const defSet = (self, v) => self.parent_.set(v);
const defRegister = (self, listener, governor) => self.parent_.register_(listener, governor);

const createImpl = (construct, get, set, register, unbreak) => {
	const proto = createInstance(Observer);
	if (get) proto.get = function () {
		return get(this);
	};
	if (set) proto.set = function (val) {
		return set(this, val);
	};
	proto.register_ = function (listener, governor, options) {
		return register(this, listener, governor, options);
	};

	return function (...stuff) {
		const instance = Object.create(proto);

		if (this) {
			instance.parent_ = this;

			if (this.set === immutableSetter && set === defSet) {
				instance.set = immutableSetter;
			}

			if (!unbreak && this.get === brokenChain) {
				instance.get = brokenChain;
			}
		}

		return construct?.(instance, ...stuff) || instance;
	};
};

const selectorRemove = (map, sel, listener) => {
	let cur = map.get(sel);
	if (cur === listener) {
		if (cur.next_) {
			map.set(sel, cur.next_);
		} else {
			map.delete(sel);

			if (map.size === 0) {
				map.selectionListener_();
				map.selectionListener_ = 0;
			}
		}
	} else while (cur?.next_) {
		if (cur.next_ === listener) {
			cur.next_ = cur.next_.next_;
			break;
		}

		cur = cur.next_;
	}
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
});

Object.assign(Observer.prototype, {
	constructor: Observer,
	register_: () => noop,
	get: brokenChain,
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
	 * If the parent is a broken chain, undefined is passed as the value in the
	 * forward function.
	 *
	 * Examples:
	 *   integer.map(i => i * 10, i => i / 10)
	 *
	 * Params:
	 *   forward: Transform used to get values from the newly created observer.
	 *   backward: Transform used to set values from the newly created observer.
	 */
	map: createImpl(
		(self, forward, backward) => {
			assert(typeof forward === 'function', "Forward must be a function");
			assert(backward == null || typeof backward === 'function',
				"Backward must be a function or undefined");

			self.forward_ = () => {
				let val;
				if (self.parent_.get !== brokenChain) {
					val = self.parent_.get();
				}

				return forward(val);
			};

			if (backward) {
				self.backward_ = backward;
			} else {
				self.set = immutableSetter;
			}
		},
		(self) => {
			const current = self.current_;
			if (!current) {
				return self.forward_();
			} else if (current.hasCache_) {
				return current.cache_;
			} else {
				current.hasCache_ = 1;
				return current.cache_ = self.forward_();
			}
		},
		(self, v) => {
			self.parent_.set(self.backward_(v));
		},
		(self, listener, governor) => {
			const cur = self.current_ = {};

			const unregister = self.parent_.register_((commit, args) => {
				const prev = self.current_;
				self.current_ = cur;
				try {
					const value = self.forward_();
					if (!cur.hasCache_ || !isEqual(value, cur.cache_)) {
						cur.cache_ = value;
						cur.hasCache_ = 1;
						listener(commit, args);
					}
				} finally {
					if (prev) self.current_ = prev;
				}
			}, governor);

			return () => {
				if (self.current_ === cur) self.current_ = 0;
				unregister();
			};
		},
		1
	),

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
	unwrap: createImpl(null,
		self => {
			const val = self.current_ ? self.current_.cache_ : self.parent_.get();
			if (isInstance(val, Observer)) {
				return val.get();
			}

			return val;
		},
		(self, v) => {
			const val = self.current_ ? self.current_.cache_ : self.parent_.get();
			if (isInstance(val, Observer)) {
				val.set(v);
			} else {
				self.parent_.set(v);
			}
		},
		(self, listener, governor) => {
			let l;
			const update = () => {
				if (l) l();
				const val = self.parent_.get();
				if (l = isInstance(val, Observer)) {
					l = val.register_((commit, args) => {
						const prev = self.current_;
						self.current_ = {cache_: val};
						try {
							listener(commit, args);
						} finally {
							self.current_ = prev;
						}
					}, governor);
				}
			};

			const parent = self.parent_.register_((commit, args) => {
				update();
				listener(commit, args);
			}, governor);
			update();

			return () => {
				parent();
				if (l) l();
			};
		}
	),

	/**
	 * Defines access control. Essentially proxies mutations into the given
	 * callback.
	 *
	 * Params:
	 *   setter: Callback to process mutation request.
	 */
	setter: createImpl(
		(self, setter) => {
			assert(typeof setter === 'function', "Setter must be a function");
			self.setter_ = setter;
		},
		defGet,
		(self, value) => self.setter_(value, self.parent_.set.bind(self.parent_)),
		defRegister,
	),

	/**
	 * Attaches a listener to this observer for lifetime events. When the first
	 * listener is attached to the observer (with .watch or .watchCommit) the
	 * callback will be invoked. The returned callback (if given) will be invoked
	 * once all watchers are subsequently removed.
	 *
	 * Params:
	 *   cb: Callback that will be invoked upon the first listener attachment. If
	 *   the callback attaches listeners, those listeners will be ignored for ref
	 *   counting.
	 *
	 * Returns:
	 *   An observer that should be functionally identicle to the current one.
	 */
	lifetime: createImpl(
		(self, cb) => {
			self.count_ = 0;
			self.forward_ = cb;
		},
		defGet, defSet,
		(self, listener, governor) => {
			if (self.reentrant_) {
				return self.parent_.register_(listener, governor);
			}

			if (self.count_ === 0) {
				self.reentrant_ = 1;
				try {
					self.remove_ = self.forward_();
				} finally {
					self.reentrant_ = 0;
				}
				assert(self.remove_ == null || typeof self.remove_ === 'function',
					'Lifetime listener must return a nullish value or a function');
			}

			self.count_++;
			const remove = self.parent_.register_(listener, governor);
			return () => {
				self.count_--;
				assert(self.count_ >= 0);
				remove();

				if (self.remove_ && self.count_ === 0) {
					self.remove_();
					self.remove_ = 0;
				}
			};
		}
	),

	/**
	 * Defines a depth to how far listeners should listen for in a state tree.
	 * If a depth of 0 is chosen, this observer will not notify watchers for when
	 * nested values change.
	 *
	 * Params:
	 *  level: Depth to search. 0 is the default.
	 */
	shallow: createImpl(
		(self, level = 0) => {
			self.level_ = level;
		},
		defGet, defSet,
		(self, listener, governor) => self.parent_.register_(listener, andGov(info => {
			if (info === defaultGovernor) info = self.level_ + 1;
			return info - 1;
		}, governor))
	),

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
	skip: createImpl(
		(self, level = 1) => {
			self.level_ = level;
		},
		0, 0,
		(self, listener, governor) => self.parent_.register_(listener, chainGov(info => {
			if (info === defaultGovernor) info = self.level_ + 1;
			return info - 1 || defaultGovernor;
		}, governor))
	),

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
	tree: createImpl(
		(self, name) => {
			self.name_ = name;
		},
		0, 0,
		(self, listener, governor) => self.parent_.register_(listener, chainGov((info, child) => {
			if (info === defaultGovernor) info = 1;

			if (info !== 1) {
				return 1;
			}

			if (child.query_ !== self.name_) {
				return defaultGovernor;
			}

			return 2;
		}, governor))
	),

	/**
	 * Defines a path that notify watchers will be called for.
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
	path: createImpl(
		(self, path) => {
			if (!isInstance(path, Array)) path = [path];

			if (!len(path)) {
				return self.parent_;
			}

			self.path_ = path;
		},
		(self) => getPath(self.parent_, self.path_, 0),
		(self, value) => {
			const val = getPath(self.parent_, self.path_, 1);
			const getter = val[getRef];
			const last = self.path_[len(self.path_) - 1];
			if (getter) {
				getter(last)[1](value);
			} else {
				val[last] = value;
			}
		},
		(self, listener, governor) => self.parent_.register_
			(listener, chainGov((info, child) => {
				if (info === defaultGovernor) info = 1;

				if (info > len(self.path_)) {
					return defaultGovernor;
				} else if (child.query_ !== self.path_[info - 1]) {
					return 0;
				} else {
					return info + 1;
				}
			}, governor)),
	),

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
	ignore: createImpl(
		(self, path) => {
			if (!isInstance(path, Array)) path = [path];
			assert(len(path), "Observer ignore must have at least one path");
			self.path_ = path;
		},
		defGet, defSet,
		(self, listener, governor) => self.parent_.register_(listener, andGov((info, child) => {
			if (info === defaultGovernor) info = 1;

			if (child.query_ !== self.path_[info - 1]) {
				return -1;
			}

			if (info >= len(self.path_)) {
				return 0;
			} else {
				return info + 1;
			}
		}, governor))
	),

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
	 *
	 * This would be identical to writing something like:
	 *   this.map(val => val == null ? def : Observer.immutable(val)).unwrap()
	 */
	def: createImpl(
		(self, def) => {
			self.def_ = def;
			self.dyn_ = isInstance(def, Observer);
		},
		(self) => self.parent_.get() ?? (self.dyn_ ? self.def_.get() : self.def_),
		defSet,
		(self, listener, governor) => {
			const remove = self.parent_.register_(listener, governor);
			if (!self.dyn_) return remove;

			let defListener = 0;
			const listen = () => {
				if (defListener) defListener();
				defListener =
					self.parent_.get() == null &&
					self.def_.register_(listener, governor);
			};

			shallowListener(self.parent_, listen);
			listen();

			return () => {
				remove();
				if (defListener) defListener();
			};
		}
	),

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
	selector: createImpl(
		(self, selValue = true, defValue = false) => {
			self.selValue_ = selValue;
			self.defValue_ = defValue;
			self.map_ = new Map();
			self.map_.prev_ = self.parent_.get();

			return sel => {
				let ret = Object.create(self);
				ret.sel_ = sel;
				return ret;
			};
		},
		(self) => isEqual(self.sel_, self.parent_.get()) ? self.selValue_ : self.defValue_,
		(self, val) => {
			assert(val === self.sel_);
			self.parent_.set(val);
		},
		(self, listener) => {
			const map = self.map_;
			const sel = self.sel_;

			if (!map.selectionListener_) map.selectionListener_ = shallowListener(self.parent_, (commit, args) => {
				const val = self.parent_.get();
				if (isEqual(val, map.prev_)) return;

				const listeners = [];
				let cur = map.get(map.prev_);
				while (cur) {
					push(listeners, cur.listener_);
					cur = cur.next_;
				}

				cur = map.get(val);
				while (cur) {
					push(listeners, cur.listener_);
					cur = cur.next_;
				}

				runListeners(map, listeners, () => (map.prev_ = val, commit), args);
			});

			listener = {
				next_: map.get(sel),
				listener_: listener,
			};
			map.set(sel, listener);

			return selectorRemove.bind(null, map, sel, listener);
		},
	),

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
	memo: createImpl(
		(self, count) => {
			assert(count == null || typeof count === 'number',
				"Count must be a number or undefined");

			self.numListeners_ = 0;
			self.base_ = self;
			const create = local => {
				const ret = Object.create(self);
				ret.local_ = local;
				return ret;
			};

			const listeners = self.listeners_ = [];
			self.flat_ = !count;
			if (!count) {
				return create(listeners);
			}

			return Array.from(Array(count), () => {
				const local = [];
				push(listeners, local);
				return create(local);
			});
		},
		(self) => {
			if (self.base_.numListeners_) {
				return self.base_.value_;
			}

			return self.parent_.get();
		},
		(self, v) => {
			if (self.base_.numListeners_ && isEqual(v, self.base_.value_)) {
				return;
			}

			self.parent_.set(v);
		},
		(self, listener, governor) => {
			const base = self.base_;

			if (!base.numListeners_) {
				base.parentListener_ = self.parent_.register_((commit, args) => {
					runListeners(base, self.flat_ ? self.listeners_ : self.listeners_.flat(), () => {
						base.value_ = self.parent_.get();
						return commit;
					}, args);
				}, (user, link, entry) => {
					base.info_ = {user_: user, link_: entry.link_, parent_: entry.parent_};

					const obs = base.value_?.[observerGetter];
					for (const entry of self.flat_ ? self.listeners_ : self.listeners_.flat()) {
						entry.parent_?.();
						entry.parent_ = obs?.register_(entry.listener_, entry.governor_, base.info_);
					}
				});

				base.value_ = self.parent_.get();
			}

			const entry = {
				listener_: listener,
				governor_: governor,
			};

			entry.parent_ = base.value_?.[observerGetter]?.register_(listener, governor, base.info_);
			push(self.local_, entry);
			base.numListeners_++;

			return () => {
				if (remove(self.local_, entry)) {
					base.numListeners_--;
					entry.parent_?.();

					if (!base.numListeners_) {
						base.parentListener_();
						base.parentListener_ = base.value_ = base.info_ = 0;
					}
				}
			};
		},
	),

	// Creates an observer that will only call listeners once during a given
	// time period. Only the latest commit will be passed to listeners.
	//
	// If there are any commits pending when the listener is removed, the listener
	// will be invoked with the pending commit right before removal.
	//
	// Params:
	//   ms - Milliseconds to wait before notifying listeners about another event
	throttle: createImpl(
		(self, ms) => {
			self.ms_ = ms;
		},
		defGet, defSet,
		(self, listener, governor) => {
			let timer, waiting;

			const remove = self.parent_.register_(commit => {
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
				}, self.ms_);
			}, governor);

			return () => {
				clearInterval(timer);
				if (waiting) {
					listener(waiting);
				}

				return remove();
			};
		}
	),

	// Wait will only let data through if there were no changes to that data within a wait period
	wait: createImpl(
		(self, ms) => {
			self.ms_ = ms;
		},
		defGet, defSet,
		(self, listener, governor) => {
			let timer, waiting;

			const remove = self.parent_.register_(commit => {
				waiting = commit;

				if (timer) {
					clearTimeout(timer);
				}

				timer = setTimeout(() => {
					listener(waiting);
					waiting = timer = 0;
				}, self.ms_);
			}, governor);

			return () => {
				if (timer) clearTimeout(timer);
				if (waiting) listener(waiting);

				remove();
			};
		}
	),

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
	 * Returns: Removal callback. Call to remove the watch.
	 */
	watchCommit (listener) {
		assert(typeof listener === 'function', 'watchCommit must be called with a function');

		return this.register_(listener, watchGovernor);
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
	 * Returns: Removal callback. Call to remove the watch.
	 */
	watch (listener) {
		assert(typeof listener === 'function', 'watch must be called with a function');

		return this.register_((commit, network, args) => {
			for (let i = 0; i < len(commit); i++) listener(commit[i], network, args);
		}, watchGovernor);
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
	 * If the effect call cannot retrieve the current value because it is a
	 * broken chain then undefined will be passed as the value.
	 *
	 * Params:
	 *   listener: Called when the listener should setup its effects. The listener
	 *   can then return a callback that will be invoked upon cleanup.
	 *
	 * Returns: Removal callback. Call to remove the watch.
	 */
	effect (listener) {
		assert(typeof listener === 'function', 'effect must be called with a function');

		let listenerContext = 0;
		const call = (commit, meta) => {
			let val;
			if (this.get !== brokenChain) {
				val = this.get();
			}

			if (listenerContext) listenerContext();
			listenerContext = listener(val, commit, meta);
			assert(listenerContext == null || typeof listenerContext === 'function',
				'Effect listener must return a nullish value or a function');
		};

		const reg = shallowListener(this, call);
		call();

		return () => {
			reg();
			if (listenerContext) listenerContext();
		};
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
});

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
Observer.mutable = createImpl(
	(self, value) => {
		self.value_ = value;
		self.listeners_ = [];
	},
	(self) => self.value_,
	(self, v) => {
		if (isEqual(self.value_, v)) return;
		runListeners(self, self.listeners_, () => [Synthetic(self.value_, self.value_ = v)]);
	},
	(self, l) => {
		push(self.listeners_, l);
		return () => {
			remove(self.listeners_, l);
		};
	}
);

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
Observer.immutable = createImpl(
	(self, value) => {
		if (isInstance(value, Observer)){
			self.parent_ = value;
		} else {
			return Observer(() => value);
		}
	},
	defGet,
	0,
	defRegister
);

const allMutDeps = createImpl(null,
	self => self.deps_.get().map(obs => {
		if (obs.get === brokenChain) {
			return undefined;
		} else {
			return obs.get();
		}
	}),
	(self, v) => {
		const d = self.deps_.get();
		assert(len(v) === len(d), "Observer all set array length mismatch");

		for (let i = 0; i < len(d); i++) {
			d[i].set(v[i]);
		}
	},
	(self, listener, governor) => {
		let listeners = [];
		const refresh = () => {
			callAll(listeners);
			listeners = self.deps_.get().map(obs => obs.register_(listener, governor));
		};

		const parent = shallowListener(self.deps_, (commit, args) => {
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

const allImmDeps = createImpl(null,
	self => self.deps_.map(obs => {
		if (obs.get === brokenChain) {
			return undefined;
		} else {
			return obs.get();
		}
	}),
	(self, v) => {
		assert(len(v) === len(self.deps_), "Observer all set array length mismatch");

		for (let i = 0; i < len(self.deps_); i++) {
			self.deps_[i].set(v[i]);
		}
	},
	(self, listener, governor) => {
		const listeners = self.deps_.map(obs => obs.register_(listener, governor));
		return () => callAll(listeners);
	}
);

/**
 * Creates an observer that combines all given observers. This is useful when you
 * have a state that is depednent on many different states. The get() method
 * will return an array of resolved values for the given observers and set()
 * takes an array to set all given observers.
 *
 * Observer.all may also take an observable that resolves to an array. This can be
 * useful if the things you care about are only known at runtime.
 *
 * If any of the observers ends up benig a broken chain, undefined is used
 * as its place when getting its value.
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
	const out = isInstance(deps, Observer) ? allMutDeps() : allImmDeps();
	out.deps_ = deps;
	return out;
};

// Creates an observer that updates when an event listener fires.
//
// Returns:
//   An observer that will keep up to date with latest events from an
//   event listener
Observer.event = createImpl(
	(self, element, type, options) => {
		self.elem_ = element;
		self.type_ = type;
		self.options_ = options;
	},
	self => self.value_,
	0,
	(self, listener, governor) => {
		const cb = e => {
			listener([Synthetic(self.value_, self.value_ = e)]);
		};

		self.elem_.addEventListener(self.type_, cb, self.options_);
		return () => self.elem_.removeEventListener(self.type_, cb, self.options_);
	}
);

// Creates an observer that updates on a timer. The timer will increment a
// integer every time it is triggered. If mulitiple things are listening to
// the timer, the timer will be registered multiple times and the integer
// will increment at arbitrary times. If this is not desirable, use
// Observer.prototype.memo
Observer.timer = createImpl(
	(self, ms) => {
		self.ms_ = ms;
		self.value_ = 0;
	},
	self => self.value_,
	0,
	(self, listener, governor) => {
		const interval = setInterval(() => {
			listener([Synthetic(self.value_, ++self.value_)]);
		}, self.ms_);

		return () => clearInterval(interval);
	}
);

export default Observer;
