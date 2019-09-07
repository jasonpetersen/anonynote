<?php
if (!$_SERVER['HTTP_X_REQUESTED_WITH']) {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

$rawData = file_get_contents("php://input");
$jsonData = json_decode($rawData, true);

$postData = array();

if ($jsonData['npname'] == "") {
	$postData["result"] = "is-empty";
	goto bail;
}

require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';

$npHashMethod = new Hashids(HASH_NP_SALT, HASH_NP_CHAR, HASH_NP_ALPHABET);

$unixTimestamp = time();
$timestamp = date('Y-m-d H:i:s', $unixTimestamp);

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
			if ($dateLock > $dateNow) {
				$postData["result"] = "lockfail";
				goto bail;
			}
		}
	}
	$ssv = false;
	$npname = str_replace(array("\r", "\n"), '', $jsonData['npname']);
	if (grapheme_strlen($npname) > NPNAME_MAX_CHAR) $npname = grapheme_substr($npname, 0, NPNAME_MAX_CHAR);
	if ($npname != $jsonData['npname']) $ssv = true;
	//check notepads table for proposed new name
	$database->query('SELECT id FROM notepads WHERE npname = :newname LIMIT 1');
	$database->bind(':newname', $npname);
	$result = $database->single();
	if ($database->rowCount() == 0) {
		//if name doesn't exist, execute rename
		$database->query('UPDATE notepads SET npname = :npname, lastedit = :lastedit WHERE id = :npid');
		$database->bind(':npname', $npname);
		$database->bind(':lastedit', $timestamp);
		$database->bind(':npid', $npid);
		$database->execute();
		$postData = array(
			'result' => "success",
			'npname' => $npname,
			'lastEdit' => $unixTimestamp,
			'ssv' => $ssv
		);
		goto bail;
	} else {
		//name already exists, so throw an error
		$postData["result"] = "actionfail";
		goto bail;
	}
}

bail:
echo json_encode($postData);
exit;
?>
