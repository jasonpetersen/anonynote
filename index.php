<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/min/static/lib.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

$minify = minify("app", $locale["core"]["lang_code"]);

define("PAGETITLE", $locale["core"]["app_name"] . " - " . $locale["app"]["tagline"]);
define("PAGEDESC", $locale["app"]["meta_desc"]);
?>
<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<script>
			var splashTimeout=setTimeout(function(){var e;((e=document.getElementById("splash")).offsetWidth||e.offsetHeight||e.getClientRects().length)&&(document.getElementById("splash-reload-button").style.visibility="visible")},1e4);
		</script>
		<style type="text/css">
			html{position:relative;min-height:100%;-webkit-text-size-adjust:100%}body{width:100%;overflow-x:hidden}body.noscroll{position:fixed;height:100%}#user-lock,#menu,#sticky-buttons{opacity:0;visibility:hidden}#header #app-header-wrapper #icon-status{-webkit-transform:scale(0);-moz-transform:scale(0);-o-transform:scale(0);-ms-transform:scale(0);transform:scale(0)}#splash{position:fixed;display:flex;flex-direction:column;justify-content:center;align-items:center;top:0;left:0;width:100%;height:100%;z-index:30000;background-color:#09c}#splash .loading-circle{margin-top:52px}#splash .loading-circle div:after{background:#fff}#splash #splash-reload-button{margin-top:20px;visibility:hidden}#splash .error{color:#fff;font-size:5em}.loading-circle{display:inline-block;position:relative;width:64px;height:64px}.loading-circle div{animation:loading-roller 1.2s cubic-bezier(.5,0,.5,1) infinite;transform-origin:32px 32px}.loading-circle div:after{content:" ";display:block;position:absolute;width:6px;height:6px;border-radius:50%;margin:-3px 0 0 -3px}.loading-circle div:nth-child(1){animation-delay:-36ms}.loading-circle div:nth-child(1):after{top:50px;left:50px}.loading-circle div:nth-child(2){animation-delay:-72ms}.loading-circle div:nth-child(2):after{top:54px;left:45px}.loading-circle div:nth-child(3){animation-delay:-108ms}.loading-circle div:nth-child(3):after{top:57px;left:39px}.loading-circle div:nth-child(4){animation-delay:-144ms}.loading-circle div:nth-child(4):after{top:58px;left:32px}.loading-circle div:nth-child(5){animation-delay:-.18s}.loading-circle div:nth-child(5):after{top:57px;left:25px}.loading-circle div:nth-child(6){animation-delay:-216ms}.loading-circle div:nth-child(6):after{top:54px;left:19px}.loading-circle div:nth-child(7){animation-delay:-252ms}.loading-circle div:nth-child(7):after{top:50px;left:14px}.loading-circle div:nth-child(8){animation-delay:-288ms}.loading-circle div:nth-child(8):after{top:45px;left:10px}@keyframes loading-roller{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}.button{display:inline-block;zoom:1;padding:8px 12px;margin:0;cursor:pointer;overflow:visible;font:bold 14px arial,helvetica,sans-serif;border:none;border-radius:0;text-decoration:none;white-space:nowrap;color:#fff;background-color:#282828;outline:0;-webkit-appearance:none;-webkit-touch-callout:none;-webkit-user-select:none;-khtml-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}.button.white{color:#282828;background-color:#fff}
		</style>
		<link rel="preload" href="<?php echo $minify["css"]; ?>" as="style" onload="this.onload=null;this.rel='stylesheet'">
	</head>
	<body id="app" class="noscroll">
<?php include_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/analytics-tracking.php'; ?>
		<div id="splash">
			<div class="loading-circle"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
			<button id="splash-reload-button" type="button" class="button white" onclick="window.location.reload();"><?php echo $locale["general"]["reload"]; ?></button>
		</div>
		<div id="modal"><div id="modal-window"></div></div>
		<div id="user-lock"></div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="app-toolbar" class="hide">
			<div id="app-toolbar-handle-background"></div>
			<div id="app-toolbar-handle-wrapper"><button id="app-toolbar-handle" type="button" class="button empty" title="<?php echo $locale["toolbar"]["toggle"]; ?>" onclick="appToolbarToggle();"><i class="fa"></i></button></div>
			<div id="icon-cloud" title="<?php echo $locale["toolbar"]["cloud"]; ?>"><i class="fa fa-cloud-online"></i></div>
			<div id="icon-database" title="<?php echo $locale["toolbar"]["idb"]; ?>"><i class="fa fa-database"></i></div>
			<button id="advanced-modal-button" type="button" class="button white small" onclick="advancedModal();"><?php echo $locale["toolbar"]["advanced"]; ?></button>
		</div>
		<div id="popup-status"><span id="popup-msg"></span></div>
		<div id="container">
			<div id="home">
				<i id="logo-homepage"><?php echo file_get_contents(realpath($_SERVER['DOCUMENT_ROOT']) . '/img/logo-homepage.svg'); ?></i>
				<h1 class="hidden"><?php echo $locale["core"]["app_name"]; ?></h1>
				<h2 class="hidden"><?php echo $locale["app"]["tagline"]; ?></h2>
				<form>
					<input id="notepad-input" type="text" onkeypress="return event.keyCode!=13;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
					<div class="label">
						<span class="label-text"><?php echo $locale["app"]["input_label"]; ?></span>
						<div class="label-info">
							<button type="button" class="button transparent" title="<?php echo $locale["app"]["info"]; ?>" onclick="popupMsg('<?php echo $locale["app"]["info"]; ?>');"><i class="fa fa-info"></i></button>
						</div>
					</div>
					<button id="find-notepad-button" type="submit" class="button large disabled" onclick="findNotepadByName($('#notepad-input').val());"><?php echo $locale["app"]["open_button"]; ?></button>
				</form>
			</div>
			<div id="notepad"></div>
			<div id="edit"></div>
		</div>
		<div id="sticky-buttons"></div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script>
			if ('serviceWorker' in navigator) {
				window.addEventListener('load', function() {
					navigator.serviceWorker.register('/sw.js').then(function(registration) {
						console.log('ServiceWorker registration successful with scope: ', registration.scope);
					}, function(err) {
						console.log('ServiceWorker registration failed: ', err);
					});
				});
			}
		</script>
		<script src="<?php echo $minify["js"]; ?>"></script>
		<script type="application/ld+json">
		{
			"@context": "http://schema.org/",
			"@type": "SoftwareApplication",
			"name": "<?php echo $locale['core']['app_name']; ?>",
			"description": "<?php echo PAGEDESC; ?>",
			"url": "<?php echo ESCAPEDURL; ?>",
			"image": "https://anonynote.org/img/pencil-square.png",
			"applicationCategory": "BusinessApplication",
			"offers": {
				"@type": "Offer",
				"price": "0.00",
				"priceCurrency": "USD"
			}
		}
		</script>
	</body>
</html>
