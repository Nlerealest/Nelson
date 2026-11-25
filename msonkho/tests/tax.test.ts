import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addVat,
  calcImport,
  calcPaye,
  calcPresumptive,
  calcWht,
  checkReceiptVat,
  extractVat,
  grossFromNet,
  transferLevy,
  vatRegistration,
} from '../src/lib/tax.ts';
import { formatK, formatKShort, formatPct, formatTyping, parseAmount } from '../src/lib/format.ts';

test('PAYE: nothing below the K170,000 tax-free band', () => {
  assert.equal(calcPaye(170_000).paye, 0);
  assert.equal(calcPaye(100_000).paye, 0);
  assert.equal(calcPaye(0).net, 0);
});

test('PAYE: K500,000 a month is K99,000 (30% above K170,000)', () => {
  const r = calcPaye(500_000);
  assert.equal(r.paye, 99_000);
  assert.equal(r.net, 401_000);
  assert.equal(r.marginalRate, 0.3);
  assert.equal(r.lines[1].taxable, 330_000);
});

test('PAYE: every band, up to the 40% top band', () => {
  // 30% of 1.4m = 420,000; 35% of 8.43m = 2,950,500; 40% of 2m = 800,000
  const r = calcPaye(12_000_000);
  assert.equal(r.paye, 420_000 + 2_950_500 + 800_000);
  assert.equal(r.marginalRate, 0.4);
  assert.deepEqual(r.lines.map((l) => l.taxable), [170_000, 1_400_000, 8_430_000, 2_000_000]);
});

test('PAYE: annual bands are twelve times the monthly bands', () => {
  assert.equal(calcPaye(6_000_000, 'year').paye, calcPaye(500_000, 'month').paye * 12);
});

test('PAYE: pension is taken from take-home pay, not from taxable pay', () => {
  const r = calcPaye(500_000, 'month', 0.05);
  assert.equal(r.paye, 99_000);
  assert.equal(r.pension, 25_000);
  assert.equal(r.net, 376_000);
  assert.equal(r.employerPension, 50_000);
});

test('Gross-up: finds the salary that leaves a given take-home pay', () => {
  assert.equal(grossFromNet(401_000).gross, 500_000);
  assert.equal(grossFromNet(150_000).gross, 150_000);
  const withPension = grossFromNet(376_000, 'month', 0.05);
  assert.equal(withPension.gross, 500_000);
  const odd = grossFromNet(1_234_567);
  assert.ok(odd.net >= 1_234_567 && odd.net - 1_234_567 < 0.02, `net ${odd.net}`);
});

test('VAT at 17.5%: add and extract', () => {
  assert.deepEqual(addVat(100_000), { net: 100_000, vat: 17_500, gross: 117_500, rate: 0.175 });
  assert.equal(extractVat(117_500).vat, 17_500);
  assert.equal(extractVat(117_500).net, 100_000);
  assert.equal(extractVat(1_000).vat, 148.94);
});

test('Receipt check: right VAT, old 16.5% VAT, none, and wrong', () => {
  assert.equal(checkReceiptVat(117_500, 17_500).status, 'ok');
  assert.equal(checkReceiptVat(116_500, 16_500).status, 'oldRate');
  assert.equal(checkReceiptVat(50_000, 0).status, 'noVat');
  assert.equal(checkReceiptVat(117_500, 25_000).status, 'mismatch');
});

test('VAT registration: compulsory from K50 million a year', () => {
  assert.equal(vatRegistration(49_999_999).mustRegister, false);
  assert.equal(vatRegistration(50_000_000).mustRegister, true);
  assert.equal(vatRegistration(25_000_000).share, 0.5);
  assert.equal(vatRegistration(30_000_000).remaining, 20_000_000);
});

test('Withholding tax by type of payment', () => {
  assert.equal(calcWht('services', 1_000_000).wht, 200_000);
  assert.equal(calcWht('supplies', 1_000_000).wht, 30_000);
  assert.equal(calcWht('construction', 1_000_000).wht, 40_000);
  assert.equal(calcWht('haulage', 500_000).netToPayee, 450_000);
  assert.equal(calcWht('winnings', 10_000).wht, 1_500);
  // Casual labour: payments up to K35,000 are exempt.
  assert.equal(calcWht('casual', 35_000).applies, false);
  assert.equal(calcWht('casual', 35_000).wht, 0);
  assert.equal(calcWht('casual', 50_000).wht, 10_000);
});

test('Presumptive tax by turnover band', () => {
  assert.deepEqual(calcPresumptive(3_000_000), { eligible: true, turnover: 3_000_000, bandIndex: 0, annualTax: 0, quarterly: 0 });
  const four = calcPresumptive(4_000_000);
  assert.ok(four.eligible);
  assert.equal(four.annualTax, 0);
  const mid = calcPresumptive(8_500_000);
  assert.ok(mid.eligible);
  assert.equal(mid.annualTax, 170_000);
  assert.equal(mid.quarterly, 42_500);
  const top = calcPresumptive(12_499_999);
  assert.ok(top.eligible && top.annualTax === 225_000);
  assert.deepEqual(calcPresumptive(12_500_000), { eligible: false, turnover: 12_500_000, mustRegisterVat: false });
  assert.deepEqual(calcPresumptive(60_000_000), { eligible: false, turnover: 60_000_000, mustRegisterVat: true });
});

test('Imports: duty on CIF, excise on CIF + duty, VAT on all three', () => {
  const r = calcImport({ cif: 1_000_000, dutyRate: 0.25, exciseRate: 0.15 });
  assert.equal(r.duty, 250_000);
  assert.equal(r.excise, 187_500);
  assert.equal(r.vat, 251_562.5);
  assert.equal(r.taxes, 689_062.5);
  assert.equal(r.landed, 1_689_062.5);
  const ev = calcImport({ cif: 1_000_000, dutyRate: 0, exciseRate: 0 });
  assert.equal(ev.taxes, 175_000);
});

test('Transfer levy: 0.05%, mobile money only above K100,000', () => {
  assert.deepEqual(transferLevy(100_000, 'mobile'), { levy: 0, exempt: true });
  assert.deepEqual(transferLevy(200_000, 'mobile'), { levy: 100, exempt: false });
  assert.deepEqual(transferLevy(50_000, 'bank'), { levy: 25, exempt: false });
});

test('Money formatting', () => {
  assert.equal(formatK(1_234_567), 'K1,234,567');
  assert.equal(formatK(148.94), 'K148.94');
  assert.equal(formatK(0.5), 'K0.50');
  assert.equal(formatK(-2500), '−K2,500');
  assert.equal(formatK(1_234.5, { decimals: 'never' }), 'K1,235');
  assert.equal(formatKShort(1_570_000), 'K1.57m');
  assert.equal(formatKShort(170_000), 'K170k');
  assert.equal(formatKShort(5_000_000_000), 'K5bn');
  assert.equal(formatPct(0.175), '17.5%');
  assert.equal(formatPct(0.3), '30%');
  assert.equal(parseAmount('K 1,250,000.50'), 1_250_000.5);
  assert.equal(parseAmount(''), 0);
  assert.equal(parseAmount('1.2.3'), 1.23);
  assert.equal(formatTyping('1250000'), '1,250,000');
  assert.equal(formatTyping('001250.755'), '1,250.75');
  assert.equal(formatTyping('.5'), '0.5');
});
