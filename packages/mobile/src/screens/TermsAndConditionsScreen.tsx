import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { TERMS_AND_CONDITIONS_TEXT } from '../content/termsAndConditions';
import { colors, spacing } from '../theme';

/** Native Terms & Conditions — edit text in content/termsAndConditions.ts */
export function TermsAndConditionsScreen({ onBack }: { onBack: () => void }) {
  const paragraphs = TERMS_AND_CONDITIONS_TEXT.split(/\n\n+/).filter(Boolean);

  return (
    <SafeAreaView style={styles.root}>
      <AppBackground />
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Terms & Conditions</Text>
        <View style={styles.headerRight} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.overline}>ASTRO ADMIN</Text>
        {paragraphs.map((block, index) => (
          <Text key={index} style={styles.paragraph}>
            {block.trim()}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(2),
    paddingHorizontal: spacing(5),
    paddingTop: spacing(3),
    paddingBottom: spacing(2),
  },
  backBtn: { paddingVertical: spacing(1), paddingHorizontal: spacing(1), minWidth: 64 },
  backText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  headerRight: { width: 64 },
  title: {
    flex: 1,
    color: colors.foreground,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing(5),
    paddingBottom: spacing(6),
    gap: spacing(3),
    alignItems: 'center',
  },
  logo: { width: 64, height: 64, marginTop: spacing(1) },
  overline: {
    color: '#c9a0ff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: spacing(1),
  },
  paragraph: {
    alignSelf: 'stretch',
    color: colors.foreground,
    fontSize: 14,
    lineHeight: 22,
  },
});
