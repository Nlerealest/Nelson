// "Never miss a bill again". Numbers: marketing/assets/app/personas/corporate/numbers.txt and its bills screen (3 Nov 2026):
// monthly bills K792,000; still to pay K142,000; ESCOM K60,000 due 5 Nov (in 2 days); safe to spend K15,142 a day for 28 days;
// staff loan K2,250,000 left of K2,500,000.
window.SHORT = {
  bpm: 100, mood: 'warm',
  scenes: [
    { type: 'title', beats: 8, kicker: 'Month-end, Lilongwe', lines: ['The bill is due', '<bad>tomorrow.</bad>'], size: 120 },
    { type: 'title', beats: 8, lines: ['Ndalama', '<em>already told you.</em>'], size: 112, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['Rent. ESCOM.', 'Water. Fibre.', '<bad>All in one week.</bad>'], size: 96, transition: 'circle' },
    { type: 'counter', beats: 8, label: 'Bills every month', value: 792000, note: 'and a staff loan<br>to repay on top', transition: 'slide' },
    { type: 'title', beats: 8, lines: ['Forget one,', 'and it costs you', '<bad>more than money.</bad>'], size: 96, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['So put every bill', '<em>in one place.</em>'], size: 108, transition: 'slide' },
    { type: 'phone', beats: 10, img: 'screen-bills', caption: 'Add rent, ESCOM,<br>water and <em>fibre</em>', size: 72, top: 440, drop: true, transition: 'flash' },
    { type: 'cards', beats: 8, cards: ['card-bills'], heights: [780], caption: 'It shows what is due<br><em>and when</em>', top: 560, transition: 'whip' },
    { type: 'title', beats: 6, kicker: 'Reminder one', lines: ['The day <em>before.</em>'], size: 130, transition: 'push-left' },
    { type: 'title', beats: 6, kicker: 'Reminder two', lines: ['And on the <em>day.</em>'], size: 130, transition: 'push-left' },
    { type: 'counter', beats: 8, label: 'Still to pay this month', value: 142000, note: 'ESCOM, water and fibre,<br>all in view', transition: 'glitch' },
    { type: 'counter', beats: 8, label: 'Safe to spend today', value: 15142, note: 'a day for 28 days, after bills<br>and savings are set aside', transition: 'flash' },
    { type: 'phone', beats: 10, img: 'screen-home', caption: 'Bills are set aside<br><em>before</em> you spend', size: 72, top: 440, transition: 'whip' },
    { type: 'cards', beats: 8, cards: ['card-loan-owe'], heights: [640], caption: 'Repaying a loan?<br><em>Record each repayment</em>', top: 600, transition: 'drop' },
    { type: 'phone', beats: 10, img: 'screen-loans', caption: 'Loans lent and borrowed,<br>all <em>tracked</em>', size: 72, top: 440, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['Tap <em>Mark paid.</em>', 'Done.'], size: 120, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['No data? <em>No problem.</em>', 'No account.', 'No ads.'], size: 100, transition: 'slide' },
    { type: 'title', beats: 8, kicker: 'Month-end', lines: ['Nothing missed.', '<em>Nothing to fear.</em>'], size: 108, transition: 'circle' },
    { type: 'end', beats: 12, bg: 'green' },
  ],
};
