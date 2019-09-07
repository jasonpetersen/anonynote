<?php

$links = array(
	"about",
	"credits",
	"contact"
);

header("Content-type: text/xml; charset=utf-8");

//create your XML document, using the namespaces
$urlset = new SimpleXMLElement('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />');

// create homepage
$url = $urlset->addChild('url');
$url->addChild('loc', 'https://anonynote.org');
$url->addChild('changefreq', 'weekly');
$url->addChild('priority', '1.0');

// create other pages
foreach ($links as $link) {
	$url = $urlset->addChild('url');
	$url->addChild('loc', 'https://anonynote.org/' . $link);
	$url->addChild('changefreq', 'weekly');
	$url->addChild('priority', '1.0');
}

// add whitespaces to xml output (optional)
$dom = new DomDocument();
$dom->loadXML($urlset->asXML());
$dom->formatOutput = true;

// output xml
echo $dom->saveXML();

?>
