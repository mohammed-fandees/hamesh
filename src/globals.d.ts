/**
 * Build-time constants this project defines itself (see `wxt.config.ts`).
 *
 * `import.meta.env` is Vite's, and a key added to it is read at runtime; these
 * are folded into the code, so a build that has them false drops everything
 * behind them.
 */

/** Whether Settings will take a session token a local server issued. */
declare const __HAMESH_DEV_SIGN_IN__: boolean;
