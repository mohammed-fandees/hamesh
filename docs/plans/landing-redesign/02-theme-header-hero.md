# 2 — Theme, header, hero

Files: `css/variables.css`, `css/base.css`, `css/hero.css`, `js/theme.js`, `js/nav-cta.js`,
`js/animations/hero.js`, `js/animations/hero-tabs.js`, `index.html`.

- [x] Dark tokens: a `[data-theme='dark']` override, plus the media query while on system
- [x] A blocking head script applies the saved theme before first paint
- [x] The toggle cycles system → light → dark, saved in `localStorage`
- [x] Header: lockup, five links, theme, language, compact CTA
- [x] The CTA shows only while the hero CTA is off screen (200ms in, 120ms out)
- [x] Hero copy from the canvas; three scenes (words, element, video moment)
- [x] Three `role="tab"` buttons with a progress bar; 0.45s fade; a click restarts the scene
- [x] Hover or keyboard focus holds the scene; off screen pauses and resumes it
- [x] Reduced motion: finished states, the tabs switch between them
- [x] The composer stays inside the window at every width, both languages
