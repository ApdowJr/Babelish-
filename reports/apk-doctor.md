# APK doctor

build-tools: /usr/local/lib/android/sdk/build-tools/37.0.0

## The file
```
-rw-r--r-- 1 runner runner 47520190 Oct 24 05:45 /tmp/apk/babelish.apk
8bfa1e2dc671f1693bf10e6049dfa7fc6566eb328ca6c38429331bf12f006c95  /tmp/apk/babelish.apk
size: 47520190 bytes
zip magic: PK
APK Sig Block 42 count: 1
```

## Zip integrity
```
    testing: res/zw.9.png             OK
    testing: resources.arsc           OK
No errors detected in compressed data of /tmp/apk/babelish.apk.
```

## Contents
```
Archive:  /tmp/apk/babelish.apk
  Length      Date    Time    Name
---------  ---------- -----   ----
       56  1981-01-01 01:01   META-INF/com/android/build/gradle/app-metadata.properties
       46  1981-01-01 01:01   META-INF/version-control-info.textproto
     3190  1981-01-01 01:01   assets/dexopt/baseline.prof
--- manifest / dex / libs ---
classes.dex
lib/arm64-v8a/libappmodules.so
lib/arm64-v8a/libc++_shared.so
lib/arm64-v8a/libdatastore_shared_counter.so
lib/arm64-v8a/libexpo-modules-core.so
lib/arm64-v8a/libexpo-modules-jsi.so
lib/arm64-v8a/libexpo-modules-v2.so
lib/arm64-v8a/libfbjni.so
lib/arm64-v8a/libgesturehandler.so
lib/arm64-v8a/libgifimage.so
lib/arm64-v8a/libhermestooling.so
lib/arm64-v8a/libhermesvm.so
lib/arm64-v8a/libimagepipeline.so
lib/arm64-v8a/libjsi.so
lib/arm64-v8a/libnative-filters.so
lib/arm64-v8a/libnative-imagetranscoder.so
lib/arm64-v8a/libreact_codegen_rngesturehandler_codegen.so
lib/arm64-v8a/libreact_codegen_rnscreens.so
lib/arm64-v8a/libreact_codegen_safeareacontext.so
lib/arm64-v8a/libreactnative.so
lib/arm64-v8a/librnscreens.so
lib/arm64-v8a/libstatic-webp.so
lib/arm64-v8a/libzstd-kmp.so
lib/armeabi-v7a/libappmodules.so
lib/armeabi-v7a/libc++_shared.so
lib/armeabi-v7a/libdatastore_shared_counter.so
lib/armeabi-v7a/libexpo-modules-core.so
lib/armeabi-v7a/libexpo-modules-jsi.so
lib/armeabi-v7a/libexpo-modules-v2.so
lib/armeabi-v7a/libfbjni.so
lib/armeabi-v7a/libgesturehandler.so
lib/armeabi-v7a/libgifimage.so
lib/armeabi-v7a/libhermestooling.so
lib/armeabi-v7a/libhermesvm.so
lib/armeabi-v7a/libimagepipeline.so
lib/armeabi-v7a/libjsi.so
lib/armeabi-v7a/libnative-filters.so
lib/armeabi-v7a/libnative-imagetranscoder.so
lib/armeabi-v7a/libreact_codegen_rngesturehandler_codegen.so
lib/armeabi-v7a/libreact_codegen_rnscreens.so
--- signature files ---
(none)
```

## Signature
```
Verifies
Verified using v1 scheme (JAR signing): false
Verified using v2 scheme (APK Signature Scheme v2): true
Verified using v3 scheme (APK Signature Scheme v3): false
Verified using v3.1 scheme (APK Signature Scheme v3.1): false
Verified using v3.2 scheme (APK Signature Scheme v3.2): false
Verified using v4 scheme (APK Signature Scheme v4): false
Verified for SourceStamp: false
Number of signers: 1
V2 Signer: certificate DN: CN=Android Debug, OU=Android, O=Unknown, L=Unknown, ST=Unknown, C=US
V2 Signer: certificate SHA-256 digest: fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c
V2 Signer: certificate SHA-1 digest: 5e8f16062ea3cd2c4a0d547876baa6f38cabf625
V2 Signer: certificate MD5 digest: 20f46148b72d8e5e5ca23d37a4f41490
V2 Signer: key algorithm: RSA
V2 Signer: key size (bits): 2048
V2 Signer: public key SHA-256 digest: 06104aa0b28fac286bae06b08313ac69c37c35a6462853db32d2ec5fa7b1ed0e
V2 Signer: public key SHA-1 digest: 88325602a013a12d5ac13516c609aa57ce9e2234
V2 Signer: public key MD5 digest: 49921988ad9941656cd9b95203196f17
```

## Alignment
```
45564133 res/zp.xml (OK - compressed)
45564392 res/zq.xml (OK - compressed)
45564704 res/zw.9.png (OK)
45566260 resources.arsc (OK)
Verification successful
```

## Manifest
```
package: name='app.zelvoca.babelish' versionCode='30400' versionName='3.4.0' platformBuildVersionName='17' platformBuildVersionCode='37' compileSdkVersion='37' compileSdkVersionCodename='17'
targetSdkVersion:'36'
application-label:'Babelish'
native-code: 'arm64-v8a' 'armeabi-v7a'
--- first lines ---
package: name='app.zelvoca.babelish' versionCode='30400' versionName='3.4.0' platformBuildVersionName='17' platformBuildVersionCode='37' compileSdkVersion='37' compileSdkVersionCodename='17'
minSdkVersion:'24'
targetSdkVersion:'36'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.MODIFY_AUDIO_SETTINGS'
uses-permission: name='android.permission.POST_NOTIFICATIONS'
uses-permission: name='android.permission.READ_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.RECORD_AUDIO'
uses-permission: name='android.permission.SYSTEM_ALERT_WINDOW'
uses-permission: name='android.permission.VIBRATE'
uses-permission: name='android.permission.WRITE_EXTERNAL_STORAGE' maxSdkVersion='32'
uses-permission: name='android.permission.RECEIVE_BOOT_COMPLETED'
uses-permission: name='android.permission.ACCESS_NETWORK_STATE'
uses-permission: name='android.permission.WAKE_LOCK'
uses-permission: name='com.google.android.c2dm.permission.RECEIVE'
```
