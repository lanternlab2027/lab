// Wrapped season hub: ?ref passthrough on links to our own apps (URL only, nothing stored, no network).
// A visit to /wrapped-season/?ref=ph-wrapped-season keeps "ph-wrapped-season" on every app link;
// without a ref the static default "wrapped-season" stays in place.
(function () {
  'use strict';
  var r = '';
  try { r = new URLSearchParams(location.search).get('ref') || ''; } catch (e) { r = ''; }
  r = r.toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 40);
  if (!r) return;
  var links = document.querySelectorAll('a.app-link[data-path]');
  for (var i = 0; i < links.length; i++) {
    var a = links[i];
    a.setAttribute('href', '../' + a.getAttribute('data-path') + '?ref=' + encodeURIComponent(r) + (a.getAttribute('data-hash') || ''));
  }
})();
