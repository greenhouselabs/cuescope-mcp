' Sanitized high-impact show-control fixture.
' Captures top-of-show orchestration as review-only evidence, not a template.
API.Function("OverlayInputAllOff")
API.Function("SetOutput2", Value:="Preview")
API.Function("SetOutput3", Input:="{host-camera-key}", Value:="Input")
API.Function("BusXSendToMasterOn", Value:="A")
API.Function("BusXSoloOff", Value:="A")
API.Function("ScriptStop", Value:="Layout Watcher")
API.Function("ScriptStart", Value:="Layout Watcher")
API.Function("StartRecording")
API.Function("StartStreaming")
