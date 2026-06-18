# XML Parsing

vMix scripts can inspect live state through `API.XML()`.

Safe pattern:

```vb
Dim xml As String = API.XML()
Dim x As New System.Xml.XmlDocument
x.LoadXml(xml)

Dim node As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{input-key}']")
If node IsNot Nothing Then
    Dim position As Integer = CInt(node.Attributes("position").Value)
End If
```

Guidance:

- Refresh XML inside polling loops.
- Use key-based selectors when available.
- Use number fallback only when no key is visible.
- Null-check nodes and attributes before reading values.
- Avoid partial title selectors in generated code.
