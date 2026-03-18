<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

define("PAGETITLE", $locale["contact"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["contact"]["meta_desc"]);
?>
<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" href="/css/icomoon.css?v=<?php echo APP_VERSION; ?>">
		<link rel="stylesheet" href="/css/main.css?v=<?php echo APP_VERSION; ?>">
	</head>
	<body id="about">
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<form id="contact-form" novalidate>
				<h1>Let's have a conversation</h1>
				<p>Reporting bugs? Have any feature requests? General questions? In need of random conversation with a stranger? I'd love to speak with you!</p>
				<div class="spacer10"></div>
				<div class="form-body">
					<div class="row two-col">
						<div class="item">
							<label for="contact-name">Name <span class="required">*</span></label>
							<div class="field-input">
								<input id="contact-name" type="text" name="name" autocomplete="name" />
							</div>
						</div>
						<div class="item">
							<label for="contact-email">Email address <span class="required">*</span></label>
							<div class="field-input">
								<input id="contact-email" type="email" name="email" autocomplete="email" />
							</div>
						</div>
					</div>
					<div class="row one-col">
						<label for="contact-message">Message <span class="required">*</span></label>
						<div class="field-input">
							<textarea id="contact-message" name="message"></textarea>
						</div>
					</div>
					<!-- Honeypot: hidden from real users, bots fill it in -->
					<div class="field-honeypot" aria-hidden="true">
						<label for="contact-website">Website</label>
						<input id="contact-website" type="text" name="website" tabindex="-1" autocomplete="off" />
					</div>
					<div class="row one-col">
						<button type="submit" id="contact-submit" class="button large">Send</button>
						<span id="contact-status"></span>
					</div>
				</div>
			</form>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="/js/main.js?v=<?php echo APP_VERSION; ?>"></script>
		<script>
		document.getElementById('contact-form').addEventListener('submit', function(e) {
			e.preventDefault();
			var btn = document.getElementById('contact-submit');
			var status = document.getElementById('contact-status');
			btn.disabled = true;
			status.textContent = '';
			fetch('/api/send-contact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-Requested-With': 'XMLHttpRequest'
				},
				body: JSON.stringify({
					name:    document.getElementById('contact-name').value,
					email:   document.getElementById('contact-email').value,
					message: document.getElementById('contact-message').value,
					website: document.getElementById('contact-website').value
				})
			})
			.then(function(r) { return r.json(); })
			.then(function(data) {
				if (data.result === 'success') {
					document.getElementById('contact-form').reset();
					status.className = 'contact-status-success';
					status.textContent = "Message sent! I'll be in touch.";
				} else if (data.result === 'invalid' || data.result === 'invalid_email') {
					status.className = 'contact-status-error';
					status.textContent = 'Please fill in all fields with a valid email address.';
					btn.disabled = false;
				} else {
					status.className = 'contact-status-error';
					status.textContent = 'Something went wrong. Please try again.';
					btn.disabled = false;
				}
			})
			.catch(function() {
				status.className = 'contact-status-error';
				status.textContent = 'Something went wrong. Please try again.';
				btn.disabled = false;
			});
		});
		</script>
	</body>
</html>
