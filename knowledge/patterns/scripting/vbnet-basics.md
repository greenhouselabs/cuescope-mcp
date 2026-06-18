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
