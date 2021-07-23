		<!-- Google Tag Manager -->
		<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
		new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
		j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
		'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
		})(window,document,'script','dataLayer','GTM-XXXXXXX');</script>
		<!-- End Google Tag Manager -->
		<meta charset="utf-8">
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8">
		<meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
		<title><?php echo PAGETITLE; ?></title>
		<meta name="description" content="<?php echo PAGEDESC; ?>">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<meta name="apple-mobile-web-app-capable" content="yes">
		<meta name="mobile-web-app-capable" content="yes">
		<meta name="author" content="Jason Petersen">
<?php if (THISPAGE != "/") echo "		<link rel=\"preload\" href=\"https://fonts.googleapis.com/css?family=Mukta:400,700|Lora:700&display=fallback\" as=\"style\" onload=\"this.onload=null;this.rel='stylesheet'\">\n"; ?>
		<meta property="fb:admins" content="8209912">
		<meta property="og:title" content="<?php echo PAGETITLE; ?>">
		<meta property="og:description" content="<?php echo PAGEDESC; ?>">
		<meta property="og:url" content="<?php echo ESCAPEDURL; ?>">
		<meta property="og:site_name" content="<?php echo $locale["core"]["app_name"]; ?>">
		<meta property="og:image" content="<?php echo THISDOMAIN; ?>/img/site-image.png">
		<meta property="fb:app_id" content="1246209422093086">
		<link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png">
		<link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png">
		<link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png">
		<link rel="manifest" href="/site.webmanifest">
		<link rel="mask-icon" href="/favicons/safari-pinned-tab.svg" color="#0099cc">
		<link rel="shortcut icon" href="/favicons/favicon.ico">
		<meta name="apple-mobile-web-app-title" content="<?php echo $locale["core"]["app_name"]; ?>">
		<meta name="application-name" content="<?php echo $locale["core"]["app_name"]; ?>">
		<meta name="msapplication-TileColor" content="#2d89ef">
		<meta name="msapplication-config" content="/favicons/browserconfig.xml">
		<meta name="theme-color" content="#0099cc">
		<script>
			// https://github.com/filamentgroup/loadCSS
			!function(n){"use strict";n.loadCSS||(n.loadCSS=function(){});var o=loadCSS.relpreload={};if(o.support=function(){var e;try{e=n.document.createElement("link").relList.supports("preload")}catch(t){e=!1}return function(){return e}}(),o.bindMediaToggle=function(t){var e=t.media||"all";function a(){t.addEventListener?t.removeEventListener("load",a):t.attachEvent&&t.detachEvent("onload",a),t.setAttribute("onload",null),t.media=e}t.addEventListener?t.addEventListener("load",a):t.attachEvent&&t.attachEvent("onload",a),setTimeout(function(){t.rel="stylesheet",t.media="only x"}),setTimeout(a,3e3)},o.poly=function(){if(!o.support())for(var t=n.document.getElementsByTagName("link"),e=0;e<t.length;e++){var a=t[e];"preload"!==a.rel||"style"!==a.getAttribute("as")||a.getAttribute("data-loadcss")||(a.setAttribute("data-loadcss",!0),o.bindMediaToggle(a))}},!o.support()){o.poly();var t=n.setInterval(o.poly,500);n.addEventListener?n.addEventListener("load",function(){o.poly(),n.clearInterval(t)}):n.attachEvent&&n.attachEvent("onload",function(){o.poly(),n.clearInterval(t)})}"undefined"!=typeof exports?exports.loadCSS=loadCSS:n.loadCSS=loadCSS}("undefined"!=typeof global?global:this);
		</script>
