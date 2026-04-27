# Intro

After the Element team decided to absorb the matrix-react-sdk as a part of element-web, we need to follow them and do the same, if we wish to keep syncing our fork. We knew this would most likely be challenging, as the absorption itself is no walk in the park, and on top of that we have our customisations that needs to survive.

# Fresh Fork Starting Point

I spent some time investigating and planning the way forward, and we eventually landed on creating new forks of element-web and matrix-js-sdk in order to be able to work with this update completely separated from what we have running in our environments. And ensure we have a solid foundation to work on.

The new forks:

- [element-web-v2](https://github.com/verji/element-web-v2)
- [matrix-js-sdk-v2](https://github.com/verji/matrix-js-sdk-v2)

## Merging the Custom Code

In short after creating the forks, we merged `matrix-react-sdk/verji-develop` into `element-web-v2`
There were some structural changes within the project, especially in regards to tests, and files that were removed. The in depth details on the merge process has been documented in: [VerjiMergeNotes-December2024.md](https://github.com/verji/element-web-v2/blob/verji-merge-react-sdk/src/VerjiMergeNotes-December2024.md)

Similarly for `matrix-js-sdk-v2` we merged in our `matrix-js-sdk/verji-develop`. Luckily this merger was less intricate, and had little to no merge conflicts.

We made sure to include the git-history from our verji-develop branches, so git-history from our development are still visible in the new repository.

# Handling Custom Verji-Modules

We have built custom modules, to minimize our "Interference" directly with element-web/matrix-js-sdk - and contain our custom functionality in seperate modules.

Structurally our UI-modules had a dependency to matrix-react-sdk, and as matrix-react-sdk no longer is available, we need to modify that dependency to get their resources from element-web instead. For each module which requires an update in this dependency, will need to be refactored.

Strategy: In order to not "break" the legacy modules, we are creating a seperate branch for each of the modules which requires refactorization which should be named "main-v2"
