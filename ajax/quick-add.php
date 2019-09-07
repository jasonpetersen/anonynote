<?php
if (!$_SERVER['HTTP_X_REQUESTED_WITH']) {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';

$npHashMethod = new Hashids(HASH_NP_SALT, HASH_NP_CHAR, HASH_NP_ALPHABET);

$unixTimestamp = time();
$timestamp = date('Y-m-d H:i:s', $unixTimestamp);

$rawData = file_get_contents("php://input");
$jsonData = json_decode($rawData, true);

$nphash = $jsonData['nphash'];
$npDecodeArray = $npHashMethod->decode($nphash);

$postData = array();

if (count($npDecodeArray) == 0) {
	$postData["result"] = "hashfail";
	goto bail;
} else {
	$npid = implode($npDecodeArray);
	$database = new Database();
	$database->query('SELECT * FROM notepads WHERE id = :npid');
	$database->bind(':npid', $npid);
	$row = $database->single();
	if ($database->rowCount() != 0) {
		if (!is_null($row["lockdate"])) {
			$dateLock = DateTime::createFromFormat('Y-m-d H:i:s', $row["lockdate"]);
			$dateNow = new DateTime("now");
			if ($dateLock > $dateNow) {
				$postData["result"] = "lockfail";
				goto bail;
			}
		}
	}
	$ssv = false;
	$text = $jsonData['notetext'];
	if (grapheme_strlen($text) > 65535) $text = grapheme_substr($text, 0, 65535);
	if ($text != $jsonData['notetext']) $ssv = true;
	$color = $isChecked = 0;
	$database->query('SELECT MAX(org) FROM notes WHERE npid = :npid');
	$database->bind(':npid', $npid);
	$result = $database->single();
	if ($database->rowCount() == 0) {
		$org = 1;
	} else {
		$org = $result['MAX(org)'] + 1;
	}
	$database->query('INSERT INTO notes (id, npid, org, color, checked, text, lastedit) VALUES (NULL, :npid, :org, :color, :checked, :text, :lastedit)');
	$database->bind(':npid', $npid);
	$database->bind(':org', $org);
	$database->bind(':color', $color);
	$database->bind(':checked', $isChecked);
	$database->bind(':text', $text);
	$database->bind(':lastedit', $timestamp);
	$database->execute();
	$newId = $database->lastInsertId();
	$postData = array(
		'result' => "success",
		'idRemote' => intval($newId),
		'org' => $org,
		'text' => $text,
		'lastEdit' => $unixTimestamp,
		'ssv' => $ssv
	);
	goto bail;
}

bail:
echo json_encode($postData);
exit;
?>
