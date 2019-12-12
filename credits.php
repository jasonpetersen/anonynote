<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/min/static/lib.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

$minify = minify("credits", $locale["core"]["lang_code"]);

define("PAGETITLE", $locale["credits"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["credits"]["meta_desc"]);
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" type="text/css" href="<?php echo $minify["css"]; ?>">
	</head>
	<body id="credits">
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<h1>Credit, acknowledgment &amp; thanks</h1>
			<img src="/img/headshot.jpg" alt="JP" class="img-right img-circle" width="200" height="200">
			<p>Hi, I'm Jason, the creator of Anonynote. I live in Boston, MA earning my living as a videographer. But every now and then I immerse myself in web work, and every now and then someone even pays me for it.</p>
			<p>This was not one of those times.</p>
			<p>In fact, when I consider the minutes this app saves me versus the countless hours spent programming it, I wonder about my time management.</p>
			<p>I keep a personal website called <a href="https://peterscene.com" target="_blank">Peterscene</a> where I blog and post about all the varied things I do.</p>
			<h2>Frameworks, libraries &amp; plugins</h2>
			<p>It takes a village, as the saying goes.</p>
			<p>Anonynote is built upon plain old <a href="http://jquery.com/" target="_blank">jQuery</a>. I also use <a href="https://jqueryui.com/" target="_blank">jQuery UI</a> for its drag-and-drop functionality.</p>
			<p>For the sake of performance, certain functions are limited in their execution by Ben Alman's <a href="http://benalman.com/projects/jquery-throttle-debounce-plugin/" target="_blank">jQuery Throttle / Debounce</a>.</p>
			<p><a href="http://animejs.com/" target="_blank">AnimeJS</a> is a lightweight JavaScript animation library that really jazzes things up. But just like jQuery animations, they can perform poorly on mobile. I'm also relying upon <a href="http://ricostacruz.com/jquery.transit/" target="_blank">Transit</a>, a jQuery plugin, for creating better performing CSS transitions and transformations.</p>
			<p>When my host bailed on Google PageSpeed support, and CloudFlare failed to want to minify any of my JavaScript and CSS assets, I needed an alternative. <a href="https://github.com/mrclay/minify" target="_blank">Minify</a> to the rescue! It's been flawless.</p>
			<p>Those notepad permalinks are courtesy of <a href="http://hashids.org/" target="_blank">Hashids</a>.</p>
			<p><a href="https://github.com/typekit/webfontloader" target="_blank">Web Font Loader</a> asynchronously calls the Google Fonts in use here.</p>
			<p><a href="https://bgrins.github.io/spectrum/" target="_blank">Spectrum</a> is a very smart, lightweight, and customizable jQuery color picker. It is capable of so much more than I'm using it for here.</p>
			<p><a href="http://soapbox.github.io/linkifyjs/" target="_blank">Linkify</a> is a straightforward JavaScript plugin that is hard at work turning all of your plain-text URLs into clickable hyperlinks.</p>
			<p><a href="https://clipboardjs.com/" target="_blank">Clipboard.js</a> is a tiny plugin for one-click copying of data to the clipboard, with very broad cross-browser support.</p>
			<p>Many web technologies were not made with emojis in mind. To properly enforce character limits on an any-character-goes web app, I really needed the <a href="https://github.com/orling/grapheme-splitter" target="_blank">Grapheme Splitter</a> JavaScript library.</p>
			<p>The contact form is courtesy of <a href="https://codecanyon.net/item/quform-responsive-ajax-contact-form/148273" target="_blank">Quform</a>. Although this is a basic implementation, it's feature-rich.</p>
			<p>Google's <a href="https://developers.google.com/web/tools/workbox/" target="_blank">Workbox</a> is used for offline file caching.</p>
			<p><a href="https://www.cloudflare.com" target="_blank">Cloudflare</a> serves as an effective, free CDN.</p>
			<p>Last but not least, Jake Archibald's <a href="https://github.com/jakearchibald/idb" target="_blank">IndexedDB Promised</a> library is a Google-recommended <a href="https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API" target="_blank">IndexedDB API</a> mod that has transformed Anonynote from top to bottom. I was merely playing at a Progressive Web App before discovering IndexedDB.</p>
			<h2>Additional code</h2>
			<p>All the little stuff really added up here.</p>
			<p>Philip Brown wrote a very straightforward <a href="http://culttt.com/2012/10/01/roll-your-own-pdo-php-class/" target="_blank">PDO PHP class</a> in use here.</p>
			<p><a href="https://icomoon.io/" target="_blank">IcoMoon</a> really spruces the place up with some vector icon magic.</p>
			<p>I found so many solutions to problems on <a href="http://stackoverflow.com/" target="_blank">Stack Overflow</a>. Thank you, fellow coders!</p>
			<h2>Inspiration</h2>
			<p>Between work and home, I use many different desktop computers. I often have a need to transfer unmemorizable textual information among them and was lacking a good solution to do so. Usually I would be forced to log into my email, email myself the text, go to the other computer, log into my email, and copy the text. This was not only cumbersome but also a potential security risk: entering sensitive passwords on unfamiliar computers is unwise.</p>
			<p>I wanted a simple place where I could quickly and anonymously post and retrieve data. No user credentials, no frills. Just one input field between me and my data. That is the site you are currently on.</p>
			<p>I was inspired by a website called <a href="http://www.dispostable.com/" target="_blank">Dispostable</a>, which I have long been a patron of. It allows you to access any email inbox at the <span class="ital">dispostable.com</span> domain&mdash;perfect as a substitute for giving a questionable site your real email.</p>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="<?php echo $minify["js"]; ?>"></script>
	</body>
</html>
