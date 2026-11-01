import jetbrains.buildServer.configs.kotlin.*
import jetbrains.buildServer.configs.kotlin.buildSteps.script
import jetbrains.buildServer.configs.kotlin.triggers.VcsTrigger
import jetbrains.buildServer.configs.kotlin.triggers.vcs
import jetbrains.buildServer.configs.kotlin.vcs.GitVcsRoot

version = "2025.07"

object Toolchain {
    // Platform digests avoid Docker classic-store collisions between amd64 and arm64.
    const val NODE_IMAGE = "node:26.12.1-bookworm@sha256:5feabe6cffeab0160ea9c8a29dd9f0bbf26b1028bbe40ed6dd80dbdfb5d99aa4"
    const val ARM_NODE_IMAGE = "node:26.12.1-bookworm@sha256:86a29e21b0f756482c69a8ab23554ec4ef59062c950c6c7a7703b1f9f752c946"
}

project {
    description = "Personal Edition by Xab3r: https://github.com/iXab3r/t3code. " +
        "Releases build main only. main is the fork integration branch; upstream mirrors pingdotgg/t3code:main. " +
        "Fork PRs target main. Upstream contributions start from upstream, without fork patches. " +
        "Periodically merge upstream into main; never main into upstream. " +
        "Workflow: https://github.com/iXab3r/t3code/blob/main/docs/operations/personal-fork.md"
    vcsRoot(PersonalGit)
    buildType(Prepare)
    buildType(LinuxArm64)
    buildType(Windows)
    buildType(Release)
}

object PersonalGit : GitVcsRoot({
    id("Git")
    name = "T3 personal integration"
    url = "https://github.com/iXab3r/t3code.git"
    branch = "refs/heads/main"
})

object Prepare : BuildType({
    id("Prepare")
    name = "Prepare / Linux x64 desktop and runtime"
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
    }
    steps {
        script {
            name = "Build shared bundle, Linux desktop and WSL runtime"
            scriptContent = """
                #!/usr/bin/env bash
                mkdir -p release
                set +e
                bash scripts/personal-release/prepare.sh %build.counter% 2>&1 | tee release/prepare.log
                result=${'$'}{PIPESTATUS[0]}
                echo "##teamcity[publishArtifacts 'release/prepare.log => diagnostics']"
                exit "${'$'}result"
            """.trimIndent()
            param("plugin.docker.imageId", Toolchain.NODE_IMAGE)
            param("plugin.docker.imagePlatform", "linux")
            param("plugin.docker.run.parameters", "--user 0 --init --platform linux/amd64 --volume t3-personal-vite:/root/.vite-plus --volume t3-personal-cargo:/root/.cargo --volume t3-personal-rustup:/root/.rustup")
        }
    }
    requirements { equals("teamcity.agent.name", "Cvat") }
    failureConditions { executionTimeoutMin = 90 }
})

object LinuxArm64 : BuildType({
    id("LinuxArm64")
    name = "Linux ARM64 / desktop and CLI"
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
        // Native dependencies must not share the x64 node_modules tree.
        checkoutDir = "t3-personal-linux-arm64"
    }
    steps {
        script {
            name = "Verify ARM64 container execution"
            scriptContent = "bash scripts/personal-release/ensure-arm64.sh ${Toolchain.ARM_NODE_IMAGE}"
        }
        script {
            name = "Package and launch-check Linux ARM64"
            scriptContent = """
                #!/usr/bin/env bash
                mkdir -p release
                set +e
                bash scripts/personal-release/prepare.sh linux-arm64 2>&1 | tee release/arm64.log
                result=${'$'}{PIPESTATUS[0]}
                echo "##teamcity[publishArtifacts 'release/arm64.log => diagnostics']"
                exit "${'$'}result"
            """.trimIndent()
            param("plugin.docker.imageId", Toolchain.ARM_NODE_IMAGE)
            param("plugin.docker.imagePlatform", "linux")
            param("plugin.docker.run.parameters", "--user 0 --init --platform linux/arm64 --volume t3-personal-vite-arm64:/root/.vite-plus --volume t3-personal-cargo-arm64:/root/.cargo --volume t3-personal-rustup-arm64:/root/.rustup")
        }
    }
    requirements { equals("teamcity.agent.name", "Cvat") }
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

object Windows : BuildType({
    id("Windows")
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
    id("Release")
    name = "Release / validate and publish"
    params { param("env.T3_PUBLISH", "release") }
    vcs {
        root(PersonalGit, "+:.\n-:.repos")
        checkoutMode = CheckoutMode.ON_AGENT
    }
    steps {
        script {
            name = "Validate complete release assets"
            scriptContent = "#!/usr/bin/env bash\nset -euo pipefail\nnode scripts/personal-release/run.mjs stage-release\nbash scripts/personal-release/publish.sh"
            param("plugin.docker.imageId", Toolchain.NODE_IMAGE)
            param("plugin.docker.imagePlatform", "linux")
            param("plugin.docker.run.parameters", "--user 0 --init")
        }
    }
    requirements { equals("teamcity.agent.name", "Cvat") }
    dependencies {
        snapshot(LinuxArm64) {
            onDependencyFailure = FailureAction.CANCEL
            onDependencyCancel = FailureAction.CANCEL
        }
        snapshot(Windows) {
            onDependencyFailure = FailureAction.CANCEL
            onDependencyCancel = FailureAction.CANCEL
        }
        artifacts(Windows) {
            buildRule = sameChainOrLastFinished()
            artifactRules = "windows/** => ci-input/windows"
            cleanDestination = true
        }
        artifacts(Prepare) {
            buildRule = sameChainOrLastFinished()
            artifactRules = "linux/** => ci-input/linux"
            cleanDestination = true
        }
        artifacts(LinuxArm64) {
            buildRule = sameChainOrLastFinished()
            artifactRules = "linux-arm64/** => ci-input/linux-arm64"
            cleanDestination = true
        }
    }
    triggers {
        vcs {
            branchFilter = "+:<default>"
            triggerRules = "-:README.md\n-:AGENTS.md\n-:docs/operations/**\n-:.teamcity/**"
            quietPeriodMode = VcsTrigger.QuietPeriodMode.USE_CUSTOM
            quietPeriod = 60
        }
    }
    failureConditions { executionTimeoutMin = 15 }
})
