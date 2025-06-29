import {createInstance, createClass, len, isInstance, assert} from './util.js';

const HASH_MAP_MIN = 16;
let random = bytes => {
	for (let i = 0; i < bytes.length; i++){
		bytes[i] = Math.min(Math.floor(Math.random() * 256), 255);
	}
};

const hex = '0123456789ABCDEF';
const UUID = createClass((size = 4) => {
	let buffer;

	if (typeof size === 'number') {
		buffer = new Int32Array(size);
		buffer[size - 1] = Math.max(Date.now(), 1);

		random(new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength - 4));
	} else if (typeof size === 'string') {
		if ((len(size) & 1) && size[0] !== '#') {
			throw new Error("not a uuid");
		}

		buffer = new Int32Array(len(size) >> 3);
		let ii = 0;

		for (let i = 1; i < len(size); i += 8){
			let val = 0;

			for (let iii = 0; iii < 8; iii++) {
				const c = hex.indexOf(size[i + iii]);
				if (c === -1) throw new Error(JSON.stringify(size) + " is not a uuid");
				val = (val << 4) | c;
			}

			buffer[ii++] = val;
		}
	} else if (isInstance(size, UUID)){
		return size;
	} else if (isInstance(size, Int32Array)) {
		buffer = size;
	} else {
		assert(ArrayBuffer.isView(size), "Invalid value passed to UUID constructor");

		buffer = new Int32Array(Math.ceil(size.byteLength / 4));
		let source = new Uint8Array(size.buffer, size.byteOffset, size.byteLength);
		let dest = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

		for (let i = 0; i < len(dest); i++) {
			dest[i] = source[i];
		}
	}

	const uuid = createInstance(UUID);
	uuid.buffer = buffer;
	return uuid;
}, {
	rawHex () {
		let s = '';

		for (let i = 0; i < len(this.buffer); i++){
			let v = this.buffer[i];

			s += hex[(v >> 28) & 0xF] + hex[(v >> 24) & 0xF] +
				hex[(v >> 20) & 0xF] + hex[(v >> 16) & 0xF] +
				hex[(v >> 12) & 0xF] + hex[(v >> 8) & 0xF] +
				hex[(v >> 4) & 0xF] + hex[v & 0xF];
		}

		return s;
	},
	toHex () {
		return '#' + this.rawHex();
	},
	toString () {
		return this.toHex();
	},
	[Symbol.toPrimitive] () {
		return this.toHex();
	},
});

UUID.equal = (first, second) => {
	if (first === second) return true;

	first = UUID(first).buffer;
	second = UUID(second).buffer;

	if (len(first) !== len(second)) return false;
	for (let i = 0; i < len(first); i++){
		if (first[i] !== second[i]) return false;
	}

	return true;
};

const hashCode = uuid => {
	return uuid.buffer[0];
};

UUID.Map = (entries) => {
	let out = createInstance(UUID.Map);
	out.arr_ = Array(HASH_MAP_MIN).fill(undefined);
	out.mask_ = len(out.arr_) - 1;
	out.size = 0;

	if (entries) for (const entry of entries) {
		out.setElement(entry);
	}

	return out;
};

createClass(UUID.Map, {
	_insert: (arr, mask, replace, elem) => {
		let hash = hashCode(elem.id);

		while (true) {
			let spot = arr[hash & mask];

			if (replace && spot && UUID.equal(elem.id, spot.id)){
				arr[hash & mask] = elem;
				return false;
			}else if (!spot) {
				arr[hash & mask] = elem;
				return true;
			}

			hash++;
		}
	},
	_resize (size) {
		let newarr = Array(size).fill(undefined);
		let newmask = len(newarr) - 1;

		for (let i = 0; i < len(this.arr_); i++) {
			let elem = this.arr_[i];
			if (!elem) continue;

			this._insert(newarr, newmask, false, elem);
		}

		this.arr_ = newarr;
		this.mask_ = newmask;
	},
	set (id, value) {
		return this.setElement({id, value});
	},
	setElement (elem) {
		// if over 80% residency, grow
		if (this.size > len(this.arr_) * 0.80) {
			this._resize(len(this.arr_) << 1);
		}

		if (this._insert(this.arr_, this.mask_, true, elem)){
			this.size++;
			return true;
		}else{
			return false;
		}
	},
	has (id) {
		if (this.size === 0) return false;
		let hash = hashCode(id);

		while (true) {
			let spot = this.arr_[hash & this.mask_];
			if (!spot) return false;

			if (UUID.equal(id, spot.id)) {
				return true;
			}

			hash++;
		}
	},
	get (id) {
		return this.getElement(id)?.value;
	},
	getElement (id) {
		if (this.size === 0) return undefined;
		let hash = hashCode(id);

		while (true) {
			let spot = this.arr_[hash & this.mask_];
			if (!spot) return undefined;

			if (UUID.equal(id, spot.id)) {
				return spot;
			}

			hash++;
		}
	},
	deleteElement(elem) {
		return this.delete(elem.id, spot => spot === elem);
	},
	delete (id, comp) {
		if (this.size === 0) return false;
		if (!comp) comp = (elem, id) => UUID.equal(elem.id, id);

		let hash = hashCode(id);
		while (true) {
			let spot = this.arr_[hash & this.mask_];
			if (!spot) return false;

			const ret = comp(spot, id);
			if (!ret) {
				hash++;
				continue;
			}

			this.size--;
			this.arr_[hash & this.mask_] = undefined;

			// if under 25% residency, shrink
			// we can get away with shrinkink without rebalancing the hash map
			// because shrinking itself will rebalance for us
			if (this.size < (len(this.arr_) >> 2) && len(this.arr_) > HASH_MAP_MIN) {
				this._resize(len(this.arr_) >> 1);
				return ret;
			}

			// get all the leading entries and put them into temp array.
			// re add them in the to the hash map so that the hash/array index
			// colleration remains correct

			let entries = [];
			while (true) {
				hash++;
				const spot = this.arr_[hash & this.mask_];
				if (!spot) break;

				entries.push(spot);
				this.arr_[hash & this.mask_] = undefined;
			}

			for (let i = 0; i < len(entries); i++) {
				this._insert(this.arr_, this.mask_, false, entries[i]);
			}

			return ret;
		}
	},
	elements (trans) {
		let i = 0;
		let found = 0;

		return {
			[Symbol.iterator] () {
				return this;
			},
			next: () => {
				if (found < this.size) while (i < len(this.arr_)) {
					let spot = this.arr_[i++];
					if (!spot) continue;

					found++;
					return {value: trans ? trans(spot) : spot, done: false};
				}

				return {value: undefined, done: true};
			}
		};
	},
	entries () {
		return this.elements(spot => [spot.id, spot.value]);
	},
	keys () {
		return this.elements(spot => spot.id);
	},
	values () {
		return this.elements(spot => spot.value);
	},
	clear () {
		let count = 0;
		let i = 0;
		while (count < this.size) {
			if (this.arr_[i]) count++;
			this.arr_[i] = undefined;

			i++;
		}

		this.size = 0;
	},
});

export const setRandom = randomFunc => random = randomFunc;

export default UUID;
