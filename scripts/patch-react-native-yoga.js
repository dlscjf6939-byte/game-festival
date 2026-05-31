const fs = require('fs');
const path = require('path');

function patchFile(target, patcher, label) {
  if (!fs.existsSync(target)) {
    console.warn(`[postinstall] ${label} not found, skipping patch.`);
    return;
  }

  const source = fs.readFileSync(target, 'utf8');
  const patched = patcher(source);

  if (patched === source) {
    console.log(`[postinstall] ${label} already patched.`);
    return;
  }

  fs.writeFileSync(target, patched);
  console.log(`[postinstall] Patched ${label}.`);
}

const yogaValueHeader = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native',
  'ReactCommon',
  'yoga',
  'yoga',
  'YGValue.h',
);

patchFile(
  yogaValueHeader,
  source => {
    let patched = source;

    if (!patched.includes('#include <stdint.h>')) {
      patched = patched.replace(
        '#include <math.h>',
        '#include <math.h>\n#include <stdint.h>',
      );
    }

    return patched
      .replaceAll('operator"" _pt', 'operator""_pt')
      .replaceAll('operator"" _percent', 'operator""_percent');
  },
  'React Native Yoga YGValue.h',
);

const cameraKitPackage = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-camera-kit',
  'android',
  'src',
  'main',
  'java',
  'com',
  'rncamerakit',
  'RNCameraKitPackage.kt',
);

patchFile(
  cameraKitPackage,
  source => {
    let patched = source.replace(
      `                false,  // needsEagerInit
                false,  // isCxxModule
                isTurboModule // isTurboModule`,
      `                false,  // needsEagerInit
                false,  // hasConstants
                false,  // isCxxModule
                isTurboModule // isTurboModule`,
    );

    patched = patched.replace(
      `                false,  // needsEagerInit
                false,  // hasConstants
                false,  // isCxxModule
                isTurboModule // isTurboModule`,
      `                false,  // needsEagerInit
                false,  // hasConstants
                false,  // isCxxModule
                isTurboModule // isTurboModule`,
    );

    return patched;
  },
  'react-native-camera-kit RNCameraKitPackage.kt',
);

const cameraKitGradle = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-native-camera-kit',
  'android',
  'build.gradle',
);

patchFile(
  cameraKitGradle,
  source => source.replace('def camerax_version = "1.4.2"', 'def camerax_version = "1.3.4"'),
  'react-native-camera-kit android/build.gradle',
);

const reactNativeGradlePluginBuild = path.join(
  __dirname,
  '..',
  'node_modules',
  '@react-native',
  'gradle-plugin',
  'build.gradle.kts',
);

patchFile(
  reactNativeGradlePluginBuild,
  source =>
    source.replace(
      '  kotlin("jvm") version "1.7.22"',
      '  kotlin("jvm") version "1.9.20"',
    ),
  'React Native Gradle plugin build.gradle.kts',
);
