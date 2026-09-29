// Not `import './teams.css'`: a plain stylesheet import is collected by the
// bundler while it transforms modules, not by the tree-shaker, so its rules
// survive into a build where every component that would have used them is gone
// (measured — the whole Teams stylesheet shipped in a store build before this).
// Read as a string instead, it is an ordinary value, and an unused value is
// dropped like any other.
import css from './teams.css?inline';

/**
 * Teams' own stylesheet, applied only in a build that has Teams.
 *
 * Imported by the two surfaces that need it — the Teams page and the account
 * row in Settings — so a build without Teams drops this module, the string it
 * holds, and every rule in it.
 *
 * Applied while this module loads, which is before either of those renders, so
 * there is no moment where Teams is drawn without its own styling.
 */
if (import.meta.env.WXT_TEAMS_API_ORIGIN && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.dataset.hamesh = 'teams';
  style.textContent = css;
  document.head.append(style);
}
