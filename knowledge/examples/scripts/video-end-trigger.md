---
source_type: internal-pattern
example_type: script
last_reviewed: 2026-06-06
---

# Video End Trigger

Use case: switch to a target input when a media input is near its end.

Key review points:

- Use `//input[@key='...']` when the media input has a key.
- Use `Sleep(100)` inside the polling loop.
- Use `Exit Do` after firing once.
- Confirm target input key before rehearsal.

Template:

```vb
Do While True
    Dim xml As String = API.XML()
    Dim x As New System.Xml.XmlDocument
    x.LoadXml(xml)

    Dim node As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{video-key}']")
    If node IsNot Nothing Then
        Dim position As Integer = CInt(node.Attributes("position").Value)
        Dim duration As Integer = CInt(node.Attributes("duration").Value)

        If duration > 0 And (duration - position) <= 500 Then
            API.Function("Cut", Input:="{target-key}")
            Exit Do
        End If
    End If

    Sleep(100)
Loop
```
