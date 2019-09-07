<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/min/static/lib.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

$minify = minify("about", $locale["core"]["lang_code"]);

define("PAGETITLE", $locale["about"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["about"]["meta_desc"]);
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" type="text/css" href="<?php echo $minify["css"]; ?>">
	</head>
	<body id="about">
<?php include_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/analytics-tracking.php'; ?>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<h1>The easiest note storage and retrieval. 100%&nbsp;free.</h1>
			<div class="video-wrap">
				<div class="video-container">
					<iframe src="https://www.youtube.com/embed/rGf_xXftWbA?rel=0" frameborder="0" allowfullscreen></iframe>
				</div>
			</div>
			<p><i class="fa fa-check"></i> Do you want to <span class="bold">retrieve data more quickly</span>? No accounts or logins getting in your way&mdash;just a single input field between you and the information you need? <span class="ital">Anonynote can help</span>.</p>
			<p><i class="fa fa-check"></i> Do you want to <span class="bold">access URLs from any device</span>&mdash;even those you don't own? In situations where bookmark syncing is not a suitable option, <span class="ital">Anonynote can help</span>.</p>
			<p><i class="fa fa-check"></i> Do you need to <span class="bold">copy unmemorizable text from one device to another</span>? Are you tired of sending emails to yourself? <span class="ital">Anonynote can help</span>.</p>
			<p>Let's face it: the number of devices we use in our daily lives isn't getting any smaller. You probably encounter text-based data in many forms that you want to either save for later or make available on another device. Why isn't there one efficient, centralized, multi-device solution to facilitate that?</p>
			<p><span class="bold">Anonynote can help!</span></p>
			<h2>Operation</h2>
			<p>Notepad names can contain up to 16 characters of any kind, including spaces and emojis. Create a notepad and fill it with notes. Color, arrange, and even check them. All data is presented in plain-text; HTML will not be interpreted. However, URLs will be converted into clickable hyperlinks.</p>
			<p>There are no accounts or logins. Anyone can potentially open and modify your notepad. However, <span class="bold">there is no directory</span>. No one knows your notepad name except you. Put simply, your notepad name <span class="ital">is</span> your password. To avoid discovery, use the same policy in creating a notepad name as you would in creating a strong password.</p>
			<h2>Any Device</h2>
			<p>Anonynote is a mobile-first application that scales well to any screen size. It is a certified <a href="https://developers.google.com/web/progressive-web-apps/" target="_blank">Progressive Web App</a>, scoring between 90% - 100% in all categories in <a href="https://developers.google.com/web/tools/lighthouse/" target="_blank">Google's Lighthouse</a>.</p>
			<p>Like all Progressive Web Apps, Anonynote is designed to function even when you are offline. Install it to the home screen on your mobile device, tablet, or even desktop computer (running Chrome) to take advantage of this feature.</p>
			<h2>Disclaimer</h2>
			<p>Anonynote is built for speed, at the expense of security. Despite our best efforts to build a strong site, <span class="bold">this is not a secure place to store sensitive data</span>.</p>
			<p>Ask yourself, "would I be upset if someone found this data?" If the answer is yes, <span class="bold">do not enter it here</span>.</p>
			<p>Data will never be purged. When you no longer need it, consider deleting it.</p>
			<p>This site takes no responsibility for the data that its users enter here. As there are no user accounts, no one owns any of the user-inputted data. An overly simplistic notepad name may be discovered at any time and its notes edited or deleted. It is your responsibility to prevent this by using unique notepad names.</p>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="<?php echo $minify["js"]; ?>"></script>
	</body>
</html>
