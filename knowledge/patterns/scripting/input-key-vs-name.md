# Input Keys vs Names

Input reference preference:

1. Key
2. Number
3. Exact title
4. Fuzzy title suggestion only

Keys are the most stable because titles can be renamed and numbers can shift when presets are edited.

Script examples:

```vb
API.Function("Fade", Input:="{camera-key}")
```

XML examples:

```vb
Dim node As System.Xml.XmlNode = x.SelectSingleNode("//input[@key='{camera-key}']")
```

If an input has no key visible in current XML, use its number as a fallback and mark the artifact with review guidance. Do not commit fuzzy title matches into executable script code.
