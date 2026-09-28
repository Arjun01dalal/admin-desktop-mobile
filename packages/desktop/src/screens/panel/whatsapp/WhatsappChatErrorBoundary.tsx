import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { waChrome } from '@/screens/panel/whatsapp/chrome';

type Props = {
  children: ReactNode;
  onReset?: () => void;
  resetKey?: string | null;
};

type State = {
  hasError: boolean;
  errorMessage: string;
};

/** Keeps a chat render failure inside the thread so the chat list stays usable. */
export class WhatsappChatErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorMessage: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unexpected chat error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[WhatsappChat]', error.message, String(info.componentStack || '').slice(0, 400));
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' });
    }
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <Box
        role="alert"
        sx={{
          flex: 1,
          display: 'grid',
          placeItems: 'center',
          px: 3,
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Box>
          <Typography fontWeight={700} color="text.primary" mb={1}>
            Chat failed to load
          </Typography>
          <Typography fontSize={14} mb={1.5}>
            Something went wrong while rendering this conversation. Your other chats are unaffected.
          </Typography>
          <Box
            component="button"
            type="button"
            onClick={this.handleReload}
            sx={(theme) => {
              const chrome = waChrome(theme as Theme);
              return {
                border: `1px solid ${chrome.fieldBorder}`,
                bgcolor: chrome.field,
                color: chrome.text,
                borderRadius: 2,
                px: 1.5,
                py: 0.75,
                fontSize: 13,
                cursor: 'pointer',
              };
            }}
          >
            Reload chat
          </Box>
        </Box>
      </Box>
    );
  }
}
