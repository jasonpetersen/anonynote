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

$ssv = false;
$text = $jsonData['notetext'];
if (grapheme_strlen($text) > 65535) $text = grapheme_substr($text, 0, 65535);
if ($text != $jsonData['notetext']) $ssv = true;
$color = $jsonData['notecolor'];
if (filter_var($color, FILTER_VALIDATE_INT, array('options' => array('min_range' => 0, 'max_range' => 8))) == false) {
	$color = 0;
	$ssv = true;
}

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
	if ($jsonData['ntid'] == 0) {
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
		$database->bind(':checked', 0);
		$database->bind(':text', $text);
		$database->bind(':lastedit', $timestamp);
		$database->execute();
		$newId = $database->lastInsertId();
		$postData = array(
			'result' => "success-new",
			'idRemote' => intval($newId),
			'org' => $org,
			'color' => $color,
			'text' => $text,
			'lastEdit' => $unixTimestamp,
			'ssv' => $ssv
		);
		goto bail;
	} else {
		$ntid = $jsonData['ntid'];
		$database->query('SELECT npid FROM notes WHERE id = :ntid');
		$database->bind(':ntid', $ntid);
		$queryData = $database->single();
		if ($queryData["npid"] != $npid) {
			$postData["result"] = "matchfail";
			goto bail;
		} else {
			$database->query('UPDATE notes SET color = :color, text = :text, lastedit = :lastedit WHERE id = :ntid');
			$database->bind(':color', $color);
			$database->bind(':text', $text);
			$database->bind(':lastedit', $timestamp);
			$database->bind(':ntid', $ntid);
			$database->execute();
			$postData = array(
				'result' => "success-update",
				'color' => $color,
				'text' => $text,
				'lastEdit' => $unixTimestamp,
				'ssv' => $ssv
			);
			goto bail;
		}
	}
}

bail:
echo json_encode($postData);
exit;
?>
