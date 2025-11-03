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

		try {
			(cur.listener_ || cur)(events.event_ || cur.current_, events.args_);
		} catch (e) {
			events.error_ = e;
			events.hasError_ = 1;
		}

		cur.current_ = cur.events_ = null;
	}

	events.event_ = 0;
};

export const callListeners = (events, args) => {
	events.args_ = args;
	call(events);
	if (events.hasError_) throw events.error_;
};
