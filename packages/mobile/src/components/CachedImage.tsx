/**
 * Disk-backed remote images via expo-image (list thumbs, chat, banners).
 * Prefer this over RN Image for any network URI that scrolls or reappears.
 */
import React from 'react';
import { Image, type ImageContentFit, type ImageProps } from 'expo-image';

type Props = Omit<ImageProps, 'contentFit'> & {
  /** Maps to expo-image contentFit; default cover for thumbs. */
  contentFit?: ImageContentFit;
  /** RN-style alias kept for call-site familiarity. */
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
};

const RESIZE_TO_FIT: Record<NonNullable<Props['resizeMode']>, ImageContentFit> = {
  cover: 'cover',
  contain: 'contain',
  stretch: 'fill',
  center: 'none',
};

export function CachedImage({
  contentFit,
  resizeMode = 'cover',
  cachePolicy = 'memory-disk',
  recyclingKey,
  transition = 120,
  ...rest
}: Props) {
  return (
    <Image
      {...rest}
      cachePolicy={cachePolicy}
      recyclingKey={recyclingKey}
      transition={transition}
      contentFit={contentFit ?? RESIZE_TO_FIT[resizeMode]}
    />
  );
}
