// "Lent a friend money? Track it" (about 70 s). Numbers: sample-data.mjs loans:
// Chikondi (cousin) lent K20,000 on 10 Sep, K5,000 repaid, K15,000 still owed, due 15 Nov.
window.SHORT = {
  bpm: 104, mood: 'warm',
  scenes: [
    { type: 'title', beats: 6, kicker: 'Lent a friend money?', lines: ['“I will pay you', '<em>back Friday.</em>”'], size: 116 },
    { type: 'title', beats: 5, lines: ['Which', '<bad>Friday?</bad>'], size: 150 },
    { type: 'counter', beats: 7, label: 'Chikondi needs transport', value: 20000, note: 'You say yes. Of course you do.' },
    { type: 'split', beats: 8, bottomAt: 2.3,
      top: { label: 'Day 1 · You', text: 'Sure, take it!', note: 'No problem, we are family.' },
      bottom: { label: 'Week 6 · Also you', text: 'How much was it?', tone: 'bad', size: 88, note: 'K15,000? K20,000? Who remembers…' } },
    { type: 'title', beats: 5, kicker: 'Awkward…', lines: ['Asking is hard.', '<em>Forgetting is worse.</em>'], size: 104 },
    { type: 'title', beats: 4, lines: ['Write it down.', '<em>With Ndalama.</em>'], size: 112 },
    { type: 'phone', beats: 8, drop: true, img: 'screen-loans', caption: 'Every loan in one place:<br><em>lent</em> and <em>borrowed</em>', size: 72 },
    { type: 'cards', beats: 8, cards: ['card-loan-lent'], heights: [520], caption: 'Who owes you.<br>How much.<br><em>Since when.</em>', top: 620 },
    { type: 'counter', beats: 7, label: 'Chikondi still owes', value: 15000, note: 'of K20,000. K5,000 already paid back.' },
    { type: 'cards', beats: 7, cards: ['card-loan-lent'], heights: [520], caption: 'Due 15 Nov.<br>Everyone <em>knows the date.</em>', top: 620 },
    { type: 'title', beats: 6, kicker: 'Part payment?', lines: ['Tap <em>Record repayment.</em>', 'It adds up for you.'], size: 92 },
    { type: 'cards', beats: 7, cards: ['card-loan-owe'], heights: [520], caption: 'Borrowed too?<br>Track <em>what you owe</em>', top: 620 },
    { type: 'title', beats: 6, lines: ['Clear records.', '<em>Friendly reminders.</em>', 'No stress.'], size: 100 },
    { type: 'title', beats: 5, lines: ['Stay friends.', '<em>Track it.</em>'], size: 130 },
    { type: 'end', beats: 10, bg: 'green' },
  ],
};
