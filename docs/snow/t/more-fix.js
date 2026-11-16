/* more.js (docs/apps/) builds links as "../<app>/", which is right only for pages one folder deep.
   Town pages sit at /snow/t/<st>/, so rewrite those links against /snow/ (this file's parent folder). */
(function () {
  'use strict';
  var me = document.currentScript, base;
  try { base = new URL('../', me.src); } catch (e) { return; }
  function fix() {
    var box = document.getElementById('more-apps'); if (!box) return;
    Array.prototype.forEach.call(box.querySelectorAll('a[href^="../"], img[src^="../"]'), function (n) {
      var at = n.tagName === 'A' ? 'href' : 'src';
      n.setAttribute(at, new URL(n.getAttribute(at), base).href);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix); else fix();
})();
