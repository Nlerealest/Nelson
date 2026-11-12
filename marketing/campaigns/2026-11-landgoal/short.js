// "Land, a car or a second shop: name the goal" (c-landgoal). Reference r-b111f257, pattern played three times.
// Business persona numbers (assets/app/personas/business/numbers.txt, 12 Nov 2026): Second shop K15,000,000 (K6,000,000 saved, K360,000 a month),
// Land in Area 47 K8,000,000 (K5,000,000 saved, K120,000 a month, about K4,000 a day).
window.SHORT = {
  bpm: 100, mood: 'warm',
  style: { reveal: 'blur' },
  scenes: [
    { id: 'hook', type: 'phone', beats: 4, img: 'screen-goals', caption: 'Fifteen million<br><em>sounds far.</em>', size: 84, top: 470 },
    { id: 'q', type: 'prompt', beats: 4, transition: 'flash', caption: 'How much a <em>month?</em>', size: 92, text: 'How do I afford a second shop?', top: 760 },
    { id: 'big', type: 'title', beats: 4, transition: 'flash', kicker: 'Second shop, K15,000,000', lines: ['Save<br><em>K360,000</em>'], size: 110 },
    { id: 'mo', type: 'title', beats: 4, transition: 'blinds', kicker: 'For 25 months', lines: ['A month.<br><em>Not a mountain.</em>'], size: 100 },
    { id: 'g1', type: 'cards', beats: 6, transition: 'whip', cards: ['card-goal'], heights: [640], caption: 'Your goal,<br><em>one monthly number</em>', top: 520 },
    { id: 'day', type: 'title', beats: 4, transition: 'glitch', kicker: 'Land in Area 47', lines: ['About<br><em>K4,000 a day</em>'], size: 100 },
    { id: 'add', type: 'phone', beats: 6, transition: 'slide', img: 'screen-goals', caption: 'Track every goal<br><em>in one place</em>', size: 72, top: 470 },
    { id: 'cs', type: 'counter', beats: 6, transition: 'fill', label: 'Second shop, a month', value: 360000, note: 'K6,000,000 of K15,000,000 saved' },
    { id: 'cl', type: 'counter', beats: 6, transition: 'band', label: 'Land in Area 47', value: 8000000, note: 'K5,000,000 saved so far' },
    { id: 'g2', type: 'cards', beats: 6, transition: 'whip-right', cards: ['card-goal-alert'], heights: [640], caption: 'An early warning<br><em>if you slip</em>', top: 520 },
    { id: 'show', type: 'showcase', beats: 10, transition: 'fill', dir: 'up', imgs: ['screen-goals', 'screen-budget', 'screen-home'], captions: ['Goals on <em>track</em>', 'A budget that <em>fits</em>', 'Today at a <em>glance</em>'], size: 72, top: 450 },
    { id: 'name', type: 'namereveal', beats: 4, drop: true, transition: 'flash', name: 'Ndalama', sub: 'Every kwacha, counted.' },
    { id: 'calm', type: 'title', beats: 6, transition: 'circle', kicker: 'Land, a car or a shop', lines: ['Name the', '<em>goal.</em>'], size: 140 },
    { id: 'end', type: 'end', beats: 8, transition: 'fill', bg: 'green' },
  ],
};
