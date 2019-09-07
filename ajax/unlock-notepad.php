<?php
if (!$_SERVER['HTTP_X_REQUESTED_WITH']) {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

$rawData = file_get_contents("php://input");
$jsonData = json_decode($rawData, true);

$postData = array();

if ($jsonData['lockpass'] == "") {
	$postData["result"] = "is-empty";
	goto bail;
}

require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';

$npHashMethod = new Hashids(HASH_NP_SALT, HASH_NP_CHAR, HASH_NP_ALPHABET);

$nphash = $jsonData['nphash'];
$npDecodeArray = $npHashMethod->decode($nphash);

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
			if ($dateLock < $dateNow) {
				$postData["result"] = "lockfail";
				goto bail;
			}
		} else {
			$postData["result"] = "lockfail";
			goto bail;
		}
		if ($jsonData['lockpass'] != $row["lockpass"]) {
			$postData["result"] = "incorrect";
			goto bail;
		} else {
			$database->query('UPDATE notepads SET lockdate = NULL, lockpass = NULL WHERE id = :npid');
			$database->bind(':npid', $npid);
			$database->execute();
			$postData["result"] = "success";
			goto bail;
		}
	}
}

bail:
echo json_encode($postData);
exit;
?>
