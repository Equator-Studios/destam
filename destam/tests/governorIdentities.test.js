import OObject from '../Object.js';
import {expect} from 'chai';
import test from 'node:test';
import Observer from '../Observer.js';

const names = ['a', 'b', 'c', 'd'];

const createState = (obj, level) => {
	for (let name of names) {
		if (level === 0) {
			obj[name] = Math.random();
		} else {
			obj[name] = OObject();
			createState(obj[name], level - 1);
		}
	}
};

const createTest = (createObs1, createObs2) => () => {
	const state = OObject();

	const states1 = [];
	createObs1(state.observer).watch(delta => {
		states1.push(delta.path);
	});

	const states2 = [];
	createObs2(state.observer).watch(delta => {
		states2.push(delta.path);
	});

	createState(state, 4);
	expect(states1).to.deep.equal(states2);
};

test("governor identities skip", createTest(
	o => o.skip().skip().shallow(),
	o => o.skip(2).shallow()
));

test("governor identities skip infinity", createTest(
	o => o.skip(Infinity),
	o => o,
));

test("governor identities shallow infinity", createTest(
	o => o.shallow(Infinity),
	o => o,
));

test("governor identities skip and shallow", createTest(
	o => o.skip().shallow(),
	o => o.shallow(1)
));

test("governor identities shallow", createTest(
	o => o.shallow(),
	o => Observer.immutable(),
));

test("governor identities multi path", createTest(
	o => o.path(['a', 'b']),
	o => o.path('a').path('b')
));

test("governor identities shallow and path", createTest(
	o => o.shallow(1).path('a'),
	o => o.path('a').shallow(),
));

test("governor identities ignore order", createTest(
	o => o.ignore('a').ignore('b'),
	o => o.ignore('b').ignore('a'),
));

test("governor identities ignore path", createTest(
	o => o.ignore(['a', 'b']).path('a'),
	o => o.path('a').ignore('b'),
));

test("governor identities shallow and ignore", createTest(
	o => o.shallow().ignore('a'),
	o => o.ignore('a').shallow(),
));

test("governor identities multiple shallow", createTest(
	o => o.shallow().shallow(),
	o => o.shallow(),
));

test("governor identities multiple shallow depth", createTest(
	o => o.shallow(1).shallow(),
	o => o.shallow().shallow(1).shallow(),
));

test("governor identities exclusive path/ignore", createTest(
	o => o.ignore('a').path('a'),
	o => Observer.immutable(),
));

test("governor identities exclusive path/ignore and shallow", createTest(
	o => o.shallow(4).ignore('a').path('a'),
	o => Observer.immutable(),
));

test("governor identities path/ignore inclusive", createTest(
	o => Observer.all([
		o.path('a'),
		o.ignore('a'),
	]),
	o => o,
));

test("governor identities memo", createTest(
	o => o.memo(),
	o => o,
));

test("governor identities memo multiple", createTest(
	o => o.memo().memo(),
	o => o,
));

test("governor identities map and unwrap", createTest(
	o => o.map(a => a.observer).unwrap(),
	o => o,
));
