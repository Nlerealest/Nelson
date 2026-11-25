// Checks what a QR code (or a pasted link or SMS) points to, so people can tell
// a genuine MRA receipt or document from a fake or a phishing link.
//
// Genuine EIS receipts and MRA documents carry a QR code with a link on MRA's
// own domain, mra.mw (for example https://eservices.mra.mw/doc/v/?vc=…&c=…).
// The parser below is hand-written rather than using URL, because React
// Native's URL support is incomplete and lookalike links rely on exactly the
// details (user names, odd characters) that a forgiving parser might hide.

export const MRA_DOMAIN = 'mra.mw';

export type Verdict =
  /** A link on mra.mw or one of its subdomains, over https. */
  | 'mra'
  /** On mra.mw but not over https: the right site, but open the https version. */
  | 'mraInsecure'
  /** Made to look like MRA (mentions MRA or Msonkho) but goes somewhere else. */
  | 'lookalike'
  /** A link to some other website. */
  | 'other'
  /** Not a web link at all. */
  | 'notLink'
  | 'empty';

export type Warning = 'userinfo' | 'ipAddress' | 'unicode' | 'punycode' | 'shortener' | 'noScheme';

export type LinkCheck = {
  verdict: Verdict;
  input: string;
  /** The link found in the input, when there is one. */
  url?: string;
  host?: string;
  /** For MRA document links: the validation code in the link. */
  documentCode?: string;
  /** True for MRA's document/receipt verification page. */
  isDocumentLink: boolean;
  warnings: Warning[];
  /** The link to open: always https for MRA links. */
  openUrl?: string;
};

type Parsed = { scheme: string; userinfo?: string; host: string; port?: string; path: string; query: string; hadScheme: boolean };

const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at', 'tiny.cc'];

/** Finds the first thing that looks like a link in free text (an SMS, a message). */
export function findLink(text: string): string | undefined {
  const withScheme = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/i.exec(text);
  if (withScheme) return trimTrailing(withScheme[0]);
  // Bare domains such as "eservices.mra.mw/doc/…" or "www.mra-pay.com"
  const bare = /(?:^|[\s(])((?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#][^\s<>"']*)?)/i.exec(text);
  return bare ? trimTrailing(bare[1]) : undefined;
}

function trimTrailing(link: string): string {
  return link.replace(/[).,;:!?'"\]]+$/, '');
}

export function parseLink(raw: string): Parsed | undefined {
  let text = raw.trim();
  let hadScheme = true;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    if (!/^(?:[^\s/?#@]+@)?[^\s/?#]+\.[^\s/?#]+/.test(text)) return undefined;
    text = `https://${text}`;
    hadScheme = false;
  }
  const m = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(text);
  if (!m) return undefined;
  const scheme = m[1].toLowerCase();
  let authority = m[2];
  let userinfo: string | undefined;
  const at = authority.lastIndexOf('@');
  if (at !== -1) {
    userinfo = authority.slice(0, at);
    authority = authority.slice(at + 1);
  }
  let host = authority;
  let port: string | undefined;
  if (host.startsWith('[')) {
    const end = host.indexOf(']');
    port = host.slice(end + 1).replace(/^:/, '') || undefined;
    host = host.slice(0, end + 1);
  } else {
    const colon = host.lastIndexOf(':');
    if (colon !== -1) {
      port = host.slice(colon + 1);
      host = host.slice(0, colon);
    }
  }
  host = host.toLowerCase().replace(/\.$/, '');
  if (!host) return undefined;
  return { scheme, userinfo, host, port, path: m[3] || '/', query: m[4] ?? '', hadScheme };
}

function queryParam(query: string, name: string): string | undefined {
  for (const part of query.replace(/^\?/, '').split('&')) {
    const [k, v = ''] = part.split('=');
    if (k === name) {
      try {
        return decodeURIComponent(v.replace(/\+/g, ' '));
      } catch {
        return v;
      }
    }
  }
  return undefined;
}

export function isMraHost(host: string): boolean {
  return host === MRA_DOMAIN || host.endsWith(`.${MRA_DOMAIN}`);
}

/** Mentions MRA or Msonkho, including common letter swaps (rn for m, 0 for o). */
function looksLikeMra(host: string, path: string): boolean {
  const flat = host.replace(/rn/g, 'm').replace(/0/g, 'o').replace(/1/g, 'l');
  return /(^|[^a-z])mra([^a-z]|$)|mramw|msonkho|malawirevenue|revenue-?authority/.test(flat) || /msonkho|\bmra\b/i.test(path);
}

export function checkLink(input: string): LinkCheck {
  const text = input.trim();
  const base = { input: text, isDocumentLink: false, warnings: [] as Warning[] };
  if (!text) return { ...base, verdict: 'empty' };
  const link = findLink(text);
  const parsed = link ? parseLink(link) : undefined;
  if (!link || !parsed || !['http', 'https'].includes(parsed.scheme)) {
    return { ...base, verdict: 'notLink' };
  }
  const { host, scheme, userinfo, path, query } = parsed;
  const warnings: Warning[] = [];
  if (userinfo !== undefined) warnings.push('userinfo');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith('[')) warnings.push('ipAddress');
  // Look-alike letters from other alphabets (e.g. Cyrillic "а") in the address.
  if (/[^ -~]/.test(host)) warnings.push('unicode');
  if (host.split('.').some((label) => label.startsWith('xn--'))) warnings.push('punycode');
  if (SHORTENERS.includes(host)) warnings.push('shortener');
  if (!parsed.hadScheme) warnings.push('noScheme');

  const result: Omit<LinkCheck, 'verdict'> = { ...base, url: link, host, warnings, isDocumentLink: false };
  // Any user name, odd characters or a bare IP address disqualify a link, even
  // if the rest of it looks right.
  const tricks = warnings.some((w) => w === 'userinfo' || w === 'unicode' || w === 'punycode' || w === 'ipAddress');
  if (isMraHost(host) && !tricks) {
    const isDocumentLink = /^\/doc\/v\/?$/i.test(path) || /\/verify|\/validate/i.test(path);
    const openUrl = `https://${host}${parsed.port ? `:${parsed.port}` : ''}${path}${query}`;
    return {
      ...result,
      verdict: scheme === 'https' || !parsed.hadScheme ? 'mra' : 'mraInsecure',
      isDocumentLink,
      documentCode: queryParam(query, 'vc'),
      openUrl,
    };
  }
  if (tricks || looksLikeMra(host, path)) return { ...result, verdict: 'lookalike' };
  return { ...result, verdict: 'other' };
}
