<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';

if ($_GET['np'] != "") {
	$ntpdhash = $_GET['np'];
	$npHashMethod = new Hashids(HASH_NP_SALT, HASH_NP_CHAR, HASH_NP_ALPHABET);
	$ntpdid = implode($npHashMethod->decode($ntpdhash));
	$database = new Database();
	$database->query('SELECT * FROM notepads WHERE id = :ntpdid LIMIT 1');
	$database->bind(':ntpdid', $ntpdid);
	$checkResult = $database->single();
	if ($database->rowCount() == 1) {
		$database->query('SELECT * FROM notes WHERE npid = :ntpdid ORDER BY id DESC');
		$database->bind(':ntpdid', $ntpdid);
		$npDataResults = $database->resultset();
		$npDataArray = array();
		foreach ($npDataResults as $npDataResult) {
			$npDataArray[] = array(
				'id' => $npDataResult["id"],
				'org' => $npDataResult["org"],
				'checked' => $npDataResult["checked"],
				'color' => $npDataResult["color"],
				'text' => $npDataResult["text"]
			);
		}
		header("Content-Type: application/json");
		echo json_encode($npDataArray, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK | JSON_PRETTY_PRINT);
		exit;
	} else {
		goto error;
	}
} else {
	goto error;
}

error:
$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);
define("PAGETITLE", $locale["error"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["error"]["meta_desc"]);
include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
exit;
?>