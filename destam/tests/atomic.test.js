import {atomic} from '../Network.js';
import OObject from '../Object.js';
import OArray from '../Array.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test("atomic oobject", () => {
	const obj = OObject();

	const commits = [];
	obj.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.path));
	});

	atomic(() => {
		obj.one = 1;
		obj.two = 2;
	});

	assert.deepStrictEqual(commits, [[['one'], ['two']]]);
});

test("atomic oobject error", () => {
	const obj = OObject();

	const commits = [];
	obj.observer.watchCommit(commit => {
		throw new Error("oh oh");
	});

	assert.throws(() => {
		atomic(() => {
			obj.one = 1;
			obj.two = 2;
		});
	});
});

test("atomic oarray", () => {
	const obj = OArray();

	const commits = [];
	obj.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.path));
	});

	atomic(() => {
		obj.push(1);
		obj.push(2);
	});

	assert.deepStrictEqual(commits, [[
		[obj.observer.indexes_[0].query_],
		[obj.observer.indexes_[1].query_]
	]]);
});

test("atomic reentrant mutation of the same observable is not lost", () => {
	const arr = OArray(['a', 'b']);

	const commits = [];
	let reentered = false;
	arr.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.value));

		if (!reentered) {
			reentered = true;
			arr.fill('Y');
		}
	});

	atomic(() => {
		arr.fill('X');
	});

	assert.deepStrictEqual([...arr], ['Y', 'Y']);
	assert.deepStrictEqual(commits, [['X', 'X'], ['Y', 'Y']]);
});

test("non-atomic reentrant mutation of the same observable dispatches normally", () => {
	const arr = OArray(['a', 'b']);

	const commits = [];
	let reentered = false;
	arr.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.value));

		if (!reentered) {
			reentered = true;
			arr.fill('Y');
		}
	});

	arr.fill('X');

	assert.deepStrictEqual([...arr], ['Y', 'Y']);
	assert.deepStrictEqual(commits, [['X', 'X'], ['Y', 'Y']]);
});

test("atomic rejects two events for the same link in one commit", () => {
	const arr = OArray(['a']);
	arr.observer.watchCommit(() => {});

	assert.throws(() => {
		atomic(() => {
			arr[0] = 'b';
			arr[0] = 'c';
		});
	}, /same link/);
});

test("atomic dispatches a reentrant touch to a still-queued link instead of corrupting it", () => {
	const arr = OArray(['a', 'b']);
	const trigger = OObject({go: false});

	const commits = [];
	arr.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.value));
	});
	trigger.observer.watchCommit(() => {
		if (trigger.go) arr.fill('Y');
	});

	atomic(() => {
		trigger.go = true;
		arr.fill('X');
	});

	assert.deepStrictEqual([...arr], ['Y', 'Y']);
	assert.deepStrictEqual(commits, [['X', 'X'], ['Y', 'Y']]);
});

test("atomic: two listeners triggered by one commit can independently mutate a third observable", () => {
	const source = OObject({a: 0, b: 0});
	const target = OObject({value: null});

	const targetCommits = [];
	target.observer.watchCommit(commit => {
		targetCommits.push(commit.map(delta => delta.value));
	});

	source.observer.path('a').watchCommit(() => {
		target.value = 'from-a';
	});
	source.observer.path('b').watchCommit(() => {
		target.value = 'from-b';
	});

	atomic(() => {
		source.a = 1;
		source.b = 1;
	});

	assert.strictEqual(target.value, 'from-b');
	assert.deepStrictEqual(targetCommits, [['from-a'], ['from-b']]);
});
