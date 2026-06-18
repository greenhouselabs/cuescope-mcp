' Sanitized slot-driven lower-third/data-source fixture.
' Captures the reusable shape: slot occupant -> reviewed row map -> timed overlay.
Dim slotMapSelector As String = "//input[@key='{slot-map-key}']"
Dim lowerThirdInput As String = "{lower-third-key}"
Dim dataRow As String = ""
Dim displayMs As Integer = 4000

Dim xml As String = API.XML()
If xml <> "" Then
    Dim doc As New System.Xml.XmlDocument
    doc.LoadXml(xml)

    Dim slotMapNode As System.Xml.XmlNode = doc.SelectSingleNode(slotMapSelector)
    If slotMapNode IsNot Nothing Then
        Dim overlayNodes As System.Xml.XmlNodeList = slotMapNode.SelectNodes("overlay")

        If overlayNodes IsNot Nothing AndAlso overlayNodes.Count > 0 Then
            Dim slotNode As System.Xml.XmlNode = overlayNodes.Item(0)

            If slotNode IsNot Nothing AndAlso slotNode.Attributes("key") IsNot Nothing Then
                Dim assignedKey As String = slotNode.Attributes("key").Value
                Dim assignedInputNode As System.Xml.XmlNode = doc.SelectSingleNode("//input[@key='" & assignedKey & "']")

                If assignedInputNode IsNot Nothing AndAlso assignedInputNode.Attributes("title") IsNot Nothing Then
                    Dim assignedTitle As String = assignedInputNode.Attributes("title").Value

                    Select Case assignedTitle
                        Case "Host A"
                            dataRow = "0"
                        Case "Guest A"
                            dataRow = "1"
                        Case Else
                            dataRow = ""
                    End Select

                    If dataRow <> "" Then
                        API.Function("DataSourceSelectRow", Value:="Roster,Lower Thirds," & dataRow)
                        API.Function("OverlayInput1In", Input:=lowerThirdInput)
                        Sleep(displayMs)
                        API.Function("OverlayInput1Out")
                    End If
                End If
            End If
        End If
    End If
End If
