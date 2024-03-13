import {Insert, Modify, Delete} from './Events.js';
import {observerGetter} from './Observer.js';
import {isSymbol, isEqual, createProxy, createClass} from './util.js';
import * as Network from './Network.js';

const OObject = (init, id) => {
	const nodes = new Map();
	const reg = Network.createReg(OObject, id);

	if (init) {
		for (let o of Object.getOwnPropertyNames(init)) {
			nodes.set(o, Network.link({reg_: reg, query_: o}, init[o]?.[observerGetter]));
		}
	} else {
		init = {};
	}

	reg.init_ = init;
	reg.nodes_ = nodes;

	const props = {
		observer: reg,
		[observerGetter]: reg,
	};

	return reg.value = createProxy(init, props,
		(_, prop, value) => {
			const prev = init[prop];

			if (isSymbol(prop) || isEqual(prev, value)) {
				init[prop] = value;
				return true;
			}

			let link = nodes.get(prop);
			let events;

			if (link) {
				Network.linkApply(link, () => Modify(prev, value, prop, reg.id), events = []);
				Network.relink(link, value?.[observerGetter]);
			} else {
				link = Network.link({reg_: reg, query_: prop}, value?.[observerGetter]);
				Network.linkApply(link, () => Insert(undefined, value, prop, reg.id), events = []);

				nodes.set(prop, link);
			}

			init[prop] = value;
			Network.callListeners(events);
			return true;
		},
		(_, prop) => {
			const prev = init[prop];
			let link = nodes.get(prop);
			delete init[prop];

			if (link) {
				let events;
				Network.linkApply(link, () => Delete(prev, undefined, prop, reg.id), events = []);

				Network.unlink(link);
				nodes.delete(prop);

				Network.callListeners(events);
			}

			return true;
		},
		Object, OObject
	);
};

createClass(OObject);
export default OObject;
