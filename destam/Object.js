import {Insert, Modify, Delete} from './Events.js';
import {observerGetter} from './Observer.js';
import {isEqual, createProxy, createClass} from './util.js';
import * as Network from './Network.js';

const OObject = createClass((init, id) => {
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

	return createProxy(init, reg, {},
		(_, prop, value) => {
			const prev = init[prop];

			if (typeof prop === 'symbol' || isEqual(prev, value)) {
				init[prop] = value;
				return true;
			}

			let link = nodes.get(prop);
			const events = [];

			if (link) {
				Network.linkApply(link, events, Modify, prev, value, prop, reg.id);
				Network.relink(link, value?.[observerGetter]);
			} else {
				link = Network.link({reg_: reg, query_: prop}, value?.[observerGetter]);
				Network.linkApply(link, events, Insert, undefined, value, prop, reg.id);

				nodes.set(prop, link);
			}

			init[prop] = value;
			Network.callListeners(events);
			return true;
		},
		Object, OObject, (_, prop) => {
			const prev = init[prop];
			delete init[prop];

			const link = nodes.get(prop);
			if (link) {
				let events;
				Network.linkApply(link, events = [], Delete, prev, undefined, prop, reg.id);

				Network.unlink(link);
				nodes.delete(prop);

				Network.callListeners(events);
			}

			return true;
		},
	);
});

export default OObject;
