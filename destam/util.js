export const isSymbol = val => typeof val == 'symbol';
export const isInstance = (inst, type) => inst instanceof type;
export const createClass = (constructor, addon = {}, extend) => {
	addon.constructor = constructor;
	constructor.prototype = extend ? Object.assign(extend, addon) : addon;
};
export const createInstance = (constructor, props) => Object.create(constructor.prototype, props);
export const isEqual = Object.is;
export const len = arr => arr.length;
export const push = (arr, val) => arr.push(val);
export const remove = (arr, item) => {
	const i = arr.indexOf(item);
	if (i >= 0) arr.splice(i, 1);
	return i >= 0;
};
export const createProxy = (init, props, set, deleteProperty, base, cons) => {
	return new Proxy(init, {
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
