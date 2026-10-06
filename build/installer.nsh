LangString bigorangeUserDataPrompt 1033 "Delete user data?"
LangString bigorangeUserDataPrompt 2052 "是否删除用户数据？"
LangString bigorangeUserDataPrompt 1057 "Hapus data pengguna?"

!macro customUnInstall
  ; Electron always uses per-user app data, so look under the current user's
  ; roaming profile even when the installation itself is per-machine.
  ${if} $installMode == "all"
    SetShellVarContext current
  ${endif}

  IfFileExists "$APPDATA\${APP_FILENAME}\*.*" 0 bigorange_skipUserDataPrompt

  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(bigorangeUserDataPrompt)" /SD IDNO IDYES bigorange_deleteUserData
  Goto bigorange_skipUserDataPrompt

  bigorange_deleteUserData:
    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif

  bigorange_skipUserDataPrompt:
  ${if} $installMode == "all"
    SetShellVarContext all
  ${endif}
!macroend
