// "He said he will pay back Friday" (about 50 s). Reference r-d3ece952, beat by beat (marketing/references/r-d3ece952.md).
// Numbers: corporate persona, assets/app/numbers.txt + screens of 5 Nov 2026: Chikondi (cousin) lent K400,000 since 10 Oct,
// K100,000 repaid, K300,000 still owed, due 15 Dec. 86 bpm = half of the reference's 172, so one beat = two of its beats.
window.SHORT = {
  bpm: 92, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'b1', type: 'prompt', beats: 4, caption: 'A cousin borrowed<br><em>K400,000</em>', text: 'I will pay you back Friday.', placeholder: 'Friday…', size: 76 },
    { id: 'b2', type: 'phone', beats: 6, transition: 'circle', img: 'screen-loans', caption: 'Friday came<br><em>and went.</em>', size: 80, top: 470 },
    { id: 'b3', type: 'bento', beats: 4, transition: 'whip', word: 'Owed', cards: ['card-loan-lent', 'card-goal2'], caption: 'Who remembers<br>the amount?', size: 64 },
    { id: 'b4', type: 'morph', beats: 4, transition: 'slide', caption: 'K100,000 back.<br><em>K300,000 not yet.</em>', size: 64, label: 'repaid', saved: 100000, goal: 400000 },
    { id: 'b5', type: 'namereveal', beats: 4, drop: true, name: 'Ndalama', sub: 'Write it down.' },
    { id: 'b6', type: 'prompt', beats: 6, transition: 'glitch', caption: 'Who owes you.<br><em>How much.</em>', text: 'Chikondi owes K300,000', placeholder: 'Ask Ndalama…', cards: ['card-loan-lent'], size: 76, top: 520 },
    { id: 'b7', type: 'steps', beats: 10, transition: 'whip-right', title: 'Every loan, <em>clear</em>', size: 92, top: 520, gap: 230,
      items: [{ k: '1', text: 'Lent K400,000 on 10 Oct' }, { k: '2', text: 'K100,000 paid back' }, { k: '3', text: 'K300,000 still owed' }, { k: '4', text: 'Due 15 Dec' }] },
    { id: 'b8', type: 'title', beats: 5, transition: 'flash', kicker: 'Part payment?', lines: ['Tap <em>Record repayment.</em>', 'It adds up for you.'], size: 92 },
    { id: 'b9', type: 'showcase', beats: 11, transition: 'slide', dir: 'up', imgs: ['screen-loans', 'screen-add', 'screen-bills'], captions: ['Lent <em>and</em> borrowed', 'Record in seconds', 'Reminders <em>the day before</em>'], size: 72, top: 450 },
    { id: 'b10', type: 'cards', beats: 6, transition: 'circle', cards: ['card-loan-owe'], heights: [520], caption: 'Borrowed too?<br>Track <em>what you owe</em>', top: 620 },
    { id: 'b11', type: 'counter', beats: 6, transition: 'whip', label: 'Still owed by Chikondi', value: 300000, note: 'Due 15 Dec. A calm chat,<br>with the numbers.' },
    { id: 'end', type: 'end', beats: 6, transition: 'circle', bg: 'green' },
  ],
};
