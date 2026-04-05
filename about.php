<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

define("PAGETITLE", $locale["about"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["about"]["meta_desc"]);
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" href="/css/icomoon.css?v=<?php echo APP_VERSION; ?>">
		<link rel="stylesheet" href="/css/main.css?v=<?php echo APP_VERSION; ?>">
	</head>
	<body id="about">
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<h1>The easiest note storage and retrieval. 100%&nbsp;free.</h1>
			<p>Anonynote is a lightweight, no-fuss notepad app that lets you store and retrieve text from any device. No accounts. No passwords. No app store. Just open a browser, type a notepad name, and you're in.</p>

			<h2>How It Works</h2>
			<p>Every notepad has a name &mdash; up to 16 characters, case-sensitive, spaces and emojis welcome. That name is your key: anyone who knows it can open, read, and edit that notepad, so treat it the way you'd treat a password. The more unique, the better.</p>
			<p>There's no directory, no search, no way for anyone to stumble across your notepad. Open the same name on any device, any browser, and you'll see the same notes.</p>

			<h2>Features</h2>
			<div class="screenshot-block">
				<div class="screenshot-content">
					<p>Notepads support an optional short description, visible just below the notepad name.</p>
					<p>To add a note, use the "quick add" field at the top of the notepad for fast, single-line entries. For longer notes, tap or click the <strong>+</strong> button to open the full note editor, where you can write as much as you like and choose a color before saving.</p>
					<p>Notes are plain text &mdash; no formatting or markup &mdash; with the exception of URLs, which are automatically converted into clickable links. Each note can be assigned one of nine colors, checked off when done, or deleted when it's no longer needed. Long notes are truncated on mobile with a "read more" link to keep things tidy.</p>
				</div>
				<img class="screenshot" src="/img/about-new-note.png" alt="Creating a new note">
			</div>
			<div class="screenshot-block">
				<div class="screenshot-content">
					<p>On <strong>desktop</strong>, every note shows a full set of tool buttons: edit, delete, color selector, and a sort handle. Click and drag the sort handle to reorder your notes. On <strong>mobile</strong>, tap the three-dots button on any note to reveal those same tool buttons. Use the up and down arrows to reorder.</p>
					<p>Notepads can be <strong>locked</strong> with the creation of a password. Click the lock icon next to the notepad name and follow the instructions. Locked notepads are read-only &mdash; good for sharing with others whom you don't want to get edit access.</p>
				</div>
				<img class="screenshot" src="/img/about-tool-buttons.png" alt="Note tool buttons">
			</div>
			<div class="screenshot-block">
				<div class="screenshot-content">
					<p>Every notepad has its own <strong>API URL</strong>, accessible via the API button in the notepad toolbar. That URL returns the notepad's notes as a JSON array, including each note's text, color, sort order, and checked state. You can use it to pull your Anonynote data into other apps, scripts, or automation workflows.</p>
				</div>
				<img class="screenshot" src="/img/about-json.png" alt="Notepad API URL">
			</div>

			<h2>Personalization</h2>
			<div class="screenshot-block reverse">
				<div class="screenshot-content">
					<p>Tap the gear icon to open Settings. From there you can switch themes. On first launch, Anonynote matches your OS preference for light or dark mode, but you can change it, and additional themes are available. You can also switch the app language from Settings.</p>
				</div>
				<img class="screenshot" src="/img/about-settings.png" alt="Settings modal">
			</div>

			<h2>Works Offline</h2>
			<p>Lose your connection and Anonynote keeps working offline. Notes are stored locally until you're online again. You can also choose to work entirely offline if you don't want your notes to sync with Anonynote's server.</p>

			<h2>Install as a Web App</h2>
			<p>Anonynote is a <a href="https://web.dev/explore/progressive-web-apps" target="_blank" rel="noopener noreferrer">Progressive Web App</a>. It can be installed directly to your home screen. No app store, no download, no updates to manage. It launches full-screen like a native app and unlocks a few extra features described below. Installation takes about ten seconds.</p>

			<h3>On iPhone (Safari)</h3>
			<div class="screenshot-block">
				<div class="screenshot-content">
					<ol>
						<li>Open Anonynote in Safari.</li>
						<li>Tap the <strong>Share</strong> button (the box with the arrow pointing up at the bottom of the screen).</li>
						<li>Scroll down and tap <strong>Add to Home Screen</strong>. Then tap <strong>Add</strong>.</li>
					</ol>
				</div>
				<img class="screenshot" src="/img/about-ios-add-to-home.png" alt="Add to Home Screen on iOS">
			</div>

			<h3>On Android (Chrome)</h3>
			<div class="screenshot-block reverse">
				<div class="screenshot-content">
					<ol>
						<li>Open Anonynote in Chrome.</li>
						<li>Tap the <strong>three-dot menu</strong> in the top-right corner.</li>
						<li>Tap <strong>Add to Home Screen</strong> or <strong>Install app</strong>.</li>
						<li>Tap <strong>Install</strong> to confirm.</li>
					</ol>
				</div>
				<img class="screenshot" src="/img/about-android-add-to-home.png" alt="Add to Home Screen on Android">
			</div>

			<h2>Web App Mode</h2>
			<div class="screenshot-block">
				<div class="screenshot-content">
					<p>Once installed, Anonynote gains a few features that aren't available in the browser.</p>
					<ul>
						<li><strong>Recent notepads.</strong> The home screen shows your recently opened notepads, so you can jump right back in without retyping a name.</li>
						<li><strong>Picks up where you left off.</strong> Close the app and reopen it. It returns to exactly the notepad you were in, at exactly the scroll position you left.</li>
						<li><strong>Long-press to copy.</strong> Press and hold any note for one second to copy its text to the clipboard.</li>
					</ul>
				</div>
				<img class="screenshot" src="/img/about-pwa-mode.png" alt="Web App Mode">
			</div>

			<h2>Privacy &amp; Security</h2>
			<p>Anonynote is built for speed and simplicity, not security. There are no user accounts, no ownership, and no audit trail. <strong>Do not store sensitive information here.</strong></p>
			<p>Your notepad name is your only protection. A weak or obvious name can be guessed, so use something unique. The same logic you'd apply to a strong password applies here.</p>
			<p>Data is never automatically purged. When you no longer need a notepad's contents, consider deleting the notes yourself.</p>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="/js/main.js?v=<?php echo APP_VERSION; ?>"></script>
	</body>
</html>
