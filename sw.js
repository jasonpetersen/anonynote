importScripts('https://storage.googleapis.com/workbox-cdn/releases/4.3.1/workbox-sw.js');

if (workbox) {
	console.log('Workbox loaded successfully.');
	// Precache core files
	workbox.precaching.precacheAndRoute([
		'/',
		'/index.php',
		'/site.webmanifest',
		'/fonts/icomoon.eot?8lhkqg',
		'/fonts/icomoon.svg?8lhkqg',
		'/fonts/icomoon.ttf?8lhkqg',
		'/fonts/icomoon.woff?8lhkqg',
		'/favicons/android-chrome-192x192.png',
		'/favicons/android-chrome-512x512.png',
		'/favicons/apple-touch-icon.png',
		'/favicons/browserconfig.xml',
		'/favicons/favicon-16x16.png',
		'/favicons/favicon-32x32.png',
		'/favicons/favicon.ico',
		'/favicons/mstile-144x144.png',
		'/favicons/mstile-150x150.png',
		'/favicons/mstile-310x150.png',
		'/favicons/mstile-310x310.png',
		'/favicons/mstile-70x70.png',
		'/favicons/safari-pinned-tab.svg'
	]);
	// As a single page web app, we need to denote that all the individual notepad permalinks are not unique pages and should route to the root index.php
	workbox.routing.registerNavigationRoute(
		workbox.precaching.getCacheKeyForURL('/index.php'), {
		whitelist: [
			new RegExp('^/np/'),
			new RegExp('^/local/')
		],
		blacklist: [
			new RegExp('^/json/'),
			new RegExp('/about'),
			new RegExp('/credits'),
			new RegExp('/contact'),
			new RegExp('/404')
		]
	});
	// Allow GA to work offline
	workbox.googleAnalytics.initialize();
	// Cache all JSON files
	workbox.routing.registerRoute(
		new RegExp('.*\.json'),
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'json',
		})
	);
	// Cache all JavaScript files Network First
	workbox.routing.registerRoute(
		new RegExp('.*\.js'),
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'javascript',
		})
	);
	// Cache all CSS files
	workbox.routing.registerRoute(
		new RegExp('.*\.css'),
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'css',
		})
	);
	// Cache the Google Fonts stylesheets
	workbox.routing.registerRoute(
		/^https:\/\/fonts\.googleapis\.com/,
		new workbox.strategies.StaleWhileRevalidate({
			cacheName: 'google-fonts-stylesheets',
		})
	);
	// Cache the underlying font files with a cache-first strategy for 1 year.
	workbox.routing.registerRoute(
		/^https:\/\/fonts\.gstatic\.com/,
		new workbox.strategies.CacheFirst({
			cacheName: 'google-fonts-webfonts',
			plugins: [
				new workbox.cacheableResponse.Plugin({
					statuses: [0, 200],
				}),
				new workbox.expiration.Plugin({
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
			cacheName: 'images',
			plugins: [
				new workbox.expiration.Plugin({
					maxEntries: 60,
					maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
				}),
			],
		})
	);
} else {
	console.log('Workbox failed to load.');
}