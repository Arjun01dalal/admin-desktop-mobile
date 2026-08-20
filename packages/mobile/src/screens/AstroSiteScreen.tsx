/**
 * Pre-auth Astro site is native now (Splash + AstroLogin). This file used to
 * load https://astrotalk.vip/ in a WebView — that path is gone.
 * If anything still mounts this screen, jump straight to native login.
 */
import { useEffect } from 'react';

type Props = {
  onOpenAstroLogin: () => void;
  onOpenPanelLogin: () => void;
  onOpenForgot: () => void;
  onOpenTerms: () => void;
};

export function AstroSiteScreen({ onOpenAstroLogin }: Props) {
  useEffect(() => {
    onOpenAstroLogin();
  }, [onOpenAstroLogin]);
  return null;
}
