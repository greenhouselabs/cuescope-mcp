# VB.NET Basics For vMix Scripts

Use these patterns when generating reviewable vMix scripts:

```vb
Dim inputName As String = "{input-key}"
API.Function("Cut", Input:=inputName)
```

Rules:

- Use `Dim name As Type`.
- Use `If condition Then ... End If`.
- Use `For Each item As String In items ... Next`.
- Use `Do While True ... Sleep(100) ... Loop` for polling.
- Use `&` for string concatenation.
- Use `CInt`, `CDbl`, or safe parsing when reading XML attributes.

Common wrong patterns:

- `var name = ...`
- `if (...) { ... }`
- `Thread.Sleep(1000)`
- Looping without `Sleep()`

## vMix Host Constraints

A vMix script runs as a single implicit procedure. See
[vMix Host Constraints](vmix-host-constraints.md) for the full list. Key rules:

- No `Sub`/`Function`/`Module`/`Class` definitions — inline all logic; repeat or
  loop instead of factoring into helper routines. `Exit Sub` is allowed.
- `Console.WriteLine` produces no visible output — use
  `API.Function("SetText", ...)` or write to a file for debug.
- Block constructs are fine: `Do/Loop`, `If/End If`, `For/Next`,
  `For Each/Next`, `Select Case`, `Try/Catch/End Try`.
- Late binding works, but bare `CreateObject` does not compile — use
  `Microsoft.VisualBasic.Interaction.CreateObject(...)`.
- Every unbounded loop needs `Sleep()`.
