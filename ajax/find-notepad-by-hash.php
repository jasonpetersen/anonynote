<?php
if (!$_SERVER['HTTP_X_REQUESTED_WITH']) {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/hashids.php';

$npHashMethod = new Hashids(HASH_NP_SALT, HASH_NP_CHAR, HASH_NP_ALPHABET);

$nphash = $_GET['nphash'];
$npDecodeArray = $npHashMethod->decode($nphash);

$postData = array();

if (count($npDecodeArray) == 0) {
	$postData["result"] = "hashfail";
	goto bail;
} else {
	$npid = implode($npDecodeArray);
	$database = new Database();
	$database->query('SELECT * FROM notepads WHERE id = :npid LIMIT 1');
	$database->bind(':npid', $npid);
	$checkResult = $database->single();
	if ($database->rowCount() == 1) {
		$postData = array(
			'result' => "success",
			'npname' => $checkResult["npname"],
			'npdesc' => $checkResult["npdesc"],
			'lastEdit' => strtotime($checkResult["lastedit"])
		);
	} else {
		$postData["result"] = "findfail";
	}
	goto bail;
}

bail:
echo json_encode($postData);
exit;
?>
