import { truthyFlag } from './parse';

/** Shape from `/SubAdmin/get-sos-flag` → `data.block`. */
export type SosBlockInfo = {
  enabled?: boolean;
  blockedById?: string;
  blockedByName?: string;
  blockedAt?: string;
  location?: string;
  officeLocation?: string;
  type?: string;
};

export type SosFlagPayload = {
  sosEnabled?: boolean;
  enabled?: boolean;
  block?: SosBlockInfo;
  data?: {
    sosEnabled?: boolean;
    enabled?: boolean;
    block?: SosBlockInfo;
  };
  payload?: SosFlagPayload;
};

/** Prefer `data.block` / `block` from get-sos-flag. */
export function getSosBlock(payload: unknown): SosBlockInfo | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as SosFlagPayload & Record<string, unknown>;
  if (obj.block && typeof obj.block === 'object') return obj.block;
  if (obj.data?.block && typeof obj.data.block === 'object') return obj.data.block;
  if (obj.payload && typeof obj.payload === 'object') {
    return getSosBlock(obj.payload);
  }
  return null;
}

export function isSosFlagEnabled(payload: unknown): boolean {
  if (payload == null) return false;

  const block = getSosBlock(payload);
  if (block) return truthyFlag(block.enabled);

  if (typeof payload !== 'object') return truthyFlag(payload);

  const obj = payload as SosFlagPayload & {
    sos?: boolean;
    sos_flag?: boolean;
    sosFlag?: boolean;
    flag?: boolean;
  };
  if (obj.sosEnabled === true || obj.enabled === true) return true;
  if (obj.sos === true || obj.sos_flag === true || obj.sosFlag === true || obj.flag === true) {
    return true;
  }
  if (obj.data?.sosEnabled === true || obj.data?.enabled === true) return true;
  if (obj.payload && typeof obj.payload === 'object') {
    return isSosFlagEnabled(obj.payload);
  }
  return false;
}
