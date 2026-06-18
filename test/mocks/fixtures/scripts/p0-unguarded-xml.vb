Dim x As New System.Xml.XmlDocument
x.LoadXml(API.XML())

Dim NodeList As XmlNodeList = x.SelectSingleNode("/vmix/inputs/input[@shortTitle='Mix Layouts']").SelectNodes("overlay")
Dim MNumber1 As String = NodeList.Item(0).Attributes.GetNamedItem("key").Value
Dim AssignedInput As String = x.SelectSingleNode("/vmix/inputs/input[@key='" & MNumber1 & "']").Attributes.GetNamedItem("title").Value
