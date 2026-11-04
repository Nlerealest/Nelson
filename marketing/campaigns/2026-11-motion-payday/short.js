// "Payday, in motion", remade in the clean Apple-style (ref-apple): blur-in words, floating cards,
// soft transitions. Persona: corporate (numbers.txt, 4 Nov 2026): income K1,730,000 a month,
// safe to spend K15,703 a day for 27 days, set aside for goals K234,018, kept K370,000 (21%),
// rent K650,000, K5,200,000 towards savings goals.
window.SHORT = {
  bpm: 100, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hook', type: 'title', beats: 8, kicker: 'Payday', lines: ['K1,730,000', '<em>lands today.</em>'], size: 120 },
    { id: 'gone', type: 'title', beats: 8, transition: 'slide', lines: ['Rent. Fuel. Fees.', '<bad>Where did it go?</bad>'], size: 104 },
    { id: 'rent', type: 'counter', beats: 8, transition: 'circle', label: 'Rent alone', value: 650000, note: 'before the month has even started' },
    { id: 'one', type: 'phone', beats: 10, transition: 'push-left', img: 'screen-home', caption: 'Every kwacha,<br><em>in one place.</em>', size: 72, top: 440 },
    { id: 'safe', type: 'counter', beats: 10, drop: true, label: 'Safe to spend today', value: 15703, note: 'a day for 27 days, after bills,<br>debts and savings' },
    { id: 'budget', type: 'cards', beats: 8, transition: 'slide', cards: ['card-budget'], heights: [780], caption: 'A budget from<br><em>what you really earn</em>', top: 560 },
    { id: 'goal', type: 'cards', beats: 8, transition: 'circle', cards: ['card-goal2'], heights: [780], caption: 'Goals with<br><em>early warnings</em>', top: 560 },
    { id: 'bills', type: 'cards', beats: 8, transition: 'push-left', cards: ['card-bills'], heights: [796], caption: 'Bills reminded<br><em>before they are due</em>', top: 560 },
    { id: 'aside', type: 'counter', beats: 9, transition: 'slide', label: 'Set aside for goals', value: 234018, note: 'before you spend a kwacha' },
    { id: 'kept', type: 'counter', beats: 9, transition: 'circle', label: 'Kept this month', value: 370000, note: '21% of the income' },
    { id: 'calm', type: 'title', beats: 8, transition: 'drop', lines: ['Payday, <em>under control.</em>'], size: 112 },
    { id: 'end', type: 'end', beats: 10, bg: 'green' },
  ],
};
