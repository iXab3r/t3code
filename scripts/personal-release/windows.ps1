$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$env:CI = 'true'
$env:VP_HOME = 'C:\BuildAgent\tools\t3-vite-plus'
$env:RUSTUP_TOOLCHAIN = '1.96.1'
$env:Path = "$env:VP_HOME\bin;$env:USERPROFILE\.cargo\bin;$env:Path"
$env:PYTHON = 'C:\Python311\python.exe'
$env:npm_config_python = $env:PYTHON
$env:npm_config_msvs_version = '2022'
$env:GYP_MSVS_VERSION = '2022'

if (-not [Environment]::UserInteractive) { throw 'T3 desktop checks require an interactive agent.' }
& "$env:VP_HOME\bin\vp.exe" env exec --node 26.12.1 --package-manager pnpm@12.14.0 node scripts/personal-release/run.mjs windows
exit $LASTEXITCODE
