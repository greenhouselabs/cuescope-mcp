' Fixture intentionally contains smart quotes and a missing Then.
Dim ActiveSecondsLeft As Integer = 12

If ActiveSecondsLeft <= 15
    API.Function("SetTextColour", Input:="{lower-third-key}", SelectedName:=”Name.Text”, Value:="#FF0000")
End If
