<?php
@ini_set('display_errors', 0);

define("USE_STATIC_CACHE", false);

define("COPYRIGHT_TEXT", "&copy; " . date("Y") . " Peterscene");
define("COPYRIGHT_URL", "https://peterscene.com");

$isSecure = false;
if (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] == 'on') {
	$isSecure = true;
} elseif (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] == 'https' || !empty($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] == 'on') {
	$isSecure = true;
}

define("THISPROTOCOL", ($isSecure) ? 'https://' : 'http://');
define("THISDOMAIN", THISPROTOCOL . $_SERVER["HTTP_HOST"]);
define("THISPAGE", $_SERVER["REQUEST_URI"]);
define("THISURL", THISDOMAIN . THISPAGE);
define("ESCAPEDURL", htmlspecialchars(THISURL, ENT_QUOTES, 'UTF-8'));

define("DB_HOST", "###");
define("DB_USER", "###");
define("DB_PASS", "###");
define("DB_NAME", "###");

define("HASH_NP_SALT", "###");
define("HASH_NP_CHAR", 6);
define("HASH_NP_ALPHABET", "###");
define("HASH_NP_PREFIX", "np");

define("NPNAME_MAX_CHAR", 16);
define("NPDESC_MAX_CHAR", 160);

define("DEFAULT_LANG_CODE", "en-US");
$validLangs = ["en-US"];

function loadLocale($inputCode) {
	$langCode = (in_array($inputCode, $validLangs)) ? $inputCode : DEFAULT_LANG_CODE;
	$json = file_get_contents(realpath($_SERVER['DOCUMENT_ROOT']) . '/locales/' . $langCode . '.json');
	$GLOBALS['locale'] = json_decode($json, true);
	return $langCode;
}

$queryAppJS = $queryAboutJS = $queryCreditsJS = $queryContactJS = $query404JS = [];
foreach ($validLangs as $lang) {
	$queryAppJS[$lang] = "b=js&f=jquery-3.4.1.min.js,jquery-ui.min.js,jquery.transit.min.js,jquery.ba-throttle-debounce.min.js,anime.min.js,idb.js,webfont-1.6.26.min.js,linkify.min.js,linkify-jquery.min.js,spectrum.min.js,clipboard.min.js,grapheme-splitter.js,main.js,anonynote.js";
	$queryAboutJS[$lang] = $queryCreditsJS[$lang] = $query404JS[$lang] = "b=js&f=jquery-3.4.1.min.js,jquery.ba-throttle-debounce.min.js,main.js";
	$queryContactJS[$lang] = "b=js&f=jquery-3.4.1.min.js,jquery.ba-throttle-debounce.min.js,quform-plugins.js,quform-scripts.js,main.js";
}

$queryAppCSS = "b=css&f=jquery-ui.min.css,jquery-ui.structure.min.css,icomoon.css,spectrum.css,main.css,anonynote.css";
$queryAboutCSS = $queryCreditsCSS = $query404CSS = "b=css&f=icomoon.css,main.css";
$queryContactCSS = "b=css&f=icomoon.css,quform.css,main.css";

function minify($whichPage, $whichLang) {
	global $queryAppJS, $queryAboutJS, $queryCreditsJS, $queryContactJS, $query404JS, $queryAppCSS, $queryAboutCSS, $queryCreditsCSS, $queryContactCSS, $query404CSS;
	switch ($whichPage) {
		case "app":
			$thisJS = $queryAppJS[$whichLang];
			$thisCSS = $queryAppCSS;
			break;
		case "about":
			$thisJS = $queryAboutJS[$whichLang];
			$thisCSS = $queryAboutCSS;
			break;
		case "credits":
			$thisJS = $queryCreditsJS[$whichLang];
			$thisCSS = $queryCreditsCSS;
			break;
		case "contact":
			$thisJS = $queryContactJS[$whichLang];
			$thisCSS = $queryContactCSS;
			break;
		case "404":
			$thisJS = $query404JS[$whichLang];
			$thisCSS = $query404CSS;
			break;
	}
	$out = [];
	$static_uri = "/min/static";
	if (USE_STATIC_CACHE) {
		$out["js"] = Minify\StaticService\build_uri($static_uri, $thisJS, "js");
		$out["css"] = Minify\StaticService\build_uri($static_uri, $thisCSS, "css");
	} else {
		$out["js"] = "/min/?" . $thisJS;
		$out["css"] = "/min/?" . $thisCSS;
	}
	return $out;
}
?>
