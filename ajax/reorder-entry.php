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
	$orderArray = $jsonData['noteorder'];
	$orderFlat = implode(", ", $orderArray);
	$database->query('SELECT DISTINCT npid FROM notes WHERE id IN ('.$orderFlat.')');
	$results = $database->resultset();
	foreach ($results as $result) {
		if ($result["npid"] != $npid) {
			$postData["result"] = "matchfail";
			goto bail;
		}
	}
	$database->beginTransaction();
	$database->query('UPDATE notes SET org = :org, lastedit = :lastedit WHERE id = :id');
	foreach ($orderArray as $k => $v) {
		$o = count($orderArray) - $k;
		$database->bind(':org', $o);
		$database->bind(':lastedit', $timestamp);
		$database->bind(':id', $v);
		$database->execute();
		$postData[$o] = $v;
	}
	$database->endTransaction();
	$postData = array(
		'result' => "success",
		'lastEdit' => $unixTimestamp
	);
	goto bail;
}

bail:
echo json_encode($postData);
exit;
?>
