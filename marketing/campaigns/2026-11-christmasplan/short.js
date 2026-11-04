// "Christmas budget: 7 weeks to go" (family persona: parents of three, income K1,750,000 a month).
// Numbers from assets/app/personas/family/numbers.txt (4 Nov 2026): safe to spend K28,199 a day for 27 days;
// income K1,750,000; goals School fees K100,000 and Family car K81,633 a month. Christmas is 25 Dec = 7 weeks from 4 Nov.
window.SHORT = {
  bpm: 100, mood: 'warm',
  scenes: [
    { type: 'title', beats: 8, kicker: 'Christmas is 7 weeks away', lines: ['December arrives.', '<bad>The account is empty.</bad>'], size: 90 },
    { type: 'title', beats: 8, lines: ['Gifts for the kids.', 'The trip to the village.'], size: 100, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['Food for the family.', '<bad>School fees in January.</bad>'], size: 96, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['It all lands', 'in <em>the same month.</em>'], size: 104, transition: 'slide' },
    { type: 'title', beats: 6, lines: ['Plan it', '<em>now.</em>'], size: 150, drop: true },
    { type: 'phone', beats: 10, img: 'screen-home', caption: 'Open <em>Ndalama</em><br>and see today', size: 72, top: 440, transition: 'flash' },
    { type: 'counter', beats: 8, label: 'Safe to spend today', value: 28199, note: 'for 27 days,<br>after bills and savings', transition: 'whip' },
    { type: 'phone', beats: 10, img: 'screen-budget', caption: 'A budget from what<br>you <em>really earn</em>', size: 72, top: 440, transition: 'slide' },
    { type: 'cards', beats: 8, cards: ['card-goal'], heights: [764], caption: 'Savings goals with the<br><em>monthly amount needed</em>', top: 560, transition: 'circle' },
    { type: 'title', beats: 6, lines: ['Warnings come', '<em>early,</em>', 'not on day 28.'], size: 108, transition: 'slide' },
    { type: 'cards', beats: 8, cards: ['card-bills'], heights: [764], caption: 'Bills remembered<br>the <em>day before</em>', top: 560, transition: 'circle' },
    { type: 'phone', beats: 10, img: 'screen-add', caption: 'Record the gifts:<br><em>Cash, Airtel Money,<br>Mpamba or Bank</em>', size: 68, top: 440, transition: 'whip' },
    { type: 'title', beats: 8, lines: ['No data? <em>No problem.</em>', 'No account.', 'No ads.'], size: 100, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['A December', 'you can <em>enjoy.</em>'], size: 120, transition: 'circle' },
    { type: 'title', beats: 6, lines: ['And a January', 'with no <em>panic.</em>'], size: 112, transition: 'slide' },
    { type: 'end', beats: 12, bg: 'green' },
  ],
};
