// "December is loud, January is quiet: plan the gap" (about 66 s). Reference r-d3ece952, beat by beat (marketing/references/r-d3ece952.md), pattern played twice.
// Numbers: family persona, assets/app/personas/family/numbers.txt of 12 Nov 2026: income K1,750,000; school fees goal K3,000,000 with K2,600,000 saved, needs K100,000 a month;
// on course for K78,272 (6 months instead of 4); safe to spend K12,651 a day. Original music (TikTok sound added by the owner).
window.SHORT = {
  bpm: 96, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'b1', type: 'prompt', beats: 4, caption: 'December spends.<br><em>January invoices.</em>', text: 'School fees. Rent. Bills.', placeholder: 'What is due in January…', size: 76 },
    { id: 'b2', type: 'phone', beats: 6, transition: 'circle', img: 'personas/family/screen-bills', caption: 'The bills do not care<br><em>about Christmas.</em>', size: 76, top: 470 },
    { id: 'b3', type: 'bento', beats: 4, transition: 'whip', word: 'January', cards: ['personas/family/card-goal', 'personas/family/card-bills'], caption: 'Fees. Rent.<br>Bills.', size: 64 },
    { id: 'b4', type: 'morph', beats: 4, transition: 'slide', caption: 'Start the goal<br><em>before the rush.</em>', size: 64, label: 'saved for school fees', saved: 2600000, goal: 3000000 },
    { id: 'b5', type: 'namereveal', beats: 4, drop: true, name: 'Ndalama', sub: 'Plan the gap.' },
    { id: 'b6', type: 'prompt', beats: 6, transition: 'glitch', caption: 'Set the goal.<br><em>See the monthly amount.</em>', text: "Children's school fees", placeholder: 'New goal…', cards: ['personas/family/card-goal'], size: 72, top: 520 },
    { id: 'b7', type: 'steps', beats: 10, transition: 'whip-right', title: 'January <em>without panic</em>', size: 92, top: 520, gap: 230,
      items: [{ k: '1', text: 'Make a savings goal' }, { k: '2', text: 'See what to set aside' }, { k: '3', text: 'Bills reminded the day before' }, { k: '4', text: 'Early warning if at risk' }] },
    { id: 'b8', type: 'title', beats: 5, transition: 'flash', kicker: 'Habits slipping?', lines: ['Goal at risk?', '<em>You get a warning.</em>'], size: 92 },
    { id: 'b9', type: 'showcase', beats: 11, transition: 'slide', dir: 'up', imgs: ['personas/family/screen-goals', 'personas/family/screen-bills', 'personas/family/screen-budget'], captions: ['Savings <em>goals</em>', 'Reminders <em>the day before</em>', 'A budget from <em>what you earn</em>'], size: 72, top: 450 },
    { id: 'b10', type: 'cards', beats: 6, transition: 'circle', cards: ['personas/family/card-goal-alert'], heights: [640], caption: 'Spot the gap<br><em>while there is time</em>', top: 560 },
    { id: 'b11', type: 'counter', beats: 6, transition: 'whip', label: 'Set aside each month', value: 100000, note: "for the children's school fees.<br>No January panic." },
    { id: 'b12', type: 'cards', beats: 6, transition: 'whip-right', cards: ['personas/family/card-hero'], heights: [520], caption: 'Safe to spend<br><em>today</em>', top: 620 },
    { id: 'b13', type: 'title', beats: 6, transition: 'blinds', kicker: 'December is loud', lines: ['January can be', '<em>quiet.</em>'], size: 112 },
    { id: 'b14', type: 'list', beats: 8, max: 500000, transition: 'slide', title: 'Monthly budgets,<br>from what you earn', step: 0.55, items: [{ label: 'Groceries', amount: 500000 }, { label: 'Transport', amount: 360000 }, { label: 'Airtime & data', amount: 142500 }, { label: 'Church & giving', amount: 100000 }] },
    { id: 'end', type: 'end', beats: 8, transition: 'circle', bg: 'green' },
  ],
};
