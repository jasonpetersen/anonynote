<?php
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/global.php';
require_once realpath($_SERVER['DOCUMENT_ROOT']) . '/min/static/lib.php';

$thisLang = ($_GET['lang'] != "") ? $_GET['lang'] : DEFAULT_LANG_CODE;
loadLocale($thisLang);

$minify = minify("contact", $locale["core"]["lang_code"]);

define("PAGETITLE", $locale["contact"]["title"] . " - " . $locale["core"]["app_name"]);
define("PAGEDESC", $locale["contact"]["meta_desc"]);
?>

<!DOCTYPE html>
<html lang="<?php echo $locale["core"]["lang_code"]; ?>" class="no-touchevents">
	<head>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/head.php'; ?>
		<link rel="stylesheet" type="text/css" href="<?php echo $minify["css"]; ?>">
	</head>
	<body id="about">
<?php include_once realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/analytics-tracking.php'; ?>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/top.php'; ?>
		<div id="container" class="article">
			<form class="quform" action="/quform/process" method="post" enctype="multipart/form-data" onclick="">
				<h1>Let's have a conversation</h1>
				<p>Reporting bugs? Have any feature requests? General questions? In need of random conversation with a stranger? I'd love to speak with you!</p>
				<div class="spacer10"></div>
				<div class="quform-elements">
					<div class="row two-col">
						<div class="item">
							<label for="name">Name <span class="quform-required">*</span></label>
							<div class="quform-input">
								<input id="name" type="text" name="name" />
							</div>
						</div>
						<div class="item">
							<label for="email">Email address <span class="quform-required">*</span></label>
							<div class="quform-input">
								<input id="email" type="text" name="email" />
							</div>
						</div>
					</div>
					<div class="row one-col">
						<label for="message">Message <span class="quform-required">*</span></label>
						<div class="quform-input">
							<textarea id="message" name="message"></textarea>
						</div>
					</div>
					<div class="row one-col">
						<label>Security check <span class="quform-required">*</span></label>
						<div class="quform-input">
							<script src="https://www.google.com/recaptcha/api.js" async defer></script>
							<div class="g-recaptcha" data-sitekey="6LfMRBoUAAAAACq3yv27jXv6_OhT27EUvu5U-ZpX"></div>
							<noscript>
							  <div style="width: 302px; height: 352px;">
								<div style="width: 302px; height: 352px; position: relative;">
								  <div style="width: 302px; height: 352px; position: absolute;">
									<iframe src="https://www.google.com/recaptcha/api/fallback?k=6LfMRBoUAAAAACq3yv27jXv6_OhT27EUvu5U-ZpX"
											frameborder="0" scrolling="no"
											style="width: 302px; height:352px; border-style: none;">
									</iframe>
								  </div>
								  <div style="width: 250px; height: 80px; position: absolute; border-style: none;
											  bottom: 21px; left: 25px; margin: 0px; padding: 0px; right: 25px;">
									<textarea id="g-recaptcha-response" name="g-recaptcha-response"
											  class="g-recaptcha-response"
											  style="width: 250px; height: 80px; border: 1px solid #c1c1c1;
													 margin: 0px; padding: 0px; resize: none;"></textarea>
								  </div>
								</div>
							  </div>
							</noscript>
						</div>
					</div>
					<div class="quform-submit">
						<div class="quform-submit-inner">
							<button type="submit"  class="button large">Send</button>
						</div>
						<div class="quform-loading-wrap"><span class="quform-loading"></span></div>
					</div>
			   </div>
			</form>
		</div>
<?php include realpath($_SERVER['DOCUMENT_ROOT']) . '/includes/bottom.php'; ?>
		<script src="<?php echo $minify["js"]; ?>"></script>
	</body>
</html>
