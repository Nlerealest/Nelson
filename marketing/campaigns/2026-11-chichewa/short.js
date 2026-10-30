// "Ndalama in Chichewa": Chichewa on screen, English subtitles. Numbers: sample-data.mjs on 2026-10-13 (K2,189 a day, 19 days).
window.SHORT = {
  bpm: 100, mood: 'bright',
  scenes: [
    { type: 'title', beats: 4, lines: ['Moni!'], size: 220, top: 760, sub: 'Hello!' },
    { type: 'title', beats: 6, lines: ['Ndalama zanu,', '<em>m’manja mwanu.</em>'], size: 120, sub: 'Your money, in your hands.' },
    { type: 'phone', beats: 7, drop: true, img: 'screen-add', caption: 'Lembani ndalama<br>zolowa ndi zotuluka', size: 76, top: 440, sub: 'Record money in and out in seconds.' },
    { type: 'counter', beats: 7, label: 'Zomwe mungagwiritse lero', value: 2189, note: 'patsiku, kwa masiku 19', sub: 'Safe to spend today: K2,189 a day for 19 days.' },
    { type: 'cards', beats: 6, cards: ['card-bills'], heights: [796], caption: 'Tikukumbutsani<br>za mabilu', top: 560, sub: 'Reminders before bills are due.' },
    { type: 'cards', beats: 6, cards: ['card-goal'], heights: [764], caption: 'Sungani ndalama<br>za foni yatsopano', top: 560, sub: 'Savings goals, with early warnings.' },
    { type: 'title', beats: 5, lines: ['Ndi yaulere.', '<em>Sifuna data.</em>'], size: 130, sub: 'It’s free. It works without data.' },
    { type: 'end', beats: 8, bg: 'green', tagline: 'Dziwani komwe kwacha yanu ikupita.', soon: 'Google Play &amp; iPhone: posachedwa', sub: 'Google Play &amp; iPhone coming soon' },
  ],
};
