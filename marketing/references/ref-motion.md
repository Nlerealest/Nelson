# Reference: motion-design showreel (`ref-motion`)

The owner's motion reference: an 18 s, 30 fps showreel (16:9). Studied frame by frame on 4 Nov 2026. **While this reference is in use, every video and every remake follows this file.** Colours, background and font stay Ndalama's (TWIZZY.md 4.1): only the motion is copied.

## What makes it work
- **One hero object carries the whole video.** A letter becomes a ball; the ball bounces, is revealed inside an editor, morphs into a toggle and a dial, then grows to fill the screen and wipes into the next scene. There are almost no plain cuts: each scene is born from the last.
- **Camera moves reveal context:** the bounce turns out to be inside an editor panel (pull-back), and the fill wipe zooms through the ball.
- **Everything enters with motion blur** and settles with a spring, slightly overshooting. Nothing just appears.
- **Pace:** about 1 idea per 1.5–2.5 s, with cuts on the beat.
- **Captions** are short (1–3 words, "Squash & stretch.", "Easing.", "Morph."), word-revealed, under the action.

## Beat by beat, and the Ndalama version (template scene types)

| # | Reference (time) | Ndalama scene in `templates/short` |
|---|---|---|
| 1 | 0–2.5 s: chrome 3D letters "MOTION" tumble in one by one from depth, hold, then scatter with blur; one letter shrinks into the ball | `chrome` (word "NDALAMA" or a short word from the idea), ends with the K-coin |
| 2 | 2.5–4.5 s: ball drops and bounces with squash & stretch, dotted trail, floor line, caption | `bounce`: captions carry the story's money moment (e.g. "Payday. K1,450,000.") |
| 3 | 4.5–6.5 s: camera pulls back, the bounce is inside an editor; an easing curve draws below | `pullback` with transition `pull`: the app screen, and a curve of a real number (balance, savings) |
| 4 | 6.5–8 s: ball morphs into a toggle (switches on), then a circle, then a dial | `morph`: toggle switches on, becomes a goal ring that fills to the real goal % |
| 5 | 8–9 s: the ball grows to fill the screen, wipe | transition `fill` (green disc) into the next scene |
| 6 | 9–12.5 s: bento grid: tiles fly in from all sides with blur and springs (kinetic "Type", springs card, 3D cube, stripes, bar chart, curve) | `bento`: kinetic word, real app cards, spinning K-cube, growing bars, drawing curve |
| 7 | 12.5–14.5 s: big digits roll up with motion blur ("900 frames.") | `counter` (rolling digits with motion blur) on a real number |
| 8 | 14.5–17 s: the name reveals letter by letter from a blur, first letter in the accent colour, background darkens | `namereveal` ("Ndalama", first letter green) |
| 9 | 17–18 s: TikTok end card with a search bar | `end` (or a `prompt` scene typing "Ndalama" into a search bar, then `end`) |

For a 45 s–1:45 video, keep this order and expand the middle: more `bounce` / `pullback` / `morph` moments for the story, a `showcase` (screens swiping up and down inside the phone) after the bento, and a second `counter`. Always start with `chrome` → `bounce`, keep the hero coin moving between scenes, use `fill` for the big transition, and end `namereveal` → `end`.

Worked example: `marketing/campaigns/2026-11-motion-payday/` (56 s).

## Ndalama's look (never changes)
Dark green stage with the soft glow, white bold type with key words in `#14b866`, Inter, solid green only on the end card, the K-coin in Ndalama greens.
