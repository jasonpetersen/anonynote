<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

define("PAGETITLE", $locale["credits"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["credits"]["meta_desc"]);
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" href="/css/icomoon.css?v=<?php echo APP_VERSION; ?>">
		<link rel="stylesheet" href="/css/main.css?v=<?php echo APP_VERSION; ?>">
	</head>
	<body id="credits">
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<h1>Credit, acknowledgment &amp; thanks</h1>
			<img src="/img/headshot.jpg" alt="JP" class="img-right img-circle" width="200" height="200">
			<p>Hi, I'm Jason, the creator of Anonynote. I live in Red Hook, NY. I'm a technology generalist working in the non-profit world. Web and application development is a particular passion of mine.</p>
			<p>I keep a personal website called <a href="https://peterscene.com" target="_blank">Peterscene</a> where I blog and post about all the varied things I do.</p>
			<h2>Frameworks, libraries &amp; plugins</h2>
			<p>It takes a village, as the saying goes.</p>
			<p><a href="https://sortablejs.github.io/Sortable/" target="_blank">SortableJS</a> provides the drag-and-drop functionality that lets you reorder your notes.</p>
			<p><a href="https://animejs.com/" target="_blank">AnimeJS</a> is a lightweight JavaScript animation library that really jazzes things up.</p>
			<p>Those notepad permalinks are courtesy of <a href="https://sqids.org/" target="_blank">Sqids</a> (formerly Hashids).</p>
			<p><a href="https://linkify.js.org/" target="_blank">Linkify</a> is a straightforward JavaScript library that is hard at work turning all of your plain-text URLs into clickable hyperlinks.</p>
			<p>Google's <a href="https://developer.chrome.com/docs/workbox/" target="_blank">Workbox</a> is used for offline file caching, making Anonynote a fully functional Progressive Web App even without an internet connection.</p>
			<p>The contact form sends mail via <a href="https://github.com/PHPMailer/PHPMailer" target="_blank">PHPMailer</a>, the de facto standard email library for PHP.</p>
			<p><a href="https://www.cloudflare.com" target="_blank">Cloudflare</a> serves as an effective, free CDN.</p>
			<p>Last but not least, <a href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API" target="_blank">IndexedDB</a> functionality is implemented using <a href="https://github.com/jakearchibald/idb" target="_blank">Jake Archibald's IDB library</a>.</p>
			<h2>Additional code</h2>
			<p>All the little stuff really added up here.</p>
			<p>Philip Brown wrote a very straightforward <a href="http://culttt.com/2012/10/01/roll-your-own-pdo-php-class/" target="_blank">PDO PHP class</a> in use here.</p>
			<p><a href="https://icomoon.io/" target="_blank">IcoMoon</a> really spruces the place up with some vector icon magic.</p>
			<p>Before the advent of AI, I found so many solutions to problems on <a href="http://stackoverflow.com/" target="_blank">Stack Overflow</a>. Thank you, fellow coders!</p>
			<h2>Inspiration</h2>
			<p>Between work and home, I use many different desktop computers. I often have a need to transfer unmemorizable textual information among them and was lacking a good solution to do so. Usually I would be forced to log into my email, email myself the text, go to the other computer, log into my email, and copy the text. This was not only cumbersome but also a potential security risk: entering sensitive passwords on unfamiliar computers is unwise.</p>
			<p>I wanted a simple place where I could quickly and anonymously post and retrieve data. No user credentials, no frills. Just one input field between me and my data. That is the site you are currently on.</p>
			<p>I was inspired by a website called <strong>Dispostable</strong>, which is no longer available, I'm sorry to say. It allowed you to access any email inbox at the <span class="ital">dispostable.com</span> domain&mdash;perfect as a substitute for giving a questionable site your real email.</p>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="/js/main.js?v=<?php echo APP_VERSION; ?>"></script>
	</body>
</html>
