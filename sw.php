<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
header('Content-Type: application/javascript');
$v = APP_VERSION;
?>
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.4.0/workbox-sw.js');

// Take control immediately on install, don't wait for old SW to idle
self.addEventListener('install', function(event) {
	self.skipWaiting();
});

// Clean up stale runtime caches from previous versions
var CURRENT_CACHES = [
	'json-<?php echo $v; ?>',
	'javascript-<?php echo $v; ?>',
	'css-<?php echo $v; ?>',
	'images-<?php echo $v; ?>',
	// Font caches are intentionally unversioned — font URLs are permanent and stable
	'google-fonts-stylesheets',
	'google-fonts-webfonts'
];
self.addEventListener('activate', function(event) {
	event.waitUntil(
		clients.claim().then(function() {
			return caches.keys();
		}).then(function(cacheNames) {
			return Promise.all(
				cacheNames.filter(function(cacheName) {
					// Keep workbox-internal caches; delete our stale versioned ones
					return !cacheName.startsWith('workbox-') && !CURRENT_CACHES.includes(cacheName);
				}).map(function(cacheName) {
					console.log('Deleting stale cache:', cacheName);
					return caches.delete(cacheName);
				})
			);
		})
	);
});


if (workbox) {
	console.log('Workbox loaded successfully.');
	// Precache core files
	workbox.precaching.precacheAndRoute([
		{ url: '/', revision: '<?php echo $v; ?>' },
		{ url: '/index.php', revision: '<?php echo $v; ?>' },
		{ url: '/site.webmanifest', revision: '<?php echo $v; ?>' },
		{ url: '/fonts/icomoon.woff2', revision: '<?php echo $v; ?>' },
		{ url: '/fonts/icomoon.woff', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/apple-touch-icon.png', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/favicon-96x96.png', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/favicon.ico', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/favicon.svg', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/web-app-manifest-192x192.png', revision: '<?php echo $v; ?>' },
		{ url: '/favicons/web-app-manifest-512x512.png', revision: '<?php echo $v; ?>' }
	]);
	// As a single page web app, route all notepad permalinks to root index.php
	const navigationHandler = workbox.precaching.createHandlerBoundToURL('/index.php');
	const navigationRoute = new workbox.routing.NavigationRoute(navigationHandler, {
		allowlist: [
			new RegExp('^/np/'),
			new RegExp('^/local/')
		],
		denylist: [
			new RegExp('^/json/'),
			new RegExp('/about'),
			new RegExp('/credits'),
			new RegExp('/contact'),
			new RegExp('/404')
		]
	});
	workbox.routing.registerRoute(navigationRoute);
	// Allow GA to work offline
	workbox.googleAnalytics.initialize();
	// Cache same-origin JSON files
	workbox.routing.registerRoute(
		function(obj) { return obj.url.origin === self.location.origin && obj.url.pathname.endsWith('.json'); },
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'json-<?php echo $v; ?>',
		})
	);
	// Cache same-origin JavaScript files
	workbox.routing.registerRoute(
		function(obj) { return obj.request.destination === 'script' && obj.url.origin === self.location.origin; },
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'javascript-<?php echo $v; ?>',
		})
	);
	// Cache same-origin CSS files
	workbox.routing.registerRoute(
		function(obj) { return obj.request.destination === 'style' && obj.url.origin === self.location.origin; },
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'css-<?php echo $v; ?>',
		})
	);
	// Cache the Google Fonts stylesheets
	workbox.routing.registerRoute(
		/^https:\/\/fonts\.googleapis\.com/,
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'google-fonts-stylesheets',
		})
	);
	// Cache the underlying font files with a cache-first strategy for 1 year
	workbox.routing.registerRoute(
		/^https:\/\/fonts\.gstatic\.com/,
		new workbox.strategies.CacheFirst({
			cacheName: 'google-fonts-webfonts',
			plugins: [
				new workbox.cacheableResponse.CacheableResponsePlugin({
					statuses: [0, 200],
				}),
				new workbox.expiration.ExpirationPlugin({
					maxAgeSeconds: 60 * 60 * 24 * 365,
					maxEntries: 30,
				}),
			],
		})
	);
	// Cache all images
	workbox.routing.registerRoute(
		/\.(?:png|gif|jpg|jpeg|svg)$/,
		new workbox.strategies.CacheFirst({
			cacheName: 'images-<?php echo $v; ?>',
			plugins: [
				new workbox.expiration.ExpirationPlugin({
					maxEntries: 60,
					maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
				}),
			],
		})
	);
} else {
	console.log('Workbox failed to load.');
}
