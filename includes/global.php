<?php
@ini_set('display_errors', 0);

define("APP_VERSION", "6.0.0");

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
$_availableLangs = [];
foreach (glob(realpath($_SERVER['DOCUMENT_ROOT']) . '/locales/*.json') as $file) {
	$_json = json_decode(file_get_contents($file), true);
	if (!empty($_json['core']['lang_code']) && !empty($_json['core']['lang'])) {
		$_availableLangs[$_json['core']['lang_code']] = $_json['core']['lang'];
	}
}
define('AVAILABLE_LANGS', $_availableLangs);
unset($_availableLangs, $_json, $file);

function loadLocale($inputCode) {
	$langCode = (array_key_exists($inputCode, AVAILABLE_LANGS)) ? $inputCode : DEFAULT_LANG_CODE;
	$json = file_get_contents(realpath($_SERVER['DOCUMENT_ROOT']) . '/locales/' . $langCode . '.json');
	$GLOBALS['locale'] = json_decode($json, true);
	return $langCode;
}

?>
