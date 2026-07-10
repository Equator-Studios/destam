import Observer, {defaultGovernor} from './Observer.js';
import {createInstance, push, call, callListeners, createClass} from './util.js';

const createLinkEntry = (link, parent, governor_, user) => {
	let child = {
		link_: link,
		parent_: parent,
		user_: user,
		governor_,
		childNext_: parent.children_,
	};

	if (child.childNext_) child.childNext_.childPrev_ = child;
	parent.children_ = child;

	// attach this child to the link listeners
	child.next_ = link;
	child.prev_ = link.prev_;
	link.prev_ = child;
	child.prev_.next_ = child;

	return child;
};

const addListener = (reg, listener) => {
	const governor = listener.governor_;
	if (!reg) return;

	const existing = reg.listeners_.get(governor);
	if (existing) {
		// Record listener shadowing so that we can re-construct if we decide
		// to remove them later.
		listener.shadow_ = existing.shadow_;
		existing.shadow_ = listener;
		return;
	}

	reg.listeners_.set(governor, listener);

	for (let link = reg.linkNext_; link !== reg; link = link.linkNext_) {
		const user = governor.governor_(listener.user_, link, listener);
		if (user) {
			addListener(link.observer_, createLinkEntry(link, listener, governor, user));
		}
	}

	governor.add_?.(reg, listener);
};

const removeListener = (reg, listener) => {
	const governor = listener.governor_;
	let active = reg.listeners_.get(governor);

	if (active === listener) {
		// Walk children first — without removing listener from listeners_ yet.
		// Any cycle-shadow descendants will recursively re-enter
		// removeListener on the same reg, hit the else branch, and unlink
		// themselves from listener.shadow_ chain (mirror of addListener
		// visiting the reg twice for a cycle: once setting listener, once
		// creating the shadow).
		for (let entry = listener.children_; entry; entry = entry.childNext_) {
			entry.prev_.next_ = entry.next_;
			entry.next_.prev_ = entry.prev_;

			if (entry.link_.observer_) {
				removeListener(entry.link_.observer_, entry);
			}
		}

		reg.listeners_.delete(governor);
		if (listener.shadow_) addListener(reg, listener.shadow_);

		governor.remove_?.(reg, listener);
	} else {
		// The listener is somewhere in active's shadow chain — unlink it.
		// Reached either by explicit removal of a shadow (e.g. obj.y deleted
		// while obj.x still references the same observable) or by the
		// children walk above when listener is a cycle-shadow descendant.
		while (active.shadow_ !== listener) active = active.shadow_;
		active.shadow_ = listener.shadow_;
	}

	listener.shadow_ = null;
};

export const link = (link, observer, insert) => {
	link.observer_ = observer;
	link.next_ = link.prev_ = link;

	for (const reg of link.reg_.listeners_.values()) {
		const user = reg.governor_.governor_(reg.user_, link, reg);
		if (user) {
			addListener(observer, createLinkEntry(link, reg, reg.governor_, user));
		}
	}

	insert = insert ?? link.reg_;
	link.linkNext_ = insert;
	link.linkPrev_ = insert.linkPrev_;
	link.linkPrev_.linkNext_ = link;
	insert.linkPrev_ = link;

	return link;
};

export const relink = (link, newObserver) => {
	const oldObserver = link.observer_;
	if (oldObserver === newObserver) return;
	link.observer_ = newObserver;

	for (let entry = link.next_; entry !== link; entry = entry.next_) {
		if (oldObserver) {
			removeListener(oldObserver, entry);
		}

		entry.children_ = null;

		addListener(newObserver, entry);
	}
};

export const unlink = (link) => {
	link.linkPrev_.linkNext_ = link.linkNext_;
	link.linkNext_.linkPrev_ = link.linkPrev_;

	for (let entry = link.next_; entry !== link; entry = entry.next_) {
		if (entry.childPrev_) {
			entry.childPrev_.childNext_ = entry.childNext_;
		} else {
			entry.parent_.children_ = entry.childNext_;
		}
		if (entry.childNext_) entry.childNext_.childPrev_ = entry.childPrev_;

		if (link.observer_) {
			removeListener(link.observer_, entry);
		}
	}
};

let createID;
export const setIDConstructor = (cons) => {
	createID = cons;
};

export const createReg = createClass((constructor, id = createID?.()) => {
	const reg = createInstance(createReg);
	reg.id = id;
	reg.source_ = constructor;
	reg.listeners_ = new Map();

	reg.linkNext_ = reg.linkPrev_ = reg;

	return reg;
}, {
	get () { return this.value },
	register_ (listener_, governor_, options) {
		options = {
			user_: defaultGovernor,
			governor_: {
				listener_,
				governor_,
				add_: listener_.add_,
				remove_: listener_.remove_,
			},
			...options,
		};

		addListener(this, options);

		return () => {
			if (options) removeListener(this, options);
			options = 0;
		};
	}
}, createInstance(Observer));

export {call, callListeners};

let override;
export const linkApply = (link, events, deltaConstructor, ...args) => {
	if (override) events = override;

	for (let entry = link.next_; entry !== link; entry = entry.next_){
		const downstream = deltaConstructor(...args);
		const gov = entry.governor_;
		downstream.network_ = entry;
		downstream.time = downstream.time ?? events.time_ ?? (events.time_ = new Date());

		if (gov.events_ !== events) {
			if (gov.events_) {
				call(gov.events_);
			}

			push(gov.events_ = events, gov);
			gov.current_ = [];
		}

		push(gov.current_, downstream);
	}
};

export const atomic = (cb, args) => {
	let old = override;
	let events = override = [];

	try {
		cb();
	} finally {
		events.args_ = args;
		override = old;

		call(events);

		if (events.hasError_) throw events.error_;
	}
};
