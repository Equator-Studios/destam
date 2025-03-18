import UUID from './UUID.js';
import Observer, {observerGetter, watchGovernor} from './Observer.js';
import * as Network from './Network.js';
import {Insert, Modify, Delete} from './Events.js';
import {createInstance, len, isEqual, callAll, isInstance, assert, createClass, remove} from './util.js';

import OObject from './Object.js';
import OArray, {indexCompare, indexPosition} from './Array.js';
import OMap, {registerElement, linkGetter} from './UUIDMap.js';

Network.setIDConstructor(UUID);

const cloneEvent = (event, prev) => {
	const e = createInstance(event.constructor);
	e.prev = prev;
	e.value = event.value;
	e.ref = event.ref;
	e.time = event.time;
	e.network_ = event.network_;
	e.id = event.id;
	return e;
};

OMap.verify = (reg, value) => {
	const map = reg.user_;

	if (isInstance(value, Insert)) {
		const element = value.value;

		if (map.has(element.id)) {
			throw new Error("already populated: " + element.id);
		}

		return {reg_: reg, user_: element, query_: element.id};
	} else {
		assert(isInstance(value, Delete) || isInstance(value, Modify), "unknown event type");

		const current = map.getElement(value.ref);
		if (!current) throw new Error("does not exist: " + value.ref);

		return current[linkGetter];
	}
};

OMap.apply = (reg, value, link, events) => {
	const map = reg.user_;

	if (isInstance(value, Insert)) {
		const element = value.value;

		registerElement(element, link);
		map.setElement(element);
		Network.link(link, element[observerGetter]);
		Network.linkApply(link, events, cloneEvent, value);
	} else if (isInstance(value, Modify)) {
		const current = link.user_;
		delete current[linkGetter];

		const element = value.value;
		Network.linkApply(link, events, cloneEvent, value, current);

		map.setElement(element);
		link.user_ = element;
		Network.relink(link, element[observerGetter]);
		registerElement(element, link);
	} else {
		const current = link.user_;
		delete current[linkGetter];

		Network.linkApply(link, events, cloneEvent, value, current);
		Network.unlink(link);

		const found = map.deleteElement(current);
		assert(found, "Tracking went into a bad state");
	}
};

OObject.verify = (reg, value) => {
	const link = reg.nodes_.get(value.ref);

	if (isInstance(value, Insert)) {
		if (link) {
			throw new Error("already populated: " + value.ref);
		}

		if (typeof value.ref !== 'string') {
			throw new Error("must be a string: " + value.ref);
		}

		return {reg_: reg, query_: value.ref};
	} else {
		assert(isInstance(value, Delete) || isInstance(value, Modify), "unknown event type");

		if (!link) throw new Error("does not exist: " + value.ref);
		return link;
	}
};

OObject.apply = (reg, value, link, events) => {
	const nodes = reg.nodes_;
	const init = reg.init_;

	if (isInstance(value, Insert)) {
		let prop = value.ref;

		nodes.set(prop, link);
		init[prop] = value.value;
		Network.link(link, value.value?.[observerGetter]);
		Network.linkApply(link, events, cloneEvent, value);
	} else if (isInstance(value, Modify)) {
		Network.linkApply(link, events, cloneEvent, value, init[link.query_]);
		init[link.query_] = value.value;
		Network.relink(link, value.value?.[observerGetter]);
	} else {
		Network.linkApply(link, events, cloneEvent, value, init[link.query_]);
		Network.unlink(link);

		nodes.delete(link.query_);
		delete init[link.query_];
	}
};

OArray.verify = (reg, value) => {
	const indexes = reg.indexes_;
	const ref = value.ref;
	const index = indexPosition(reg.value, ref);
	const link = indexes[index];

	if (isInstance(value, Insert)) {
		if (link && indexCompare(link.query_, ref) === 0) {
			throw new Error("already exists: " + ref);
		}

		return {reg_: reg, query_: ref};
	} else {
		assert(isInstance(value, Delete) || isInstance(value, Modify), "unknown event type");

		if (!link || indexCompare(link.query_, ref) !== 0) {
			throw new Error("does not exist: " + ref);
		}

		return link;
	}
};

OArray.apply = (reg, value, link, events) => {
	const init = reg.init_;
	const indexes = reg.indexes_;
	const index = indexPosition(reg.value, link.query_);

	if (isInstance(value, Insert)) {
		Network.link(link, value.value?.[observerGetter], indexes[index]);
		indexes.splice(index, 0, link);
		init.splice(index, 0, value.value);
		Network.linkApply(link, events, cloneEvent, value);
	} else if (isInstance(value, Modify)) {
		Network.linkApply(link, events, cloneEvent, value, init[index]);
		init[index] = value.value;
		Network.relink(link, value.value?.[observerGetter]);
	} else {
		Network.linkApply(link, events, cloneEvent, value, init[index]);
		Network.unlink(link);
		init.splice(index, 1);
		indexes.splice(index, 1);
	}
};

const unrefDummy = (dummy) => {
	dummy.refs_--;
	if (!dummy.refs_) {
		dummy.regPrev_.regNext_ = dummy.regNext_;
		dummy.regNext_.regPrev_ = dummy.regPrev_;
	}
};

/**
 * Creates a map of observable nodes inside the network. This is used for
 * generating and applying deltas.
 */
const Tracker = createClass(observer => {
	assert(isInstance(observer, Observer), "Paramater must be an observer");

	const network = createInstance(Tracker);
	network.arr_ = Array(64);
	network.mask_ = len(network.arr_) - 1;
	network.size = 0;
	network.eventListeners_ = [];

	const listener = (commit, args) => {
		for (const l of network.eventListeners_) l.commit_(commit, args);
	};

	const createElement = reg => ({
		id: reg.id,
		value: reg.value,
		reg,
		occurrences_: 1,
	});

	listener.add_ = (reg, parent) => {
		const prev = network.getElement(reg.id);
		if (!prev) {
			network.setElement(createElement(reg));

			for (const l of network.eventListeners_) l.add_(reg);
		} else {
			let current = prev;
			while (true) {
				if (current.reg === reg) {
					current.occurrences_++;
					break;
				}

				if (!current.next_) {
					current.next_ = createElement(reg);
					console.warn("Conflicting id in observer network: " + reg.id.toHex());
					break;
				}

				current = current.next_;
			}
		}
	};

	listener.remove_ = (reg, parent) => {
		const net = network.getElement(reg.id);

		let prev = null;
		let current = net;
		while (current.reg !== reg) {
			prev = current;
			current = current.next_;
		}

		if (--current.occurrences_ > 0) {
			// do nothing
		} else if (prev) {
			prev.next_ = current.next_;
		} else if (current.next_) {
			network.setElement(current.next_);
		} else {
			network.deleteElement(net);

			const refs = len(network.eventListeners_);
			if (refs){
				const dummy = {
					user_: 2,
					governor_: {
						listener_: listener,
						governor_: (info, child) => {
							if (!(info - 1)) return 0;

							const childInfo = parent.governor_.governor_(parent.user_, child);
							if (!childInfo) return 0;

							return 1;
						},
					},

					refs_: refs,
					regNext_: reg.regNext_,
					regPrev_: reg,
				};

				reg.regNext_.regPrev_ = dummy;
				reg.regNext_ = dummy;

				for (const l of network.eventListeners_) {
					l.remove_(reg, dummy);
				}
			}
		}
	};

	network.listener = observer.register_(listener, watchGovernor);

	return network;
}, {
	/**
	 * Combines events over a time period into a commit.
	 *
	 * Params:
	 *   callback: A callback to be called when a commit is constructed. The
	 *     callback is called with three arguments:
	 *       1. The commit
	 *       2. A callback to querify if this is a newly added observable.
	 *       3. A list of args that were sent as part of an apply operation.
	 *   time:
	 *     The mininum amount of time to wait between callback invocation.
	 *     If undefined is passed, the digest will run in passive mode: flush()
	 *     must be called manually to recieve a callback.
	 *   ignore: An optional callback to ignore changes from certain sources.
	 *     This is used to break infinite loops with events. See the args argument
	 *     of the apply() function.
	 */
	digest (callback, time, ignore = () => false) {
		let currentTimeout;

		let trackedChanges = new Map();
		const changes = new Map();
		const deleted = new Map();
		const dummies = [];

		// sync is not reentrant: Track previous invocations
		let syncPromise = Promise.resolve();

		const trackingReg = (trackedChanges, reg) => {
			return trackedChanges.get(reg) ?? this.has(reg.id);
		};

		const sync = () => syncPromise = syncPromise.then(() => {
			const deltas = [...changes.values()];
			changes.clear();
			deleted.clear();

			const regFunc = trackingReg.bind(undefined, trackedChanges);
			trackedChanges = new Map();

			for (const dummy of dummies) unrefDummy(dummy);
			dummies.length = 0;

			if (len(deltas)) return callback(deltas, regFunc);
		}).then(val => {
			currentTimeout = 0;
			if (time != null && changes.size) {
				currentTimeout = setTimeout(sync, time);
			}

			return val;
		});

		const flush = () => {
			if (currentTimeout) clearTimeout(currentTimeout);
			currentTimeout = 0;
			return sync();
		};

		const listener = {
			network: this,
			flush,
			remove: () => {
				if (remove(this.eventListeners_, listener)) {
					flush();
				}
			},
			add_: reg => {
				if (!this.isExternal_ || !ignore(this.externalArg_)) {
					trackedChanges.set(reg, false);
				}
			},
			remove_: (reg, dummy) => {
				if (this.isExternal_) {
					unrefDummy(dummy);
				} else {
					dummies.push(dummy);
				}

				trackedChanges.set(reg, true);
			},
			commit_: (commit, args) => {
				if (ignore(args)) {
					return;
				}

				for (let delta of commit) {
					const link = delta.network_.link_;
					if (!trackingReg(trackedChanges, link.reg_)) {
						continue;
					}

					let prev = changes.get(link);
					if (!prev) {
						const map = deleted.get(link.reg_);
						if (map) {
							let relink = map.get(delta.ref.toString());

							if (relink) {
								map.delete(delta.ref.toString());
								prev = changes.get(relink);
								changes.delete(relink);
							}
						}
					}

					if (isInstance(delta, Delete)) {
						let map = deleted.get(link.reg_);
						if (!map) {
							deleted.set(link.reg_, map = new Map());
						}

						map.set(delta.ref.toString(), link);
					}

					if (!prev) {
						changes.set(link, delta);
					} else if (isInstance(prev, Delete)) {
						if (isEqual(delta.value, prev.prev)) {
							changes.delete(link);
							delta = 0;
						} else {
							const mod = Modify(prev.prev, delta.value, delta.ref);
							mod.id = prev.id;
							mod.time = delta.time;
							changes.set(link, mod);
							delta = mod;
						}
					} else if (isInstance(delta, Delete)) {
						if (isInstance(prev, Insert)) {
							changes.delete(link);
							delta = 0;
		 				} else {
		 					delta = cloneEvent(delta, delta.prev);
		 					delta.prev = prev.prev;
		 					changes.set(link, delta);
		 				}
					} else {
	 					prev = cloneEvent(prev, prev.prev);
	 					prev.value = delta.value;
	 					prev.time = delta.time;
						if (isInstance(prev, Modify) && isEqual(prev.prev, prev.value)) {
							changes.delete(link);
							delta = 0;
						} else {
							changes.set(link, delta = prev);
						}
					}
				}

				if (time == null) {
					return;
				}

				if (!currentTimeout) {
					currentTimeout = setTimeout(sync, time);
					return;
				}
			},
		};

		this.eventListeners_.push(listener);
		return listener;
	},

	/**
	 * Applies a commit to the network. This apply is done atomically such that
	 * if one part of the commit cannot be applied, the whole thing is bailed.
	 * Since this offers an additional way to mutate the state tree, any watchers
	 * will be called in response to the apply.
	 *
	 * Params:
	 *   commit: A list of events representing the events to apply atomically.
	 *   args: An optional value that is passed to listeners. This can be used
	 *   to break infinite loops in recursive events.
	 */
	apply (commit, args) {
		assert(isInstance(commit, Array), "Commit must be an array");

		const events = [];

		const links = [];
		for (let i = 0; i < len(commit); i++) {
			const delta = commit[i];
			const reg = this.getElement(delta.id)?.reg;
			if (!reg) throw new Error(`unknown reg: ${delta.id.toHex()}`);

			const link = reg.source_.verify(reg, delta);

			// deltas that operate on the same link within the same commit are
			// dissallowed.
			if (links.includes(link)) {
				throw new Error("duplicate action");
			}

			links[i] = link;
		}

		this.isExternal_ = 1;
		this.externalArg_ = args;
		for (let i = 0; i < len(commit); i++) {
			const link = links[i];
			const reg = link.reg_;
			reg.source_.apply(reg, commit[i], link, events);
		}
		this.isExternal_ = 0;

		Network.callListeners(events, args);
	},

	/**
	 * Removes the network tracking. Since the network attaches itself to the
	 * state tree as a listener, the network can leak if it isn't manually
	 * removed. This must be called after a network is finished being used.
	 *
	 * Removing the entire network will also cause any digest listeners to be
	 * automatically cleaned up as well.
	 */
	remove () {
		for (const l of this.eventListeners_.slice()) l.remove();
		this.listener();

		assert(this.size === 0);
	},

	/**
	 * Shorthand to flush all digest listeners associated with this network.
	 */
	flush () {
		return Promise.all(this.eventListeners_.map(l => l.flush()));
	},
}, createInstance(UUID.Map));

export default Tracker;
