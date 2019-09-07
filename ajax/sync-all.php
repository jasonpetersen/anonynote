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

$postData = array(
	'warning' => false
);

$database = new Database();
$database->beginTransaction();

foreach ($jsonData['oosNotes'] as $nplid => $v) {
	// ### NOTEPAD ### //
	// validate and set variables
	$npname = str_replace(array("\r", "\n"), '', $jsonData['oosNotes'][$nplid]['notepad']['npname']);
	if (grapheme_strlen($npname) > NPNAME_MAX_CHAR) $npname = grapheme_substr($npname, 0, NPNAME_MAX_CHAR);
	if (is_null($jsonData['oosNotes'][$nplid]['notepad']['npdesc'])) {
		$npdesc = "";
	} else {
		$npdesc = str_replace(array("\r", "\n"), '', $jsonData['oosNotes'][$nplid]['notepad']['npdesc']);
		if (grapheme_strlen($npdesc) > NPDESC_MAX_CHAR) $npdesc = grapheme_substr($npdesc, 0, NPDESC_MAX_CHAR);
	}
	$npSynced = filter_var($jsonData['oosNotes'][$nplid]['notepad']['synced'], FILTER_VALIDATE_BOOLEAN);
	$npLastEdit = $jsonData['oosNotes'][$nplid]['notepad']['lastEdit'];
	if ($npLastEdit > $unixTimestamp) $npLastEdit = $unixTimestamp;
	$nphash = $jsonData['oosNotes'][$nplid]['notepad']['nphash'];
	$postData[$nplid] = array(
		'result' => "success",
		'isLocked' => false,
		'npname' => $npname,
		'nphash' => $nphash
	);
	if (is_null($nphash)) {
		// ### NEW NOTEPAD
		// possible errors: 1) notepad name already exists
		$database->query('SELECT id FROM notepads WHERE npname = :npname LIMIT 1');
		$database->bind(':npname', $npname);
		$database->single();
		if ($database->rowCount() == 0) {
			$database->query('INSERT INTO notepads (id, npname, npdesc, lockdate, lockpass, lastedit) VALUES (NULL, :npname, :npdesc, NULL, NULL, :lastedit)');
			$database->bind(':npname', $npname);
			$database->bind(':npdesc', $npdesc);
			$database->bind(':lastedit', $timestamp);
			$database->execute();
			$npid = $jsonData['oosNotes'][$nplid]['notepad']['npid'] = $database->lastInsertId();
			$postData[$nplid]["nphash"] = $npHashMethod->encode($npid);
		} else {
			$postData[$nplid]["result"] = "npnamefail";
			$postData["warning"] = true;
		}
	} else {
		// ### EXISTING NOTEPAD
		$npDecodeArray = $npHashMethod->decode($nphash);
		if (count($npDecodeArray) == 0) {
			$postData[$nplid]["result"] = "hashfail";
			$postData["warning"] = true;
		} else {
			$npid = $jsonData['oosNotes'][$nplid]['notepad']['npid'] = implode($npDecodeArray);
			$database->query('SELECT * FROM notepads WHERE id = :npid LIMIT 1');
			$database->bind(':npid', $npid);
			$row = $database->single();
			if ($database->rowCount() != 1) {
				$postData[$nplid]["result"] = "findfail";
				$postData["warning"] = true;
			} else {
				$mysqlNpName = $row["npname"];
				$mysqlNpDesc = $row["npdesc"];
				$mysqlNpLastEdit = strtotime($row["lastedit"]);
				$mysqlLockDate = strtotime($row["lockdate"]);
				if ((!is_null($row["lockdate"])) && ($mysqlLockDate > $unixTimestamp)) {
					$postData[$nplid]["result"] = "lockfail";
					$postData[$nplid]["isLocked"] = true;
					$postData["warning"] = true;
				} else {
					if ($npSynced == false) {
						// ### existing notepad needs updating
						// possible errors: 1) server side lastEdit is greater than client side; 2) notepad name already exists
						if ($npLastEdit >= $mysqlNpLastEdit) {
							$database->query('UPDATE notepads SET npdesc = :npdesc, lastedit = :lastedit WHERE id = :npid');
							$database->bind(':npdesc', $npdesc);
							$database->bind(':lastedit', $timestamp);
							$database->bind(':npid', $npid);
							$database->execute();
							if ($npname != $mysqlNpName) {
								$database->query('SELECT id FROM notepads WHERE npname = :npname LIMIT 1');
								$database->bind(':npname', $npname);
								$database->single();
								if ($database->rowCount() == 0) {
									$database->query('UPDATE notepads SET npname = :npname WHERE id = :npid');
									$database->bind(':npname', $npname);
									$database->bind(':npid', $npid);
									$database->execute();
								} else {
									$postData[$nplid]["result"] = "nprenamefail";
									$postData["warning"] = true;
								}
							}
						}
					}
				}
			}
		}
	}
	// ### NOTES ### //
	if (isset($jsonData['oosNotes'][$nplid]['notepad']['npid'])) {// we must have emerged from the above code with a notepad ID to commit any notes or note changes
		foreach ($jsonData['oosNotes'][$nplid] as $key => $val) {
			if (($key != "notepad") && ($postData[$nplid]["isLocked"] == false)) {
				// validate and set variables
				$idRemote = $jsonData['oosNotes'][$nplid][$key]['idRemote'];
				if (is_int($idRemote)) {// we'll validate and reset anything else, but if someone messed with the remote ID, stop right here
					$org = $jsonData['oosNotes'][$nplid][$key]['org'];
					if (!is_int($org)) $org = 0;
					$color = $jsonData['oosNotes'][$nplid][$key]['color'];
					if (filter_var($color, FILTER_VALIDATE_INT, array('options' => array('min_range' => 0, 'max_range' => 8))) == false) $color = 0;
					$isChecked = filter_var($jsonData['oosNotes'][$nplid][$key]['isChecked'], FILTER_VALIDATE_BOOLEAN);
					$text = $jsonData['oosNotes'][$nplid][$key]['text'];
					if (grapheme_strlen($text) > 65535) $text = grapheme_substr($text, 0, 65535);
					$noteLastEdit = $jsonData['oosNotes'][$nplid][$key]['lastEdit'];
					if ($noteLastEdit > $unixTimestamp) $noteLastEdit = $unixTimestamp;
					$deleted = filter_var($jsonData['oosNotes'][$nplid][$key]['deleted'], FILTER_VALIDATE_BOOLEAN);
					$noteSynced = filter_var($jsonData['oosNotes'][$nplid][$key]['synced'], FILTER_VALIDATE_BOOLEAN);
					if ($idRemote == 0) {
						// ### NEW NOTE, needs creating
						// no possible errors
						$database->query('INSERT INTO notes (id, npid, org, color, checked, text, lastedit) VALUES (NULL, :npid, :org, :color, :checked, :text, :lastedit)');
						$database->bind(':npid', $npid);
						$database->bind(':org', $org);
						$database->bind(':color', $color);
						$database->bind(':checked', $isChecked);
						$database->bind(':text', $text);
						$database->bind(':lastedit', $timestamp);
						$database->execute();
					} else {
						// EXISTING NOTE
						// check right at the top whether this note A) still exists, and B) is actually in the notepad the client says it is
						$database->query('SELECT * FROM notes WHERE id = :ntid');
						$database->bind(':ntid', $idRemote);
						$row = $database->single();
						if ($row["npid"] == $npid) {
							if ($deleted == true) {
								// ### EXISTING NOTE, flagged for deletion
								// no possible errors; FYI, lastEdit does not factor into this scenario
								$database->query('DELETE FROM notes WHERE id = :ntid');
								$database->bind(':ntid', $idRemote);
								$database->execute();
							} else {
								// ### EXISTING NOTE, needs updating
								// possible errors: 1) server side lastEdit is greater than client side
								if ($noteLastEdit >= strtotime($row["lastedit"])) {
									$database->query('UPDATE notes SET org = :org, color = :color, checked = :checked, text = :text, lastedit = :lastedit WHERE id = :ntid');
									$database->bind(':org', $org);
									$database->bind(':color', $color);
									$database->bind(':checked', $isChecked);
									$database->bind(':text', $text);
									$database->bind(':lastedit', $timestamp);
									$database->bind(':ntid', $idRemote);
									$database->execute();
								}
							}
						}
					}
				}
			}
		}
	}
}

if ($postData["warning"] == false) {
	$database->endTransaction();
} else {
	if ($jsonData['override'] == "override") {
		$postData["warning"] = false;
		$database->endTransaction();
	} else {
		$database->cancelTransaction();
	}
}

echo json_encode($postData);
exit;
?>
