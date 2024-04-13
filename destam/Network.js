import Observer, {baseGovernorParent} from './Observer.js';
import {createInstance, push, call, callListeners} from './util.js';

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

	if (!link.observer_) {
		child = 0;
	}

	// handle cycles
	for (let entry = child; child && entry.link_; entry = entry.parent_) {
		if (entry.link_.reg_ === link.observer_) {
			child.regNext_ = child.regPrev_ = child;
			child = 0;
		}
	}

	return child;
};

const addListener = (reg, parent) => {
	const governor = parent.governor_;

	parent.regNext_ = reg.regNext_;
	reg.regNext_.regPrev_ = parent;
	reg.regNext_ = parent;
	parent.regPrev_ = reg;

	for (let link = reg.linkNext_; link !== reg; link = link.linkNext_) {
		const user = governor.governor_(link, parent.user_, parent);
		if (user) {
			const child = createLinkEntry(link, parent, governor, user);
			if (child) addListener(link.observer_, child);
		}
	}

	if (governor.add_) {
		governor.add_(reg, parent);
	}
};

const removeListener = (reg, parent) => {
	parent.regPrev_.regNext_ = parent.regNext_;
	parent.regNext_.regPrev_ = parent.regPrev_;

	for (let entry = parent.children_; entry; entry = entry.childNext_ ) {
		entry.prev_.next_ = entry.next_;
		entry.next_.prev_ = entry.prev_;

		if (entry.link_.observer_) {
			removeListener(entry.link_.observer_, entry);
		}
	}

	const governor = parent.governor_;
	if (parent.regPrev_ !== parent && governor.remove_) {
		governor.remove_(reg, parent);
	}
};

export const link = (link, observer, insert) => {
	link.observer_ = observer;

	insert = insert ?? link.reg_;
	link.linkNext_ = insert;
	link.linkPrev_ = insert.linkPrev_;
	link.linkPrev_.linkNext_ = link;
	insert.linkPrev_ = link;

	link.next_ = link.prev_ = link;

	for (let reg = link.reg_.regNext_; reg !== link.reg_; reg = reg.regNext_) {
		const user = reg.governor_.governor_(link, reg.user_, reg);
		if (user) {
			const child = createLinkEntry(link, reg, reg.governor_, user);
			if (child) addListener(observer, child);
		}
	}

	return link;
};

export const relink = (link, newObserver) => {
	const oldObserver = link.observer_;
	link.observer_ = newObserver;

	if (oldObserver !== newObserver) {
		for (let entry = link.next_; entry !== link; entry = entry.next_) {
			if (oldObserver) {
				removeListener(oldObserver, entry);
			}

			entry.children_ = null;

			if (newObserver) {
				addListener(newObserver, entry);
			}
		}
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

export const createReg = (constructor, id) => {
	const reg = createInstance(Observer);
	reg.get = () => reg.value;
	reg.register_ = (listener_, governor_, options) => {
		governor_ = {
			listener_,
			governor_,
			add_: listener_.add_,
			remove_: listener_.remove_,
		};

		const listenerNode = {
			user_: baseGovernorParent,
			governor_,
			...options,
		};

		addListener(reg, listenerNode);

		return () => {
			if (governor_) removeListener(reg, listenerNode);
			governor_ = 0;
		};
	};

	reg.id = id || createID?.();
	reg.source_ = constructor;

	reg.regNext_ = reg.regPrev_ = reg;
	reg.linkNext_ = reg.linkPrev_ = reg;

	return reg;
};

export {call, callListeners};

let override;
export const linkApply = (link, events, deltaConstructor, ...args) => {
	if (override) events = override;

	for (let entry = link.next_; entry !== link; entry = entry.next_){
		const downstream = deltaConstructor(...args);
		const gov = entry.governor_;
		downstream.network_ = entry;
		downstream.time = (events.time_ ?? (events.time_ = new Date()));

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
		call(events);

		override = old;
		if (events.hasError_) throw events.error_;
	}
};
