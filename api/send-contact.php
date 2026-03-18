<?php
if (!isset($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] !== 'XMLHttpRequest') {
	include realpath($_SERVER['DOCUMENT_ROOT']) . '/404.php';
	exit;
}

header('Content-Type: application/json');

require '/XXX/XXX.php';
require '/XXX/XXX.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\OAuth;
use League\OAuth2\Client\Provider\Google;

$rawData = file_get_contents('php://input');
$data    = json_decode($rawData, true);

$postData = [];

// Honeypot check — silently succeed so bots don't know they were caught
if (!empty($data['website'])) {
	$postData['result'] = 'success';
	goto bail;
}

// Validate inputs
$name    = trim($data['name']    ?? '');
$email   = trim($data['email']   ?? '');
$message = trim($data['message'] ?? '');

if (empty($name) || empty($email) || empty($message)) {
	$postData['result'] = 'invalid';
	goto bail;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
	$postData['result'] = 'invalid_email';
	goto bail;
}

// Send
$mail = new PHPMailer();
$mail->isSMTP();
$mail->Host       = 'smtp.gmail.com';
$mail->SMTPAuth   = true;
$mail->AuthType   = 'XOAUTH2';
$mail->Port       = 465;
$mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;

$provider = new Google([
	'clientId'     => OAUTH_CLIENT_ID,
	'clientSecret' => OAUTH_CLIENT_SECRET,
]);

$mail->setOAuth(new OAuth([
	'provider'     => $provider,
	'clientId'     => OAUTH_CLIENT_ID,
	'clientSecret' => OAUTH_CLIENT_SECRET,
	'refreshToken' => OAUTH_REFRESH_TOKEN,
	'userName'     => MAIL_FROM,
]));

$mail->setFrom(MAIL_FROM, 'Anonynote Contact Form');
$mail->addAddress(MAIL_TO);
$mail->addReplyTo($email, $name);
$mail->Subject = 'Anonynote: Message from ' . $name;
$mail->Body    = "Name: {$name}\nEmail: {$email}\n\nMessage:\n{$message}";

if ($mail->send()) {
	$postData['result'] = 'success';
} else {
	$postData['result'] = 'error';
}

bail:
echo json_encode($postData);
exit;
?>
