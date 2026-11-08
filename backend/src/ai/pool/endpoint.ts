import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** True for loopback, private, link-local, CGNAT, multicast and reserved ranges (IPv4 and IPv6). */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.0\.|198\.1[89]\.|22[4-9]\.|23\d\.|24\d\.|25[0-5]\.)/.test(address);
  }
  if (version === 6) {
    const value = address.toLowerCase();
    const mapped = value.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]!);
    return value === '::' || value === '::1' || /^f[cd]/.test(value) || /^fe[89ab]/.test(value) || /^ff/.test(value);
  }
  return true;
}

/**
 * Admin-defined endpoints are fetched by the server, so they must be https and resolve to public
 * addresses. `allowPrivate` exists only for local tests against a fake provider.
 */
export async function assertPublicEndpoint(baseUrl: string, allowPrivate: boolean): Promise<URL> {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('endpoint_invalid');
  }
  if (allowPrivate) {
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('endpoint_invalid');
    return url;
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('endpoint_invalid');
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error('endpoint_private');
  }
  return url;
}
