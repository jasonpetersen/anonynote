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
	$ntid = $jsonData['ntid'];
	$database->query('SELECT npid FROM notes WHERE id = :ntid');
	$database->bind(':ntid', $ntid);
	$result = $database->single();
	if ($result["npid"] != $npid) {
		$postData["result"] = "matchfail";
		goto bail;
	} else {
		$ssv = false;
		$color = $jsonData['notecolor'];
		if (filter_var($color, FILTER_VALIDATE_INT, array('options' => array('min_range' => 0, 'max_range' => 8))) == false) {
			$color = 0;
			$ssv = true;
		}
		$database->query('UPDATE notes SET color = :color, lastedit = :lastedit WHERE id = :ntid');
		$database->bind(':color', $color);
		$database->bind(':lastedit', $timestamp);
		$database->bind(':ntid', $ntid);
		$database->execute();
		$postData = array(
			'result' => "success",
			'color' => $color,
			'lastEdit' => $unixTimestamp,
			'ssv' => $ssv
		);
		goto bail;
	}
}

bail:
echo json_encode($postData);
exit;
?>
