' Sanitized watcher fixture with fresh XML, a state-change latch, and pacing.
Dim lastActive As String = ""

Do While True
    Dim xml As String = API.XML()

    If xml <> "" Then
        Dim doc As New System.Xml.XmlDocument
        doc.LoadXml(xml)

        Dim activeNode As System.Xml.XmlNode = doc.SelectSingleNode("/vmix/active")
        If activeNode IsNot Nothing Then
            Dim currentActive As String = activeNode.InnerText

            If currentActive <> lastActive Then
                API.Function("SetText", Input:="{lower-third-key}", SelectedName:="Name.Text", Value:=currentActive)
                lastActive = currentActive
            End If
        End If
    End If

    Sleep(250)
Loop
