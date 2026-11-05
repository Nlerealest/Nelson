// Reference test for r-43dfc391 (handheld clip, slow hold then sideways whip-pans with heavy blur).
// Numbers: corporate persona, numbers.txt of 5 Nov 2026.
window.SHORT = {
  bpm: 83, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hold', type: 'title', beats: 10, kicker: 'Payday', lines: ['K1,730,000', '<em>lands today.</em>'], size: 120 },
    { id: 'home', type: 'phone', beats: 8, transition: 'whip', img: 'screen-home', caption: 'Every kwacha,<br><em>in one place.</em>', size: 72, top: 440 },
    { id: 'safe', type: 'counter', beats: 4, transition: 'whip-right', label: 'Safe to spend today', value: 18615, note: 'after bills, debts and savings' },
    { id: 'goal', type: 'cards', beats: 4, transition: 'whip', cards: ['card-goal2'], heights: [780], caption: 'Goals with<br><em>early warnings</em>', top: 560 },
    { id: 'calm', type: 'title', beats: 6, transition: 'whip-right', lines: ['Payday, <em>under control.</em>'], size: 112 },
    { id: 'end', type: 'end', beats: 8, transition: 'whip', bg: 'green' },
  ],
};
