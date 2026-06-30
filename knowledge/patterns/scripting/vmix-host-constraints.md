---
source_type: internal-pattern
last_reviewed: 2026-06-29
---

# vMix Host Constraints

The vMix scripting host runs each script as a **single implicit procedure**.
These constraints are enforced by the CueScope script validator and must be
respected by every generated or hand-authored vMix VB.NET script.

## Hard rules (validator errors)

- **No procedure or type definitions.** Do not write `Sub`, `Function`,
  `Module`, `Class`, `Structure`, `Namespace`, `Property`, `Enum`, or
  `Interface` (or their `End ...` lines). The script body is already one
  procedure. Inline all logic; repeat code or use loops instead of factoring
  into helper routines.
- **Every unbounded loop must call `Sleep()`.** A `Do While True` / `While True`
  loop without `Sleep()` freezes vMix.
- Use VB.NET, not C#: `Dim` (not `var`), `=` / `<>` (not `==` / `!=`),
  `Sleep(ms)` (not `Thread.Sleep`), `'` comments (not `//`).

## Allowed

- **Early exit:** `Exit Sub`, `Exit Function`, `Exit Do`, `Exit For`.
- **Inline lambdas:** `Dim f = Function(x) x * 2` (an expression, not a
  procedure definition).
- **Block constructs:** `Do/Loop`, `If/End If`, `For/Next`, `For Each/Next`,
  `Select Case/End Select`, `Try/Catch/Finally/End Try`.
- **Variable Sleep intervals:** `Sleep(pollMs)` is fine; confirm the variable is
  always greater than 0.

## Late binding and COM (confirmed on a real host)

The host runs effectively `Option Strict Off`, so late binding works — but the
bare `CreateObject` shorthand is **not** available (`BC30451: 'CreateObject' is
not declared`, because `Microsoft.VisualBasic` is not imported).

- Use the qualified form:
  `Microsoft.VisualBasic.Interaction.CreateObject("ProgID")`.
- Or .NET reflection: `Type.GetTypeFromProgID("ProgID")` +
  `Activator.CreateInstance(t)`.
- `System.*` is available (`System.Xml.XmlDocument`, `System.IO.File`,
  `System.IO.Path`), so reading and writing files from a script works.

Example — read a media file's frame size via `Shell.Application` (column headers
vary by Windows version, so scan for the labels):

```vb
Dim shellApp As Object = Microsoft.VisualBasic.Interaction.CreateObject("Shell.Application")
Dim folder As Object = shellApp.NameSpace("E:\media")
Dim item As Object = folder.ParseName("clip.mp4")
Dim widthText As String = ""
Dim i As Integer = 0
Do While i < 350
    If folder.GetDetailsOf(Nothing, i) = "Frame width" Then widthText = folder.GetDetailsOf(item, i)
    i = i + 1
Loop
```

## No visible console

`Console.Write` / `Console.WriteLine` produce no visible output. For on-screen
debug, drive a title field with
`API.Function("SetText", Input:="{key}", SelectedName:="Debug.Text", Value:=...)`,
or write to a temp file with `System.IO.File.WriteAllText`.
