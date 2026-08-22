export type UpdateGameImagePayload = {
  gameId: string;
  imagePath: string;
  provider?: string;
};

export type GameImageUpdateTarget = {
  gameId: string;
  provider: string;
  name: string;
  currentImageUrl?: string;
};

/** Omit provider for Plutus-Gaming (admin-panel-domains parity). */
export function buildUpdateGameImagePayload(
  gameId: string,
  imagePath: string,
  provider: string,
): UpdateGameImagePayload {
  const payload: UpdateGameImagePayload = {
    gameId: String(gameId).trim(),
    imagePath: String(imagePath).trim(),
  };
  const providerNorm = String(provider || '').trim();
  if (providerNorm && providerNorm.toLowerCase() !== 'plutus-gaming') {
    payload.provider = providerNorm;
  }
  return payload;
}
