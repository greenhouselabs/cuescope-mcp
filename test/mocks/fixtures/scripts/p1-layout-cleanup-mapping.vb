' Sanitized sparse layout cleanup and mapping fixture.
' Based on production layout scripts, but with neutral input keys and names.
Dim layoutInput As String = "{layout-key}"
Dim clearInput As String = "Clear"
Dim expectedLayers() As Integer = {1, 2, 3, 4}

Do While True
    Dim xml As String = API.XML()

    For Each layerNumber As Integer In expectedLayers
        API.Function("SetLayer", Input:=layoutInput, Value:=CStr(layerNumber) & "," & clearInput)
    Next

    API.Function("SetLayer", Input:="{layout-key}", Value:="5,Clear")
    API.Function("SetLayer1PanX", Input:="{layout-key}", Value:="0")
    API.Function("AudioBusOn", Input:="{guest-key}", Value:="A")

    Sleep(250)
Loop
