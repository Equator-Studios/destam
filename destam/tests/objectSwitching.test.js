import OObject from '../Object.js';
import createNetwork from '../Tracking.js';
import { clone } from './clone.js';
import {expect} from 'chai';
import test from 'node:test';
import Observer from '../Observer.js';

[
	(name, cb) => test("object sharing events: " + name, () => cb(Observer.mutable(), OObject())),
	(name, cb) => test("object sharing replicate: " + name, async () => {
		const id = Observer.mutable();
		const obj = OObject();

		const obj2 = clone(obj);
		const obj2Network = createNetwork(obj2.observer);

		const network = createNetwork(Observer.all([
			id.map(id => obj.observer.path(id)).unwrap(),
			id.map(id => obj.observer.ignore(id)).unwrap(),
		]));
		const digest = network.digest((commits, observerRefs) => {
			obj2Network.apply(clone(commits, {observerRefs, observerNetwork: obj2Network}));
		});

		cb(id, obj);

		await network.flush();

		expect(obj).to.deep.equal(obj2);
	}),
].forEach(test => {
	test("switcher", (id, state) => {
		const stateSyncObs = id.map(id => state.observer.path(id)).unwrap();

		const events = [];
		stateSyncObs.watch(delta => {
			if (!delta.network_) {
				events.push('');
			} else {
				events.push(delta.path[0]);
			}
		});

		state.a = 1;
		state.b = 2;
		state.c = 3;

		id.set('a');
		state.a++;
		state.b++;
		state.c++;

		id.set('b');
		state.a++;
		state.b++;
		state.c++;

		id.set('c');
		state.a++;
		state.b++;
		state.c++;

		expect(events).to.deep.equal(['', 'a', '', 'b', '', 'c']);
	});

	test("ignore switcher", (id, state) => {
		const stateSyncObs = id.map(id => state.observer.ignore(id)).unwrap();

		const events = [];
		stateSyncObs.watch(delta => {
			if (!delta.network_) {
				events.push('');
			} else {
				events.push(delta.path[0]);
			}
		});

		state.a = 1;
		state.b = 2;
		state.c = 3;

		id.set('a');
		state.a++;
		state.b++;
		state.c++;

		id.set('b');
		state.a++;
		state.b++;
		state.c++;

		id.set('c');
		state.a++;
		state.b++;
		state.c++;

		expect(events).to.deep.equal(['a', 'b', 'c', '', 'b', 'c', '', 'a', 'c', '', 'a', 'b']);
	});

	test("switcher and path", (sw, obj) => {
		sw.set('a');
		obj.a = OObject();
		obj.b = OObject();

		const events = [];
		const obs = sw.map(key => obj.observer.path(key)).unwrap().path('path');
		obs.watch(delta => {
			if (!delta.network_) {
				events.push([]);
			} else {
				events.push(delta.path);
			}
		});

		obj.a.path = 1;
		obj.a.other = 1;
		obj.c = 3;
		sw.set('b');
		obj.a.path = 2;
		obj.b.path = 1;
		obj.b.other = 1;
		sw.set('a');
		obj.b.path = 2;
		sw.set('d');
		obj.d = OObject();
		obj.d.path = 1;
		obj.d.other = 1;

		expect(events).to.deep.equal([['a', 'path'], [], ['b', 'path'], [], [], ['d'], ['d', 'path']]);
	});

	test("ignore switcher and path", (sw, obj) => {
		sw.set('a');
		obj.a = OObject();
		obj.b = OObject();

		const events = [];
		const obs = sw.map(key => obj.observer.ignore(key)).unwrap().skip().path('path');
		obs.watch(delta => {
			if (!delta.network_) {
				events.push([]);
			} else {
				events.push(delta.path);
			}
		});

		obj.a.path = 1;
		obj.a.other = 1;
		obj.b.path = 1;
		obj.b.other = 1;
		obj.c = 3;
		sw.set('b');
		obj.a.path++;
		obj.a.other++;
		obj.b.path++;
		obj.b.other++;
		obj.c++;
		sw.set('a');
		obj.a.path++;
		obj.a.other++;
		obj.b.path++;
		obj.b.other++;
		obj.c++;
		sw.set('d');
		obj.a.path++;
		obj.a.other++;
		obj.b.path++;
		obj.b.other++;
		obj.c++;
		obj.d = OObject();
		obj.d.path = 1;
		obj.d.other = 1;

		expect(events).to.deep.equal([['b', 'path'], ['c'], [], ['a', 'path'], ['c'], [], ['b', 'path'], ['c'], [], ['a', 'path'], ['b', 'path'], ['c']]);
	});
});

