import {Insert, Modify, Delete} from './Events.js';
import {observerGetter} from './Observer.js';
import {createInstance, isEqual} from './util.js';
import * as Network from './Network.js';
import UUID from './UUID.js';
import OObject from './Object.js';

export const linkGetter = Symbol('uuid_map_linkGetter');

// An element is bucketed under its own `id`, so changing that id has to move
// it. Watching from here catches the change wherever it comes from - a local
// assignment or an applied delta - and keeps the bucket and the link's query in
// step without the map emitting anything of its own, which is what lets both
// sides of a network re-key off the element's plain property delta.
const watchID = (link, element) => {
	unwatchID(link);

	const reg = link.reg_;
	let current = element.id;

	link.unwatchID_ = element.observer.path('id').watch(() => {
		const next = element.id;
		if (UUID.equal(current, next)) return;

		// the element already carries `next` by the time this runs, so a probe
		// that lands on it would otherwise read as a collision with itself
		const occupant = reg.user_.getElement(next);
		if (occupant && occupant !== element) {
			// the write has already landed and throwing will not unwind it, so
			// put it back before rejecting - otherwise the element is left
			// keyed under an id it no longer answers to and the bad id ships
			// downstream. Re-entry here is a no-op: `current` is unchanged.
			element.id = current;
			throw new Error("already populated: " + next);
		}

		// delete by identity: the element still sits in the bucket its old id
		// hashed to, but no longer answers to that id
		reg.user_.delete(current, spot => spot === element);
		Network.unlink(link);

		reg.user_.setElement(element);
		link.query_ = current = next;

		// which listeners want this link is decided from its query when the
		// link is made, so relink to have the governors recompute - otherwise a
		// path watcher stays pinned to the key the element used to have
		Network.link(link, element[observerGetter]);
	});
};

export const unwatchID = (link) => {
	link.unwatchID_?.();
	link.unwatchID_ = null;
};

export const registerElement = (element, link) => {
	Object.defineProperty(element, linkGetter, {
		enumerable: false,
		configurable: true,
		value: link,
	});

	watchID(link, element);
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
	reg.getProp_ = (_, prop) => map.getElement(prop);
	reg.setProp_ = (_, prop, value) => reg.value.setElement(value);

	return reg.value = createInstance(OMap, {
		observer: {
			get: () => reg
		},
		[observerGetter]: {
			get: () => reg
		},
		arr_: {
			get: () => map.arr_,
			enumerable: true,
		},
		mask_: {
			get: () => map.mask_,
			enumerable: true,
		},
		minAllocation_: {
			get: () => map.minAllocation_,
			enumerable: true,
		},
		size: {
			get: () => map.size,
			enumerable: true,
		},
	});
};

OMap.prototype = Object.assign(createInstance(UUID.Map), {
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
		if (!comp) comp = elem => UUID.equal(elem.id, id);

		const reg = this[observerGetter];

		let ret;
		const elem = reg.user_.delete(id, (elem, id) => {
			ret = comp(elem, id);
			return ret && elem;
		});

		if (elem) {
			const link = elem[linkGetter];
			unwatchID(link);
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
			unwatchID(link);

			Network.linkApply(link, events, Delete, elem, undefined, elem.id, reg.id);
			Network.unlink(link);
		}

		reg.user_.clear();
		Network.callListeners(events);
	},
});

export default OMap;
