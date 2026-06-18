# Overlays

vMix overlay channels are 1 through 4.

Patterns:

- Lower thirds usually use channel 1 or 2.
- Bugs/logos often live on a persistent channel.
- Full-screen graphics should usually be switched as inputs, not stacked as overlays, unless intentional.

Review checks:

- Is the target overlay channel already occupied?
- Should the script use `OverlayInputNIn`, `OverlayInputNOut`, or `OverlayInputNOff`?
- Should clearing an overlay happen after a timed `Sleep()`?
- Is the overlay input a title, image, browser, or other suitable graphic?

Failure mode:

- A timed overlay script can clear a different graphic if the same channel is reused while the script sleeps.
