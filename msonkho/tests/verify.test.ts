import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLink, findLink, isMraHost, parseLink } from '../src/lib/verify.ts';

test('A genuine EIS receipt link is an MRA document link', () => {
  const r = checkLink('https://eservices.mra.mw/doc/v/?vc=90241313200014&c=fdd8d5ccc06a49d6a1efbf7e3896f0b4');
  assert.equal(r.verdict, 'mra');
  assert.equal(r.isDocumentLink, true);
  assert.equal(r.documentCode, '90241313200014');
  assert.equal(r.host, 'eservices.mra.mw');
  assert.equal(r.openUrl, 'https://eservices.mra.mw/doc/v/?vc=90241313200014&c=fdd8d5ccc06a49d6a1efbf7e3896f0b4');
});

test('MRA addresses: the main site and any subdomain', () => {
  assert.equal(checkLink('https://www.mra.mw').verdict, 'mra');
  assert.equal(checkLink('https://mra.mw/').verdict, 'mra');
  assert.equal(checkLink('HTTPS://ESERVICES.MRA.MW/doc/v/?vc=1').verdict, 'mra');
  assert.equal(checkLink('eservices.mra.mw/doc/v/?vc=123').verdict, 'mra');
  assert.equal(isMraHost('mra.mw'), true);
  assert.equal(isMraHost('notmra.mw'), false);
});

test('Plain http on MRA is flagged, and opened over https', () => {
  const r = checkLink('http://eservices.mra.mw/doc/v/?vc=1');
  assert.equal(r.verdict, 'mraInsecure');
  assert.equal(r.openUrl, 'https://eservices.mra.mw/doc/v/?vc=1');
});

test('Lookalikes: MRA in the wrong place in the address', () => {
  for (const link of [
    'https://mra.mw.verify-receipt.com/doc/v/?vc=1',
    'https://mra-mw.com/pay',
    'https://www.mra.mw-online.net',
    'https://rnra.mw/login',
    'https://msonkho-online.com',
    'https://pay-mra.net',
    'https://example.com/mra/verify',
  ]) {
    assert.equal(checkLink(link).verdict, 'lookalike', link);
  }
});

test('Tricks: a user name before the address, odd letters, raw IP addresses', () => {
  const userinfo = checkLink('https://mra.mw@evil.example/doc/v/?vc=1');
  assert.equal(userinfo.host, 'evil.example');
  assert.equal(userinfo.verdict, 'lookalike');
  assert.ok(userinfo.warnings.includes('userinfo'));

  const cyrillic = checkLink('https://eservices.mrа.mw/doc'); // Cyrillic "а"
  assert.equal(cyrillic.verdict, 'lookalike');
  assert.ok(cyrillic.warnings.includes('unicode'));

  assert.equal(checkLink('https://xn--mra-abc.mw').verdict, 'lookalike');
  assert.equal(checkLink('http://196.45.1.10/doc/v').verdict, 'lookalike');
});

test('Other websites and non-links', () => {
  assert.equal(checkLink('https://www.google.com').verdict, 'other');
  const short = checkLink('https://bit.ly/3abc');
  assert.equal(short.verdict, 'other');
  assert.ok(short.warnings.includes('shortener'));
  assert.equal(checkLink('INV-2026-000123 TOTAL 117500').verdict, 'notLink');
  assert.equal(checkLink('   ').verdict, 'empty');
  assert.equal(checkLink('ftp://mra.mw/file').verdict, 'notLink');
});

test('Finds the link inside an SMS', () => {
  const sms = 'MRA: Your tax refund of K85,000 is ready. Claim at https://mra-refunds.co/claim?id=88. Expires today!';
  assert.equal(findLink(sms), 'https://mra-refunds.co/claim?id=88');
  assert.equal(checkLink(sms).verdict, 'lookalike');
  assert.equal(findLink('Visit www.mra.mw for help.'), 'www.mra.mw');
  assert.equal(checkLink('Visit www.mra.mw for help.').verdict, 'mra');
});

test('Parser details', () => {
  const p = parseLink('https://user:pw@Example.COM.:8443/a/b?x=1#frag');
  assert.ok(p);
  assert.equal(p.host, 'example.com');
  assert.equal(p.port, '8443');
  assert.equal(p.userinfo, 'user:pw');
  assert.equal(p.path, '/a/b');
  assert.equal(p.query, '?x=1');
  assert.equal(parseLink('not a link'), undefined);
});
