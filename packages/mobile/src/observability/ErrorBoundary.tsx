/**
 * Root error boundary — captures render crashes and offers retry.
 */
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { captureException } from './sentry';

type Props = {
  children: ReactNode;
  /** Optional label for Sentry tags. */
  name?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, {
      boundary: this.props.name || 'root',
      componentStack: info.componentStack,
    });
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: spacing(6),
          backgroundColor: colors.background,
        }}
      >
        <Text
          style={{
            color: colors.foreground,
            fontSize: 18,
            fontWeight: '800',
            marginBottom: spacing(2),
          }}
        >
          Something went wrong
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: spacing(4) }}>
          {__DEV__ ? this.state.error.message : 'Please try again. If it keeps happening, contact support.'}
        </Text>
        <TouchableOpacity
          onPress={this.retry}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: colors.primary,
            paddingHorizontal: spacing(4),
            paddingVertical: spacing(2.5),
            borderRadius: radius.md,
          }}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
