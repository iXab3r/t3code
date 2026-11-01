$ErrorActionPreference = 'Stop'

function Invoke-TeamCity {
    & teamcity-cli @args
    if ($LASTEXITCODE -ne 0) { throw "teamcity-cli failed: $($args[0..1] -join ' ')" }
}

$description = 'Personal Edition by Xab3r: https://github.com/iXab3r/t3code. Releases build main only. main is the fork integration branch; upstream mirrors pingdotgg/t3code:main. Fork PRs target main. Upstream contributions start from upstream, without fork patches. Periodically merge upstream into main; never main into upstream. personal is legacy. Workflow: https://github.com/iXab3r/t3code/blob/main/docs/operations/personal-fork.md'
Invoke-TeamCity projects create T3Personal --name 'T3 Personal' --parent EyeAuras --description $description
Invoke-TeamCity vcs roots create T3Personal_Git --name 'T3 personal integration' --project T3Personal --url https://github.com/iXab3r/t3code.git --branch refs/heads/main
# Current settings keep inherited credentials current instead of replaying a build-settings snapshot.
Invoke-TeamCity projects versioned-settings config replace T3Personal --item '{"synchronizationMode":"enabled","vcsRootId":"T3Personal_Git","format":"kotlin","buildSettingsMode":"alwaysUseCurrent","allowUIEditing":false,"showSettingsChanges":true,"storeSecureValuesOutsideVcs":true,"applyChangesInDependenciesAndVcsSettings":true,"importDecision":"importFromVCS"}'
Invoke-TeamCity projects versioned-settings load T3Personal --confirm
