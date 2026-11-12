// "Prices up again: re-check your budget in 5 minutes" (about 66 s). Reference r-d3ece952, beat by beat (marketing/references/r-d3ece952.md), pattern played twice.
// Numbers: corporate persona, assets/app/personas/corporate/numbers.txt of 12 Nov 2026: income K1,730,000; Groceries pace K287,500; safe to spend K946 a day;
// New car needs K161,290 a month; cutting about K1,018 puts goals back on track. Original music (TikTok sound added by the owner).
window.SHORT = {
  bpm: 100, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'b1', type: 'prompt', beats: 4, caption: 'Your budget is<br><em>from January.</em>', text: 'Prices are not.', placeholder: 'What did it cost…', size: 80 },
    { id: 'b2', type: 'phone', beats: 6, transition: 'circle', img: 'personas/corporate/screen-budget', caption: 'Rent. Food. Fuel.<br><em>All moved.</em>', size: 80, top: 470 },
    { id: 'b3', type: 'bento', beats: 4, transition: 'whip', word: 'Prices', cards: ['personas/corporate/card-budget', 'personas/corporate/card-bills'], caption: 'Groceries,<br>transport, rent', size: 64 },
    { id: 'b4', type: 'morph', beats: 4, transition: 'slide', caption: 'Same salary.<br><em>Goals feel it too.</em>', size: 64, label: 'saved for the car', saved: 4000000, goal: 9000000 },
    { id: 'b5', type: 'namereveal', beats: 4, drop: true, name: 'Ndalama', sub: 'Re-check in 5 minutes.' },
    { id: 'b6', type: 'prompt', beats: 6, transition: 'glitch', caption: 'Budgets from<br><em>what you earn</em>', text: 'Groceries', placeholder: 'New budget…', cards: ['personas/corporate/card-budget'], size: 72, top: 520 },
    { id: 'b7', type: 'steps', beats: 10, transition: 'whip-right', title: '5 minutes, <em>3 checks</em>', size: 92, top: 520, gap: 230,
      items: [{ k: '1', text: 'Open your budgets' }, { k: '2', text: 'See where spending runs fast' }, { k: '3', text: 'Adjust early' }, { k: '4', text: 'Check safe to spend' }] },
    { id: 'b8', type: 'title', beats: 5, transition: 'flash', kicker: 'Spending too fast?', lines: ['Ndalama warns you', '<em>before the month ends.</em>'], size: 88 },
    { id: 'b9', type: 'showcase', beats: 11, transition: 'slide', dir: 'up', imgs: ['personas/corporate/screen-budget', 'personas/corporate/screen-goals', 'personas/corporate/screen-home'], captions: ['Budgets <em>that fit you</em>', 'Goals with <em>early warnings</em>', 'Every kwacha <em>in one place</em>'], size: 72, top: 450 },
    { id: 'b10', type: 'cards', beats: 6, transition: 'circle', cards: ['personas/corporate/card-goal-alert'], heights: [640], caption: 'A small fix<br><em>keeps goals on track</em>', top: 560 },
    { id: 'b11', type: 'counter', beats: 6, transition: 'whip', label: 'Safe to spend today', value: 946, note: 'after bills, debts and savings' },
    { id: 'b12', type: 'cards', beats: 6, transition: 'whip-right', cards: ['personas/corporate/card-hero'], heights: [520], caption: 'Your month,<br><em>in one place</em>', top: 620 },
    { id: 'b13', type: 'title', beats: 6, transition: 'blinds', kicker: 'Prices change', lines: ['Your budget', '<em>can too.</em>'], size: 112 },
    { id: 'b14', type: 'list', beats: 8, max: 300000, transition: 'slide', title: 'Monthly budgets,<br>from what you earn', step: 0.55, items: [{ label: 'Groceries', amount: 287500 }, { label: 'Transport', amount: 210000 }, { label: 'Airtime & data', amount: 142500 }, { label: 'Church & giving', amount: 125000 }] },
    { id: 'end', type: 'end', beats: 8, transition: 'circle', bg: 'green' },
  ],
};
