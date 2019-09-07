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
	$isLocked = false;
	$database = new Database();
	$database->query('SELECT * FROM notepads WHERE id = :npid');
	$database->bind(':npid', $npid);
	$row = $database->single();
	if ($database->rowCount() != 0) {
		if (!is_null($row["lockdate"])) {
			$dateLock = DateTime::createFromFormat('Y-m-d H:i:s', $row["lockdate"]);
			$dateNow = new DateTime("now");
			if ($dateLock > $dateNow) {
				$isLocked = true;
			} else {
				$database->query('UPDATE notepads SET lockdate=NULL, lockpass=NULL WHERE id = :npid');
				$database->bind(':npid', $npid);
				$database->execute();
			}
		}
	}
	$database->query('SELECT * FROM notes WHERE npid = :npid ORDER BY org DESC');
	$database->bind(':npid', $npid);
	$results = $database->resultset();
	$postData = array(
		'result' => "success",
		'size' => $database->rowCount(),
		'lockstatus' => $isLocked
	);
	if ($database->rowCount() > 0) {
		foreach ($results as $result) {
			$postData[] = array(
				'id' => $result["id"],
				'org' => $result["org"],
				'color' => $result["color"],
				'isChecked' => $result["checked"],
				'text' => $result["text"],
				'lastEdit' => strtotime($result["lastedit"])
			);
		}
	}
	goto bail;
}

bail:
echo json_encode($postData);
exit;
?>
