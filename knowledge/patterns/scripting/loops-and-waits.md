# Loops And Waits

Polling scripts are common in vMix, but unsafe loops can freeze the application.

Safe loop pattern:

```vb
Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    ' Read state and decide what to do.

    Sleep(100)
Loop
```

Guidance:

- Include `Sleep()` in every unbounded loop.
- Refresh `API.XML()` inside polling loops.
- Use `Sleep(100)` or slower unless a tighter loop is truly necessary.
- Exit one-shot trigger loops after firing.
- Avoid repeated switching/overlay actions without a latch or exit condition.
