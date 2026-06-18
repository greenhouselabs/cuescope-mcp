# List Control

List inputs contain ordered media items. Automation can change playback or selection state.

Common functions:

- `NextItem`
- `PreviousItem`
- `SelectIndex`
- `ListAdd`
- `ListRemove`
- `ListRemoveAll`
- `ListShuffle`

Guidance:

- Playback navigation is lower risk than destructive list mutation.
- Validate the target input is a list or playlist-like input when possible.
- Include selected-index checks where state exposes them.
- Treat remove/shuffle operations as show-critical and Control Mode only.
