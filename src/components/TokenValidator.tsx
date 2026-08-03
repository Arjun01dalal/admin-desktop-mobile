import { useTokenValidator } from '@/hooks/useTokenValidator';

/** Mount inside the panel router — mirrors laxminarayan `<TokenValidator />`. */
export function TokenValidator() {
  useTokenValidator();
  return null;
}
