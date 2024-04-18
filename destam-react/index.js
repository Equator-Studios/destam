import Observer, {shallowListener, observerGetter} from 'destam/Observer';
import React from 'react';

const compareArrays = (a, b) => {
	if (a === b) return true;
	if (a.length !== b.length) return false;

	for (let i = 0; i < a.length; i++) {
		if (!Object.is(a[i], b[i])) return false;
	}

	return true;
};

/**
 * Provides react hook integration with observers. This is supposed to be
 * similar to React.useState except instead of having react manage the state,
 * the state will instead come from an observer. The watcher will have a shallow
 * depth.
 *
 * Examples:
 *   const [state, setState] = useObserver(observer);
 *   const [state, setState] = useObserver(observer, 'state');
 *   const [state, setState] = useObserver(() => observer.path('state'), [observer]);
 *   const [state, setState] = useObserver(() => observer.path(path), [observer, path]);
 *
 * Params:
 *   gen: A function that will generate the observer that is going to be listened.
 *     If what's passed isn't a function, it will interpret the passed
 *     argument as the observer.
 *   deps: Any dependencies that the gen function relies on. If a function wasn't
 *     passed as the generator, then these deps will be interpreted as a path.
 */
export const useObserver = (gen, deps) => {
	if (!gen) {
		gen = () => Observer.NULL;
		deps = [Observer.NULL];
	} else if (typeof gen !== 'function') {
		let obs = gen;
		if (!(obs instanceof Observer)) {
			obs = obs[observerGetter];
			if (!obs) {
				throw new Error("not an observable");
			}
		}

		const path = !deps ? [] : Array.isArray(deps) ? deps : [deps];
		if (path.length) {
			gen = () => obs.path(path);
		} else {
			gen = () => obs;
		}

		deps = [obs, ...path];
	}

	const [, state] = React.useState(null);
	React.useEffect(() => () => state.listener(), [state]);

	if (!state.setter) {
		state.setter = (value, info) => {
			const obs = state.obs;

			if (typeof value === 'function') {
				obs.set(value(obs.get()), info);
			}else{
				obs.set(value, info);
			}
		};
	}

	if (!state.deps || !compareArrays(deps, state.deps)) {
		if (state.listener) state.listener();

		state.obs = gen();
		state.deps = deps;

		state.listener = shallowListener(state.obs, () => {
			state.value = state.obs.get();
			state({});
		});

		state.value = state.obs.get();
	}

	return [state.value, state.setter];
};
