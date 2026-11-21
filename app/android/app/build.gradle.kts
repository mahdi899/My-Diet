import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
val hasReleaseKeystore = keystorePropertiesFile.exists()
if (hasReleaseKeystore) {
    keystorePropertiesFile.inputStream().use { keystoreProperties.load(it) }
}

val storeBilling = Properties()
val storeBillingFile = rootProject.file("store-billing.properties")
if (storeBillingFile.exists()) {
    storeBillingFile.inputStream().use { storeBilling.load(it) }
}

fun storeRsa(flavor: String): String =
    (storeBilling.getProperty("$flavor.rsa") ?: "")
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "")
        .replace("\r", "")

android {
    namespace = "ir.sabzine.sabzine_flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "ir.sabzine.sabzine_flutter"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        manifestPlaceholders["appLabel"] = "رژیم من"
    }

    if (hasReleaseKeystore) {
        signingConfigs {
            create("release") {
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
                storeFile = file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
            }
        }
    }

    buildTypes {
        release {
            signingConfig = if (hasReleaseKeystore) {
                signingConfigs.getByName("release")
            } else {
                signingConfigs.getByName("debug")
            }
        }
    }

    buildFeatures {
        buildConfig = true
    }

    flavorDimensions += "store"
    productFlavors {
        create("bazaar") {
            dimension = "store"
            buildConfigField("String", "STORE_CHANNEL", "\"bazaar\"")
            buildConfigField("String", "STORE_RSA_KEY", "\"${storeRsa("bazaar")}\"")
        }
        create("myket") {
            dimension = "store"
            buildConfigField("String", "STORE_CHANNEL", "\"myket\"")
            buildConfigField("String", "STORE_RSA_KEY", "\"${storeRsa("myket")}\"")
            manifestPlaceholders["marketApplicationId"] = "ir.mservices.market"
            manifestPlaceholders["marketBindAddress"] = "ir.mservices.market.InAppBillingService.BIND"
            manifestPlaceholders["marketPermission"] = "ir.mservices.market.BILLING"
        }
        create("preview") {
            dimension = "store"
            applicationIdSuffix = ".preview"
            versionNameSuffix = "-test"
            manifestPlaceholders["appLabel"] = "رژیم من تست"
            buildConfigField("String", "STORE_CHANNEL", "\"preview\"")
            buildConfigField("String", "STORE_RSA_KEY", "\"\"")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}

dependencies {
    implementation("com.google.android.gms:play-services-auth-api-phone:18.3.1")
    "bazaarImplementation"("com.github.cafebazaar.Poolakey:poolakey:2.2.0")
    "myketImplementation"("ir.myket:billing:2.2")
}

tasks.register("reverseLocalApi") {
    doLast {
        val properties = Properties()
        val local = rootProject.file("local.properties")
        if (!local.exists()) return@doLast
        local.inputStream().use { properties.load(it) }
        val sdk = properties.getProperty("sdk.dir") ?: return@doLast
        val adbName = if (System.getProperty("os.name").lowercase().contains("windows")) "adb.exe" else "adb"
        val adb = File(sdk, "platform-tools" + File.separator + adbName)
        if (!adb.exists()) return@doLast
        val listing = ProcessBuilder(adb.absolutePath, "devices")
            .redirectErrorStream(true)
            .start()
        val devices = listing.inputStream.bufferedReader().readText()
        listing.waitFor()
        val serials = devices.lineSequence()
            .map { it.trim() }
            .filter { it.endsWith("\tdevice") }
            .map { it.substringBefore('\t') }
            .filter { it.isNotEmpty() }
            .toList()
        for (serial in serials) {
            val reverse = ProcessBuilder(adb.absolutePath, "-s", serial, "reverse", "tcp:8000", "tcp:8000")
                .redirectErrorStream(true)
                .start()
            val output = reverse.inputStream.bufferedReader().readText().trim()
            if (reverse.waitFor() != 0) logger.warn("adb reverse tcp:8000 failed for $serial: $output")
        }
    }
}

afterEvaluate {
    tasks.matching { it.name == "preBuild" || it.name == "preDebugBuild" }.configureEach {
        dependsOn("reverseLocalApi")
    }
}
