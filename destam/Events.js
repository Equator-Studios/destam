import {isInstance, createInstance, createClass, assert} from './util.js';

const createModifier = () => {
	const constructor = (prev, value, ref, id) => {
		const out = createInstance(constructor);
		out.ref = ref;
		out.id = id;
		out.value = value;
		out.prev = prev;

		return out;
	};

	createClass(constructor, {
		/**
		 * Computes a human readable path for how the event made it to the state
		 * watcher when nesting is inloved.
		 *
		 * Returns:
		 *   An array of values representing the path in the state tree the event
		 *   took place
		 */
		get path () {
			assert(this.network_, "orphaned event");

			const path = [];

			for (let current = this.network_; current.link_; current = current.parent_) {
				assert(current.link_.query_ != null, "This path contains an observer that cannot be queried");

				path.unshift(current.link_.query_);
			}

			return path;
		},

		/**
		 * Returns:
		 *   The observable that was mutated to trigger this event.
		 */
		get parent () {
			assert(this.network_, "orphaned event");

			return this.network_.link_.reg_.value;
		},

		/**
		 * Inverts the event such that when applied to the state tree, will undo
		 * any changes made by this event.
		 *
		 * Returns:
		 *   An event that does the inverse of this event.
		 */
		get inverse () {
			let cons;
			if (isInstance(this, Insert)) {
				cons = Delete;
			} else if (isInstance(this, Delete)) {
				cons = Insert;
			} else {
				cons = constructor;
			}

			const e = createInstance(cons);
			for (let o of Object.keys(this)) e[o] = this[o];
			e.prev = this.value;
			e.value = this.prev;
			return e;
		}
	});

	return constructor;
};

export const Insert = createModifier();
export const Modify = createModifier();
export const Delete = createModifier();
export const Synthetic = createModifier();
