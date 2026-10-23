/* Runs in <head>, before the stylesheet paints.
 *
 * If the visitor chose a theme on a previous visit, put it on <html> now —
 * otherwise the page would flash daylight and then swap to night. With no
 * stored choice we deliberately set nothing, so the CSS media query keeps
 * following the device (and keeps following it if the OS switches later).
 */
(function () {
  try {
    var saved = localStorage.getItem('babelish-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch (error) {
    /* storage blocked (private mode): the device preference is fine */
  }
})();
