// "Rains are coming: plan the seed money". K45,000 goal by 15 Dec 2026, from 2 Nov: goalPlan -> K22,500 a month (2 months).
window.SHORT = {
  bpm: 112, mood: 'warm',
  scenes: [
    { type: 'title', beats: 8, kicker: 'Rainy season', lines: ['The first rains', 'are <em>coming.</em>'], size: 112 },
    { type: 'title', beats: 8, lines: ['Seed. Fertiliser.', 'Sprayer. Labour.', '<em>All needed at once.</em>'], size: 96, transition: 'slide' },
    { type: 'counter', beats: 8, label: 'Inputs for the field', value: 45000, note: 'due before the planting day', transition: 'circle' },
    { type: 'title', beats: 8, lines: ['But rent, school', 'and food', '<bad>come from the same salary.</bad>'], size: 96, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['Wait until December', 'and it is <bad>too late.</bad>'], size: 100, transition: 'circle' },
    { type: 'title', beats: 6, lines: ['Plan it <em>now.</em>', 'With Ndalama.'], size: 116, drop: true },
    { type: 'phone', beats: 10, img: 'screen-goals', caption: 'Make a <em>savings goal</em><br>for your seed money', size: 74, top: 440, transition: 'whip' },
    { type: 'counter', beats: 8, label: 'Save each month', value: 22500, note: 'for 2 months<br>to reach K45,000', transition: 'flash' },
    { type: 'phone', beats: 10, img: 'screen-budget', caption: 'A budget built from<br>what you <em>really earn</em>', size: 74, top: 440, transition: 'slide' },
    { type: 'cards', beats: 8, cards: ['card-bills'], heights: [764], caption: 'Bills reminded<br>the <em>day before</em>', top: 560, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['Habits putting the', 'goal at risk?', '<em>You get an early warning.</em>'], size: 94, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['No data? <em>No problem.</em>', 'No account.', 'No ads.'], size: 100, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['The rains arrive.', '<em>The inputs are ready.</em>'], size: 108, transition: 'slide' },
    { type: 'end', beats: 12, bg: 'green' },
  ],
};
