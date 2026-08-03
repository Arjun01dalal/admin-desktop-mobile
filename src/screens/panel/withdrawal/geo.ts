import { toast } from 'react-toastify';
import type { AddressInfo } from '@/types/gcalc';
import type { Coords } from '@/controllers/LocationProvider';

export type GeoContext = {
  city: string;
  state: string;
  lat: string;
  long: string;
};

type LocationSlice = {
  coords: Coords | null;
  address: AddressInfo | null;
  requestLocation: (options?: { force?: boolean }) => Promise<Coords>;
};

/** Require lat/long + city/state for withdrawal mutations (matches old panel). */
export async function requireWithdrawalGeo(
  loc: LocationSlice,
): Promise<GeoContext | null> {
  let coords = loc.coords;
  if (!coords) {
    try {
      coords = await loc.requestLocation({ force: true });
    } catch {
      toast.error('Location Information Missing');
      return null;
    }
  }

  let address = loc.address;
  if (!address?.city || !address?.state) {
    try {
      const res = await window.gcalc?.getAddress({
        lat: coords.latitude,
        lng: coords.longitude,
        token: localStorage.getItem('token'),
      });
      if (res?.ok && res.address) address = res.address;
    } catch {
      /* fall through */
    }
  }

  if (!address?.city || !address?.state) {
    toast.error('Location Information Missing');
    return null;
  }

  return {
    city: String(address.city),
    state: String(address.state),
    lat: String(coords.latitude),
    long: String(coords.longitude),
  };
}
