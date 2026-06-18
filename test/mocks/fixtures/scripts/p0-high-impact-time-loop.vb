Dim TriggerTime As String = "01:50:00"

Do While True
    If TriggerTime = DateTime.Now.ToString("hh:mm:ss") Then
        API.Function("StartStreaming", Value:="")
    End If

    Sleep(250)
Loop
