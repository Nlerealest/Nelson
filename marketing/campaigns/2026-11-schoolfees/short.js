// "School fees without the panic" (voiceover). Numbers: goalPlan / goalWarnings on sample-data.mjs at 2026-10-13
// (K120,000 by 15 Jan 2027, K45,000 saved, K18,750 a month for 4 months; on course for K18,214, 5 months instead of 4).
window.SHORT = {
  bpm: 96, mood: 'warm',
  scenes: [
    { id: 'hook', type: 'title', kicker: 'For parents', lines: ['School fees', 'are due in <em>January.</em>'], size: 120 },
    { id: 'target', type: 'counter', label: 'School fees', value: 120000, note: 'K45,000 already saved' },
    { id: 'plan', type: 'counter', drop: true, label: 'Save each month', value: 18750, note: 'for 4 months<br>about K625 a day' },
    { id: 'warn', type: 'cards', cards: ['card-goal2'], heights: [780], caption: 'Off track?<br><bad>It warns you early.</bad>', top: 560 },
    { id: 'tip', type: 'title', lines: ['Cut about <em>K1,442</em>', 'this month and', 'you’re back on track.'], size: 104 },
    { id: 'end', type: 'end', bg: 'green' },
  ],
};
