import React from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBackground } from '../components/AppBackground';
import { TERMS_AND_CONDITIONS_TEXT } from '../content/termsAndConditions';
import { styles } from './TermsAndConditionsScreen.styles';

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
        <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
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

