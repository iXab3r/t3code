import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.script
import jetbrains.buildServer.configs.kotlin.triggers.VcsTrigger
import jetbrains.buildServer.configs.kotlin.triggers.vcs
import jetbrains.buildServer.configs.kotlin.vcs.GitVcsRoot

version = "2026.1"

val nodeImage = "node:26.12.1-bookworm@sha256:3b764117159bda01d2396391e7789b6a9106af9729cfd001ef55e98557868310"

project {
    vcsRoot(PersonalGit)
    buildType(Prepare)
    buildType(Windows)
    buildType(Release)
}

object PersonalGit : GitVcsRoot({
    id("T3Personal_Git")
    name = "T3 personal integration"
    url = "https://github.com/iXab3r/t3code.git"
    branch = "refs/heads/personal"
})

object Prepare : BuildType({
    id("T3Personal_Prepare")
    name = "Prepare / Linux x64 runtime"
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
    }
    steps {
        script {
            name = "Build shared bundle and WSL runtime"
            scriptContent = "bash scripts/personal-release/prepare.sh %build.counter%"
            param("plugin.docker.imageId", nodeImage)
            param("plugin.docker.imagePlatform", "linux")
            param("plugin.docker.run.parameters", "--user 0 --init --platform linux/amd64 --volume t3-personal-vite:/root/.vite-plus --volume t3-personal-cargo:/root/.cargo --volume t3-personal-rustup:/root/.rustup")
        }
    }
    requirements { equals("teamcity.agent.name", "Cvat") }
    failureConditions { executionTimeoutMin = 90 }
})

object Windows : BuildType({
    id("T3Personal_Windows")
    name = "Windows x64 / installer and launch check"
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
    }
    steps {
        step {
            name = "Package and verify Windows desktop"
            type = "jetbrains_powershell"
            param("jetbrains_powershell_script_mode", "FILE")
            param("jetbrains_powershell_script_file", "scripts/personal-release/windows.ps1")
            param("jetbrains_powershell_execution", "PS1")
            param("jetbrains_powershell_noprofile", "true")
            param("jetbrains_powershell_bitness", "x64")
        }
    }
    requirements { equals("teamcity.agent.name", "laptop-g15") }
    dependencies {
        snapshot(Prepare) {
            onDependencyFailure = FailureAction.CANCEL
            onDependencyCancel = FailureAction.CANCEL
        }
        artifacts(Prepare) {
            buildRule = sameChainOrLastFinished()
            artifactRules = "prepare/** => ci-input/prepare"
            cleanDestination = true
        }
    }
    failureConditions { executionTimeoutMin = 90 }
})

object Release : BuildType({
    id("T3Personal_Release")
    name = "Release / validate and stage assets"
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
    }
    steps {
        script {
            name = "Validate complete release assets"
            scriptContent = "node scripts/personal-release/run.mjs stage-release"
            param("plugin.docker.imageId", nodeImage)
            param("plugin.docker.imagePlatform", "linux")
            param("plugin.docker.run.parameters", "--user 0 --init")
        }
    }
    requirements { equals("teamcity.agent.name", "Cvat") }
    dependencies {
        snapshot(Windows) {
            onDependencyFailure = FailureAction.CANCEL
            onDependencyCancel = FailureAction.CANCEL
        }
        artifacts(Windows) {
            buildRule = sameChainOrLastFinished()
            artifactRules = "windows/** => ci-input/windows"
            cleanDestination = true
        }
    }
    triggers { vcs { quietPeriodMode = VcsTrigger.QuietPeriodMode.USE_CUSTOM; quietPeriod = 60 } }
    failureConditions { executionTimeoutMin = 15 }
})
