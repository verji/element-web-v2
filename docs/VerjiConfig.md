## Element features
-   `UIFeature.urlPreviews` - Whether URL previews are enabled across the entire application.
-   `UIFeature.feedback` - Whether prompts to supply feedback are shown.
-   `UIFeature.voip` - Whether or not VoIP is shown readily to the user. When disabled,
    Jitsi widgets will still work though they cannot easily be added.
-   `UIFeature.widgets` - Whether or not widgets will be shown.
-   `UIFeature.advancedSettings` - Whether or not sections titled "advanced" in room and
    user settings are shown to the user.
-   `UIFeature.shareQrCode` - Whether or not the QR code on the share room/event dialog
    is shown.
-   `UIFeature.shareSocial` - Whether or not the social icons on the share room/event dialog
    are shown.
-   `UIFeature.identityServer` - Whether or not functionality requiring an identity server
    is shown. When disabled, the user will not be able to interact with the identity
    server (sharing email addresses, 3PID invites, etc).
-   `UIFeature.thirdPartyId` - Whether or not UI relating to third party identifiers (3PIDs)
    is shown. Typically this is considered "contact information" on the homeserver, and is
    not directly related to the identity server.
-   `UIFeature.registration` - Whether or not the registration page is accessible. Typically
    useful if accounts are managed externally.
-   `UIFeature.passwordReset` - Whether or not the password reset page is accessible. Typically
    useful if accounts are managed externally.
-   `UIFeature.deactivate` - Whether or not the deactivate account button is accessible. Typically
    useful if accounts are managed externally.
-   `UIFeature.advancedEncryption` - Whether or not advanced encryption options are shown to the
    user.
-   `UIFeature.roomHistorySettings` - Whether or not the room history settings are shown to the user.
    This should only be used if the room history visibility options are managed by the server.
-   `UIFeature.TimelineEnableRelativeDates` - Display relative date separators (eg: 'Today', 'Yesterday') in the
    timeline for recent messages. When false day dates will be used.
-   `UIFeature.BulkUnverifiedSessionsReminder` - Display popup reminders to verify or remove unverified sessions. Defaults
    to true.
-   `UIFeature.locationSharing` - Whether or not location sharing menus will be shown.

## Verji features

-   `UIFeature.homePageButtons` - Shows/hides the 3 buttons on the homepage.
    Used by : Homepage.tsx
-   `UIFeature.userInfoVerifyDevice` - Shows/hide the Verify device component in the user panel.
    Used by : UserInfo.tsx
-   `UIFeature.userInfoShareLinkToUserButton` - Shows/hide the the share room link in the user panel
    Used by : UserInfo.tsx.tsx
-   `UIFeature.userInfoRedactButton` - Shows/hide the redact button.
    Used by : UserInfo.tsx & RoomList.tsx
-   `UIFeature.roomListExplorePublicRooms` - Shows/hide the possibility to explore public rooms.
    Used by : Settings.tsx
-   `UIFeature.createRoomE2eeSection` - Shows/hide the possibility to create non encrypted rooms. Verji only creates encrypted rooms.
    Used by : CreateRoomDialog.ts
-   `UIFeature.createRoomShowJoinRuleDropdown` - Shows/hides the option to create rules for a room.
    Used by : CreateRoomDialog.ts
-   `UIFeature.createRoomShowAdvancedSettings` - Shows/hides the advanced settings for a room.
    Used by : CreateRoomDialog.ts
-   `UIFeature.roomSummaryFilesOption` - Shows/hides the possiblity for adding files to the room.
    Used by : RoomContextMenu.tsx & RoomSummaryCard.tsx
-   `UIFeature.newRoomIntroInviteThisRoom` - Show/Hides invite to this room button.
    Used by : NewRoomIntro.tsx
-   `UIFeature.emailAddressShowRemoveButton` - Show/Hides the remove address button.
    Used by : EmailAddresses.tsx
-   `UIFeature.emailAddressShowAddButton` - Show/Hides the add new address button.
    Used by : EmailAddresses.tsx
-   `UIFeature.phoneNumerShowRemoveButton` - Shows/hides the possibility to remove a phonenumber.
    Used by : PhoneNumbers.tsx
-   `UIFeature.phoneNumerShowAddButton` - Show/hides the possiblity to add a phone number.
    Used by : PhoneNumbers.tsx
-   `UIFeature.roomSettingsAlias` - Show/hides the alias settings for a room.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsExternalAccount` - Show/hides external account settings.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsDiscovery` - Show/hides the discover other entities/servers.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsSetIdServer` - Show/hides the option to change identity server.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsIntegrationManager` - Show/hides the integration manager component.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsChangePassword` - Show/hides the possibility to change password.
    Used by : GeneralRoomSettingTab.tsx
-   `UIFeature.userSettingsResetCrossSigning` - Show/hides the possibility to reset crossigning.
    Used by : CrossSigningsPanel.tsx
-   `UIFeature.userSettingsDeleteBackup` - Show/hides the possibility to delete backup keys.
    Used by : SecureBackupPanel.tsx
-   `UIFeature.userSettingsResetBackup` - Show/hides the possibility to reset backup keys.
    Used by : SecureBackupPanel.tsx
-   `UIFeature.setupEncryptionResetButton` - Show/hides the possibility to reset encryption.
    Used by : SetupEncryptionBody.tsx
-   `UIFeature.accountSendAccountEvent` - Shows/hides dev tools options to send account events.
    Used by : AccountData.tsx
-   `UIFeature.accountSendRoomEvent` - Shows/hides dev tools options to send room events.
    Used by : AccountData.tsx
-   `UIFeature.enableLoginPage` - Enables/disables the login page.
    Used by : Login.tsx
-   `UIFeature.enableNewRoomIntro` - Enables/disbles the new room intro.
    Used by : CreationGrouper.tsx
-   `UIFeature.enableRoomDevTools` - Enables/disables dev tools in the room
    Used by : DevtoolsDialog.tsx
-   `UIFeature.exportDefaultSizeLimit` - False sets the limit to 20MB and removes UI to adjust limit vs 8MB and the option to set size.
    Used by : ExportDialog.tsx
-   `UIFeature.allExportTypes` - False Sets the export to export from beginning, else use a timeline.
    Used by : ExportDialog.tsx
-   `UIFeature.exportAttatchmentsDefaultOff` - False will always export attachments.
    Used by : ExportDialog.tsx
-   `UIFeature.roomSettingsSecurity` - Shows/hide the room security settings tab.
    Used by : RoomSettingsDialog.tsx
-   `UIFeature.baseToolActionButton` - Shows/Hides dev tools options.
    Used by : BaseTool.tsx
-   `UIFeature.networkOptions` - Shows/hides networks for user.
    Used by : NetworkDropdown.tsx
-   `UIFeature.searchWarnings` - Enables/disables search in files.
    Used by : Settings.tsx
-   `UIFeature.powerSelectorCustomValue` - Enables/disables powerlevel.
    Used by : Settings.tsx
-   `UIFeature.customThemePanel` - Enables/diasbles option to change theme.
    Used by : ThemeChoicePanel.tsx
-   `UIFeature.videoMirrorLocalVideo` - Enables/Disbles possibiity to flis video.
    Used by : VoiceUserSettingsTab.tsx
-   `UIFeature.videoConnectionSettings` - Shows/hides the video connection settings.
    Used by : VoiceUserSettingsTab.tsx
-   `UIFeature.spotlightDialogShowOtherSearches` - Enables/disables filtering of public spaces.
    Used by : Spotlightdialog.tsx
-   `UIFeature.showCreateSpaceButton` - Show/hide the create space button.
    Used by : SpaceRoomView.tsx
-   `UIFeature.showSpaceLandingPageDetails` - Shows/hides the spaces landing page.
    Used by : SpaceRoomView.tsx & SpacecontextMenu.tsx & RoomInfoLine.tsx
-   `UIFeature.showSendMessageToUserLink` - Shows/hides the SendInvitationLink on InviteDialog.
    Used by : InviteDialog.tsx
-   `UIFeature.helpShowMatrixDisclosurePolicyAndLinks` - Show/hides the Matrix disclorures policies and links to register on GIT
    Used by : BugreportDialog.tsx & Helpusersettingstab.tsx
-   `UIFeature.showSendMessageToUserLink` - Show/hides the MessageSearch notice about searching in encrypted.
    Used by : SecuritySettingsTab.tsx
-   `UIFeature.searchShortcutPreferences` - Show/hides keybindingssettings.
    Used by : PreferenceUserSettingsTab.tsx
-   `UIFeature.showStickersButtonSetting` - hows/hides stickersettings.
    Used by : PreferenceUserSettingsTab.tsx
-   `UIFeature.unverifiedSessionsToast` - Shows/hide Unferified session toast.
    Used by : BulkUnverifiedSessionsToast.tsx
-   `UIFeature.insertTrailingColonSetting` - 
    Used by : PreferenceUserSettingsTab.tsx
-   `UIFeature.showJoinLeavesSetting` - Shows/hides option to show who joins or leaves the rooms.
    Used by : PreferenceUserSettingsTab.tsx
-   `UIFeature.showChatEffectSetting` - Show/hides the option to show chat effects.
    Used by : PreferenceUserSettingsTab.tsx
-   `UIFeature.addSubSpace` - Shows/hide the add subspace button.
    Used by : SpaceContextMenu.tsx
-   `UIFeature.addSpace` - Shows/hide the add space button.
    Used by : RoomListHeader.tsx
-   `UIFeature.showAddMoreButtonForSpaces` - Show/hides invite button to space.
    Used by : SpaceRoomView.tsx
-   `UIFeature.addExistingRoomToSpace` - Shows/hides the possibility to add existing rooms to space.
    Used by : RoomList.tsx  & RoomListHeader.tsx
-   `UIFeature.showInviteToSpaceFromPeoplePlus` - Shows/hide the invite people to space button.
    Used by : RoomList.tsx
-   `UIFeature.showExploreRoomsButton` - Shows/hides the Explore rooms button.
    Used by : LeftPanel.tsx
-   `UIFeature.showAddWidgetsInRoomInfo` - Shows/hides the add widget option for rooms.
    Used by : RoomSummarycard.tsx
-   `UIFeature.widgetContextDeleteButton` - Shows/hide the delete widget button.
    Used by : WidgetContextMenu.tsx
-   `UIFeature.roomPreviewRejectIgnoreButton` - Shows/hides the reject/ignore button.
    Used by : RoomPreviewBar.tsx
-   `UIFeature.multipleCallsInRoom` - Shows/hides the jitsi call for multipe persons in videocall.
    Used by : LegacyCallHandler.tsx
-   `UIFeature.showPlusMenuForMetaSpace` - Shows/hides the add meta space.
    Used by : RoomListHeader.tsx
-   `UIFeature.showStartChatPlusMenuForMetaSpace` - Shows/hides the possibility for chat in metaspaces.
    Used by : RoomList.tsx
-   `UIFeature.showAddRoomPlusMenuForMetaSpace` - Shows/hides the possibility to add rooms to metaspaces.
    Used by : RoomList.tsx
-   `UIFeature.showMembersListForSpaces` - Shows/hides the memberslist for metaspaces.
    Used by : SpaceRoomView.tsx
-   `UIFeature.showRoomMembersInSuggestions` - Shows/hide RoomMembers in InviteDialog/SpotlightDialog suggestions. If false the suggestions will rely on search results
-   `UIFeature.showRecentsInSuggestions` - Show/Hide the "Recents" Suggestions, in Invite Dialog
-   `UIFeature.allowDirectUserInvite` - Determines whether or not you are allowed to invite a user directly by user id.
    Used by : [verji-onboarding-module] - CustomInviteDialog.tsx
-   `UIFeature.searchInAllRooms` - Shows/hides "All rooms" tab in  when you search in rooms.
    Used by : SearchBar.tsx
-   `UIFeature.leaveSpaceButton` - Shows/hides "Leave Space" button in Space-Settings
    Used by : SpaceSettingsGeneralTab.tsx
## How to use feature flags
First we have to define them in the element framework
-   UIFeatures.ts : SearchWarning = "UIFeature.SearchWarning"
-   Settings.ts
```
        [UIFeature.SearchWarning]: {
            supportedLevels: LEVELS_UI_FEATURE,
            default: true,
        },
```
Second we have to define in our local config.json under section 'SettingsDefaults'
-   config.json : "UIFeature.SearchWarning": false,

And to use it we apply this check to the component we wish to control, like this
```
     if (!SettingsStore.getValue(UIFeature.SearchWarning ) return <></>;
     or
    {SettingsStore.getValue(UIFeature.HomePageButtons) && showButtons}
```

# Custom Verji Modules

Verji uses the matrix/element module system to dynamically build customised features. Some hooks for these customisations needs to be maintained in matrix-react-sdk. We mainly have two types of modules.

* GUI-modules (Custom components)
    - Uses a lifecycle to swap an existing component, with our custom component(s)
* Extenstion-modules
    - Uses hooks to inject custom logic and features

## Verji GUI-Modules
- [@verji/verji-usermenu-module](https://github.com/verji/verji-usermenu-module)
- [@verji/verji-onboarding-module](https://github.com/verji/verji-onboarding-module)
- [@verji/verji-news-module](https://github.com/verji/verji-news-module)

## Verji Extension Modules
- [@verji/verji-usersearch-module](https://github.com/verji/verji-usersearch-module)
- [@verji/verji-cryptosetup-module](https://github.com/verji/verji-cryptosetup-module)
