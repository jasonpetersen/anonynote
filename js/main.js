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

let menuScroll;//remembers notepad scroll position when toggling the menu


//** FUNCTIONS **//

// toggle the menu on and off
function toggleMenu() {
	let menuIcon = document.querySelector('#menu-button .fa');
	let menu = document.getElementById('menu');
	menuIcon.classList.toggle('fa-bars');
	menuIcon.classList.toggle('fa-times');
	menu.classList.toggle('display');
	// no-scroll body styles
	if (menu.classList.contains('display')) {
		document.addEventListener('keyup', menuEsc);
		menuScroll = window.scrollY;
		let offsetY = `${menuScroll * (-1)}px`;
		document.body.classList.add('noscroll');
		document.body.style.top = offsetY;
		let footerLocationCalc = window.innerHeight - document.getElementById('container').offsetHeight - document.getElementById('header').offsetHeight;
		if (footerLocationCalc <= 110) {
			let footer = document.getElementById('footer');
			footer.style.position = 'relative';
			footer.style.marginTop = `${footer.offsetHeight * -1}px`;
		}
	} else {
		document.removeEventListener('keyup', menuEsc);
		let footer = document.getElementById('footer');
		footer.style.position = '';
		footer.style.marginTop = '';
		document.body.classList.remove('noscroll');
		document.body.style.top = '';
		window.scrollTo(0, menuScroll);
	}
}

// listen for ESC key when menu is active
function menuEsc(e) {
	if ((e.key === "Escape") && (document.getElementById('menu').classList.contains('display'))) {
		toggleMenu();
	}
}

//** ON DOM READY **//

document.addEventListener('DOMContentLoaded', function() {
	// we can't test for touch capability, but we can test for a touchevent action; swap out the "no-touchevents" class if a touchevent is detected
	window.addEventListener('touchstart', function onFirstTouch() {
		document.documentElement.classList.remove('no-touchevents');
		document.documentElement.classList.add('touchevents');
		window.removeEventListener('touchstart', onFirstTouch, false);
	}, false);
	// prevent hyperlinks with the 'nolink' class from executing
	document.addEventListener('click', function(e) {
		if (e.target.matches('a.nolink')) e.preventDefault();
	});
});
