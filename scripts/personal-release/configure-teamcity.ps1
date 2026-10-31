$ErrorActionPreference = 'Stop'

function Invoke-TeamCity {
    & teamcity-cli @args
    if ($LASTEXITCODE -ne 0) { throw "teamcity-cli failed: $($args[0..1] -join ' ')" }
}

Invoke-TeamCity projects create T3Personal --name 'T3 Personal' --parent _Root --description 'Personal T3 desktop releases from the personal integration branch.'
Invoke-TeamCity vcs roots create T3Personal_Git --name 'T3 personal integration' --project T3Personal --url https://github.com/iXab3r/t3code.git --branch refs/heads/personal
Invoke-TeamCity projects versioned-settings config replace T3Personal --item '{"synchronizationMode":"enabled","vcsRootId":"T3Personal_Git","format":"kotlin","buildSettingsMode":"useFromVCS","allowUIEditing":false,"showSettingsChanges":true,"storeSecureValuesOutsideVcs":true,"applyChangesInDependenciesAndVcsSettings":true,"importDecision":"importFromVCS"}'
Invoke-TeamCity projects versioned-settings load T3Personal --confirm
Invoke-TeamCity projects move T3Personal --parent EyeAuras
