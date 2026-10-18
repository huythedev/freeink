; Preserve electron-builder's association registration, with fully quoted paths.
; Its v26 command quotes %1 but leaves $appExe unquoted.
!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\FreeInk.Notebook\shell\open\command" "" '"$appExe" "%1"'
  WriteRegStr SHELL_CONTEXT "Software\Classes\FreeInk.Notebook\DefaultIcon" "" '"$appExe",0'
!macroend
