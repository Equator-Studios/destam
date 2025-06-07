import {expect} from 'chai';
import test from 'node:test';
import OObject from '../Object.js';
import {Insert} from '../Events.js';
import Observer from '../Observer.js';

test("should be instanceof itself", () => {
	let arr = OObject();

	expect(arr).to.be.an.instanceOf(OObject);
});

test("object hasOwnProperty", () => {
	let arr = OObject({
		"hello": true
	});

	expect(arr.hasOwnProperty("hello")).to.equal(true);
});

test("object prototype", () => {
	const cons = () => {
		return Object.create(cons.prototype);
	};

	cons.prototype = Object.create(OObject.prototype);
	cons.prototype.constructor = cons;

	const obj = OObject(cons());
	expect(obj).to.be.an.instanceOf(OObject);
	expect(obj).to.be.an.instanceOf(cons);
});

test("reading keys", () => {
	let object = OObject({ one: '1', two: '2', three: '3' });

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
});

test("reading properties from an object observer", () => {
	let object = OObject({ one: '1', two: '2', three: '3' });

	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
});

test("reading keys", () => {
	let object = OObject({});
	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
});

test("deleting keys", () => {
	let object = OObject({ one: '1', two: '2', three: '3' });

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');

	delete object.one;
	delete object.two;
	delete object.three;

	expect (Object.keys(object)).to.have.members([]);
	expect (object.one).to.equal(undefined);
	expect (object.two).to.equal(undefined);
	expect (object.three).to.equal(undefined);
});

test("this keyword must be the value of the observer in a called function", () => {
	let arr = OObject();

	arr.call = function () {
		expect (this).to.equal(arr);
	};

	arr.call();
});

test("this keyword must be the value of the observer in a called function in a prototype", () => {
	let arr = OObject(Object.create({
		call () {
			expect (this).to.equal(arr);
		}
	}));

	arr.call();
});

test("object basic events", () => {
	let object = OObject({});
	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (events).to.deep.equal(['1', '2', '3']);
});

test("object basic events with memo", () => {
	let object = OObject({});
	const events = [];
	object.observer.memo().watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (events).to.deep.equal(['1', '2', '3']);
});

test("remove event before setting values", () => {
	let object = OObject({});
	const events = [];
	let event = object.observer.watch(event => {
		events.push(event.value);
	});

	event();

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (events).to.deep.equal([]);
});

test("remove after unlink", () => {
	let object = OObject({});
	const events = [];
	let event = object.observer.watch(event => {
		events.push(event.value);
	});

	let nested = OObject();
	object.nested = nested;

	let nestedEvent = nested.observer.watch(event => {
		events.push(event.value);
	});

	nested.one = 1;
	event();
	nested.two = 2;
	nestedEvent();
	nested.three = 3;

	expect (events).to.have.ordered.members([nested, 1, 1, 2]);
});

test("remove event after setting values", () => {
	let object = OObject({});
	const events = [];
	let event = object.observer.watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	event();

	object.one = '4';
	object.two = '5';
	object.three = '6';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('4');
	expect (object.two).to.equal('5');
	expect (object.three).to.equal('6');
	expect (events).to.deep.equal(['1', '2', '3']);
});

test("reset keys", () => {
	let object = OObject({});
	const events = [];
	object.observer.watch(event => {
		events.push(event.value);
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	object.one = '4';
	object.two = '5';
	object.three = '6';

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect (Object.keys(object)).to.have.members(['one', 'two', 'three']);
	expect (object.one).to.equal('1');
	expect (object.two).to.equal('2');
	expect (object.three).to.equal('3');
	expect (events).to.deep.equal(['1', '2', '3', '4', '5', '6', '1', '2', '3']);
});

test("prototype not linking", () => {
	let arr = OObject(Object.create({
		value: 'not linked'
	}));

	let events = [];
	arr.observer.watch (state => {
		if (state instanceof Insert) {
			events.push(state.value);
		}
	});

	arr.value = 'linked';

	expect(events).to.deep.equal(['linked']);
});

test("object pathing", () => {
	let object = OObject({});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.path());
	});

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect(paths).to.deep.equal([['one'], ['two'], ['three']]);
});

test("shallow query with a path", () => {
	let object = OObject({});
	let object2 = OObject({});
	let object3 = OObject({});

	const paths = [];
	object.observer.path('next').shallow(1).watch(event => {
		paths.push(event.path());
	});

	object.next = object2;

	object2.one = '1';
	object2.two = '2';
	object2.three = '3';

	object2.next = object3;

	object3.one = '1';
	object3.two = '2';
	object3.three = '3';

	object.one = '1';
	object.two = '2';
	object.three = '3';

	expect(paths).to.deep.equal([['next'], ['next', 'one'], ['next', 'two'], ['next', 'three'], ['next', 'next']]);
});

test("shallow query with a path and memo", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.path('next').memo().shallow().watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object2.thing = 'thing';

	expect(paths).to.deep.equal([['next']]);
});

test("oobject path after memo", () => {
	let object = OObject({
		nested: OObject({
			hello: 1,
			world: 1,
		}),
	});

	const paths = [];
	object.observer.path('nested').memo().path('hello').watch(event => {
		paths.push(event.path());
	});

	object.nested.hello = 2;
	object.nested.world = 2;

	expect(paths).to.deep.equal([['nested', 'hello']]);
});

test("oobject memo path", () => {
	let object = OObject({
		other: {},
	});

	const paths = [];
	object.observer.memo().path('hello').watch(event => {
		paths.push(event.path());
	});

	object.hello = 2;

	expect(paths).to.deep.equal([['hello']]);
});

test("oobject double memo path", () => {
	let object = OObject({
		other: {},
	});

	const paths = [];
	object.observer.memo().memo().path('hello').watch(event => {
		paths.push(event.path());
	});

	object.hello = 2;

	expect(paths).to.deep.equal([['hello']]);
});

test("oobject skip memo", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.skip().memo().path('hello').watch(event => {});
	}).to.throw();
});

test("oobject tree memo", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.tree('children').memo().path('hello').watch(event => {});
	}).to.throw();
});

test("oobject skip get", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.skip().get();
	}).to.throw();
});

test("oobject tree get", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.tree('children').get();
	}).to.throw();
});

test("oobject skip set", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.skip().set('value');
	}).to.throw();
});

test("oobject tree set", () => {
	let object = OObject({
		other: OObject(),
	});

	expect(() => {
		object.observer.tree('children').set('value');
	}).to.throw();
});

test("shallow query with a path and ordered memo", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	const [one, two] = object.observer.path('next').memo(2);

	one.shallow().watch(event => {
		paths.push(event.path());
	});

	two.watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object2.thing = 'thing';

	expect(paths).to.deep.equal([['next'], ['next'], ['next', 'thing']]);
});

test("object switch selector", () => {
	const object = OObject({
		nested: OObject({
			val: 1,
		}),
	});

	const sel = object.observer.path(['nested', 'val']).selector();

	const paths = [];
	sel(1).watch(delta => {
		paths.push(delta.path());
	});

	object.nested = OObject({
		val: 1,
	});

	expect(paths).to.deep.equal([]);
});

test("shallow query with a path and memo predefine", () => {
	let object = OObject({});
	let object2 = OObject({});

	object.next = object2;

	const paths = [];
	object.observer.path('next').memo().shallow().watch(event => {
		paths.push(event.path());
	});

	object2.thing = 'thing';

	expect(paths).to.deep.equal([]);
});

test("double path", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.path('next').path('thing').watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object2.thing = 'thing';
	object2.thing2 = 'thing';

	expect(paths).to.deep.equal([['next'], ['next', 'thing']]);
});

test("double path and memo", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.path('next').memo().path('thing').watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object2.thing = 'thing';
	object2.thing2 = 'thing';

	expect(paths).to.deep.equal([['next'], ['next', 'thing']]);
});

test("double path and memo predefine", () => {
	let object = OObject({});
	let object2 = OObject({});

	object.next = object2;

	const paths = [];
	object.observer.path('next').memo().path('thing').watch(event => {
		paths.push(event.path());
	});

	object2.thing = 'thing';
	object2.thing2 = 'thing';

	expect(paths).to.deep.equal([['next', 'thing']]);
});

test("try to query an object path that doesn't have a path", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.shallow(1).watch(event => {
		paths.push(event.path());
	});

	object.next = object2;
	object._hidden = 'hidden';

	object2.one = '1';
	object2.two = '2';
	object2.three = '3';

	expect(paths).to.deep.equal([['next']]);
});

test("test parent object getter", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.watch(event => {
		paths.push(event.getParent());
	});

	object.next = object2;

	object2.one = '1';
	object.two = '2';
	object2.three = '3';

	expect(paths).to.have.ordered.members([object, object2, object, object2]);
});

test("exists promise on already existing object", async () => {
	let object = OObject({});

	object.hello = 'world';

	const promise = object.observer.path("hello").defined();

	await promise;
});

test("exists promise on not existing object", async () => {
	let object = OObject({});

	const promise = object.observer.path("hello").defined();

	object.hello = 'world';

	await promise;
});

test("exists promise on not existing object", async () => {
	let object = OObject({});

	const promise = object.observer.path("hello").defined(state => state === 'world');
	let resolved = false;

	promise.then(() => resolved = true);

	object.hello = 'hello';
	expect(resolved).to.equal(false);

	object.hello = 'world';
	expect(resolved).to.equal(false);
});

test("exists promise on not existing object", () => {
	let object = OObject({});

	let called = false;
	object.observer.path("hello").defined().then(() => {
		called = true;
	});

	expect(called).to.equal(false);
});

test("path to hidden", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.path('_hidden').watch(event => {
		paths.push(event.path());
	});

	object._hidden = object2;
	object.a = '1';
	object.b = '2';
	object.c = '3';

	object2.a = '1';
	object2.b = '2';
	object2.c = '3';

	expect(paths).to.deep.equal([['_hidden'], ['_hidden', 'a'], ['_hidden', 'b'], ['_hidden', 'c']]);
});

test("path to hidden with shallow", () => {
	let object = OObject({});
	let object2 = OObject({});

	const paths = [];
	object.observer.path('_hidden').shallow().watch(event => {
		paths.push(event.path());
	});

	object._hidden = object2;
	object.a = '1';
	object.b = '2';
	object.c = '3';

	object2.a = '1';
	object2.b = '2';
	object2.c = '3';

	expect(paths).to.deep.equal([['_hidden']]);
});

test("object relinking", () => {
	let object = OObject();

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});


	object.value = 'initialize';
	object.value = OObject();
	object.value.property = 'property';

	expect(events).to.deep.equal([['value'], ['value'], ['value', 'property']]);
});

test("pathing for deleted objects", () => {
	let object = OObject();

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	object.value = 'initialize';

	delete object.value;

	expect(events).to.deep.equal([['value'], ['value']]);
});

test("parent for deleted objects", () => {
	let object = OObject();

	let events = [];
	object.observer.watch(event => {
		events.push(event.getParent());
	});

	object.value = 'initialize';
	delete object.value;

	expect(events).to.have.ordered.members([object, object]);
});

test("chained path", () => {
	let object = OObject({
		nested: OObject({})
	});

	let events = [];
	object.observer.path('nested').path('value').watch(event => {
		events.push(event.value);
	});

	object.nested.value = 'hello';

	expect(events).to.deep.equal(['hello']);
});

test("chained path and ignore", () => {
	let object = OObject({
		nested: OObject({})
	});

	let events = [];
	object.observer.path('nested').ignore('value').watch(event => {
		events.push(event.value);
	});

	object.nested.value = 'hello';
	object.nested.second = 'second';

	expect(events).to.deep.equal(['second']);
});

test("parent changing value", () => {
	let object = OObject({
		nested: OObject({
			nested: OObject({

			})
		})
	});

	let events = [];
	object.observer.path(['nested', 'nested', 'value']).watch(event => {
		events.push(event.value);
	});

	object.nested.nested.value = 'hello';
	object.nested.dude = 'dude';
	object.nested = 'changed';

	expect(events).to.deep.equal(['hello', 'changed']);
});

test("circle network", () => {
	let object = OObject({
		nested: OObject({

		})
	});

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	object.nested.changed = 'yes';
	object.nested2 = object.nested;
	object.nested = null;
	object.nested2.changed = 'again';

	expect(events).to.deep.equal([['nested', 'changed'], ['nested2'], ['nested'], ['nested2', 'changed']]);
});

test("usage of unlinked network", () => {
	let object = OObject();
	let object2 = OObject();

	object.nested2 = object.nested;

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	let events2 = [];
	object2.observer.watch(event => {
		events2.push(event.path());
	});

	object.other = object2;
	object2.whatever = 'what';
	object.other = null;
	object2.whatever = 'else';

	expect(events).to.deep.equal([['other'], ['other', 'whatever'], ['other']]);
	expect(events2).to.deep.equal([['whatever'], ['whatever']]);
});

test("usage of unlinked network with a circle", () => {
	let object = OObject();
	let object2 = OObject({
		circle: OObject()
	});

	object2.circle = object2;

	object.nested2 = object.nested;

	let events = [];
	object.observer.watch(event => {
		events.push(event.path(object));
	});

	let events2 = [];
	object2.observer.watch(event => {
		events2.push(event.path(object2));
	});

	object.other = object2;
	object2.whatever = 'what';
	object.other = null;
	object2.whatever = 'else';

	expect(events).to.deep.equal([['other'], ['other', 'whatever'], ['other']]);
	expect(events2).to.deep.equal([['whatever'], ['whatever']]);
});

test("usage of unlinked network with a circle of parent", () => {
	let object2 = OObject();
	let object = OObject({
		circle: OObject()
	});

	object.circle = object;

	object.nested2 = object.nested;

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	let events2 = [];
	object2.observer.watch(event => {
		events2.push(event.path());
	});

	object.other = object2;
	object2.whatever = 'what';
	object.other = null;
	object2.whatever = 'else';

	expect(events).to.deep.equal([['other'], ['other', 'whatever'], ['other']]);
	expect(events2).to.deep.equal([['whatever'], ['whatever']]);
});

test("unlinking then relinking", () => {
	let object = OObject();
	let object2 = OObject();

	object.nested = object2;
	object2.thing = 'hello';
	object.nested = null;
	object.nested = object2;
});

test("nested events", () => {
	let object = OObject();

	object.observer.shallow(1).watch(event => {
		event.value.thing = 'thing';
	});

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	object.thing = OObject();

	expect(object.thing.thing).to.equal('thing');
	expect(events).to.deep.equal([['thing'], ['thing', 'thing']]);
});

test("event masking pre", () => {
	let object = OObject();

	let watcher = object.observer.watch(event => {
		watcher();
	});

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	object.thing = OObject();

	expect(events).to.deep.equal([['thing']]);
});

test("event masking post", () => {
	let object = OObject();

	let events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	let watcher = object.observer.watch(event => {
		watcher();
	});

	object.thing = OObject();

	expect(events).to.deep.equal([['thing']]);
});

test("nested events of parents", () => {
	let object = OObject();

	object.observer.shallow(1).watch(event => {
		event.value.thing = 'thing';
	});

	let events = [];
	object.observer.watch(event => {
		events.push(event.getParent());
	});

	object.thing = OObject();

	expect(events).to.have.ordered.members([object, object.thing]);
});

test("skip and path", () => {
	let object = OObject();

	object.one = OObject();
	object.two = OObject();
	object.three = OObject();

	const events = [];
	object.observer.skip().path('value').watch(event => {
		events.push(event.path());
	});


	object.one.value = 'value';
	object.one.other = 'value';
	object.two.value = 'value';
	object.two.other = 'value';
	object.three.value = 'value';
	object.three.other = 'value';

	expect(events).to.deep.equal([['one', 'value'], ['two', 'value'], ['three', 'value']]);
});

test("register hidden then public", () => {
	let object = OObject();

	const events = [];
	object.observer.watch(event => {
		events.push(event.path());
	});

	object._hidden = OObject();
	object._hidden.thing = 'thing';
	object.public = object._hidden;
	object.public.thing2 = 'thing2';

	expect(events).to.deep.equal([['public'], ['public', 'thing2']]);
});

test("skip and path and shallow", () => {
	let object = OObject();

	object.one = OObject();
	object.two = OObject();
	object.three = OObject();

	const events = [];
	object.observer.skip().path('value').shallow().watch(event => {
		events.push(event.path());
	});

	object.one.value = OObject();
	object.one.value.nested = 'nested';
	object.one.other = OObject();
	object.one.other.nested = 'nested';
	object.two.value = OObject();
	object.two.value.nested = 'nested';
	object.two.other = OObject();
	object.two.other.nested = 'nested';
	object.three.value = OObject();
	object.three.value.nested = 'nested';
	object.three.other = OObject();
	object.three.other.nested = 'nested';

	expect(events).to.deep.equal([['one', 'value'], ['two', 'value'], ['three', 'value']]);
});

test("shallow listener on observer mutating to null", () => {
	let object = OObject();

	let events = [];
	object.observer.path("hello").shallow().watch(event => {
		events.push(event.path());
	});

	object.hello = OObject();
	object.hello.dude = 'dude';

	object.hello = null;

	expect(events).to.deep.equal([['hello'], ['hello']]);
});

test("observer map with object", () => {
	const object = OObject();
	const observer = object.observer.path("value").map(x => x * 2, x => x / 2);
	const values = [];
	observer.watch(state => {
		values.push(observer.get());
	});

	observer.set(10);
	expect(object.value).to.equal(5);

	object.value = 50;
	expect(values).to.deep.equal([10, 100]);
});

test("object delete check during listener", () => {
	const obj = OObject();

	obj.thing = 'thing';

	let has;
	obj.observer.watch(state => {
		has = 'thing' in obj;
	});

	delete obj.thing;

	expect(has).to.equal(false);
});

test("object observer memo", () => {
	const obj = OObject();

	let obs = obj.observer.path('nested').memo();

	let stuff = [];
	let w = obs.watch(state => stuff.push(state.value));
	let w2 = obs.watch(state => stuff.push(state.value));

	const oldNested = obj.nested = OObject();

	obj.whatever = 'whatever';

	obj.nested.hello = 'hello';
	w();
	obj.nested.hello = 'world';

	obj.nested = OObject();

	expect(obs.get()).to.equal(obj.nested);

	w2();

	obj.nested.hello = "shouldn't see thins";

	expect(stuff).to.deep.equal([oldNested, oldNested, 'hello', 'hello', 'world', obj.nested]);
	expect(obs.get()).to.equal(obj.nested);
});

test("object setter", () => {
	const obj = OObject();

	obj.observer.path('value').set("value 1");
	obj.observer.path('value2').set("value 2");
	obj.observer.path('value3').set("value 3");

	expect(obj.observer.path('value').get()).to.equal("value 1");
	expect(obj.observer.path('value2').get()).to.equal("value 2");
	expect(obj.observer.path('value3').get()).to.equal("value 3");
});

test("object setter events", () => {
	const obj = OObject();

	const vals = [];
	obj.observer.watch(delta => {
		vals.push(delta.value);
	});

	obj.observer.path('value').set("value 1");
	obj.observer.path('value2').set("value 2");
	obj.observer.path('value3').set("value 3");

	expect(vals).to.deep.equal(['value 1', 'value 2', 'value 3']);
});

test("object events memo late watch", () => {
	const obj = OObject();

	const vals = [];
	const memo = obj.observer.path('val').memo().shallow();

	memo.watch(delta => {
		vals.push(delta.value);
	});

	obj.val = 1;
	obj.val = 2;

	memo.watch(delta => {});
	obj.val = OObject();
	obj.val.hello = 'world';

	expect(vals).to.deep.equal([1, 2, obj.val]);
});

test("oobject immutability after shallow", () => {
	const obj = OObject().observer.shallow();
	expect(obj.isImmutable()).to.equal(true);
});

test("oobject effect on broken chain", () => {
	const obj = OObject();
	const obs = obj.observer.skip();
	let calls = 0;
	obs.effect(() => {
		calls++;
	});

	obj.obj = 'obj';

	expect(calls).to.equal(2);
});

test("oobject effect on broken chain with path", () => {
	const obj = OObject({obj: OObject()});
	const obs = obj.observer.skip().path('obj');
	let calls = 0;
	obs.effect(() => {
		calls++;
	});

	obj.obj.obj = 'obj';

	expect(calls).to.equal(2);
});

test("oobject map on broken chain with path", () => {
	const obj = OObject({obj: OObject()});
	const obs = obj.observer.skip().path('obj');
	const obs2 = obs.map(() => {
		return 1;
	});

	obj.obj.obj = 'obj';

	expect(obs2.get()).to.equal(1);
});

test("oobject Observer.all on broken chain", () => {
	const obj = OObject();
	const obs = obj.observer.skip()

	expect(Observer.all([obs]).get()[0]).to.equal(undefined);
});

test("oobject Observer.all on broken chain 2", () => {
	const obj = OObject();
	const obs = obj.observer.skip()

	expect(Observer.all(Observer.immutable([obs])).get()[0]).to.equal(undefined);
});
