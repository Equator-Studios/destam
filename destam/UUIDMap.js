import {Insert, Modify, Delete} from './Events.js';
import {observerGetter, getRef} from './Observer.js';
import {createInstance, isEqual} from './util.js';
import * as Network from './Network.js';
import UUID from './UUID.js';
import OObject from './Object.js';

export const linkGetter = Symbol('uuid_map_linkGetter');

export const registerElement = (element, link) => {
	Object.defineProperty(element, linkGetter, {
		enumerable: false,
		configurable: true,
		value: link,
	});
};

const OMap = (map, id) => {
	if (Array.isArray(map)) {
		map = UUID.Map(map);
	} else {
		map = map ?? UUID.Map();
	}

	const reg = Network.createReg(OMap, id);

	for (const element of map.elements()) {
		registerElement(element, Network.link({reg_: reg, user_: element, query_: element.id}, element[observerGetter]));
	}

	reg.user_ = map;

	return reg.value = createInstance(OMap, {
		observer: {
			get: () => reg
		},
		[getRef]: {
			get: () => ref => [map.getElement(ref), val => reg.value.setElement(val)],
		},
		[observerGetter]: {
			get: () => reg
		},
		arr_: {
			get: () => map.arr_,
		},
		mask_: {
			get: () => map.mask_,
		},
		size: {
			get: () => map.size,
		},
	});
};

OMap.prototype = Object.assign(createInstance(UUID.Map), {
	constructor: OMap,
	set (id, value) {
		return this.setElement(OObject({id, value}));
	},
	setElement (element) {
		const prev = this.getElement(element.id);
		const reg = this[observerGetter];
		const events = [];
		let link;

		if (prev) {
			if (isEqual(prev, element)) {
				return;
			}

			link = prev[linkGetter];
			delete prev[linkGetter];

			Network.linkApply(link, events, Modify, prev, element, element.id, reg.id);
			Network.relink(link, element[observerGetter]);
		} else {
			link = Network.link({reg_: reg, user_: element, query_: element.id}, element[observerGetter]);
			Network.linkApply(link, events, Insert, undefined, element, element.id, reg.id);
		}

		registerElement(element, link);
		reg.user_.setElement(element);

		Network.callListeners(events);
	},
	delete (id, comp) {
		if (!comp) comp = elem => UUID.compare(elem.id, id);

		const reg = this[observerGetter];

		let ret;
		const elem = reg.user_.delete(id, (elem, id) => {
			ret = comp(elem, id);
			return ret && elem;
		});

		if (elem) {
			const link = elem[linkGetter];
			delete elem[linkGetter];

			let events;
			Network.linkApply(link, events = [], Delete, elem, undefined, id, reg.id);
			Network.unlink(link);
			Network.callListeners(events);

			return ret;
		}

		return false;
	},
	clear () {
		const reg = this[observerGetter];

		let events = [];
		for (const elem of reg.user_.elements()) {
			const link = elem[linkGetter];

			Network.linkApply(link, events, Delete, elem, undefined, elem.id, reg.id);
			Network.unlink(link);
		}

		reg.user_.clear();
		Network.callListeners(events);
	},
});

export default OMap;
