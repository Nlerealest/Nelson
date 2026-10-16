// Persists app data in the browser's localStorage. Nothing leaves the phone.

import { toDateKey, addMonths, monthOf } from './logic.js';

const KEY = 'ndalama:v1';

export function emptyData() {
  return { transactions: [], budgets: {}, goals: [], bills: [], loans: [], settings: { name: '' } };
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    return { ...emptyData(), ...JSON.parse(raw) };
  } catch {
    return emptyData();
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function parseBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('Not an Ndalama backup file');
  return { ...emptyData(), ...parsed };
}

// Sample data for the K250,000-a-month example: last month in full plus the
// current month up to today.
export function demoData(today = toDateKey(new Date())) {
  const mk = monthOf(today);
  const prev = addMonths(mk, -1);
  const day = Number(today.slice(8, 10));
  const d = (m, dd) => `${m}-${String(dd).padStart(2, '0')}`;
  const t = (date, type, amount, category, method = 'Cash', note = '') => ({
    id: newId(),
    date,
    type,
    amount,
    category,
    method,
    note,
  });

  const monthOfSpending = (m, upTo) =>
    [
      [1, 'income', 250000, 'Salary', 'Bank', 'Monthly salary'],
      [1, 'expense', 60000, 'Rent', 'Airtel Money', 'House rent'],
      [2, 'expense', 25000, 'Groceries', 'Cash', 'Maize flour, oil, sugar'],
      [3, 'expense', 3000, 'Airtime & Data', 'Airtel Money', 'Data bundle'],
      [4, 'expense', 4000, 'Transport', 'Cash', 'Minibus'],
      [5, 'expense', 15000, 'Electricity', 'TNM Mpamba', 'ESCOM units'],
      [6, 'expense', 25000, 'Family support', 'Airtel Money', 'Sent to mother'],
      [8, 'expense', 6000, 'Transport', 'Cash', 'Minibus'],
      [9, 'expense', 12000, 'Groceries', 'Cash', 'Vegetables and fish'],
      [11, 'expense', 5000, 'Church & Giving', 'Cash', 'Offering'],
      [12, 'expense', 8500, 'Eating out', 'Cash', 'Lunch with friends'],
      [14, 'expense', 2000, 'Airtime & Data', 'Airtel Money', 'Airtime'],
      [15, 'expense', 6000, 'Transport', 'Cash', 'Minibus'],
      [16, 'expense', 12000, 'Groceries', 'Cash', 'Groceries top-up'],
      [18, 'expense', 6000, 'Water', 'TNM Mpamba', 'Water board'],
      [20, 'expense', 8000, 'Health', 'Cash', 'Clinic and medicine'],
      [22, 'expense', 6000, 'Transport', 'Cash', 'Minibus'],
      [24, 'expense', 5000, 'Eating out', 'Cash', 'Chips and drinks'],
      [28, 'expense', 10000, 'Groceries', 'Cash', 'Groceries'],
    ]
      .filter(([dd]) => dd <= upTo)
      .map(([dd, ...rest]) => t(d(m, dd), ...rest));

  const transactions = [...monthOfSpending(prev, 31), ...monthOfSpending(mk, day)];

  const goals = [
    {
      id: newId(),
      name: 'New phone',
      target: 250000,
      deadline: d(addMonths(mk, 9), 28),
      contributions: [{ amount: 40000, date: d(prev, 2) }],
    },
    {
      id: newId(),
      name: "Children's school fees",
      target: 90000,
      deadline: d(addMonths(mk, 3), 28),
      contributions: [{ amount: 30000, date: d(prev, 2) }],
    },
  ];

  const paidThisMonth = (dueDay) => (dueDay <= day ? [prev, mk] : [prev]);
  const bills = [
    { id: newId(), name: 'House rent', amount: 60000, dueDay: 1, category: 'Rent', paidMonths: paidThisMonth(1) },
    { id: newId(), name: 'ESCOM electricity', amount: 15000, dueDay: 5, category: 'Electricity', paidMonths: paidThisMonth(5) },
    { id: newId(), name: 'Water board', amount: 6000, dueDay: 18, category: 'Water', paidMonths: paidThisMonth(18) },
    { id: newId(), name: 'Internet bundle', amount: 10000, dueDay: 25, category: 'Airtime & Data', paidMonths: [prev] },
  ];

  const loans = [
    {
      id: newId(),
      direction: 'lent',
      person: 'Chikondi (cousin)',
      amount: 20000,
      date: d(prev, 10),
      dueDate: d(prev, 30),
      note: 'For transport to Blantyre',
      repayments: [{ amount: 5000, date: d(prev, 28) }],
    },
    {
      id: newId(),
      direction: 'borrowed',
      person: 'Village bank',
      amount: 50000,
      date: d(prev, 3),
      dueDate: d(addMonths(mk, 2), 3),
      note: 'Small loan',
      repayments: [],
    },
  ];

  return {
    ...emptyData(),
    transactions,
    goals,
    bills,
    loans,
    budgets: {
      Rent: 60000,
      Groceries: 55000,
      Transport: 30000,
      Electricity: 15000,
      Water: 6000,
      'Airtime & Data': 10000,
      'Family support': 25000,
      Health: 8000,
      'Church & Giving': 10000,
      'Eating out': 15000,
      Savings: 16000,
    },
  };
}
