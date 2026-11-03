// "Fuel price changed again? Re-plan in a minute". Numbers: logic.js on sample-data.mjs at 2026-10-13:
// safeToSpend K2,189 a day (19 days); plus two K3,500 minibus trips -> K2,004 a day; Transport budget K25,000, pace K35,769.
window.SHORT = {
  bpm: 100, mood: 'warm',
  scenes: [
    { type: 'title', beats: 8, kicker: 'On the radio today', lines: ['The fuel price', '<bad>changed again.</bad>'], size: 112 },
    { type: 'title', beats: 8, lines: ['Minibus fares', 'follow the pump.'], size: 108, transition: 'slide' },
    { type: 'counter', beats: 8, label: 'One minibus trip', value: 3500, note: 'and you go twice a day', transition: 'circle' },
    { type: 'title', beats: 8, lines: ['Rent, food and school', '<bad>did not get cheaper.</bad>'], size: 96, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['So how much can you', '<em>really</em> spend today?'], size: 100, transition: 'circle' },
    { type: 'title', beats: 6, lines: ['Re-plan it', '<em>in a minute.</em>'], size: 120, drop: true },
    { type: 'counter', beats: 8, label: 'Safe to spend today', value: 2189, note: 'a day for 19 days,<br>after bills and savings', transition: 'flash' },
    { type: 'phone', beats: 10, img: 'screen-add', caption: 'Record the new fare:<br><em>Cash or Airtel Money</em>', size: 72, top: 440, transition: 'whip' },
    { type: 'counter', beats: 8, label: 'Safe to spend, updated', value: 2004, note: 'after two K3,500 trips.<br>An honest number.', transition: 'slide' },
    { type: 'cards', beats: 8, cards: ['card-budget'], heights: [780], caption: 'Transport running fast?<br><em>You get a warning.</em>', top: 560, transition: 'circle' },
    { type: 'phone', beats: 10, img: 'screen-budget', caption: 'Adjust your budget<br>to what you <em>really earn</em>', size: 72, top: 440, transition: 'slide' },
    { type: 'title', beats: 8, lines: ['No data? <em>No problem.</em>', 'No account.', 'No ads.'], size: 100, transition: 'circle' },
    { type: 'title', beats: 8, lines: ['The price moves.', '<em>You know your number.</em>'], size: 108, transition: 'slide' },
    { type: 'end', beats: 12, bg: 'green' },
  ],
};
