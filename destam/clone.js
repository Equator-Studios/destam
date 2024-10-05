import {observerGetter} from './Observer.js';
import OObject from './Object.js';
import OArray from './Array.js';
import OMap from './UUIDMap.js';
import UUID from './UUID.js';
import * as Network from './Network.js';
import {Insert, Modify, Delete} from './Events.js';
import {registerElement} from './UUIDMap.js';
import {assert} from './util.js';

const wrap = (type, props) => {
	return {
		"OBJECT_TYPE": type,
		...props,
	};
}

const encodeEvent = (value, name, encodeValue) => {
	return wrap("observer_" + name, Object.fromEntries(encodeValue.map(name => {
		let val = value[name];

		if (name === 'time') {
			val = wrap('date', {date: +val});
		}

		return [name, val];
	})));
};

export const stringify = (state, options) => {
	const duplicates = new Set();

	return JSON.stringify(state, (key, value) => {
		if (value?.[observerGetter] && duplicates.has(value)) {
			return wrap('ref', {id: value[observerGetter].id});
		}

		duplicates.add(value);

		const getRef = (v, create) => {
			if (!options?.observerRefs || !options.observerRefs(v[observerGetter])) {
				return create();
			} else {
				return wrap("observer_ref", {id: v[observerGetter].id.toHex()});
			}
		};

		if (value instanceof UUID) {
			return wrap('uuid', {val: value.toString()});
		} else if (value instanceof OArray) {
			return getRef(value, () => {
				const reg = value[observerGetter];
				const indexes = reg.indexes_;
				const out = [];

				for (let i = 0; i < indexes.length; i++) {
					out.push( {
						ref: indexes[i].query_,
						val: value[i],
					});
				}

				return wrap("observer_array", {id: reg.id.toHex(), vals: out});
			});
		} else if (value instanceof OObject) {
			return getRef(value, () => {
				let reg = value[observerGetter];

				let out = [];
				for (const name of Object.keys(value)) {
					out.push({
						name,
						val: value[name],
					});
				}

				return wrap("observer_object", {id: reg.id.toHex(), vals: out});
			});
		} else if (value instanceof OMap) {
			return getRef(value, () => {
				let reg = value[observerGetter];
				let map = reg.user_;

				let out = [];
				for (let item of map.elements()) {
					out.push(item);
				}

				return wrap("observer_map", {id: reg.id.toHex(), vals: out});
			});
		} else if (value instanceof Insert) {
			return encodeEvent(value, "insert", ['id', 'value', 'ref', 'time']);
		} else if (value instanceof Modify) {
			return encodeEvent(value, "modify", ['id', 'value', 'ref', 'time']);
		} else if (value instanceof Delete) {
			return encodeEvent(value, "delete", ['id', 'ref', 'time']);
		} else {
			return value;
		}
	}, 2);
};

export const parse = (state, options) => {
	const refs = new Map();

	const constructors = {
		observer_array: OArray,
		observer_object: OObject,
		observer_map: OMap,
	};

	const walk = obj => {
		if (Array.isArray(obj)){
			obj.forEach(walk);
		} else if (typeof obj === 'object') {
			for (let o in obj) {
				if (o === 'OBJECT_TYPE') {
					if (obj.OBJECT_TYPE === 'observer_ref') {
						const obs = options?.observerNetwork?.get(UUID(obj.id));
						assert(obs, "Could not find referenced id: " + obj.id);

						refs.set(obj.id, obs);
					} else if (constructors[obj.OBJECT_TYPE]) {
						refs.set(obj.id, constructors[obj.OBJECT_TYPE](null, UUID(obj.id)));
					}

					continue;
				}

				walk(obj[o]);
			}
		}
	};

	walk(JSON.parse(state));

	return JSON.parse(state, (key, value) => {
		if (!(value && typeof value === 'object' && "OBJECT_TYPE" in value)) {
			return value;
		}

		if (value.OBJECT_TYPE === 'ref') {
			const obj = refs.get(value.id.toHex());
			assert(obj, "Could not find json ref: " + value.id.toHex());
			return obj;
		} else if (value.OBJECT_TYPE === 'observer_ref') {
			const obs = options?.observerNetwork?.get(UUID(value.id));
			assert(obs, "Could not find referenced id: " + value.id);

			return obs;
		} else if (value.OBJECT_TYPE === 'uuid') {
			return UUID(value.val);
		} else if (value.OBJECT_TYPE === 'observer_array') {
			const val = refs.get(value.id);
			const reg = val[observerGetter]
			const indexes = reg.indexes_;
			const init = reg.init_;

			for (const val of value.vals) {
				const ref = val.ref;

				const link = {reg_: reg, query_: ref};
				indexes.push(link);
				init.push(val.val);
				Network.link(link, val.val?.[observerGetter]);
			}

			refs.set(value.id, val);
			return val;
		} else if (value.OBJECT_TYPE === 'observer_object') {
			const val = refs.get(value.id);
			const reg = val[observerGetter];
			const nodes = reg.nodes_;
			const init = reg.init_;

			for (const val of value.vals) {
				const link = {reg_: reg, query_: val.name};
				Network.link(link, val.val?.[observerGetter]);
				init[val.name] = val.val;
				nodes.set(val.name, link);
			}

			refs.set(value.id, val);
			return val;
		} else if (value.OBJECT_TYPE === 'observer_map') {
			const val = refs.get(value.id);
			const reg = val[observerGetter];
			const map = reg.user_;

			for (const val of value.vals) {
				const link = {reg_: reg, user_: val, query_: val.id};

				registerElement(val, link);
				map.setElement(val);
				Network.link(link, val[observerGetter]);
			}

			refs.set(value.id, val);
			return val;
		} else if (value.OBJECT_TYPE === 'observer_insert') {
			const val = Insert();
			val.id = value.id;
			val.value = value.value;
			val.ref = value.ref;
			val.time = value.time;
			return val;
		} else if (value.OBJECT_TYPE === 'observer_modify') {
			const val = Modify();
			val.id = value.id;
			val.value = value.value;
			val.ref = value.ref;
			val.time = value.time;
			return val;
		} else if (value.OBJECT_TYPE === "date") {
			return new Date(value.date);
		} else {
			assert(value.OBJECT_TYPE === 'observer_delete', "unknown object type");
			const val = Delete();
			val.id = value.id;
			val.ref = value.ref;
			val.time = value.time;
			return val;
		}
	});
};

export const clone = (value, options) => {
	return parse(stringify(value, options), options);
}
