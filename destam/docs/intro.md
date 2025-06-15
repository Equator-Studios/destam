# A Destam Introduciton

## [Observer](observer.md)
An observer is object that basically acts as a box around your state that may mutate at a later date. This box provides an interface to attach a listener to so that the rest of the application can react to these mutations. It also provides a miriad of functions to transform that state into something else. This is the most important concept in Destam and having a good understanding of Observers is key to making high performance well designed applications. Other state management libraries have similar concepts that are often called atoms.

## [Observable](observables.md)
An observable is a container of many different pieces of state that represent those pieces of state in unique ways for your application. Observables can be created that looks like a standard javascript object or array, but plug into the rest of the Destam infastructure. Most of your state will be stored in Observables. Observables can then be used to generate Observers that are used to listen for and react to state changes.

## [State tree](state-tree.md)
A state tree is a series of arbitrarily nested Observables. When Observables are combined into a state tree, they communicate with each other so that any listeners that maybe attached to your application can react to the state tree as a whole instead of for each observable individally.

## [Governors](governors.md)
Governors are how you can achieve fine-grained queries on observables. Often times, your state tree can get big enough where watching the whole thing and manually filtering for events will lead to poor performance. Governors let you narrow down what you actually want to listen to. It's like a mini-query system.

## Deltas
Deltas represent a singular mutation to an Observer. They can be used to determine which piece of state in your entire application has change uniquely, and query the before and after state. Deltas can then be later applied back to the application state. By inverting a delta and applying that back to application state, a undo operation is effectively done.

## Commits
A commit is simply an array of deltas. The deltas are position independent and represent an atomic change to your application using the least amount of deltas possible.

## [Network](network.md)
A Network represents a state tree in a way that is optimal for replaying deltas. Most simple applications won't need to touch networks, but they can be used to implement undo/redo or network transparency.
