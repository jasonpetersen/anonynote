<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/min/static/lib.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

$minify = minify("404", $locale["core"]["lang_code"]);

define("PAGETITLE", $locale["error"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["error"]["meta_desc"]);

header("HTTP/1.0 404 Not Found");
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" type="text/css" href="<?php echo $minify["css"]; ?>">
	</head>
	<body id="error">
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="full-container">
			<div id="broken-pencil">
				<svg  version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 138"><polygon class="broken-pencil-path" points="179.75 82.86 172.82 68.15 193.39 58.38 193.39 58.38 179.75 82.86"/><polygon class="broken-pencil-path" points="255.37 99.32 241.67 110.23 229.21 94.46 229.21 94.46 255.37 99.32"/><polygon class="broken-pencil-path" points="142.2 25.92 147.24 0 162.31 2.95 162.31 2.95 142.2 25.92"/><polygon class="broken-pencil-path" points="262.15 13.72 229.21 8.94 234.62 0.78 234.62 0.78 262.15 13.72"/><path class="broken-pencil-path" d="M374.66,119.81c-2.16.28-11.37-1.06-21.21-3.23L336,112.86l17.32-81.75,17.78,3.73c10.51,2.24,19.09,4.51,21,5.72A18,18,0,0,1,400,52.77c.69,5.16-10.16,55.54-12.77,59.38A19.4,19.4,0,0,1,374.66,119.81Z"/><path class="broken-pencil-path" d="M332.19,69.57c4.72-22.27,8.45-40.74,8.31-41S317.11,23.32,285,16.43l-.76-.16-13.87,7.15,9.92,11.08.27.32.3.07c32.56,7.06,41.14,9.27,42,10.61,1.35,2.08.35,4.16-2.09,4.32-.73,0-16.34-3.15-37.36-7.6l-.28-.06L265.4,51.31l9.93,11.07,5.26,6.42L260.37,79.2l9.93,11.07,5.26,6.4L271.05,99l52.53,11.21Z"/><path class="broken-pencil-path" d="M150.94,78.88l-14.69-2.16,8.94-21-8.13-1.57L122.38,52l7.86-18.45c-5,2.65-10.35,5.46-15.89,8.37C73.74,63.33,65.53,67.31,64,66.55a2.42,2.42,0,0,1-1.51-2.9c.26-1.71,8.3-6.28,49.34-27.89l11.79-6.18-.41-.07L108.5,27.35,114.63,13,91.3,25.22l-73.87,39L0,120.27,56.62,138,157.07,85.11l2-4.68Zm-88.17,35.3-8.39,4.28-14-4.39,5.59-18L28.85,90.73l4.45-14.31L41,72.37a70.81,70.81,0,0,1,8.21-4c.24.08,5.28,9.46,11.23,20.83l10.82,20.7Z"/></svg>
				<a href="/" type="button" class="button color cyan circle homebtn">
					<i class="fa fa-home"></i>
				</a>
			</div>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="<?php echo $minify["js"]; ?>"></script>
	</body>
</html>
