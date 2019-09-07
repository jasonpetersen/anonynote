<?php
if (!$_SERVER['HTTP_X_REQUESTED_WITH']) {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/database-class.php';

$postData = array();

$database = new Database();
$database->query('SELECT text FROM notes WHERE id = XXXX');
$result = $database->single();
if ($database->rowCount() == 1) {
	$postData = array(
		'result' => "success",
		'version' => $result["text"]
	);
} else {
	$postData["result"] = "findfail";
}

echo json_encode($postData);
exit;
?>
