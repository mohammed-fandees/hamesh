# 1 — Motion foundation

Files: `landing/js/lib/typing.js`, `landing/js/lib/fitts.js`, `landing/js/animations/cursor.js`,
the six typing demos, their markup and CSS.
Tests: `tests/landing/typing.test.ts`, `tests/landing/fitts.test.ts`, `e2e/landing.spec.ts`.

- [x] `graphemes(text)` with `Intl.Segmenter`; an Arabic mark stays with its letter
- [x] `typingSchedule(text)`: 55ms ±25% seeded from the text, +120ms after a space,
      +220ms after `، . ؛ , ;`
- [x] `typeInto(tl, el, text, opts)`: a seek-safe property tween, caret inline after the text
- [x] Caret solid while typing, blinking 530ms while idle, never fades before the last character
- [x] No `.ui-reveal` or `steps(N)` in any of the six demos; reduced motion shows the final text
- [x] `travelTime(D, W) = 0.16 + 0.1·log2(1 + D/W)`, `power3.out`; explicit durations still win
