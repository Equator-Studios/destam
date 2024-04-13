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
	} else if (isInstance(value, Modify)) {
		const element = value.value;
		const current = map.getElement(element.id);
		if (!current) throw new Error("does not exist");

		return current[linkGetter];
	} else {
		assert(isInstance(value, Delete), "unknown event type");

		const current = map.getElement(value.ref);
		if (!current) throw new Error("does not exist");

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
		Network.relink(link, element[observerGetter]);
		registerElement(element, link);
	} else {
		const current = link.user_;
		delete current[linkGetter];

		Network.linkApply(link, events, cloneEvent, value, current);
		Network.unlink(link);

		map.deleteElement(current);
	}
};

OObject.verify = (reg, value) => {
	const nodes = reg.nodes_;

	if (isInstance(value, Insert)) {
		let prop = value.ref;
		if (typeof prop !== 'string') {
			throw new Error("must be a string: " + prop);
		}

		let node = nodes.get(prop);
		if (node) {
			throw new Error("already populated: " + prop);
		}

		return {reg_: reg, query_: prop};
	} else if (isInstance(value, Modify)) {
		const link = nodes.get(value.ref);
		if (!link) throw new Error("does not exist");
		return link;
	} else {
		assert(isInstance(value, Delete), "unknown event type");

		const link = nodes.get(value.ref);
		if (!link) throw new Error("does not exist");
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
			throw new Error("already exists: " + ref.decimal_ + ' ' + ref);
		}

		return {reg_: reg, query_: ref};
	} else if (isInstance(value, Modify)) {
		if (!link || indexCompare(link.query_, ref) !== 0) {
			throw new Error("does not exist: " + ref.decimal_ + ' ' + ref);
		}

		return link;
	} else {
		assert(isInstance(value, Delete), "unknown event type");

		if (!link || indexCompare(link.query_, ref) !== 0) {
			throw new Error("does not exist: " + ref.decimal_ + ' ' + ref);
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

/**
 * Creates a map of observable nodes inside the network. This is used for
 * generating and applying deltas.
 */
const Tracker = observer => {
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

			if (len(network.eventListeners_)){
				const dummy = {
					user_: [parent.user_, 1],
					governor_: {
						listener_: listener,
						governor_: (child, info) => {
							if (!info[1]) return 0;
							let childInfo = parent.governor_.governor_(child, info[0]);
							if (!childInfo) return 0;
							return [childInfo, info[0] - 1];
						},
					},
				};

				dummy.regNext_ = reg.regNext_;
				reg.regNext_.regPrev_ = dummy;
				reg.regNext_ = dummy;
				dummy.regPrev_ = reg;

				let refs = len(network.eventListeners_);
				const deref = () => {
					refs--;

					if (refs === 0) {
						dummy.regPrev_.regNext_ = dummy.regNext_;
						dummy.regNext_.regPrev_ = dummy.regPrev_;
					}
				};

				for (const l of network.eventListeners_) {
					l.remove_(reg, deref);
				}

				return;
			}
		}
	};

	network.listener = observer.register_(listener, watchGovernor);

	return network;
};


createClass(Tracker, {
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
	 */
	digest (callback, time) {
		let currentTimeout;

		let trackedChanges = new Map();
		const changes = new Map();
		const deleted = new Map();
		const derefs = [];

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

			callAll(derefs);
			derefs.length = 0;

			if (len(deltas)) return callback(deltas, regFunc);
		}).then(() => {
			currentTimeout = 0;
			if (time != null && changes.size) {
				currentTimeout = setTimeout(sync, time);
			}
		});

		const flush = () => {
			if (currentTimeout) clearTimeout(currentTimeout);
			currentTimeout = 0;
			return sync();
		};

		const destroy = () => {
			if (remove(this.eventListeners_, listener)) {
				flush();
			}
		};

		const listener = {
			destroy_: destroy,
			add_: reg => {
				trackedChanges.set(reg, false);
			},
			remove_: (reg, deref) => {
				trackedChanges.set(reg, true);
				derefs.push(deref);
			},
			commit_: (commit, args) => {
				for (let delta of commit) {
					const link = delta.network_.link_;
					if (!trackingReg(trackedChanges, link.reg_)) {
						continue;
					}

					let prev = changes.get(link);
					if (!prev) {
						const map = deleted.get(link.reg_);
						if (map) {
							let relink = map.get(delta.ref);

							if (relink) {
								map.delete(delta.ref);
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

						map.set(delta.ref, link);
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

					if (delta) {
						delta.args = args;
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

		return {
			network: this,
			remove: destroy,
			flush: flush,
		};
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

		for (let i = 0; i < len(commit); i++) {
			const link = links[i];
			const reg = link.reg_;
			reg.source_.apply(reg, commit[i], link, events);
		}

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
		for (const l of this.eventListeners_.slice()) l.destroy_();
		this.listener();

		assert(this.size === 0);
	},
}, createInstance(UUID.Map));

export default Tracker;
