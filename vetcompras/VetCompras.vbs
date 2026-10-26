' ============================================================
'  Abre VetCompras con un doble clic, sin ventana negra.
'  - Si el programa ya esta funcionando, solo abre el navegador.
'  - Si no, lo inicia en segundo plano y espera a que este listo.
'  Argumento opcional /sinNavegador: usado al encender el PC.
' ============================================================
Option Explicit
Dim shell, fso, carpeta, puerto, url, i, abrirNavegador

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
carpeta = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = carpeta

abrirNavegador = True
If WScript.Arguments.Count > 0 Then
  If LCase(WScript.Arguments(0)) = "/sinnavegador" Then abrirNavegador = False
End If

puerto = LeerPuerto()
url = "http://localhost:" & puerto

If Not fso.FileExists(carpeta & "\dist\index.html") Then
  MsgBox "VetCompras no esta instalado todavia." & vbCrLf & "Ejecute primero instalar.bat", vbExclamation, "VetCompras"
  WScript.Quit 1
End If

If Not EstaFuncionando() Then
  ' 0 = ventana oculta. El registro queda en registro.log para soporte tecnico.
  shell.Run "cmd /c npm start >> """ & carpeta & "\registro.log"" 2>&1", 0, False
  For i = 1 To 60
    WScript.Sleep 500
    If EstaFuncionando() Then Exit For
  Next
  If Not EstaFuncionando() Then
    MsgBox "VetCompras no pudo iniciar." & vbCrLf & vbCrLf & _
      "Revise el archivo registro.log en " & carpeta & vbCrLf & _
      "o ejecute iniciar.bat para ver el detalle.", vbCritical, "VetCompras"
    WScript.Quit 1
  End If
End If

If abrirNavegador Then shell.Run url

Function EstaFuncionando()
  Dim http
  EstaFuncionando = False
  On Error Resume Next
  Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
  http.setTimeouts 1000, 1000, 1000, 1000
  http.Open "GET", url & "/api/sesion", False
  http.Send
  If Err.Number = 0 Then
    If http.Status = 200 Then EstaFuncionando = True
  End If
  On Error GoTo 0
End Function

Function LeerPuerto()
  Dim archivo, linea
  LeerPuerto = "3000"
  If fso.FileExists(carpeta & "\.env") Then
    Set archivo = fso.OpenTextFile(carpeta & "\.env", 1)
    Do Until archivo.AtEndOfStream
      linea = Trim(archivo.ReadLine)
      If LCase(Left(linea, 7)) = "puerto=" Then LeerPuerto = Trim(Mid(linea, 8))
    Loop
    archivo.Close
  End If
End Function
