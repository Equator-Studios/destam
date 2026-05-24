# A Destam Introduction

## [Observer](observer.md)
An observer is an object that acts as a box around state that may mutate at a later date. The box provides an interface to attach listeners so the rest of the application can react to mutations, plus a set of functions to transform that state into something else. This is the most important concept in Destam, and having a good understanding of Observers is key to writing high-performance, well-designed applications. Other state management libraries have similar concepts that are often called atoms.

## [Observable](observables.md)
An observable is a container that holds many pieces of state and exposes them in a way that fits your application. Observables can be created to look like standard JavaScript objects or arrays while plugging into the rest of the Destam infrastructure. Most of your state will live in observables, which in turn produce observers used to listen for and react to changes.

## [State tree](state-tree.md)
A state tree is a series of arbitrarily nested observables. When observables are nested inside other observables, they communicate so that listeners attached to the root can react to the tree as a whole instead of subscribing to each observable individually.

## [Governors](governors.md)
Governors are how you achieve fine-grained queries on observables. State trees can get large enough that watching the whole thing and manually filtering events leads to poor performance. Governors let you narrow down what you actually want to listen to — like a mini query system.

## Deltas
A delta represents a single mutation to an observer. Deltas tell you exactly which piece of state changed, with both the before and after values. A delta can be applied back to a state tree to replay the mutation; inverting a delta and applying it performs an undo.

## Commits
A commit is an array of deltas. The deltas within a commit are position-independent and together represent an atomic change to the application using the smallest number of deltas possible.

## [Network](network.md)
A network represents a state tree in a way that's optimal for replaying deltas. Most simple applications won't need to touch networks directly, but they're what's used to implement undo/redo and network transparency.
