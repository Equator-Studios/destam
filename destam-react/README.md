# React integration with observers

## useObserver
useObserver is a easy way to have components re-render when the observer
changes in useObserver. It looks similar to the `React.useState` semantics but
instead of operating on its own state, it operates on the given observer.

A basic example of how to use useObserver
```jsx
// first we're going to create a number that increments every second
const number = Observer.mutable(1);

setInterval(() => {
	number.set(number.get() + 1);
}, 1000);

const Component = () => {
	// every time the number is incremented by the setInterval, the component
	// will automatically rerender with the new value. The user should see
	// a number count up. To keep with React.useEffect: we also get a setCount
	// value as well.
	const [count, setCount] = useObserver(number);

	return <div>
		{count}
		<button onClick={() => setCount(0)}> Reset </button>
	</div>;
};

```

This code would do something similar to if you used `React.useState` and a
`React.useEffect` to create a timer. The difference is that the observer
solution has a global counter so all instances of `Component` created will
render the same number. If the count was reset for one component, it would
reset for all components. That's really the power of observers here is to share
state that the rest of the program manages.

`useObserver` provides a couple of interfaces. Above we use a basic interface
with use with an observer. All cases should be covered by this but sometimes
some sugar would be nice.

```jsx
const state = OObject({ value: 'value' });
const [value, setValue] = useObserver(state, 'value');
```

The above snippet is sugar for `Observer.prototype.path` it will simply listen
for the `value` state to change. This paramater can instead be an array which
would have the observer listen along a chain of events like this:

```jsx
const [value, setValue] = useObserver(state, ['user', 'name']);
```

## useObserver callback

Sometimes it's important to construct an observer specifically for a useObserver
call. The helpers above can help for common cases, but there can be more complex
cases. Consider you want to define a default variable for an observer that would
normally be undefined.

```jsx
const [value, setValue] = useObserver(() => state.observer.path('value').def('default'), [state]);
```

`useObserver` does not provide a helper for creating an observer that will resolve
to a default value. We have to create that observer ourselves. It's important
that the observer is created through a callback because it means we won't get
confused when the app remounts and sees a different observer. Remember that
identical calls to the same observer will create different references to observers
in memory. It's more like a hidden `useMemo` combined for us here. Like `useMemo`,
we can also give it a dependency array:


```jsx
const [value, setValue] = useObserver(() => state.observer.path('value').def(default), [state, default]);
```

## Memo your observers!

A common mistake made with observers is to create them every time your component
remounts. The point of observers is for their lifetime to typically be the lifetime
of the state they represent. You don't want observers to be created and destroyed
to manage the same piece of state. Consider this:

```jsx
const Component = (defaultName) => {
	const observer = Observer.mutable(defaultName);
	const [name, setName] = useObserver(observer);

	return <div>
		<div>Your name is {name}</div>
		<textarea onChange={setName} value={name} />
	</div>;
};
```

The above component would not work because the observer is being recreated every
time the component rerenders. It would always take the value of defaultName regardless
if the user changes what's in the textarea. The way to fix this is to use
`React.useMemo`.

```jsx
const Component = (defaultName) => {
	const observer = React.useMemo(() => Observer.mutable(defaultName), [defaultName]);
	const [name, setName] = useObserver(observer);

	return <div>
		<div>Your name is {name}</div>
		<textarea onChange={setName} value={name} />
	</div>;
};
```

Now the component will work as expected. Always memo your observers if you ever
need to create them inside your component!

## Using useEffect with Observer.prototype.watch

As flexible and easy to use is `useObserver` it's sometimes not powerful enough
or you want to optimize for component rerenders. An easy way to reduce the
amount of times your component rerenders is to identify observer state that
is only used in a useEffect but is not used in the jsx. Consider this:

```jsx
const Component = () => {
	const query = React.useMemo(() => Obserever.create(null), []);

	const [queryValue] = useObserver(query);
	const [searchResults, setSearchResults] = React.useState([]);

	React.useEffect(() => {
		setSearchResults(getSearchResults(queryValue));
	}, [queryValue]);

	return <div>
		<TextBox observer={query} />
		<SearchResults results={searchResults} />
	</div>;
};
```

Notice that nothing inside the component rendering needs queryValue itself, but
we are using `useObserver` with the query that can change every time the user
types. Instead we can use the `watch` primitive directly in the use effect.


```jsx
const Component = () => {
	const query = React.useMemo(() => Obserever.create(null), []);

	const [searchResults, setSearchResults] = React.useState([]);

	React.useEffect(() => {
		const update = () => {
			setSearchResults(getSearchResults(query.get()));
		};

		update();
		const listener = query.watch(update);

		return () => {
			listener();
		}
	}, [queryValue]);

	return <div>
		<TextBox observer={query} />
		<SearchResults results={searchResults} />
	</div>;
};
```

Note that sometimes instead of:
```js
const listener = query.watch(update);

return () => {
	listener();
}
```
You can return the remove function directly. These two things do the same things.
The problem with the below solution is that it's not trivial to add other
things that need to be cleaned up with the useEffect.

```js
return query.watch(update);
```

# Complete example

## Counter

```jsx
const ShowCounter = ({count: countObs}) => {
	const [count] = useObserver(countObs);

	return <div>
		The count is at: {count}
	</div>;
};

const Counter = ({state}) => {
	return <div>
		<ShowCounter count={state.observer.path('count')} />
		<button onClick={() => {
			state.count += 1;
		}}> Increment </button>
		<button onClick={() => {
			state.count -= 1;
		}}> Decrement </button>
		<button onClick={() => {
			state.count = 0;
		}}> Reset </button>
	</div>;
};

const state = OObject({
	// we're going to initialize the counter
	// so we don't try to increment undefined
	count: 0
});

createRoot(document.getElementById('root')).render(<Counter state={state} />);
```

## Todo

```jsx
const TodoItem = ({item}) => {
	const [name] = useObserver(item, 'name');
	const [completed, setCompleted] = useObserver(item, 'completed');

	return <li
		style={{textDecoration: completed ? 'line-through' : 'none'}}
		onClick={() => {
			setCompleted(c => !c);
		}}
	>
		{name}
	</li>;
};

const TodoList = ({todos}) => {
	const [items] = useObserver(todos);

	return <ul>
		{items.map((item, i) => {
			return <TodoItem key={i} item={item} />;
		})}
	</ul>;
};

const AddTodo = ({todos}) => {
	const [current, setCurrent] = React.useState('');

	return <div>
		<input value={current} onChange={e => setCurrent(e.target.value)} />
		<button onClick={() => {
			if (!current) return;

			todos.push(OObject({
				completed: false,
				name: current,
			}));

			setCurrent('');
		}}>
			Add Todo
		</button>
	</div>;
};

const TodoFilter = ({filter}) => {
	const [filt, setFilt] = useObserver(filter);

	return <div>
		Show:
		<button disabled={filt === 'all'} onClick={() => setFilt('all')}>All</button>
		<button disabled={filt === 'active'} onClick={() => setFilt('active')}>Active</button>
		<button disabled={filt === 'completed'} onClick={() => setFilt('completed')}>Completed</button>
	</div>;
};

const Undo = ({state}) => {
	const [history, setHistory] = React.useState([]);
	const [historyPos, setHistoryPos] = React.useState(0);
	const network = React.useMemo(() => createNetwork(state.observer), [state]);

	React.useEffect(() => () => network && network.remove(), [network]);

	React.useEffect(() => {
		return state.observer.watchCommit((commit, args) => {
			if (args === 'is-undo-action') {
				return;
			}

			setHistoryPos(pos => {
				setHistory(history => history.slice(0, pos).concat([commit]));
				return pos + 1;
			});
		});
	}, [state]);

	return <div>
		<button disabled={historyPos === 0} onClick={() => {
			setHistoryPos(pos => {
				network.apply(history[pos - 1].map(delta => delta.invert()), 'is-undo-action');
				return pos - 1;
			});
		}}>Undo</button>
		<button disabled={historyPos === history.length} onClick={() => {
			setHistoryPos(pos => {
				network.apply(history[pos], 'is-undo-action');
				return pos + 1;
			});
		}}>Redo</button>
	</div>;
};

const Todo = ({state}) => {
	return <div>
		<AddTodo todos={state.todos} />
		<TodoList todos={Observer.all([
			state.observer.path('todos'),
			state.observer.path('filter'),
		]).map(([todos, filt]) => {
			return todos.filter(todo => {
				if (filt === 'completed' && !todo.completed) return false;
				if (filt === 'active' && todo.completed) return false;
				return true;
			});
		})}/>
		<TodoFilter filter={state.observer.path('filter')}/>
		<Undo state={state.todos} />

		All items<br/>
		<TodoList todos={state.todos} />
	</div>;
};

const state = OObject({
	// we're going to initialize the counter
	// so we don't try to increment undefined
	todos: OArray(),
	filter: 'all',
});

createRoot(document.getElementById('root')).render(<Todo state={state} />);
```

## Checkboxes
```jsx
const Checkbox = ({value, name}) => {
	const [checked, setChecked] = useObserver(value);

	return <>
		<label><input type="Checkbox" checked={checked} onChange={cb => {
			setChecked(cb.target.checked);
		}} />{name}</label>
		<br/>
	</>;
};

const countries = [
	'Australia',
	'Canada',
	'France',
	'USA',
	'Mexico',
	'Japan',
];

const App = () => {
	const checkboxes = countries.map(name => ({name, value: Observer.mutable(false)}));

	return <>
		<Checkbox
			name='Check All'
			value={Observer.all(checkboxes.map(c => c.value)).map(cbs => {
				return !cbs.some(c => !c);
			}, v => {
				return Array(checkboxes.length).fill(v);
			})}
		/>
		{checkboxes.map((checkbox, i) => {
			return <Checkbox
				key={checkbox.name}
				name={checkbox.name}
				value={checkbox.value}
			/>;
		})}
	</>;
};

createRoot(document.getElementById('root')).render(<App />);
```
