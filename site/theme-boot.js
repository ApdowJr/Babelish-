/* Runs in <head>, before the stylesheet paints.
 *
 * If the visitor chose a theme on a previous visit, put it on <html> now —
 * otherwise the page would flash daylight and then swap to night. With no
 * stored choice we deliberately set nothing, so the CSS media query keeps
 * following the device (and keeps following it if the OS switches later).
 */
(function () {
  /* Matches --bg in styles.css for each side; the two <meta name="theme-color">
   * tags in the markup carry these for the OS-driven case. */
  var CHROME = { light: '#F6F4FB', dark: '#0D0A1C' };

  try {
    var saved = localStorage.getItem('babelish-theme');
    if (saved === 'light' || saved === 'dark') {
      document.documentElement.setAttribute('data-theme', saved);

      /* A stored choice pins the address-bar colour too. Dropping the media
       * attribute is what makes it win over the opposite OS preference. */
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i++) {
        metas[i].setAttribute('content', CHROME[saved]);
        metas[i].removeAttribute('media');
      }
    }
  } catch (error) {
    /* storage blocked (private mode): the device preference is fine */
  }
})();
