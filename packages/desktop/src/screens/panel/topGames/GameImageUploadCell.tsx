import { Box, Tooltip, Typography } from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';

type Props = {
  imageUrl?: string | null;
  alt: string;
  disabled?: boolean;
  onUpdate: () => void;
  /** Square game thumb (Top/Casino) vs wide banner thumb. */
  variant?: 'square' | 'wide';
  isVideo?: boolean;
};

const FRAME = {
  square: { width: 56, height: 56 },
  wide: { width: 88, height: 50 },
} as const;

/** Thumbnail + compact update button (Top / Casino / Banner games). */
export function GameImageUploadCell({
  imageUrl,
  alt,
  disabled,
  onUpdate,
  variant = 'square',
  isVideo = false,
}: Props) {
  const frame = FRAME[variant];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        py: 0.75,
        px: 0.25,
        minWidth: variant === 'wide' ? 96 : 72,
        mx: 'auto',
      }}
    >
      <Box
        sx={{
          ...frame,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderRadius: 1.25,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          flexShrink: 0,
        }}
      >
        {imageUrl ? (
          isVideo ? (
            <Box
              component="video"
              src={imageUrl}
              controls
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box
              component="img"
              src={imageUrl}
              alt={alt}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          )
        ) : (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ px: 0.5, fontSize: 10, lineHeight: 1.2, textAlign: 'center' }}
          >
            No image
          </Typography>
        )}
      </Box>

      <Tooltip title="Update image URL" arrow placement="top">
        <Box
          component="button"
          type="button"
          disabled={disabled}
          onClick={onUpdate}
          sx={{
            minWidth: 72,
            height: 26,
            px: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.5,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'action.selected',
            color: 'text.secondary',
            fontSize: 11,
            fontWeight: 700,
            lineHeight: 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            transition: 'background-color 0.15s ease, border-color 0.15s ease',
            '&:hover': disabled
              ? undefined
              : {
                  bgcolor: 'action.hover',
                  borderColor: 'text.disabled',
                  color: 'text.primary',
                },
          }}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: 13 }} />
          URL
        </Box>
      </Tooltip>
    </Box>
  );
}
