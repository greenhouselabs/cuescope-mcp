# Timers

Timers appear as title inputs, countdown controls, or script-driven waits.

Patterns:

- Use title countdown functions for visual timers.
- Use `Sleep()` for script timing.
- Use polling loops for event triggers such as media ending.

Review checks:

- Confirm whether the request is a visual countdown or automation delay.
- Confirm the target title input and fields.
- Confirm overlay channel if the timer is shown as a graphic.
- Avoid tight polling for timer-like behavior.

Failure mode:

- A script delay can clear or change an overlay after the operator has reused that channel.
