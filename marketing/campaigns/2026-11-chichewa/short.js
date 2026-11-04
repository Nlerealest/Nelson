// "Ndalama in Chichewa": Chichewa on screen, English subtitles. Remade in the editing style of reference r-69b1218d.
// Numbers: assets/app/numbers.txt on 2026-11-04 (safe to spend K15,703 a day for 27 days).
window.SHORT = {
  bpm: 116, mood: 'bright',
  style: { reveal: 'blur' },
  scenes: [
    { type: 'title', beats: 4, lines: ['Moni!'], size: 230, top: 760, sub: 'Hello!' },
    { type: 'title', beats: 6, lines: ['Ndalama zimapita', '<em>kuti?</em>'], size: 130, transition: 'push-left', sub: 'Where does your money go?' },
    { type: 'title', beats: 3, lines: ['<em>Lembani.</em>'], size: 240, top: 800, transition: 'circle', sub: 'Record.' },
    { type: 'title', beats: 3, lines: ['<em>Sungani.</em>'], size: 240, top: 800, transition: 'push-right', sub: 'Save.' },
    { type: 'title', beats: 3, lines: ['<em>Dziwani.</em>'], size: 240, top: 800, transition: 'push-left', sub: 'Know.' },
    { type: 'showcase', beats: 16, imgs: ['screen-add', 'screen-home', 'screen-bills', 'screen-goals'], dir: 'left', transition: 'circle', size: 70, top: 330,
      captions: ['Lembani ndalama<br>zolowa ndi zotuluka', 'Muone zonse<br>pa tsamba limodzi', 'Mabilu <em>onse</em><br>pamalo amodzi', 'Zolinga zanu<br>zosungira'],
      sub: 'Record, see everything, bills, savings goals.' },
    { type: 'counter', beats: 8, label: 'Zomwe mungagwiritse lero', value: 15703, note: 'patsiku, kwa masiku 27', transition: 'push-left', sub: 'Safe to spend today: K15,703 a day for 27 days.' },
    { type: 'pair', beats: 8, caption: 'Lembani momwe<br>mwalipirira', options: ['Airtel<br>Money', 'TNM<br>Mpamba'], picks: [0, 1], note: 'Cash, Airtel Money, Mpamba, Bank', transition: 'circle', sub: 'Note how it was paid.' },
    { type: 'cards', beats: 8, cards: ['card-bills'], heights: [796], caption: 'Tikukumbutsani<br>za mabilu', top: 560, transition: 'push-right', sub: 'Reminders before bills are due.' },
    { type: 'cards', beats: 8, cards: ['card-goal'], heights: [764], caption: 'Sungani ndalama<br>za galimoto', top: 560, transition: 'push-left', sub: 'Savings goals, with early warnings.' },
    { type: 'showcase', beats: 12, imgs: ['screen-budget', 'screen-report', 'screen-loans'], dir: 'up', transition: 'circle', size: 70, top: 330,
      captions: ['Bajeti <em>yanu</em>', 'Lipoti la mwezi', 'Ngongole zanu'], sub: 'Budgets, monthly reports, loans.' },
    { type: 'title', beats: 6, lines: ['Ndi yaulere.', '<em>Sifuna data.</em>'], size: 130, transition: 'push-right', sub: 'It’s free. It works without data.' },
    { type: 'title', beats: 6, lines: ['Mtendere wa<br><em>m’maganizo.</em>'], size: 120, transition: 'circle', sub: 'Peace of mind about your money.' },
    { type: 'end', beats: 10, bg: 'green', tagline: 'Dziwani komwe kwacha yanu ikupita.', soon: 'Google Play &amp; iPhone: posachedwa', transition: 'circle', sub: 'Google Play &amp; iPhone coming soon' },
  ],
};
