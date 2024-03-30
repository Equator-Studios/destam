import {Insert, Modify, Delete} from './Events.js';
import {observerGetter, getRef} from './Observer.js';
import {isEqual, len, createProxy, push, createClass, assert} from './util.js';
import * as Network from './Network.js';

const entropy = 8;
const max = Math.max;
const signBit = 0x80;

const zero = [0, 0];

const getByte = (num, pos) => {
	pos += num[0] + 1;
	if (pos < 1) {
		return 0;
	}

	if (pos >= len(num)) {
		return num[len(num) - 1] & signBit ? 0xFF : 0;
	}

	return num[pos];
};

export const indexCompare = (a, b) => {
	let i = max(len(a) - a[0] - 1, len(b) - b[0] - 1);
	const e = -max(a[0], b[0]);

	let sign = 1;
	for (; i >= e; i--) {
		let av = getByte(a, i);
		let bv = getByte(b, i);

		if (av !== bv) return ((av < bv) ^ ((av ^ bv) & signBit && sign)) ? -1 : 1;
		sign = 0;
	}

	return 0;
};

export const indexAdd = (a, c, dec = 0) => {
	const d = (dec >> 3) + !!(dec & 0x7);
	c <<= (8 - dec) & 0x7;

	let i = -max(a[0], d);
	const e = max(len(a) - a[0] - 1, 1);
	const data = [-i];

	for (; i < -d;) {
		push(data, getByte(a, i++));
	}

	let l;
	for (; i < e || c !== l;) {
		c += l = getByte(a, i++);
		push(data, c & 0xFF);

		if ((c ^ l) & signBit) {
			if (c & signBit) {
				l = -1;
			} else {
				l = 1;
			}
		} else {
			l = 0;
		}

		c >>= 8;
	}

	return data;
};

export const indexLeading = (a, b) => {
	let i = -max(a[0], b[0]);
	const e = max(len(a) - a[0] - 1, len(b) - b[0] - 1);

	let c = 0, l;
	for (; i <= e; i++) {
		const d = getByte(a, i) - getByte(b, i) + c;
		c = d >> 8;

		for (let ii = 0; ii < 8; ii++) {
			if (d & (1 << ii)) l = ii + i * 8;
		}
	}

	return l;
};

const getElement = (indexes, ref) => {
	let left = 0;
	let right = len(indexes) - 1;

	while (left <= right) {
		const m = (left + right) >> 1;

		if (indexCompare(indexes[m].query_, ref) < 0) {
			left = m + 1;
		} else if (left === right) {
			right = -1;
		} else {
			right = m;
		}
	}

	return left;
};

export const indexPosition = (array, ref) => {
	return getElement(array[observerGetter].indexes_, ref);
};

export const positionIndex = (array, pos) => {
	const indexes = array[observerGetter].indexes_;
	return indexes[pos]?.query_;
};

const splice = (reg, start, count, arr) => {
	const init = reg.init_;
	const indexes = reg.indexes_;
	const addCount = len(arr);
	const events = [];

	start = start ?? 0;
	count = Math.min(count ?? len(init), len(init) - start);

	assert(!isNaN(start) && !isNaN(count), 'expected integers');
	assert(start >= 0 && start <= len(init), 'start out of bounds: ' + start);

	for (let i = 0; i < Math.min(count, addCount); i++){
		const old = init[start + i];
		const value = arr[i];
		const link = indexes[i + start];

		if (!isEqual(old, value)) {
			Network.relink(link, value?.[observerGetter]);
			Network.linkApply(link, () => Modify(old, value, link.query_, reg.id), events);
		}
	}

	const insertCount = addCount - count;
	if (insertCount < 0) {
		for (let i = addCount; i < count; i++) {
			const link = indexes[start + i];

			Network.unlink(link);
			Network.linkApply(link, () => Delete(init[start + i], undefined, link.query_, reg.id), events);
		}

		indexes.splice(start, -insertCount);
	} else if (insertCount) {
		const links = [];

		let prev, d = 0;
		if (len(indexes) === 0) {
			prev = zero;
		} else if (len(indexes) === start) { // appending the array
			prev = indexes[len(indexes) - 1].query_;
		} else if (start === 0) { // prepending the array
			prev = indexAdd(indexes[0].query_, -2);
		} else { // inserting between
			prev = indexes[start - 1].query_;
			d = 1 - indexLeading(indexes[start].query_, prev);
		}

		const significant = 31 - Math.clz32(insertCount);
		d += entropy + ((1 << significant) === insertCount ? significant : significant + 1);

		let insert = indexes[start + count];
		let error = 0;
		for (let i = count; i < addCount; i++) {
			const num = Math.floor(Math.random() * (1 << entropy));
			prev = indexAdd(prev, num + error + 1, d);
			error = (1 << entropy) - num;

			const value = arr[i];
			const link = Network.link({reg_: reg, query_: prev}, value?.[observerGetter], insert);

			Network.linkApply(link, () => Insert(undefined, value, prev, reg.id), events);
			links[i - count] = link;
		}

		indexes.splice(start, 0, ...links);
	}

	const ret = init.splice(start, count, ...arr);
	Network.callListeners(events);
	return ret;
};

const OArray = (init, id) => {
	const indexes = [];
	const reg = Network.createReg(OArray, id);

	if (init) {
		let index = zero;
		for (let i = 0; i < len(init); i++) {
			push(indexes, Network.link({reg_: reg, query_: index}, init[i]?.[observerGetter]));
			index = indexAdd(index, 1);
		}
	} else {
		init = [];
	}

	reg.init_ = init;
	reg.indexes_ = indexes;

	const props = {
		splice: (start, len, ...val) => splice(reg, start, len, val),
		push: (...values) => splice(reg, len(init), 0, values),
		unshift: val => splice(reg, 0, 0, [val]),
		shift: () => splice(reg, 0, 1, [])[0],
		pop: () => splice(reg, len(init) - 1, 1, [])[0],
		fill: val => splice(reg, 0, len(init), Array(len(init)).fill(val)),
		sort: undefined,
		reverse: undefined,
		observer: reg,
		[getRef]: ref => {
			const index = getElement(indexes, ref);
			if (index >= len(indexes) || indexCompare(indexes[index].query_, ref) !== 0) return [null];
			return [init[index], val => reg.value[index] = val];
		},
		[observerGetter]: reg,
	};

	return reg.value = createProxy(init, props,
		(obj, prop, value) => {
			assert((() => {
				for (let i = 0; i < prop.length; i++){
					const code = prop.charCodeAt(i);

					if (code < 48 || code > 57){
						return false;
					}
				}
				return true;
			})(), "invalid array property: " + prop);

			const num = parseInt(prop);
			const old = init[num];
			if (!isEqual(old, value)){
				const link = indexes[num];
				assert(link, "Array write outside of bounds!");

				let events;
				Network.linkApply(link, () => Modify(old, value, link.query_, reg.id), events = []);

				Network.relink(link, value?.[observerGetter]);
				init[num] = value;
				Network.callListeners(events);
			}

			return true;
		},
		null,
		Array, OArray,
	);
};

createClass(OArray);
export default OArray;
