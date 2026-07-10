export const observerGetter = Symbol();

export const isInstance = (inst, type) => inst instanceof type;

export const createClass = (constructor, addon = {}, extend) => {
	Object.defineProperty(addon, 'constructor', {value: constructor, writable: true});
	constructor.prototype = extend ? Object.assign(extend, addon) : addon;
	return constructor;
};

export const createInstance = (constructor, props) => Object.create(constructor.prototype, props);

export const isEqual = Object.is;

export const len = arr => arr.length;

export const push = (arr, val) => arr.push(val);

export const remove = (arr, item) => {
	const i = arr.lastIndexOf(item);
	if (i >= 0) arr.splice(i, 1);
	return i >= 0;
};

export const createProxy = (init, reg, props, set, base, cons, deleteProperty) => {
	reg.init_ = init;
	props.observer = props[observerGetter] = reg;

	return reg.value = new Proxy(init, {
		set, deleteProperty,
		get: (init, prop) => prop in props ? props[prop] : init[prop],
		getPrototypeOf: () => {
			const proto = Object.getPrototypeOf(init);
			if (proto === base.prototype) return cons.prototype;
			return proto;
		}
	});
};

export const callAll = (arr, arg) => {
	for (let func of arr) func(arg);
};

export const assert = (condition, error) => {
	if (process.env.NODE_ENV !== 'production' && !condition) {
		throw new Error(error);
	}
};

export const noop = () => {};

export const call = events => {
	for (events.index_ ||= 0; events.index_ < len(events);) {
		const cur = events[events.index_++];

		// Clear current_/events_ before invoking, not after: a reentrant
		// mutation of the same observable from within this very listener
		// call must see gov.events_ as stale (cleared) so linkApply gives it
		// a fresh current_ array and re-queues the governor onto `events`,
		// instead of appending to the array we already handed to the
		// listener (which would otherwise get silently dropped when this
		// call returns).
		const current = cur.current_;
		cur.current_ = cur.events_ = null;

		try {
			// A commit is a minimal per-link diff: delta order within it is
			// undefined, so a listener can never be asked to make sense of
			// two events for the same link in one commit (e.g. an Insert
			// immediately undone by a Delete).
			assert((() => {
				if (!current) return true;

				const seen = new Set();
				for (const delta of current) {
					if (seen.has(delta.network_.link_)) return false;
					seen.add(delta.network_.link_);
				}

				return true;
			})(), "a single commit cannot contain more than one event for the same link");

			(cur.listener_ || cur)(events.event_ || current, events.args_);
		} catch (e) {
			events.error_ = e;
			events.hasError_ = 1;
		}
	}

	events.event_ = 0;
};

export const callListeners = (events, args) => {
	events.args_ = args;
	call(events);
	if (events.hasError_) throw events.error_;
};
