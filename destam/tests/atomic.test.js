import {atomic} from '../Network.js';
import OObject from '../Object.js';
import OArray from '../Array.js';
import {expect} from 'chai';
import test from 'node:test';

test("atomic oobject", () => {
	const obj = OObject();

	const commits = [];
	obj.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.path()));
	});

	atomic(() => {
		obj.one = 1;
		obj.two = 2;
	});

	expect(commits).to.deep.equal([[['one'], ['two']]]);
});

test("atomic oobject error", () => {
	const obj = OObject();

	const commits = [];
	obj.observer.watchCommit(commit => {
		throw new Error("oh oh");
	});

	expect(() => {
		atomic(() => {
			obj.one = 1;
			obj.two = 2;
		});
	}).to.throw();
});

test("atomic oarray", () => {
	const obj = OArray();

	const commits = [];
	obj.observer.watchCommit(commit => {
		commits.push(commit.map(delta => delta.path()));
	});

	atomic(() => {
		obj.push(1);
		obj.push(2);
	});

	expect(commits).to.deep.equal([[
		[obj.observer.indexes_[0].query_],
		[obj.observer.indexes_[1].query_]
	]]);
});
