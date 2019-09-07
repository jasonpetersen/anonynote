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

$ssv = false;
$npname = str_replace(array("\r", "\n"), '', $jsonData['npname']);
if (grapheme_strlen($npname) > NPNAME_MAX_CHAR) $npname = grapheme_substr($npname, 0, NPNAME_MAX_CHAR);
if ($npname != $jsonData['npname']) $ssv = true;
$npdesc = "";

$database = new Database();
$database->query('SELECT * FROM notepads WHERE npname = :npname LIMIT 1');
$database->bind(':npname', $npname);
$row = $database->single();
if ($database->rowCount() == 1) {
	$npid = $row["id"];
	if (!is_null($row["npdesc"])) $npdesc = $row["npdesc"];
	$lastEdit = strtotime($row["lastedit"]);
} else {
	$lastEdit = time();
	$lastEditFormatted = date('Y-m-d H:i:s', $lastEdit);
	$database->query('INSERT INTO notepads (id, npname, npdesc, lockdate, lockpass, lastedit) VALUES (NULL, :padname, NULL, NULL, NULL, :lastedit)');
	$database->bind(':padname', $npname);
	$database->bind(':lastedit', $lastEditFormatted);
	$database->execute();
	$npid = $database->lastInsertId();
}

$postData = array(
	'nphash' => $npHashMethod->encode($npid),
	'npname' => $npname,
	'npdesc' => $npdesc,
	'lastEdit' => $lastEdit,
	'ssv' => $ssv
);

bail:
echo json_encode($postData);
exit;
?>
