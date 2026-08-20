import { useEffect, useMemo, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { AstroLogo } from '@/components/AstroLogo';
import { ThemeModeMenu } from '@/components/ThemeModeMenu';
import { TERMS_AND_CONDITIONS_TEXT } from '@/content/termsAndConditions';

type Props = {
  onBack: () => void;
};

function stripInlineStyles(html: string) {
  return html.replace(/\sstyle="[^"]*"/gi, '').replace(/\sstyle='[^']*'/gi, '');
}

/** Native Terms & Conditions — loads from api.astrothirdeye.com static page. */
export function TermsAndConditions({ onBack }: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [heading, setHeading] = useState('Terms & Conditions');
  const [bodyHtml, setBodyHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await window.gcalc?.fetchTermsAndConditions?.();
        if (cancelled) return;
        if (!res?.ok || !res.bodyHtml) {
          setError(res?.message || 'Failed to load Terms & Conditions');
          setBodyHtml('');
          return;
        }
        setHeading(res.heading || 'Terms & Conditions');
        setBodyHtml(stripInlineStyles(res.bodyHtml));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load Terms & Conditions');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fallbackParagraphs = useMemo(
    () => TERMS_AND_CONDITIONS_TEXT.split(/\n\n+/).filter(Boolean),
    [],
  );

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: isDark
          ? 'radial-gradient(circle at 50% 0%, #2b2b30 0%, #1c1c1e 55%)'
          : 'radial-gradient(circle at 50% 0%, #ffffff 0%, #f0f1f5 45%, #e8e9ee 100%)',
        color: isDark ? '#fff' : '#111',
        px: 3,
        py: 3,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          mb: 2,
        }}
      >
        <Button onClick={onBack} sx={{ color: 'text.secondary' }}>
          ← Back
        </Button>
        <ThemeModeMenu />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
        <AstroLogo size={64} />
        <Typography
          variant="overline"
          sx={{
            mt: 1,
            letterSpacing: 3,
            color: isDark ? '#c9a0ff' : '#7b4fd4',
            fontWeight: 700,
          }}
        >
          ASTRO ADMIN
        </Typography>
        <Typography variant="h5" fontWeight={700} color="text.primary" textAlign="center">
          {heading}
        </Typography>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          maxWidth: 720,
          width: '100%',
          mx: 'auto',
          pr: 1,
          pb: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': { display: 'none', width: 0, height: 0 },
        }}
      >
        {loading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {!loading && error && !bodyHtml ? (
          <>
            <Typography color="error" sx={{ mb: 2, textAlign: 'center' }}>
              {error}
            </Typography>
            {fallbackParagraphs.map((block, index) => (
              <Typography
                key={index}
                variant="body2"
                color="text.primary"
                sx={{ mb: 2, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
              >
                {block.trim()}
              </Typography>
            ))}
          </>
        ) : null}

        {!loading && bodyHtml ? (
          <Box
            sx={{
              color: 'text.primary',
              '& h1, & h2, & h3, & h4': {
                color: 'text.primary',
                fontWeight: 700,
                mt: 2.5,
                mb: 1,
              },
              '& p, & li': {
                color: 'text.primary',
                lineHeight: 1.7,
                mb: 1.25,
                fontSize: 14,
              },
              '& a': { color: 'primary.main' },
              '& hr': {
                border: 0,
                borderTop: '1px solid',
                borderColor: 'divider',
                my: 2,
              },
              '& ul, & ol': { pl: 3, mb: 2 },
            }}
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : null}
      </Box>
    </Box>
  );
}
