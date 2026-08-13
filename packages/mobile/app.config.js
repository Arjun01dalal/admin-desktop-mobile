/**
 * Dynamic Expo config.
 * Preview/dev: omit freeRASP native plugin (stable sideload testing).
 * Production: keep freeRASP when EXPO_PUBLIC_DISABLE_RASP is not "1".
 */
const { withGradleProperties } = require('@expo/config-plugins');
const appJson = require('./app.json');

const profile = String(process.env.EAS_BUILD_PROFILE || process.env.APP_ENV || '').toLowerCase();
const raspDisabledExplicitly = process.env.EXPO_PUBLIC_DISABLE_RASP === '1';
const isPreviewOrDev =
  profile === 'preview' ||
  profile === 'development' ||
  profile === 'development-simulator';

const omitFreeRasp = raspDisabledExplicitly || isPreviewOrDev;

const basePlugins = (appJson.expo.plugins || []).filter((plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  if (omitFreeRasp && name === 'freerasp-react-native') return false;
  return true;
});

/** Raise Gradle/Kotlin heap + metaspace; skip release lint (OOM on 16GB local builds). */
function withAndroidJvmMemory(config) {
  return withGradleProperties(config, (cfg) => {
    const props = {
      'org.gradle.jvmargs':
        '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
      'kotlin.daemon.jvmargs': '-Xmx2048m -XX:MaxMetaspaceSize=512m',
      'org.gradle.workers.max': '2',
      'android.lint.checkReleaseBuilds': 'false',
    };
    for (const [key, value] of Object.entries(props)) {
      cfg.modResults = cfg.modResults.filter(
        (item) => !(item.type === 'property' && item.key === key),
      );
      cfg.modResults.push({ type: 'property', key, value });
    }
    return cfg;
  });
}

const expoConfig = {
  ...appJson.expo,
  plugins: basePlugins,
  extra: {
    ...appJson.expo.extra,
    raspDisabled: omitFreeRasp,
    easBuildProfile: profile || null,
  },
};

module.exports = withAndroidJvmMemory({
  ...appJson,
  expo: expoConfig,
});
