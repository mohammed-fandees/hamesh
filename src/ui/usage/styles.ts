// Read as a string, like Teams' own sheet (see ../teams/styles.ts): a build
// without a server to share counts with drops this module and every rule in it.
import css from './usage.css?inline';

/** The usage-consent cards' stylesheet, applied only in a build that has them. */
if (import.meta.env.WXT_TEAMS_API_ORIGIN && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.dataset.hamesh = 'usage';
  style.textContent = css;
  document.head.append(style);
}
