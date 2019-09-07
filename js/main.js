//** JQUERY FIX **//

// see https://stackoverflow.com/questions/46094912/added-non-passive-event-listener-to-a-scroll-blocking-touchstart-event
(function () {
    if (typeof EventTarget !== "undefined") {
        let func = EventTarget.prototype.addEventListener;
        EventTarget.prototype.addEventListener = function (type, fn, capture) {
            this.func = func;
            if(typeof capture !== "boolean"){
                capture = capture || {};
                capture.passive = false;
            }
            this.func(type, fn, capture);
        };
    };
}());


//** APPLICATION VARIABLES **//

var menuScroll;//remembers notepad scroll position when toggling the menu


//** FUNCTIONS **//

// toggle the menu on and off
function toggleMenu() {
	$('#menu-button .fa').toggleClass('fa-bars');
	$('#menu-button .fa').toggleClass('fa-times');
	$('#menu').toggleClass('display');
	// no-scroll body styles
	if ($('#menu').hasClass('display')) {
		$(document).on("keyup", menuEsc);
		menuScroll = $(window).scrollTop();
		var offsetY = $(window).scrollTop() * (-1) + 'px';
		$('body').addClass('noscroll').css('top', offsetY);
		var footerLocationCalc = $(window).height() - $('#container').height() - $('#header').height();
		if (footerLocationCalc <= 110) {
			if ($('html').hasClass('ie11')) {
				$('#footer').css('position', 'relative').css('margin-top', 0);
			} else {
				$('#footer').css('position', 'relative').css('margin-top', $('#footer').height()*-1);
			}
		}
	} else {
		$(document).off("keyup", menuEsc);
		$('#footer').css('position', '').css('margin-top', '');
		$('body').removeClass('noscroll').css('top', '');
		$(window).scrollTop(menuScroll);
	}
}

// listen for ESC key when menu is active
function menuEsc(e) {
	if ((e.keyCode == 27) && ($('#menu').hasClass('display'))) {
		toggleMenu();
	}
}

// check if IE, apply class if so
function detectIE() {
	var isie = false;
	var ua = window.navigator.userAgent;
	var msie = ua.indexOf('MSIE ');
	var trident = ua.indexOf('Trident/');
	var edge = ua.indexOf('Edge/');
	if (msie > 0) {
		// IE 10 or older
		isie = true;
		var ieVer = parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
	} else if (trident > 0) {
		// IE 11
		isie = true;
		var rv = ua.indexOf('rv:');
		var ieVer = parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
	} else if (edge > 0) {
		// Edge (IE 12+)
		isie = true;
		var ieVer = parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
	}
	if (isie == true) {
		$('html').addClass('ie');
		if (ieVer == 11) $('html').addClass('ie11');
	}
}


//** ON DOCUMENT READY **//

$(document).ready(function() {
	// we can't test for touch capability, but we can test for a touchevent action; swap out the "no-touchevents" class if a touchevent is detected
	window.addEventListener('touchstart', function onFirstTouch() {
		$('html').removeClass('no-touchevents');
		$('html').addClass('touchevents');
		window.removeEventListener('touchstart', onFirstTouch, false);
	}, false);
	// detect IE
	detectIE();
	// prevent hyperlinks with the 'nolink' class from executing
	$(document).on("click", 'a.nolink', function(e) { e.preventDefault(); });
});
