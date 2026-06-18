Do While True
    Dim xml As String = API.XML()

    If xml <> "" Then
        API.Function("SetVolume", Input:="{host-camera-key}", Value:="100")
        API.Function("SetVolume", Input:="{guest-camera-key}", Value:="100")
        API.Function("SetVolume", Input:="{lower-third-key}", Value:="0")
        API.Function("AudioBusOn", Input:="{host-camera-key}", Value:="A")
        API.Function("AudioBusOff", Input:="{guest-camera-key}", Value:="A")
    End If

    Sleep(200)
Loop
