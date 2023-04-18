//** GLOBAL APPLICATION VARIABLES **//

var appVer = "5.2.7";// the application version number

$.holdReady( true );// hold document ready
var holdReleaseCurrent = 0;// number; 0 to start; increment upward until we hit holdReleaseTarget
var holdReleaseTarget = 6;// how many checks are needed before we release the hold on document ready. 1) Check internet connection, 2) Google Fonts loaded, 3) CSS loaded, 4) Locale loaded, 5) Core app variables set, 6) IndexedDB initialized

// variables stored in and retrieved from IndexedDB object stores
var idbVersion;// holds the current database version number
var idbDB = "anonynote";// the IDB database name
var notepadIdLocal;// number; if in notepad location, holds that notepad local ID
var offlineState = 0;// 0 = offline mode off (default); 1 = offline mode on; 2 = offline mode on by user choice; 3 = unavailable (no IDB support)
var localPadCounter = 0;// local notepad counter; default to 0, unless later pulled from an IndexedDB stored value
var localNoteCounter = 0;// local note counter; default to 0, unless later pulled from an IndexedDB stored value
var langCode = "en-US";// current language code; default (and only language ATM) is 'en-US'
var globalSync = true;// boolean; set to false if anything at all is out-of-sync between IndexedDB and MySQL
var darkMode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? true : false;// boolean; initially set based upon OS preference; possibly override later from IndexedDB or user selection
var catalog = {};// an object that holds information on every notepad opened on this device
var notepads = {};// an object that holds all the notes for all the notepads opened on this device

// declare IndexedDB snapshot object store variables; temp variables to use or discard depending on conditions
var snapshotLoc, snapshotNotepadIdLocal, snapshotScroll;

var locale;// holds all the language for the app
var npScroll;// holds notepad scroll position for notepad <--> edit movement
var modalScroll;// holds notepad scroll position when toggling the modal window
var modalForce = false;// boolean; set to true to prevent escaping and clicking to turn off the modal window
var touchStatus = void 0;// holds the most recent touch event
var statusQueue = 0;// number; increments up and down for actions triggering the status icon
var statusComplete = 1;// boolean (1 or 0); indicates whether the statusQueue is clear or not
var speed = 400;// milliseconds; transition speed
$.fx.speeds._default = 400;// milliseconds; jQuery speed
var timeoutInternet = 5000;// milliseconds; how long to wait before bailing on an internet connection check
var timeoutAjax = 7500;// milliseconds; how long to wait before bailing any other Ajax call
var funcThrottle = 3000;// milliseconds; certain functions are throttled so as to not rapid-fire, but will trigger after no more than the provided number of milliseconds
var charSplitter = new GraphemeSplitter();// initialize the Grapheme Splitter library, used for accurate character counting
var desktopWidth = 768;// number; the pixel width at which desktop screen size begins
var npnameMaxChar = 16;// number; notepad name character limit, also applies to lock password limit -- also defined in global.php
var npdescMaxChar = 160;// number; notepad description character limit, also defined in global.php
var truncateNote = 150;// number; note characters to show before hiding the rest behind a 'read more' link (on mobile only)
var notePrefix = "note-";// string; prefix for note ids
var npLaunchFail;// boolean; set to true if there was a failed attempt to launch directly to a notepad page
var appLoc = "home";// holds the current application location (home, notepad, or edit); "home" by default
var appLaunched = false;// boolean; set to true when the application is finished prepping and actually running
var actionQueue = [];// an array for temporary storage, used in the delay and execution of IDB puts
var quickAddFocusOut = void 0;// // holds a timer from the setTimeout() function
var colors = [];// an array that will later hold the palette for the color picker
var colorHexToId = [];// another array that will later hold the palette for the color picker

var isInWebApp = ((window.navigator.standalone == true) || (window.matchMedia('(display-mode: standalone)').matches)) ? true : false;// boolean; whether we're operating from within an iOS or Android web app environment
var clipboardAccess = (typeof navigator.clipboard === 'undefined') ? false : true;// boolean; whether there is access to the clipboard
var idbSupport;// boolean; holds whether there is IDB support

var networkConn, internetConn;
networkConn = internetConn = (navigator.onLine) ? true : false;// boolean; whether network and internet connections are detected. assume their statuses are the same unless proven otherwise

var urlParams = {};// an object that holds all URL parameters
var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,val) {
	urlParams[key] = val;
});


//** GLOBAL AJAX SETTINGS **//

$.ajaxSetup({
	cache: false,// do not allow AJAX requests to be cached
	contentType: "application/json",//the type of data we're sending
	dataType : "json",// the type of data we expect to get back
	timeout: timeoutAjax,// when to give up (in milliseconds)
	error: function(xhr, status, errorThrown) {
		userControl("open");
		cloudIndicator("error");
		statusIndicator("error");
		if (appLaunched == false) {
			if (appLoc == "notepad") {
				$('#notepad').empty().removeAttr('style').removeClass('active-loc');
				$('#home').removeAttr('style').addClass('active-loc');
				updateState("home", "replace");
				popupMsg(locale.popup.notepad_launch_timeout, "red");
			}
			$('#notepad-input').focus();
			splashHandler("clear");
		} else if (status == "timeout") {
			if (offlineState == 3) {
				errorModal("timeout");
			} else {
				internetConn = false;
				$('body').attr('data-internet', 0);
				setOfflineState("system", 1);
				recheckInternet(15, 8);
			}
		} else {
			errorModal(xhr.status);
		}
	}
});


//** CORE FUNCTIONS **//

// increment holdReleaseCurrent until it hits the target, then allow document ready
function holdRelease() {
	holdReleaseCurrent++;
	if (holdReleaseCurrent >= holdReleaseTarget) {
		$.holdReady( false );
	}
}

WebFont.load({// document hold release #2: asynchronously load the Google Fonts
	google: { families: ['Mukta:400,700', 'Lora:700'] },
	active: function() { holdRelease(); },// hold release on success...
	inactive: function() { holdRelease(); },// ...or failure
	timeout: 3000
});

var cssCheck = setInterval(function(){// document hold release #3: CSS is being loaded asynchronously on the index.php page; wait for the presence of one of its styles to confirm it's ready
	if (getComputedStyle(document.querySelector(':root')).getPropertyValue('--white-color') != "") {
		holdRelease();
		clearInterval(cssCheck);
	}
}, 250);

// determine internet connection status
$.ajax({
	type: "GET",
	dataType: "text",
	timeout: timeoutInternet,
	url: "/ajax/is-connected",
	success: function() {
		internetConn = true;// we are probably online
	},
	error: function(xhr, status, errorThrown) {
		internetConn = false;// we are either offline, or have a poor connection -- the latter to be treated the same as the former
	},
	complete: function() {
		holdRelease();// document hold release #1: determine whether there is a functional internet connection
		if (!('indexedDB' in window)) {// check for IndexedDB support
			if (internetConn) {
				idbSupport = false;
				$('body').attr('data-idb-support', 0);
				setOfflineState("system", 3);// without IDB support, offline mode is unavailable
				loadLocale();// document hold release #4: load the default language code locale
				prepLaunchState();// document hold release #5: set core app variables
				holdRelease();// document hold release #6: no IDB to initialize, so skip it
			} else {
				splashHandler("doa");// without either IndexedDB or an internet connection, this app can't run
			}
		} else {
			idbInit();// initialize IndexedDB
		}
	}
});

// re-check for an internet connection at an interval
function recheckInternet(maxTimes, intervalSeconds) {
	if ((internetConn) || (!networkConn)) return;// conditions for early bailing
	clearTimeout(window.internetCheckFirst);
	clearInterval(window.internetCheck);
	var internetCheckCount = 0;
	function checkIsConnected() {
		$.ajax({
			type: "GET",
			dataType: "text",
			timeout: timeoutInternet,
			url: "/ajax/is-connected",
			success: function() {
				internetConn = true;
				$('body').attr('data-internet', 1);
				setOfflineState("system", 0);
				clearInterval(internetCheck);
			},
			error: function(xhr, status, errorThrown) {
				internetCheckCount++;
				if (internetCheckCount >= maxTimes) clearInterval(window.internetCheck);
			}
		});
	}
	window.internetCheckFirst = setTimeout(checkIsConnected, timeoutInternet);
	window.internetCheck = setInterval(checkIsConnected, 1000 * intervalSeconds);
}

// load the locale JSON file
function loadLocale() {
	var xobj = new XMLHttpRequest();
	xobj.overrideMimeType("application/json");
	xobj.open('GET', '/locales/' + langCode + '.json', true);
	xobj.onreadystatechange = function () {
		if (xobj.readyState == 4) {
			if (xobj.status == "200") {
				locale = JSON.parse(xobj.responseText);
				holdRelease();
			} else {
				splashHandler("doa");// an app without language is unusable
			}
		}
	};
	xobj.send(null);
}

// set core application variables necessary for launch; depends upon an array of circumstances, including URL, offline state, and more
function prepLaunchState() {
	if ((isInWebApp) && (idbSupport) && (urlParams["override"] != 1)) {
		// scenario #1: this app is being loaded within a web app environment; launch from the IDB snapshot, overriding all other considerations
		if ((["notepad", "edit"].includes(snapshotLoc)) && (typeof catalog[snapshotNotepadIdLocal] !== 'undefined')) {
			appLoc = "notepad";
			notepadIdLocal = snapshotNotepadIdLocal;
			npScroll = snapshotScroll;
		}
		holdRelease();
	} else if (window.location.pathname.substring(0,4) == "/np/") {
		// scenario #2: the URL is specifying a remote DB notepad hash
		var notepadHash = window.location.pathname.substring(4,10);
		if (([0, 3].includes(offlineState)) && (internetConn)) {
			$.ajax({
				type: "GET",
				url: "/ajax/find-notepad-by-hash",
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",
				data: { nphash: notepadHash },
				success: function(postData) {
					if (postData["result"] == "success") {
						// that notepad was found in the remote database: proceed with setting variables
						appLoc = "notepad";
						for (let k in catalog) {
							if (catalog[k]["npname"] == postData.npname) notepadIdLocal = Number(k);
						}
						if (typeof notepadIdLocal === 'undefined') {
							localPadCounter++;
							notepadIdLocal = localPadCounter;
							idbSnapshotUpdate("count");
						}
						catalog[notepadIdLocal] = {
							'npname': postData.npname,
							'nphash': notepadHash,
							'npdesc': ((postData.npdesc == "") || (postData.npdesc == null) || (typeof postData.npdesc === 'undefined')) ? void 0 : postData.npdesc,
							'lastEdit': postData.lastEdit,
							'lastOpen': getUnixTimestamp(),
							'synced': 1
						}
						idbCatalogUpdate();
					} else {
						// there was an error of one kind or another: flag the error and bail
						npLaunchFail = true;
					}
				},
				error: function(xhr, status, errorThrown) {
					// there was an error of one kind or another: flag the error and bail
					npLaunchFail = true;
				},
				complete: function() {
					holdRelease();
				}
			});
		} else {
			// scenario #3: the user just tried calling a remote notepad in either offline mode, or without an internet connection
			// try to find the notepad in the local catalog
			for (let k in catalog) {
				if (catalog[k]["nphash"] == notepadHash) {
					// it was found: proceed with setting variables
					appLoc = "notepad";
					notepadIdLocal = Number(k);
				}
			}
			if (appLoc == "home") {
				// it was not found: flag the error and bail
				npLaunchFail = true;
			}
			holdRelease();
		}
	} else if (window.location.pathname.substring(0,7) == "/local/") {
		// scenario #4: the URL is specifying a local notepad ID
		notepadIdLocal = Number(window.location.pathname.substring(7));
		if (typeof catalog[notepadIdLocal] !== 'undefined') {
			// that notepad was found in the catalog: proceed with setting variables
			appLoc = "notepad";
		} else {
			// that notepad was not found: roll back the notepad ID var, flag the error, and bail
			notepadIdLocal = void 0;
			npLaunchFail = true;
		}
		holdRelease();
	} else {
		// scenario #5: the URL is not specifying a particular notepad; just bail
		holdRelease();
	}
}

// lockdown or allow user control
function userControl(directive) {
	switch (directive) {
		case "lock":
			$('#user-lock').addClass("display");
			break;
		case "open":
			$('#user-lock').removeClass("display");
			break;
	}
}

// trigger on changes to network connection status
function updateOnlineStatus(event) {
	console.log("Network connection status change: " + event.type + ".");
	networkConn = navigator.onLine ? true : false;
	if (!networkConn) {// if the network connection has been lost
		internetConn = false;
		$('body').attr('data-internet', 0);
		setOfflineState("system", 1);
		if (!idbSupport) splashHandler("doa");// without either IndexedDB or a network connection, this app can't run
	} else {// if the network connection has been re-established
		$.ajax({
			type: "GET",
			dataType: "text",
			timeout: timeoutInternet,
			url: "/ajax/is-connected",
			success: function() {
				internetConn = true;
				$('body').attr('data-internet', 1);
				setOfflineState("system", 0);
			},
			error: function(xhr, status, errorThrown) {
				internetConn = false;
				$('body').attr('data-internet', 0);
				setOfflineState("system", 1);
				recheckInternet(15, 4);
			}
		});
	}
}
window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// toggle offline mode state
// 0 = offline mode off (online); 1 = offline mode on via system coercion; 2 = offline mode on by user choice; 3 = unavailable (no IDB support)
function setOfflineState(userSystem, num, override) {
	if (override == "override") {
		// disregard all of the logic below and execute the request silently
		offlineState = num;
		$('body').attr('data-offline-mode', offlineState);
		idbSnapshotUpdate("conn");
		return offlineState;
	}
	if (offlineState == 3) return null;// this variable can never be other than "3" in the absence of IDB support; bail
	var originalState = offlineState;
	if (typeof num !== 'undefined') {
		if (num == offlineState) return null;// the offline state is already the specified value; bail
		if ((offlineState == 2) && (num == 0) && (userSystem == "system")) {
			return null;// the user turned on offline mode and the system is trying to turn it off; don't let it
		} else if ((offlineState == 2) && (num == 1)) {
			return null;// the user had already turned offline mode on; don't let the system claim credit for it
		} else {
			offlineState = num;
		}
	} else {
		switch (offlineState) {
			case 0:
				offlineState = (userSystem == "user") ? 2 : 1;
				break;
			case 1:
				offlineState = 0;
				break;
			case 2:
				if (userSystem == "user") {
					offlineState = 0;
				} else {
					return null;// the user turned on offline mode and the system is trying to turn it off; don't let it
				}
				break;
		}
	}
	// if we weren't online, but now we are -- and there's any data out of sync -- revert this change and bring up the sync modal now
	// or, if the application is still launching, flag the sync modal to appear later, right as the splash screen is cleared
	if ((originalState != 0) && (offlineState == 0) && (globalSync == false)) {
		offlineState = originalState;
		if (appLaunched == true) {
			syncModal("dialog");
		} else {
			window.syncOnLaunch = true;
		}
	} else {
		// otherwise, commit the change to DOM attribute and IndexedDB
		$('body').attr('data-offline-mode', offlineState);
		idbSnapshotUpdate("conn");
		// convey messaging via pop ups
		if (offlineState == 0) {
			if (userSystem == "user") popupMsg(locale.popup.offline.disabled_user, "green");
			if (userSystem == "system") popupMsg(locale.popup.offline.disabled_sys, "green");
		} else if (offlineState == 1) {
			popupMsg(locale.popup.offline.enabled_sys, "red");
		} else if (offlineState == 2) {
			popupMsg(locale.popup.offline.enabled_user, "red");
		}
	}
	return offlineState;
}

// clear or otherwise modify the splash screen
function splashHandler(toggle) {
	switch (toggle) {
		case "clear":
			if (window.syncOnLaunch == true) {// if the offline state changed during the application launch, bring up the sync modal
				window.syncOnLaunch = void 0;
				syncModal("dialog");
			}
			$('body').removeClass("noscroll");
			$('#splash').empty().hide();
			appLaunched = true;
			break;
		case "doa":
			$('body').addClass("noscroll");
			$('#splash').empty().append("<button type='button' class='button transparent' onclick='window.location.reload();'><i class='error fa fa-warning'></i></button>").show();
			break;
	}
}

// used to limit IDB function puts for quick transactions that are likely to succeed
function npCommitHandler(toggle, sync, ts) {
	if (toggle == "offline") {
		recheckInternet(15, 4);// if the internet connection is poor or nonexistent, check it again
		idbCatalogUpdate();
		if (sync) {
			globalSync = false;
			idbSnapshotUpdate("sync");
		}
	} else if (typeof actionQueue[ts] === 'undefined') {
		actionQueue[ts] = setTimeout(function () {
			idbCatalogUpdate();
			if (sync) {
				globalSync = false;
				idbSnapshotUpdate("sync");
			}
		}, funcThrottle);
	} else {
		clearTimeout(actionQueue[ts]);
		idbCatalogUpdate();
		if ((sync) && (!globalSync)) {
			globalSync = true;
			idbSnapshotUpdate("sync");
		}
	}
}
function noteCommitHandler(toggle, whichid, sync, ts, option) {
	switch (toggle) {
		case "offline":
			recheckInternet(15, 4);// if the internet connection is poor or nonexistent, check it again
			if ((sync) && (option == "delete")) { idbNoteDelete(whichid); } else { idbNoteUpdate(whichid);	}
			if (sync) {
				globalSync = false;
				idbSnapshotUpdate("sync");
			}
			break;
		case "delay":
			actionQueue[ts] = setTimeout(function () {
				if ((sync) && (option == "delete")) { idbNoteDelete(whichid); } else { idbNoteUpdate(whichid);	}
				if (sync) {
					globalSync = false;
					idbSnapshotUpdate("sync");
				}
			}, funcThrottle);
			break;
		case "resolve":
			clearTimeout(actionQueue[ts]);
		case "now":
			if ((sync) && (option == "delete")) { idbNoteDelete(whichid); } else { idbNoteUpdate(whichid);	}
			if ((sync) && (!globalSync)) {
				globalSync = true;
				idbSnapshotUpdate("sync");
			}
			break;
	}
}

// update status indicator icon
function statusIndicator(toggle) {
	switch (toggle) {
		case "process":
			statusQueue++;
			statusComplete = 0;
			$('#icon-status i').removeClass().addClass('fa fa-refresh fa-spin');
			$('#icon-status').addClass('display');
			break;
		case "success":
			statusComplete = 1;
			$('#icon-status i').removeClass().addClass('fa fa-check');
			hideIndicator(statusQueue);
			break;
		case "error":
			statusComplete = 1;
			$('#icon-status i').removeClass().addClass('fa fa-warning');
			hideIndicator(statusQueue);
			break;
		case "hide":
			statusComplete = 1;
			$('#icon-status i').removeClass().addClass('fa');
			$('#icon-status').removeClass('display');
			break;
	}
}

// hide status indicator icon
function hideIndicator(queueNum) {
	window.setTimeout(function() {
		if (statusQueue == queueNum) $('#icon-status').removeClass('display');
	}, 3000);
}

// update cloud indicator icon
function cloudIndicator(toggle) {
	switch (toggle) {
		case "online":
			$('#icon-cloud i').removeClass().addClass('fa fa-cloud-online');
			break;
		case "offline":
			$('#icon-cloud i').removeClass().addClass('fa fa-cloud-offline');
			break;
		case "upload":
			$('#icon-cloud i').removeClass().addClass('fa fa-cloud-upload');
			break;
		case "download":
			$('#icon-cloud i').removeClass().addClass('fa fa-cloud-download');
			break;
		case "error":
			$('#icon-cloud i').removeClass().addClass('fa fa-cloud-error');
			break;
	}
}

// slide the app header bar in or out
function appToolbarToggle() {
	$('#app-toolbar').toggleClass('hide');
}

// toggle the modal window on and off
// a lot of hack-y styling to accommodate a position: fixed, 100% height, no-scroll body -- which is necessary to prevent background scrolling on iOS
function modalToggle(op) {
	if ((op == "on") && ($('#modal').hasClass('display'))) return;
	switch (op) {
		case "on":
			modalScroll = $(window).scrollTop();
			var offsetY = $(window).scrollTop() * (-1) + 'px';
			$('#modal').addClass('display');
			$(document).on("keyup", modalEsc);
			$('body').addClass('noscroll').css('top', offsetY);
			var footerLocationCalc = $(window).height() - $('#container').height() - $('#header').height();
			if (footerLocationCalc <= 110) {
				if ($('html').hasClass('ie11')) {
					$('#footer').css('position', 'relative').css('margin-top', 0);
				} else {
					$('#footer').css('position', 'relative').css('margin-top', $('#footer').height()*-1);
				}
			}
			break;
		case "off":
			$('#footer').css('position', '').css('margin-top', '');
			$('body').removeClass('noscroll').css('top', '');
			$('#modal').removeClass('display');
			$('#modal-window').empty();
			$(document).off("keyup", modalEsc);
			$(window).scrollTop(modalScroll);
			modalForce = false;
			break;
	}
}

// listen for ESC key when modal is active
function modalEsc(e) {
	if ((e.keyCode == 27) && ($('#modal').hasClass('display')) && (!modalForce)) {
		modalToggle("off");
	}
}

// produce an error message
function errorModal(errcode, manualtext) {
	switch (errcode) {
		case "timeout":
			var dialogTxt = locale.modal.error.timeout;
			break;
		case 403:
			var dialogTxt = locale.modal.error.http_code_403;
			break;
		case 404:
			var dialogTxt = locale.modal.error.http_code_404;
			break;
		case 408:
			var dialogTxt = locale.modal.error.http_code_408;
			break;
		case 500:
			var dialogTxt = locale.modal.error.http_code_500;
			break;
		case "manual":
			if (typeof manualtext !== 'undefined') {
				var dialogTxt = manualtext;
				break;
			}
		default:
			var dialogTxt = locale.modal.error.catchall;
			break;
	}
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row modal-window-wrapper-top">',
		'	<p>'+ dialogTxt +'</p>',
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		'	<button type="button" class="button color green large" aria-label="'+ locale.general.continue +'" onclick="modalToggle(\'off\');">'+ locale.general.continue +'</button>',
		'	<button type="button" class="button color cyan large" aria-label="'+ locale.general.reload +'" onclick="window.location.reload();">'+ locale.general.reload +'</button>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
	userControl("open");
	statusIndicator("error");
}

// display a popup message
function popupMsg(popupTxt, optColor) {
	clearTimeout(window.popupTimeout);
	$('#popup-status').removeClass("red green");
	if (typeof optColor !== 'undefined') $('#popup-status').addClass(optColor);
	$('#popup-msg').html(popupTxt);
	$('#popup-status').addClass('show');
	window.popupTimeout = setTimeout(function() {
		$('#popup-status').removeClass('show');
	}, 5000);
}

// update the display URL and store location information
function updateState(appLocation, pushAction) {
	switch (appLocation) {
		case "home":
			var pushObject = { loc: 'home' };
			var pushTitle = locale.core.app_name + " - " + locale.app.tagline;
			var pushURL = "/";
			notepadIdLocal = void 0;
			break;
		case "notepad":
			var pushObject = { loc: 'notepad', npidLocal: notepadIdLocal };
			var pushTitle = catalog[notepadIdLocal]["npname"] + " - " + locale.core.app_name;
			if (typeof catalog[notepadIdLocal]["nphash"] !== 'undefined') {
				var pushURL = "/np/" + catalog[notepadIdLocal]["nphash"];
			} else {
				var pushURL = "/local/" + notepadIdLocal;
			}
			break;
		case "edit":
			var pushTitle = catalog[notepadIdLocal]["npname"] + " - " + locale.core.app_name;
			break;
		default:
			return;
	}
	if (pushAction == "replace") {
		history.replaceState(pushObject, pushTitle, pushURL);
	} else if (pushAction == "push") {
		history.pushState(pushObject, pushTitle, pushURL);
	}
	$(document).prop('title', pushTitle);
	appLoc = appLocation;
	idbSnapshotUpdate("pos");
}

//** INDEXEDDB FUNCTIONS **//

// either build the core IDB object stores on first use, or retrieve the stored values, or determine IDB is unsupported
// then call holdRelease() to proceed with releasing the hold on document ready
function idbInit() {
	var os = 'snapshot';
	var dbCheckPromise = idb.open(idbDB);
	dbCheckPromise.catch(function() {
		// IndexedDB is supported but not accessible, probably as a result of private browsing mode.
		// Effectively, it's unsupported. Flag it as such. Proceed with application.
		if (!internetConn) {
			splashHandler("doa");// without either IndexedDB or an internet connection, this app can't run
		} else {
			idbSupport = false;
			$('body').attr('data-idb-support', 0);
			setOfflineState("system", 3);// without IDB support, offline mode is unavailable
			loadLocale();// document hold release #4: load the default language code locale
			prepLaunchState();// document hold release #5: set core app variables
			holdRelease();// document hold release #6: no IDB to initialize, so skip it
		}
	});
	dbCheckPromise.then(function(db) {
		idbSupport = true;
		$('body').attr('data-idb-support', 1);
		idbVersion = db.version;
		db.close();
		if (idbVersion == 1) {
			// V1 means application is running for the first time. Proceed to the build function where we upgrade to V2 and create core object stores.
			$('body').attr('data-offline-mode', offlineState);
			loadLocale();// document hold release #4: load the default language code locale
			prepLaunchState();// document hold release #5: set core app variables
			idbBuild();
		} else {
			// any other version, pull stored variables
			idbGetAll(os).then(function(snapshotArray) {
				for (var s=0; s<snapshotArray.length; s++) {
					if (snapshotArray[s]["entry"] == "conn") offlineState = snapshotArray[s]["offline"];
					if (snapshotArray[s]["entry"] == "lang") langCode = snapshotArray[s]["lang"];
					if (snapshotArray[s]["entry"] == "sync") globalSync = Boolean(snapshotArray[s]["synced"]);
					if (snapshotArray[s]["entry"] == "mode") darkMode = Boolean(snapshotArray[s]["darkMode"]);
					if (snapshotArray[s]["entry"] == "count") {
						localPadCounter = snapshotArray[s]["padCount"];
						localNoteCounter = snapshotArray[s]["noteCount"];
					}
					if (snapshotArray[s]["entry"] == "pos") {
						snapshotLoc = snapshotArray[s]["loc"];
						snapshotNotepadIdLocal = snapshotArray[s]["npidLocal"];
						snapshotScroll = snapshotArray[s]["scrollPos"];
					}
				}
				$('body').attr('data-offline-mode', offlineState);
				loadLocale();// document hold release #4: load the stored language code locale
				idbGetAll('catalog').then(function(catalogArray) {
					if (catalogArray.length == 0) {
						prepLaunchState();// document hold release #5: set core app variables
						holdRelease();// document hold release #6: completed IDB initialization
					} else {
						for (var c=0; c<catalogArray.length; c++) {
							catalog[catalogArray[c]["npidLocal"]] = {
								'npname': catalogArray[c]["npname"],
								'nphash': catalogArray[c]["nphash"],
								'npdesc': catalogArray[c]["npdesc"],
								'lastEdit': catalogArray[c]["lastEdit"],
								'lastOpen': catalogArray[c]["lastOpen"],
								'synced': catalogArray[c]["synced"]
							}
						}
						var cycles = 0;
						$.each(catalog, function(key, value) {
							idbGetAll(key).then(function(notesArray) {
								cycles++;
								notepads[key] = {};
								for (var n=0; n<notesArray.length; n++) {
									notepads[key][notesArray[n]["idLocal"]] = {
										'idRemote': notesArray[n]["idRemote"],
										'org': notesArray[n]["org"],
										'color': notesArray[n]["color"],
										'isChecked': notesArray[n]["isChecked"],
										'text': notesArray[n]["text"],
										'lastEdit': notesArray[n]["lastEdit"],
										'deleted': notesArray[n]["deleted"],
										'synced': notesArray[n]["synced"]
									}
								}
								if (cycles == catalogArray.length) {
									prepLaunchState();// document hold release #5: set core app variables
									holdRelease();// document hold release #6: completed IDB initialization
								}
							});
						});
					}
				});
			});
		}
	});
	function idbBuild() {
		idbVersion++;
		var dbPromise = idb.open(idbDB, idbVersion, function(upgradeDb) {
			var snapshotOS = upgradeDb.createObjectStore(os, {keyPath: 'entry'});
			snapshotOS.createIndex('loc', 'loc', {unique: false});
			snapshotOS.createIndex('npidLocal', 'npidLocal', {unique: true});
			snapshotOS.createIndex('scrollPos', 'scrollPos', {unique: false});
			snapshotOS.createIndex('offline', 'offline', {unique: false});
			snapshotOS.createIndex('padCount', 'padCount', {unique: false});
			snapshotOS.createIndex('noteCount', 'noteCount', {unique: false});
			snapshotOS.createIndex('lang', 'lang', {unique: false});
			snapshotOS.createIndex('synced', 'synced', {unique: false});
			snapshotOS.createIndex('darkMode', 'darkMode', {unique: false});
			var catalogOS = upgradeDb.createObjectStore('catalog', {keyPath: 'npidLocal'});
			catalogOS.createIndex('npname', 'npname', {unique: false});
			catalogOS.createIndex('nphash', 'nphash', {unique: false});
			catalogOS.createIndex('npdesc', 'npdesc', {unique: false});
			catalogOS.createIndex('lastEdit', 'lastEdit', {unique: false});
			catalogOS.createIndex('lastOpen', 'lastOpen', {unique: false});
			catalogOS.createIndex('synced', 'synced', {unique: false});
		});
		dbPromise.then(function(db) {
			var tx = db.transaction(os, 'readwrite');
			var store = tx.objectStore(os);
			var itemConn = { entry: "conn", offline: offlineState };
			var itemCount = { entry: "count", padCount: localPadCounter, noteCount: localNoteCounter };
			var itemLang = { entry: "lang", lang: langCode };
			var itemSync = { entry: "sync", synced: (globalSync) ? 1 : 0 };
			var itemMode = { entry: "mode", darkMode: (darkMode) ? 1 : 0 };
			store.put(itemConn);
			store.put(itemCount);
			store.put(itemLang);
			store.put(itemSync);
			store.put(itemMode);
			db.close();
			return tx.complete;
		}).then(function() {
			console.log('First time visit. Core application object stores defined.');
			holdRelease();// document hold release #6: completed IDB initialization
		});
	}
}

// get all values from the specified object store; returns Promise
function idbGetAll(os) {
	if (!idbSupport) return;
	var dbPromise = idb.open(idbDB);
	return dbPromise.then(function(db) {
		var tx = db.transaction(os, 'readonly');
		var store = tx.objectStore(os);
		var val = store.getAll();
		db.close();
		return val;
	});
}

// update the IndexedDB snapshot object store
function idbSnapshotUpdate(whichEntry) {
	if (!idbSupport) return;
	var os = 'snapshot';
	switch (whichEntry) {
		case "pos":
			var item = { entry: "pos", loc: appLoc, npidLocal: notepadIdLocal, scrollPos: $(document).scrollTop() };
			var verbiage = "position";
			break;
		case "count":
			var item = { entry: "count", padCount: localPadCounter, noteCount: localNoteCounter };
			var verbiage = "counters";
			break;
		case "conn":
			var item = { entry: "conn", offline: offlineState };
			var verbiage = "offline state";
			break;
		case "sync":
			var item = { entry: "sync", synced: (globalSync) ? 1 : 0 };
			var verbiage = "data sync";
			break;
		case "mode":
			var item = { entry: "mode", darkMode: (darkMode) ? 1 : 0 };
			var verbiage = "dark mode";
			break;
		default:
			return;
			break;
	}
	var dbPromise = idb.open(idbDB);
	return dbPromise.then(function(db) {
		var tx = db.transaction(os, 'readwrite');
		var store = tx.objectStore(os);
		store.put(item);
		db.close();
		return tx.complete;
	}).then(function() {
		console.log('Snapshot '+ verbiage +' updated:', item);
		return item;
	});
}

// commit the current notepad hash, name, description, last edit timestamp, and sync status to the IndexedDB catalog object store
function idbCatalogUpdate() {
	if (!idbSupport) return;
	var os = 'catalog';
	var item = {
		npidLocal: notepadIdLocal,
		npname: catalog[notepadIdLocal]["npname"],
		nphash: catalog[notepadIdLocal]["nphash"],
		npdesc: catalog[notepadIdLocal]["npdesc"],
		lastEdit: catalog[notepadIdLocal]["lastEdit"],
		lastOpen: catalog[notepadIdLocal]["lastOpen"],
		synced: catalog[notepadIdLocal]["synced"]
	};
	var dbPromise = idb.open(idbDB);
	return dbPromise.then(function(db) {
		var tx = db.transaction(os, 'readwrite');
		var store = tx.objectStore(os);
		store.put(item);
		db.close();
		return tx.complete;
	}).then(function() {
		console.log('Notepad details updated to catalog object store:', item);
		return item;
	});
}

// update one or all notes in the current IndexedDB notepad object store
function idbNoteUpdate(whichTar) {
	if (!idbSupport) return;
	var os = notepadIdLocal;
	if (whichTar == "all") {
		var thisTarget;
		var items = [];
		for (let n in notepads[os]) {
			thisTarget = { "idLocal": Number(n) };
			items.push($.extend({}, thisTarget, notepads[os][n]));
		}
	} else {
		var thisTarget = { "idLocal": whichTar };
		var item = $.extend({}, thisTarget, notepads[os][whichTar]);
	}
	var dbPromise = idb.open(idbDB);
	return dbPromise.then(function(db) {
		var tx = db.transaction(os, 'readwrite');
		var store = tx.objectStore(os);
		if (whichTar == "all") {
			items.forEach(function(item) { store.put(item); });
		} else {
			store.put(item);
		}
		db.close();
		return tx.complete;
	}).then(function() {
		if (whichTar == "all") {
			console.log('All notes in object store "'+ os +'" updated:', items);
			return items;
		} else {
			console.log('Note '+ whichTar +' in object store "'+ os +'" updated:', item);
			return item;
		}
	});
}

// delete one or all notes in the current IndexedDB notepad object store
function idbNoteDelete(whichTar) {
	if (!idbSupport) return;
	var os = notepadIdLocal;
	var dbPromise = idb.open(idbDB);
	return dbPromise.then(function(db) {
		var tx = db.transaction(os, 'readwrite');
		var store = tx.objectStore(os);
		if (whichTar == "all") {
			store.clear();
		} else {
			store.delete(whichTar);
		}
		db.close();
		return tx.complete;
	}).then(function() {
		if (whichTar == "all") {
			console.log('All notes deleted from the "'+ os +'" object store.');
		} else {
			console.log('Note '+ whichTar +' deleted from the "'+ os +'" object store.');
		}
		return true;
	});
}

// clear notepad IndexedDB object store (if exists) and do a full refresh with a MySQL-gotten array
function idbNotepadRefresh(dataArray) {
	if (!idbSupport) return;
	var os = notepadIdLocal;
	var osCheckPromise = idb.open(idbDB);
	return osCheckPromise.then(function(db) {
		var osInDB = (db.objectStoreNames.contains(os) ? true : false);
		db.close();
		if (!osInDB) {
			return idbCreateNotepadOS(os).then(function() { return arrayAddProceed(); });
		} else {
			console.log('Object store "'+ os +'" already exists. Proceeding to purge.');
			return clearOS().then(function() { return arrayAddProceed(); });
		}
	});
	function clearOS() {
		var dbPromise = idb.open(idbDB);
		return dbPromise.then(function(db) {
			var tx = db.transaction(os, 'readwrite');
			var store = tx.objectStore(os);
			store.clear();
			db.close();
			return tx.complete;
		}).then(function() {
			console.log('All items purged from the "'+ os +'" object store.');
			return true;
		});
	}
	function arrayAddProceed() {
		if (typeof dataArray === 'undefined') return true;// there aren't any notes to add
		var dbPromise = idb.open(idbDB);
		return dbPromise.then(function(db) {
			var tx = db.transaction(os, 'readwrite');
			var store = tx.objectStore(os);
			for (var n=0; n<dataArray.length; n++) { store.put(dataArray[n]); }
			db.close();
			return tx.complete;
		}).then(function() {
			console.log('All notes added to the "'+ os +'" object store. Values:', dataArray);
			return true;
		});
	}
}

// create a new IndexedDB object store for the specified local notepad ID
function idbCreateNotepadOS(osNum) {
	idbVersion++;
	var dbPromise = idb.open(idbDB, idbVersion, function(upgradeDb) {
		var npOS = upgradeDb.createObjectStore(osNum, {keyPath: 'idLocal'});
		npOS.createIndex('idRemote', 'idRemote', {unique: false});
		npOS.createIndex('org', 'org', {unique: false});
		npOS.createIndex('color', 'color', {unique: false});
		npOS.createIndex('isChecked', 'isChecked', {unique: false});
		npOS.createIndex('text', 'text', {unique: false});
		npOS.createIndex('lastEdit', 'lastEdit', {unique: false});
		npOS.createIndex('deleted', 'deleted', {unique: false});
		npOS.createIndex('synced', 'synced', {unique: false});
	});
	return dbPromise.then(function(db) {
		db.close();
		console.log('Object store "'+ osNum +'" created.');
		return true;
	});
}

// delete the entire IndexedDB application database
function idbEmpty() {
	if (!idbSupport) return;
	var dbPromise = idb.delete(idbDB);
	return dbPromise.then(function() {
		console.log('Entire '+ idbDB +' IndexedDB database deleted.');
		return true;
	});
}


//** ACTION FUNCTIONS **//

// present the homepage
function buildHome(dir) {
	switch (dir) {
		case "start":
			statusIndicator("success");
			$('#home').addClass('active-loc');
			updateState("home", "replace");
			$('#notepad-input').focus();
			splashHandler("clear");
			break;
		case "jump":
			$('.color-selector').spectrum("destroy");// destroy all color picker instances
			$('.active-loc').empty().removeAttr('style').removeClass('active-loc');
			$('#notepad').empty().removeAttr('style');// just in case the jump was from the edit dialog
			$('html, body').animate({ scrollTop: 0 }, 0);
			$('#home').addClass('active-loc').removeAttr('style');
			$('#notepad-input').val('').focus();
			$('#find-notepad-button').addClass('disabled');
			stickyButtonsToggle("hide");
			updateState("home", "jump");
			break;
		case "backward":
			if (typeof quickAddFocusOut !== 'undefined') {
				clearTimeout(quickAddFocusOut);
				quickAddFocusOut = void 0;
			} else {
				stickyButtonsToggle("hide");
			}
			$('#notepad').css({ opacity: 1, x: 0 }).transition({ opacity: 0, x: '50%' }, speed, function() {
				updateState("home", "push");
				$('.color-selector').spectrum("destroy");// destroy all color picker instances
				$('#notepad').empty().removeAttr('style').removeClass('active-loc');
				$('#home').css({ opacity: 0, x: '-50%' }).addClass('active-loc');
				$('html, body').animate({ scrollTop: 0 }, 0);
				$('#notepad-input').val('');
				$('#find-notepad-button').addClass('disabled');
				$('#home').transition({
					opacity: 1,
					x: 0,
					duration: speed,
					complete: function() {
						$('#home').removeAttr('style');
						$('#notepad-input').focus();
					}
				});
			});
			break;
	}
}

// find the notepad db entry based on the name
function findNotepadByName(pad) {
	if (pad == "") {
		popupMsg(locale.popup.empty, "red");
		return;
	}
	if ([0, 3].includes(offlineState)) {// if online, MySQL query
		$.ajax({
			type: "POST",
			url: "/ajax/find-notepad-by-name",
			data: JSON.stringify({
				npname: pad
			}),
			beforeSend: function() {
				userControl("lock");
				statusIndicator("process");
				cloudIndicator("upload");
			},
			success: function(postData) {
				cloudIndicator("online");
				if (postData["result"] == "is-empty") {
					errorModal();
				} else {
					for (let k in catalog) {
						if (catalog[k]["npname"] === postData.npname) notepadIdLocal = Number(k);
					}
					if (typeof notepadIdLocal === 'undefined') {
						localPadCounter++;
						notepadIdLocal = localPadCounter;
						idbSnapshotUpdate("count");
					}
					catalog[notepadIdLocal] = {
						'npname': postData.npname,
						'nphash': postData.nphash,
						'npdesc': ((postData.npdesc == "") || (postData.npdesc == null) || (typeof postData.npdesc === 'undefined')) ? void 0 : postData.npdesc,
						'lastEdit': postData.lastEdit,
						'lastOpen': getUnixTimestamp(),
						'synced': 1
					}
					idbCatalogUpdate();
					buildNotepad("forward");
				}
			}
		});
	} else {// if offline, search IDB catalog; failing to find it, create it
		for (let k in catalog) {
			if (catalog[k]["npname"] === pad) notepadIdLocal = Number(k);
		}
		if (typeof notepadIdLocal === 'undefined') {
			localPadCounter++;
			notepadIdLocal = localPadCounter;
			catalog[notepadIdLocal] = {
				'npname': pad,
				'nphash': undefined,
				'npdesc': undefined,
				'lastEdit': getUnixTimestamp(),
				'lastOpen': getUnixTimestamp(),
				'synced': 0
			}
			globalSync = false;
			notepads[notepadIdLocal] = {};
			idbSnapshotUpdate("count");
			idbSnapshotUpdate("sync");
			idbCatalogUpdate();
			idbCreateNotepadOS(notepadIdLocal);
		}
		buildNotepad("forward");
	}
}

// build or re-build the recently opened notepads list
// home page, web app mode only, max 10
function buildRecentNotepads() {
	if (!isInWebApp) return;
	if (Object.keys(catalog).length == 0) {
		$('#recent-notepads-wrapper').hide();
		return;
	} else {
		$('#recent-notepads-wrapper').show();
	}
	$('#recent-notepads').empty();
	var catalogOrdered = [];
	$.each(catalog, function(key, value) {
		catalogOrdered[key] = {
			"npidLocal": key,
			"npname": value["npname"],
			"lastOpen": value["lastOpen"]
		}
	});
	catalogOrdered.sort(function(a, b){return b.lastOpen - a.lastOpen}).slice(0, 10).forEach(function(c) {
		$('#recent-notepads').append(
			'<button type="button" class="button large full-width white" onclick="notepadIdLocal='+c.npidLocal+';catalog['+c.npidLocal+'][\'lastOpen\']=getUnixTimestamp();idbCatalogUpdate();buildNotepad(\'forward\');">'+ c.npname +'</button>'
		);
	});
	$('#recent-notepads-button').removeClass('active');
	$('#recent-notepads').css('max-height', '0px');
}

// open the specified notepad
function buildNotepad(arg, scrPos, elem) {
	if (arg == "backward") {
		$('#edit').css({ opacity: 1, x: 0 }).transition({ opacity: 0, x: '50%' }, speed, function() {
			$('#edit-color-selector').spectrum("destroy");
			$('#edit').empty().removeAttr('style').removeClass('active-loc');
			$('#notepad').css({ opacity: 0, x: '-50%' }).addClass('active-loc');
			if (typeof scrPos === 'undefined') {
				$('html, body').animate({ scrollTop: 0 }, 0);
			} else {
				$(window).scrollTop(scrPos);
			}
			stickyButtonsToggle("show");
			updateState("notepad", "jump");
			$('#notepad').transition({
				opacity: 1,
				x: 0,
				duration: speed,
				complete: function() {
					$('#notepad').removeAttr('style');// fixes sortable bug
					// If a DOM element has been added or changed in the edit dialog, Linkify it now.
					// This is frankly baffling. It won't Linkify while hidden back on the edit dialog. Fine. It won't even consistently Linkify (I'm looking at you, iOS) while perfectly visible, albeit off screen. Okay...
					// So now I have to wait for the animation to finish, and then suffer the visual hiccup of the Linkification that I'd rather happen off screen?
					// When I Linkify the whole notepad on the notepad build, IT'S INVISIBLE. AND IT WORKS. So WTF is going on here?
					if (typeof elem !== 'undefined') linkifyInit(elem);
				}
			});
		});
	} else {
		var lockStatus = false;
		var hasNotes = false;
		var allNotes = "";
		if ([0, 3].includes(offlineState) && (typeof catalog[notepadIdLocal]["nphash"] !== 'undefined')) {// if online and notepad hash is defined, MySQL query
			$.ajax({
				type: "GET",
				url: "/ajax/build-notepad",
				contentType: "application/x-www-form-urlencoded; charset=UTF-8",
				data: {
					nphash: catalog[notepadIdLocal]["nphash"]
				},
				beforeSend: function() {
					userControl("lock");
					statusIndicator("process");
					cloudIndicator("download");
				},
				success: function(postData) {
					cloudIndicator("online");
					if (postData["result"] == "hashfail") {
						errorModal("manual", locale.modal.error.critical);
						return;
					}
					delete notepads[notepadIdLocal];
					notepads[notepadIdLocal] = {};
					var npdescCheck = ((postData["npdesc"] == "") || (postData["npdesc"] == null) || (typeof postData["npdesc"] === 'undefined')) ? void 0 : postData["npdesc"];
					if ((catalog[notepadIdLocal]["npname"] != postData["npname"]) || (catalog[notepadIdLocal]["npdesc"] != npdescCheck)) {
						catalog[notepadIdLocal]["npname"] = postData["npname"];
						catalog[notepadIdLocal]["npdesc"] = npdescCheck;
						catalog[notepadIdLocal]["lastEdit"] = postData["lastEdit"];
						idbCatalogUpdate();
					}
					if (postData["lockstatus"] == true) lockStatus = true;
					if (postData["size"] != 0) {// if there are any notes, parse through them
						hasNotes = true;
						var thisNote, thisTarget;
						var idbArray = [];
						for (var i=0; i<postData["size"]; i++) {
							localNoteCounter++;
							thisTarget = { "idLocal": localNoteCounter };
							notepads[notepadIdLocal][localNoteCounter] = { "idRemote": Number(postData[i]["id"]), "org": Number(postData[i]["org"]), "color": Number(postData[i]["color"]), "isChecked": Number(postData[i]["isChecked"]), "text": postData[i]["text"], "lastEdit": Number(postData[i]["lastEdit"]), "deleted": 0, "synced": 1 };
							idbArray[i] = $.extend({}, thisTarget, notepads[notepadIdLocal][localNoteCounter]);
							thisNote = rowBuilder(localNoteCounter, postData[i]["id"], postData[i]["color"], postData[i]["isChecked"], postData[i]["text"]);
							allNotes += thisNote;
						}
						idbSnapshotUpdate("count");// update the counter
						idbNotepadRefresh(idbArray);// refresh (or create) an object store with this notepad's notes
					} else {
						idbNotepadRefresh();// give it no parameter so that it will simply create an empty OS or clear an existing one
					}
					buildNotepadProceed();
				}
			});
		} else {// if offline, pull from IDB catalog
			if (Object.keys(notepads[notepadIdLocal]).length > 0) {// if there are any notes, parse through them
				var orderedNotesObj = {};
				for (let n in notepads[notepadIdLocal]) {
					if (notepads[notepadIdLocal][n]["deleted"] == 0) {// discard deleted notes; use org as key to put them in order
						orderedNotesObj[notepads[notepadIdLocal][n]["org"]] = { "idLocal" : Number(n), "idRemote" : notepads[notepadIdLocal][n]["idRemote"], "color" : notepads[notepadIdLocal][n]["color"], "isChecked" : notepads[notepadIdLocal][n]["isChecked"], "text" : notepads[notepadIdLocal][n]["text"] };
					}
				}
				if (Object.keys(orderedNotesObj).length > 0) {// proceed if there are any non-deleted notes
					var orderedNotes = Object.entries(orderedNotesObj);// convert to array
					orderedNotes.reverse();// reverse the array, since we display descending order
					hasNotes = true;
					for (var o=0; o<orderedNotes.length; o++) {
						thisNote = rowBuilder(orderedNotes[o][1]["idLocal"], orderedNotes[o][1]["idRemote"], orderedNotes[o][1]["color"], orderedNotes[o][1]["isChecked"], orderedNotes[o][1]["text"]);
						allNotes += thisNote;
					}
				}
			}
			buildNotepadProceed();
		}
	}
	function buildNotepadProceed() {
		statusIndicator("success");
		if (arg == "refresh") var previousScroll = $(window).scrollTop();
		if (!$('#notepad').is(':empty')) {
			$('.color-selector').spectrum("destroy");// remove any of the previous Spectrum color picker elements
			$('#notepad').empty();
		}
		var notepadTop = [
			'<div id="notepad-top">',
			'	<div id="np-top-row">',
			'		<div id="lock-button-wrapper"><button id="lock-button" type="button" class="button circle" aria-label="'+ locale.notepad.lock +'" title="'+ locale.notepad.lock +'"><i class="fa fa-unlock"></i></button></div>',
			'		<div id="np-rename" class="h1"></div>',
			'	</div>',
			'	<div id="np-desc"></div>',
			'	<div id="notepad-btns">',
			'		<button id="home-button" type="button" class="button responsive" aria-label="'+ locale.notepad.home +'" onclick="buildHome(\'backward\');">',
			'			<i class="fa fa-home"></i><span> '+ locale.notepad.home +'</span>',
			'		</button>',
			'		<button id="delete-all-modal-button" type="button" class="button color red responsive" aria-label="'+ locale.notepad.delete_all +'" onclick="deleteAllModal();">',
			'			<i class="fa fa-trash"></i><span> '+ locale.notepad.delete_all +'</span>',
			'		</button>',
			'		<button id="sort-modal-button" type="button" class="button color orange responsive" aria-label="'+ locale.notepad.sort +'" onclick="sortModal();">',
			'			<i class="fa fa-sort"></i><span> '+ locale.notepad.sort +'</span>',
			'		</button>',
			'		<button id="json-modal-button" type="button" class="button color blue responsive" aria-label="'+ locale.notepad.json +'" onclick="jsonModal();">',
			'			<i class="fa fa-code"></i><span> '+ locale.notepad.json +'</span>',
			'		</button>',
			'		<button id="refresh-button" type="button" class="button color green responsive" aria-label="'+ locale.notepad.refresh +'" onclick="buildNotepad(\'refresh\');">',
			'			<i class="fa fa-repeat"></i><span> '+ locale.notepad.refresh +'</span>',
			'		</button>',
			'	</div>',
			'	<div id="quick-add"><form>',
			'		<input id="quick-add-input" type="text" aria-label="'+ locale.notepad.quick_add_placeholder +'" placeholder="'+ locale.notepad.quick_add_placeholder +'" onkeypress="return event.keyCode!=13;"/>',
			'		<button id="quick-add-button" type="submit" class="button color cyan square disabled" aria-label="'+ locale.notepad.quick_add_label +'" onclick="quickAdd();"><i class="fa fa-enter"></i></button>',
			'	</form></div>',
			'</div>'
		].join("\n");
		$('#notepad').append(notepadTop);
		if (typeof catalog[notepadIdLocal]["nphash"] === 'undefined') $('#json-modal-button').addClass('disabled');
		// fill in top with additional elements
		fillNotepadName();
		fillNotepadDesc();
		// add listeners to quick add input
		$('#quick-add-input').on({
			'input': function() {
				if ($(this).val() == "") {
					if (!$('#quick-add-button').hasClass('disabled')) $('#quick-add-button').addClass('disabled');
				} else {
					if ($('#quick-add-button').hasClass('disabled')) $('#quick-add-button').removeClass('disabled');
				}
			},
			'keyup': function(e) {
				if ((e.keyCode == 13) && (!$('#quick-add-button').hasClass('disabled'))) {
					$('#quick-add-button').click();
				}
			},
			'focusin': function() {
				if (typeof quickAddFocusOut !== 'undefined') {
					clearTimeout(quickAddFocusOut);
					quickAddFocusOut = void 0;
				} else {
					stickyButtonsToggle("hide");
				}
			},
			'focusout': function() {
				quickAddFocusOut = setTimeout(function() { stickyButtonsToggle("show"); quickAddFocusOut = void 0; }, 100);
			}
		});
		// lock the notepad if specified in database
		if (lockStatus) {
			lockToggle("lock");
		} else {
			$('#lock-button').off('click').click(function() {
				lockModal();
			});
		}
		// check for presence of notes and build accordingly
		if (!hasNotes) {
			// no notes = no notepad
			notepadRoot("destroy");
		} else {
			// create the notepad root
			notepadRoot("create");
			// populate notes
			$('#notepad-body').append(allNotes);
			// toggle the state of the Check All button
			setCheckAllState();
			// Linkify these notes and Spectrum-ize the color selectors
			linkifyInit("all");
			spectrumInit("all");
		}
		// open user control
		userControl("open");
		// animate it in
		switch (arg) {
			case "start":
				stickyButtonsToggle("show");
				$('#notepad').addClass('active-loc');
				splashHandler("clear");
				if (typeof scrPos !== 'undefined') $(window).scrollTop(scrPos);
				updateState("notepad", "replace");
				break;
			case "refresh":
				$(window).scrollTop(previousScroll);
				break;
			case "jump":
				if ($('.active-loc').attr('id') == "home") {
					$('#home').removeClass('active-loc').removeAttr('style');
				} else {
					$('.active-loc').empty().removeClass('active-loc').removeAttr('style');
				}
				$('#notepad').addClass('active-loc');
				stickyButtonsToggle("show");
				updateState("notepad", "jump");
				buildRecentNotepads();
				break;
			case "forward":
				$('#home').css({ opacity: 1, x: 0 }).transition({ opacity: 0, x: '-50%' }, speed, function() {
					$('#home').removeClass('active-loc').removeAttr('style');
					$('#notepad').css({ opacity: 0, x: '50%' }).addClass('active-loc');
					$('html, body').animate({ scrollTop: 0 }, 0);
					stickyButtonsToggle("show");
					updateState("notepad", "push");
					$('#notepad').transition({
						opacity: 1,
						x: 0,
						duration: speed,
						complete: function() {
							$('#notepad').removeAttr('style');//fixes sortable bug
							buildRecentNotepads();
						}
					});
				});
				break;
		}
	}
}

// rename the notepad
function renameNotepad(action) {
	switch (action) {
		case "edit":
			var renameHtml = '<input id="np-rename-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>';
			$('#np-rename').empty().append(renameHtml);
			$('#np-rename-input').val(catalog[notepadIdLocal]["npname"]);
			$('#np-rename-input').on({
				'input': function() {
					if ($(this).val() == "") {
						if (!$(this).hasClass('warning')) $(this).addClass('warning');
					} else {
						if ($(this).hasClass('warning')) $(this).removeClass('warning');
						if (charSplitter.countGraphemes($(this).val()) >= npnameMaxChar) { $(this).val(charSplitter.splitGraphemes($(this).val()).slice(0, npnameMaxChar).join('')); }
					}
				},
				'keyup': function(e) {
					if (e.keyCode == 13) {
						if (($(this).val() != "") && (!$(this).hasClass('warning'))) {
							renameNotepad("save");
						}
					} else if (e.keyCode == 27) {
						renameNotepad("cancel");
					}
				},
				'focusout': function() {
					renameNotepad("save");
				}
			});
			$('#np-rename-input').focus();
			if (typeof quickAddFocusOut !== 'undefined') {
				clearTimeout(quickAddFocusOut);
				quickAddFocusOut = void 0;
			} else {
				stickyButtonsToggle("hide");
			}
			break;
		case "save":
			// variables, objects, arrays; conditions for early bailing
			var proposedName = $('#np-rename-input').val();
			var formerName = catalog[notepadIdLocal]["npname"];
			if (proposedName == "") return;
			if (proposedName == formerName) {
				renameNotepad("cancel");
				return;
			}
			// IDB and MySQL updates
			if ([0, 3].includes(offlineState)) {// if online
				$.ajax({
					type: "POST",
					url: "/ajax/rename-notepad",
					data: JSON.stringify({
						npname: proposedName,
						nphash: catalog[notepadIdLocal]["nphash"]
					}),
					beforeSend: function() {
						userControl("lock");
						statusIndicator("process");
						cloudIndicator("upload");
					},
					success: function(postData) {
						cloudIndicator("online");
						switch (postData["result"]) {
							case "is-empty":
								$('#np-rename-input').val(formerName);
								fillNotepadName();
								errorModal();
								break;
							case "hashfail":
								$('#np-rename-input').val(formerName);
								fillNotepadName();
								errorModal("manual", locale.modal.error.critical);
								break;
							case "lockfail":
								$('#np-rename-input').val(formerName);
								fillNotepadName();
								errorModal("manual", locale.modal.error.locked);
								break;
							case "actionfail":
								userControl("open");
								statusIndicator("error");
								$('#np-rename-input').addClass('warning');
								popupMsg(locale.popup.rename, "red");
								break;
							default:
								userControl("open");
								statusIndicator("success");
								catalog[notepadIdLocal]["npname"] = postData.npname;
								catalog[notepadIdLocal]["lastEdit"] = postData.lastEdit;
								idbCatalogUpdate();
								$('#np-rename-input').val(postData.npname);
								fillNotepadName();
								updateState("notepad", "replace");
								break;
						}
					},
					complete: function() {
						stickyButtonsToggle("show");
					}
				});
			} else {// if offline
				var proceed = true;
				for (let k in catalog) { if (catalog[k]["npname"] == proposedName) proceed = false; }
				if (proceed) {
					catalog[notepadIdLocal]["npname"] = proposedName;
					catalog[notepadIdLocal]["lastEdit"] = getUnixTimestamp();
					catalog[notepadIdLocal]["synced"] = 0;
					npCommitHandler("offline", globalSync, undefined);
					fillNotepadName();
					stickyButtonsToggle("show");
					updateState("notepad", "replace");
				} else {// error
					$('#np-rename-input').addClass('warning');
					popupMsg(locale.popup.rename, "red");
				}
			}
			break;
		case "cancel":
			stickyButtonsToggle("show");
			fillNotepadName();
			break;
			
	}
}

// change the notepad description
function changeNotepadDesc() {
	// conditions for early bailing
	if (catalog[notepadIdLocal]["npdesc"] == $('#np-desc-textarea').text()) return;
	if ((typeof catalog[notepadIdLocal]["npdesc"] === 'undefined') && ($('#np-desc-textarea').text() == "")) return;
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	catalog[notepadIdLocal]["npdesc"] = ($('#np-desc-textarea').text() == "") ? void 0 : $('#np-desc-textarea').text();
	catalog[notepadIdLocal]["lastEdit"] = Math.floor(tsAction/1000);
	catalog[notepadIdLocal]["synced"] = 0;
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/change-notepad-desc",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				npdesc: $('#np-desc-textarea').text()
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				npCommitHandler("delay", wasSynced, tsAction);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$('#np-desc-textarea').text(postData.npdesc);
							catalog[notepadIdLocal]["npdesc"] = postData.npdesc;
						}
						catalog[notepadIdLocal]["lastEdit"] = postData.lastEdit;
						catalog[notepadIdLocal]["synced"] = 1;
						npCommitHandler("resolve", wasSynced, tsAction);
						break;
				}
			}
		});
	} else {// if offline
		npCommitHandler("offline", wasSynced, undefined);
	}
}

// lock the notepad
function lockNotepad(whatpass) {
	if (typeof whatpass === 'undefined') return;
	$.ajax({
		type: "POST",
		url: "/ajax/lock-notepad",
		data: JSON.stringify({
			nphash: catalog[notepadIdLocal]["nphash"],
			lockpass: whatpass
		}),
		beforeSend: function() {
			userControl("lock");
			statusIndicator("process");
			cloudIndicator("upload");
		},
		success: function(postData) {
			cloudIndicator("online");
			switch (postData["result"]) {
				case "is-empty":
					errorModal();
					break;
				case "hashfail":
					errorModal("manual", locale.modal.error.critical);
					break;
				case "lockfail":
					errorModal("manual", locale.modal.lock.locked_already);
					break;
				case "ssvfail":
					errorModal("manual", locale.modal.error.catchall);
					break;
				default:
					userControl("open");
					statusIndicator("success");
					lockModal("success");
					break;
			}
		}
	});
}

// unlock the notepad
function unlockNotepad(whichpass) {
	if (typeof whichpass === 'undefined') return;
	$.ajax({
		type: "POST",
		url: "/ajax/unlock-notepad",
		data: JSON.stringify({
			nphash: catalog[notepadIdLocal]["nphash"],
			lockpass: whichpass
		}),
		beforeSend: function() {
			userControl("lock");
			statusIndicator("process");
			cloudIndicator("upload");
		},
		success: function(postData) {
			cloudIndicator("online");
			switch (postData["result"]) {
				case "is-empty":
					errorModal();
					break;
				case "hashfail":
					errorModal("manual", locale.modal.error.critical);
					break;
				case "lockfail":
					errorModal("manual", locale.modal.unlock.not_locked);
					break;
				case "incorrect":
					userControl("open");
					statusIndicator("error");
					unlockModal("incorrect");
					break;
				default:
					userControl("open");
					statusIndicator("success");
					unlockModal("success");
					break;
			}
		}
	});
}

// display lock modal
var password1, password2;
function lockModal(lockstep) {
	switch (lockstep) {
		case "validate1":
			if ($('#lock-password-input-1').val() != "") {
				password1 = $('#lock-password-input-1').val();
				lockModal("prompt2");
			}
			break;
		case "validate2":
			if ($('#lock-password-input-2').val() != "") {
				password2 = $('#lock-password-input-2').val();
				if (password1 == password2) {
					lockNotepad(password2);
				} else {
					lockModal("mismatch");
				}
			}
			break;
		case "success":
			lockToggle("lock");
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p>'+ locale.modal.lock.success +'</p>',
				'	<p class="smaller ital">'+ locale.modal.lock.success_detail +'</p>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			break;
		case "mismatch":
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p>'+ locale.modal.lock.mismatch +'</p>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button color cyan large" aria-label="'+ locale.general.retry +'" onclick="lockModal(\'prompt1\');">'+ locale.general.retry +'</button>',
				'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			break;
		case "prompt2":
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top"><form>',
				'	<input id="lock-password-input-2" type="password" aria-label="'+ locale.modal.lock.reenter_placeholder +'" placeholder="'+ locale.modal.lock.reenter_placeholder +'" onkeypress="return event.keyCode!=13;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>',
				'	<div class="spacer20"></div>',
				'	<div class="modal-window-wrapper-bottom">',
				'		<button type="button" class="button color red large" aria-label="'+ locale.general.back +'" onclick="lockModal(\'prompt1\');">'+ locale.general.back +'</button>',
				'		<button type="submit" class="button color green large next" aria-label="'+ locale.general.next +'" onclick="lockModal(\'validate2\');">'+ locale.general.next +'</button>',
				'		<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
				'	</div>',
				'</form></div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			$('#modal-window .next').addClass('disabled');
			$('#lock-password-input-2').addClass('invalid').on({
				'input': function() {
					if ($(this).val() == "") {
						if (!$(this).hasClass('invalid')) {
							$(this).addClass('invalid');
							$('#modal-window .next').addClass('disabled');
						}
					} else {
						if (charSplitter.countGraphemes($(this).val()) >= npnameMaxChar) { $(this).val(charSplitter.splitGraphemes($(this).val()).slice(0, npnameMaxChar).join('')); }
						if ($(this).hasClass('invalid')) {
							$(this).removeClass('invalid');
							$('#modal-window .next').removeClass('disabled');
						}
					}
				},
				'keyup': function(e) {
					if ((e.keyCode == 13) && (!$(this).hasClass('invalid'))) {
						$(':focus').blur();
						$('#modal-window .next').click();
					}
				}
			});
			$('#lock-password-input-2').val('').focus();
			break;
		case "prompt1":
		default:
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top"><form>',
				'	<p class="bold">'+ locale.modal.lock.prompt +'</p>',
				'	<p>'+ locale.modal.lock.prompt_detail +'</p>',
				'	<input id="lock-password-input-1" type="password" aria-label="'+ locale.modal.lock.password_placeholder +'" placeholder="'+ locale.modal.lock.password_placeholder +'" onkeypress="return event.keyCode!=13;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>',
				'	<p class="smaller ital">'+ locale.modal.lock.password_detail +'</p>',
				'	<div class="modal-window-wrapper-bottom">',
				'		<button type="submit" class="button color green large next" aria-label="'+ locale.general.next +'" onclick="lockModal(\'validate1\');">'+ locale.general.next +'</button>',
				'		<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
				'	</div>',
				'</form></div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			$('#modal-window .next').addClass('disabled');
			$('#lock-password-input-1').addClass('invalid').on({
				'input': function() {
					if ($(this).val() == "") {
						if (!$(this).hasClass('invalid')) {
							$(this).addClass('invalid');
							$('#modal-window .next').addClass('disabled');
						}
					} else {
						if (charSplitter.countGraphemes($(this).val()) >= npnameMaxChar) { $(this).val(charSplitter.splitGraphemes($(this).val()).slice(0, npnameMaxChar).join('')); }
						if ($(this).hasClass('invalid')) {
							$(this).removeClass('invalid');
							$('#modal-window .next').removeClass('disabled');
						}
					}
				},
				'keyup': function(e) {
					if ((e.keyCode == 13) && (!$(this).hasClass('invalid'))) {
						$(':focus').blur();
						$('#modal-window .next').click();
					}
				}
			});
			if (typeof lockstep === 'undefined') modalToggle("on");
			break;
	}
}

// display unlock modal
function unlockModal(unlockstep) {
	switch (unlockstep) {
		case "validate":
			if ($('#unlock-password-input').val() != "") {
				unlockNotepad($('#unlock-password-input').val());
			}
			break;
		case "success":
			lockToggle("unlock");
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p>'+ locale.modal.unlock.success +'</p>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			break;
		case "incorrect":
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p>'+ locale.modal.unlock.incorrect +'</p>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button color cyan large" aria-label="'+ locale.general.retry +'" onclick="unlockModal(\'prompt\');">'+ locale.general.retry +'</button>',
				'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			break;
		case "prompt":
		default:
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top"><form>',
				'	<p>'+ locale.modal.unlock.prompt +'</p>',
				'	<input id="unlock-password-input" type="password" aria-label="'+ locale.modal.lock.password_placeholder +'" placeholder="'+ locale.modal.lock.password_placeholder +'" onkeypress="return event.keyCode!=13;" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>',
				'	<p class="smaller ital">'+ locale.modal.unlock.prompt_detail +'</p>',
				'	<div class="modal-window-wrapper-bottom">',
				'		<button type="submit" class="button color green large next" aria-label="'+ locale.general.next +'" onclick="unlockModal(\'validate\');">'+ locale.general.next +'</button>',
				'		<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
				'	</div>',
				'</form></div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			$('#modal-window .next').addClass('disabled');
			$('#unlock-password-input').addClass('invalid').on({
				'input': function() {
					if ($(this).val() == "") {
						if (!$(this).hasClass('invalid')) {
							$(this).addClass('invalid');
							$('#modal-window .next').addClass('disabled');
						}
					} else {
						if (charSplitter.countGraphemes($(this).val()) >= npnameMaxChar) { $(this).val(charSplitter.splitGraphemes($(this).val()).slice(0, npnameMaxChar).join('')); }
						if ($(this).hasClass('invalid')) {
							$(this).removeClass('invalid');
							$('#modal-window .next').removeClass('disabled');
						}
					}
				},
				'keyup': function(e) {
					if ((e.keyCode == 13) && (!$(this).hasClass('invalid'))) {
						$(':focus').blur();
						$('#modal-window .next').click();
					}
				}
			});
			if (typeof unlockstep === 'undefined') modalToggle("on");
			break;
	}
}

// lock or unlock the display of the notepad
function lockToggle(lockstate) {
	switch (lockstate) {
		case "lock":
			$('#notepad').attr('data-lock-status', 'locked');
			$('#np-name').prop('onclick', null).off('click');
			$('#np-desc-textarea').attr('contenteditable', 'false');
			if ($('#np-desc-textarea').text() == "") $('#np-desc').addClass('hidden');
			$('#home-button').addClass('large').removeClass('responsive');
			$('#sticky-add').css('display', 'none');
			$('#lock-button .fa').removeClass('fa-unlock').addClass('fa-lock');
			$('#lock-button').off('click').click(function() {
				unlockModal();
			});
			break;
		case "unlock":
			$('#notepad').removeAttr('data-lock-status');
			fillNotepadName();
			$('#np-desc-textarea').attr('contenteditable', 'true');
			if ($('#np-desc').hasClass('hidden')) $('#np-desc').removeClass('hidden');
			$('#home-button').addClass('responsive').removeClass('large');
			$('#sticky-add').css('display', '');
			$('#lock-button .fa').removeClass('fa-lock').addClass('fa-unlock');
			$('#lock-button').off('click').click(function() {
				lockModal();
			});
			break;
	}
}

// create the edit note dialog
function buildEdit(domID) {
	// variables, objects, arrays
	npScroll = $(window).scrollTop();// remember notepad scroll position, for when we return to it
	var ntId, ntColor, ntText;
	if (typeof domID === 'undefined') {// are we pulling up an existing note or a blank new note?
		ntId = ntText = "";
		ntColor = colors[0]["hex"];
		buildEditProceed();
	} else {
		var thisLocalId = Number($(domID).attr('data-local-id'));
		ntId = "'#" + notePrefix + thisLocalId + "'";
		ntColor = colors[notepads[notepadIdLocal][thisLocalId]["color"]]["hex"];
		ntText = notepads[notepadIdLocal][thisLocalId]["text"];
		buildEditProceed();
	}
	// visual updates
	function buildEditProceed() {
		var editContent = [
			'<div id="color-selector-wrapper">',
			'	<div class="h3">'+ locale.edit.pick +'</div>',
			'	<input type="text" id="edit-color-selector"/>',
			'</div>',
			'<form>',
			'	<textarea id="note-text" placeholder="'+ locale.edit.placeholder +'" style="background-color: '+ ntColor +'"></textarea>',
			'	<div id="note-edit-btns">',
			'		<div>',
			'			<button type="submit" class="button color green responsive" aria-label="'+ locale.general.save +'" onclick="saveNote('+ ntId +');">',
			'				<i class="fa fa-check"></i><span> '+ locale.general.save + '</span>',
			'			</button>',
			'			<button type="button" class="button responsive" aria-label="'+ locale.general.cancel +'" onclick="buildNotepad(\'backward\', npScroll);">',
			'				<i class="fa fa-arrow-down fa-rotate-90"></i><span> '+ locale.general.cancel + '</span>',
			'			</button>',
			'		</div>',
			'		<div>',
			'			<button type="button" class="button color red responsive" aria-label="'+ locale.general.delete +'" onclick="deleteNoteOnEdit('+ ntId +');">',
			'				<i class="fa fa-trash"></i><span> '+ locale.general.delete + '</span>',
			'			</button>',
			'		</div>',
			'	</div>',
			'</form>'
		].join("\n");
		$('#edit').append(editContent);
		$('#note-text').val(ntText);// set note text
		$('#edit-color-selector').spectrum({
			showPaletteOnly: true,
			showSelectionPalette: false,
			hideAfterPaletteSelect: true,
			preferredFormat: 'hex',
			change: function(color) {
				$('#note-text').css('background-color', color.toHexString());
			},
			color: ntColor,
			palette: [
				[colors[0]['hex'], colors[1]['hex'], colors[2]['hex']],
				[colors[3]['hex'], colors[4]['hex'], colors[5]['hex']],
				[colors[6]['hex'], colors[7]['hex'], colors[8]['hex']]
			]
		});
		if (typeof quickAddFocusOut !== 'undefined') {
			clearTimeout(quickAddFocusOut);
			quickAddFocusOut = void 0;
		} else {
			stickyButtonsToggle("hide");
		}
		$('#notepad').css({ opacity: 1, x: 0 }).transition({ opacity: 0, x: '-50%' }, speed, function() {
			removeAllToolOverlays();// if any options overlays were visible back in the notepad we've now left, turn them off now
			$('#notepad').removeClass('active-loc').removeAttr('style');
			$('#edit').css({ opacity: 0, x: '50%' }).addClass('active-loc');
			$('html, body').animate({ scrollTop: 0 }, 0);
			updateState("edit", "jump");
			$('#note-text').scrollTop($('#note-text').prop('scrollHeight') - $('#note-text').height());// scroll note bottom
			$('#edit').transition({
				opacity: 1,
				x: 0,
				duration: speed,
				complete: function() {
					$('#edit').removeAttr('style');
					$('#note-text').focus();// focus note
					var inputLength = document.getElementById('note-text').value.length;
					document.getElementById('note-text').setSelectionRange(inputLength, inputLength);// set caret to note end
					$('#note-text').scrollTop($('#note-text').prop('scrollHeight') - $('#note-text').height());// scroll note bottom again, because, Safari
				}
			});
		});
	}
}

// save a note
function saveNote(domID) {
	// conditions for early bailing
	if ($('#note-text').val() == "") {
		popupMsg(locale.popup.empty, "red");
		return;
	}
	// variables, objects, arrays; visual updates
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var thisColorHex = $('#edit-color-selector').spectrum("get");
	var thisColorId = Number(colorHexToId[thisColorHex]);
	var thisText = $('#note-text').val();
	if (typeof domID === 'undefined') {// create new note
		localNoteCounter++;
		var thisLocalId = localNoteCounter;
		var thisRemoteId = 0;
		domID = '#' + notePrefix + thisLocalId;
		idbSnapshotUpdate("count");
		var newNote = rowBuilder(thisLocalId, 0, thisColorId, 0, thisText);
		var maxOrg = 0;
		for (let n in notepads[notepadIdLocal]) { if (notepads[notepadIdLocal][n]["org"] > maxOrg) maxOrg = notepads[notepadIdLocal][n]["org"]; }
		notepads[notepadIdLocal][thisLocalId] = { "idRemote": 0, "org": maxOrg+1, "color": thisColorId, "isChecked": 0, "text": thisText, "lastEdit": Math.floor(tsAction/1000), "deleted": 0, "synced": 0 };
		if (!$('#notepad-table').length) notepadRoot("create");
		$('#notepad-body').prepend(newNote);
		setCheckAllState();
		spectrumInit(domID);
		buildNotepad("backward", undefined, domID);//it's a new note: don't specify previous scroll position (scroll to top)
	} else {// edit existing note
		var thisLocalId = Number($(domID).attr('data-local-id'));
		var thisRemoteId = Number($(domID).attr('data-remote-id'));
		notepads[notepadIdLocal][thisLocalId]["color"] = thisColorId;
		notepads[notepadIdLocal][thisLocalId]["text"] = thisText;
		notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
		$(domID).attr('data-color', thisColorId);
		$(domID).find('.color-selector').spectrum("set", thisColorHex);
		fillNoteText("append", domID, thisText);
		buildNotepad("backward", npScroll, domID);
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/save-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: thisRemoteId,
				notetext: thisText,
				notecolor: thisColorId
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$(domID).attr('data-color', postData.color);
							$(domID).find('.color-selector').spectrum("set", colors[postData.color]["hex"]);
							fillNoteText("append", domID, postData.text);
							notepads[notepadIdLocal][thisLocalId]["color"] = postData.color;
							notepads[notepadIdLocal][thisLocalId]["text"] = postData.text;
						}
						if (postData["result"] == "success-new") {
							$(domID).attr('data-remote-id', postData.idRemote);
							notepads[notepadIdLocal][thisLocalId]["idRemote"] = postData.idRemote;
							notepads[notepadIdLocal][thisLocalId]["org"] = postData.org;
						}
						notepads[notepadIdLocal][thisLocalId]["lastEdit"] = postData.lastEdit;
						notepads[notepadIdLocal][thisLocalId]["synced"] = 1;
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// quick add a note from the notepad page
function quickAdd() {
	// conditions for early bailing
	if ($('#quick-add-input').val() == "") {
		popupMsg(locale.popup.empty, "red");
		return;
	}
	// variables, objects, arrays
	localNoteCounter++;
	var thisLocalId = localNoteCounter;
	idbSnapshotUpdate("count");
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var domID = '#' + notePrefix + thisLocalId;
	var quickAddText = $('#quick-add-input').val();
	var newNote = rowBuilder(thisLocalId, 0, 0, 0, quickAddText);
	var maxOrg = 0;
	for (let n in notepads[notepadIdLocal]) { if (notepads[notepadIdLocal][n]["org"] > maxOrg) maxOrg = notepads[notepadIdLocal][n]["org"]; }
	notepads[notepadIdLocal][thisLocalId] = { "idRemote": 0, "org": maxOrg+1, "color": 0, "isChecked": 0, "text": quickAddText, "lastEdit": Math.floor(tsAction/1000), "deleted": 0, "synced": 0 };
	// visual updates
	if (!$('#notepad-table').length) notepadRoot("create");
	$('#notepad-body').prepend(newNote);
	setCheckAllState();
	linkifyInit(domID);
	spectrumInit(domID);
	$('#quick-add-input').one("blur", function() {// a long, crazy method of focusing out and in again, so as to reset any mobile keyboard autocompletes
		const quickAddInput = document.querySelector('#quick-add-input');
		const quickAddLoc = document.querySelector('#quick-add > form');
		const fakeInput = document.createElement('input');// create invisible dummy input to receive the focus
		fakeInput.setAttribute('type', 'text');
		fakeInput.style.position = 'absolute';
		fakeInput.style.opacity = 0;
		fakeInput.style.height = 0;
		fakeInput.style.fontSize = '16px';// disable auto zoom
		quickAddLoc.prepend(fakeInput);
		fakeInput.focus();// focus so that subsequent async focus will work
		setTimeout(() => {
			quickAddInput.focus();// now we can focus back on this input
			fakeInput.remove();// and cleanup
		}, 100);
	});
	$('#quick-add-input').val("").blur();
	$('#quick-add-button').addClass('disabled');
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/quick-add",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				notetext: quickAddText
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							fillNoteText("append", domID, postData.text);
							notepads[notepadIdLocal][thisLocalId]["text"] = postData.text;
						}
						notepads[notepadIdLocal][thisLocalId]["idRemote"] = postData.idRemote;
						notepads[notepadIdLocal][thisLocalId]["org"] = postData.org;
						notepads[notepadIdLocal][thisLocalId]["lastEdit"] = postData.lastEdit;
						notepads[notepadIdLocal][thisLocalId]["synced"] = 1;
						$(domID).attr('data-remote-id', postData.idRemote);
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// delete a note
function deleteNote(domID) {
	// variables, objects, arrays
	var thisLocalId = Number($(domID).attr('data-local-id'));
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	notepads[notepadIdLocal][thisLocalId]["deleted"] = 1;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	anime({
		targets: domID,
		scale: { value: 0, duration: speed, easing: 'easeOutSine' },
		complete: function(anim) {
			$(domID + ' .color-selector').spectrum("destroy");
			$(domID).remove();
			if ($('#notepad-body > div').length == 0) notepadRoot("destroy");
			setCheckAllState();
		}
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/delete-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number($(domID).attr('data-remote-id'))
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, "delete");
						delete notepads[notepadIdLocal][thisLocalId];
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// delete option on the edit page
function deleteNoteOnEdit(domID) {
	// conditions for early bailing
	if (typeof domID === 'undefined') {
		buildNotepad("backward", npScroll);
		return;
	}
	// variables, objects, arrays
	var thisLocalId = Number($(domID).attr('data-local-id'));
	var thisRemoteId = Number($(domID).attr('data-remote-id'));
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	notepads[notepadIdLocal][thisLocalId]["deleted"] = 1;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	$(domID + ' .color-selector').spectrum("destroy");
	$(domID).remove();
	if ($('#notepad-body > div').length == 0) notepadRoot("destroy");
	setCheckAllState();
	buildNotepad("backward", npScroll);
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/delete-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: thisRemoteId
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, "delete");
						delete notepads[notepadIdLocal][thisLocalId];
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// delete all notes from the currently opened notepad
function deleteAllNotes() {
	modalToggle("off");
	// conditions for early bailing
	if (!$('#notepad-table').length) return;
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["deleted"] = 1;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// visual updates
	anime({
		targets: '#notepad-body > div',
		scale: { value: 0, duration: speed, easing: 'easeOutSine' },
		complete: function(anim) {
			notepadRoot("destroy");
		}
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/delete-all-notes",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"]
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						noteCommitHandler("resolve", "all", wasSynced, tsAction, "delete");
						delete notepads[notepadIdLocal];
						notepads[notepadIdLocal] = {};
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", "all", wasSynced, undefined, undefined);
	}
}

// display delete all modal
function deleteAllModal() {
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row modal-window-wrapper-top">',
		'	<p>'+ locale.modal.delete_all +'</p>',
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		'	<button type="button" class="color red button large" aria-label="'+ locale.general.yes +'" onclick="deleteAllNotes();">'+ locale.general.yes +'</button>',
		'	<button type="button" class="color green button large" aria-label="'+ locale.general.no +'" onclick="modalToggle(\'off\');">'+ locale.general.no +'</button>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
}

// display the JSON modal
function jsonModal() {
	var jsonURL = window.location.protocol+'//'+window.location.hostname+'/json/'+catalog[notepadIdLocal]["nphash"];
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row modal-window-wrapper-top">',
		'	<p class="bold">'+ locale.modal.json.prompt +'</p>',
		'	<p>'+ locale.modal.json.prompt_detail +'</p>',
		'	<div id="json-wrapper"><a href="'+ jsonURL +'" target="_blank" aria-label="'+ locale.modal.json.url +'">'+ jsonURL +'</a></div>',
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
}

// shuffle the note order around
function reorderEntry() {
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var orderArrayLocalId = $('#notepad-body').sortable("toArray", { attribute: "data-local-id" });
	var orderArrayRemoteId = $('#notepad-body').sortable("toArray", { attribute: "data-remote-id" });
	var c = 0;
	orderArrayLocalId.forEach(function(n) {
		notepads[notepadIdLocal][n]["org"] = orderArrayLocalId.length - c;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
		c++;
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/reorder-entry",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				noteorder: orderArrayRemoteId
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						orderArrayLocalId.forEach(function(n) {
							notepads[notepadIdLocal][n]["lastEdit"] = postData.lastEdit;
							notepads[notepadIdLocal][n]["synced"] = 1;
						});
						noteCommitHandler("resolve", "all", wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", "all", wasSynced, undefined, undefined);
	}
}

// re-sort the present notepad's notes by a variety of methods
function noteSort(sortorder) {
	switch (sortorder) {
		case "az":
			$('.note-row').sort(function(a, b) {
				if ($(a).find(".note-full").text().toLowerCase() < $(b).find(".note-full").text().toLowerCase()) { return -1; } else { return 1; }
			}).appendTo('#notepad-body');
			break;
		case "za":
			$('.note-row').sort(function(a, b) {
				if ($(a).find(".note-full").text().toLowerCase() < $(b).find(".note-full").text().toLowerCase()) { return 1; } else { return -1; }
			}).appendTo('#notepad-body');
			break;
		case "color":
			$('.note-row').sort(function(a, b) {
				if ($(a).attr("data-color") > $(b).attr("data-color")) { return 1; } else { return -1; }
			}).appendTo('#notepad-body');
			break;
		case "checked":
			$('.note-row').sort(function(a, b) {
				if ($(a).attr("data-is-checked") < $(b).attr("data-is-checked")) { return 1; } else { return -1; }
			}).appendTo('#notepad-body');
			break;
		case "unchecked":
			$('.note-row').sort(function(a, b) {
				if ($(a).attr("data-is-checked") > $(b).attr("data-is-checked")) { return 1; } else { return -1; }
			}).appendTo('#notepad-body');
			break;
	}
	modalToggle("off");
	reorderEntry();
}

// display sort modal
function sortModal() {
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row modal-window-wrapper-top">',
		'	<p>'+ locale.modal.sort +'</p>',
		'	<button type="button" class="color red button large" aria-label="'+ locale.notepad.sort_az +'" onclick="noteSort(\'az\');"><i class="fa fa-sort-az"></i> '+ locale.notepad.sort_az +'</button>',
		'	<button type="button" class="color orange button large" aria-label="'+ locale.notepad.sort_za +'" onclick="noteSort(\'za\');"><i class="fa fa-sort-za"></i> '+ locale.notepad.sort_za +'</button>',
		'	<button type="button" class="color yellow button large" aria-label="'+ locale.notepad.sort_color +'" onclick="noteSort(\'color\');"><i class="fa fa-palette"></i> '+ locale.notepad.sort_color +'</button>',
		'	<div class="spacer0"></div>',
		'	<button type="button" class="color cyan button large" aria-label="'+ locale.notepad.sort_checked +'" onclick="noteSort(\'checked\');"><i class="fa fa-checkbox-checked"></i> '+ locale.notepad.sort_checked +'</button>',
		'	<button type="button" class="color blue button large" aria-label="'+ locale.notepad.sort_unchecked +'" onclick="noteSort(\'unchecked\');"><i class="fa fa-checkbox-unchecked"></i> '+ locale.notepad.sort_unchecked +'</button>',
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		'	<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
}

// move notes up and down
function moveUp(domID) {
	var targetRow = $(domID);
	var prevRow = targetRow.prev();
	if (prevRow.length == 0) return;
	removeAllToolOverlays();
	var prevClone = prevRow.hide().clone().attr('id', 'prev-clone').insertBefore(prevRow).show().css('z-index', 999).css('position','relative');
	var targetClone = targetRow.hide().clone().attr('id', 'target-clone').insertBefore(targetRow).show().css('z-index', 1000).css('position','relative');
	anime({
		targets: '#prev-clone',
		translateY: { value: targetClone.height(), duration: speed, easing: 'easeInOutSine' }
	});
	anime({
		targets: '#target-clone',
		translateY: { value: '-' + prevClone.height(), duration: speed, easing: 'easeInOutSine' },
		complete: function(anim) {
			prevClone.remove();
			targetClone.remove();
			targetRow.insertBefore(prevRow);
			prevRow.show();
			targetRow.show();
			reorderEntry();
		}
	});
}
function moveDown(domID) {
	var targetRow = $(domID);
	var nextRow = targetRow.next();
	if (nextRow.length == 0) return;
	removeAllToolOverlays();
	var nextClone = nextRow.hide().clone().attr('id', 'next-clone').insertBefore(nextRow).show().css('z-index', 999).css('position', 'relative');
	var targetClone = targetRow.hide().clone().attr('id', 'target-clone').insertBefore(targetRow).show().css('z-index', 1000).css('position', 'relative');
	anime({
		targets: '#next-clone',
		translateY: { value: '-' + targetClone.height(), duration: speed, easing: 'easeInOutSine' }
	});
	anime({
		targets: '#target-clone',
		translateY: { value: nextClone.height(), duration: speed, easing: 'easeInOutSine' },
		complete: function(anim) {
			nextClone.remove();
			targetClone.remove();
			targetRow.insertAfter(nextRow);
			nextRow.show();
			targetRow.show();
			reorderEntry();
		}
	});
}

// change a note color
function changeColor(domID, whichcolor) {
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var thisLocalId = Number($(domID).attr('data-local-id'));
	notepads[notepadIdLocal][thisLocalId]["color"] = colorHexToId[whichcolor];
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	$(domID).attr('data-color', colorHexToId[whichcolor]);
	$(domID).find('.color-selector').spectrum("set", whichcolor);
	if ($(domID+' .col-4').hasClass('tools-disp')) {
		$(domID).find('.tools-disp').removeClass('tools-disp');
		$(domID).find('.expand-button i').toggleClass('fa-ellipsis-h');
		$(domID).find('.expand-button i').toggleClass('fa-ellipsis-v');
		$(domID + ' .col-4 .color-selector').spectrum("destroy");
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/change-color",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number($(domID).attr('data-remote-id')),
				notecolor: colorHexToId[whichcolor]
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$(domID).attr('data-color', postData.color);
							$(domID).find('.color-selector').spectrum("set", colors[postData.color]["hex"]);
							notepads[notepadIdLocal][thisLocalId]["color"] = postData.color;
						}
						notepads[notepadIdLocal][thisLocalId]["lastEdit"] = postData.lastEdit;
						notepads[notepadIdLocal][thisLocalId]["synced"] = 1;
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// change all note colors for the current notepad
function changeAllColors() {
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var currentColorHex = $('#spectrum-change-all .color-selector').spectrum("get");
	var currentColorId = colorHexToId[currentColorHex];
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["color"] = currentColorId;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// visual updates
	$('#notepad-body > div').attr('data-color', currentColorId);
	$('#notepad-body').find('.color-selector').spectrum("set", currentColorHex);
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/change-color-all",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				notecolor: currentColorId
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$('#notepad-body > div').attr('data-color', postData.color);
							$('#notepad-body').find('.color-selector').spectrum("set", colors[postData.color]["hex"]);
							for (let n in notepads[notepadIdLocal]) notepads[notepadIdLocal][n]["color"] = postData.color;
						}
						for (let n in notepads[notepadIdLocal]) {
							notepads[notepadIdLocal][n]["lastEdit"] = postData.lastEdit;
							notepads[notepadIdLocal][n]["synced"] = 1;
						}
						noteCommitHandler("resolve", "all", wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", "all", wasSynced, undefined, undefined);
	}
}

// check or uncheck the checkbox
function checkBox(domID) {
	// variables, objects, arrays; visual updates
	var toCheck = false;
	if ($(domID).attr('data-is-checked') == 0) toCheck = true;
	$(domID).attr('data-is-checked', toCheck ? 1 : 0);
	setCheckAllState();
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	var thisLocalId = Number($(domID).attr('data-local-id'));
	notepads[notepadIdLocal][thisLocalId]["isChecked"] = toCheck ? 1 : 0;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/check-box",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number($(domID).attr('data-remote-id')),
				checkaction: toCheck
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
					case "matchfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$(domID).attr('data-is-checked', postData.isChecked ? 1 : 0);
							notepads[notepadIdLocal][thisLocalId]["isChecked"] = postData.isChecked ? 1 : 0;
						}
						notepads[notepadIdLocal][thisLocalId]["lastEdit"] = postData.lastEdit;
						notepads[notepadIdLocal][thisLocalId]["synced"] = 1;
						noteCommitHandler("resolve", thisLocalId, wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", thisLocalId, wasSynced, undefined, undefined);
	}
}

// check or uncheck all the checkboxes
function checkAllBox() {
	// visual updates
	if ($('#notepad-header .checkbox').attr('data-check-state') == 1) {
		// uncheck all
		$('#notepad-body > div').attr('data-is-checked', 0);
		$('#notepad-header .checkbox').attr('data-check-state', 0);
		var checkState = false;
	} else {
		// check all
		$('#notepad-body > div').attr('data-is-checked', 1);
		$('#notepad-header .checkbox').attr('data-check-state', 1);
		var checkState = true;
	}
	// variables, objects, arrays
	var wasSynced = globalSync;
	var tsAction = getUnixTimestampMS();
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["isChecked"] = checkState ? 1 : 0;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "POST",
			url: "/ajax/check-all-box",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				checkaction: checkState
			}),
			beforeSend: function() {
				statusIndicator("process");
				cloudIndicator("upload");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
				cloudIndicator("online");
				switch (postData["result"]) {
					case "hashfail":
						errorModal("manual", locale.modal.error.critical);
						break;
					case "lockfail":
						errorModal("manual", locale.modal.error.locked);
						break;
					default:
						statusIndicator("success");
						if (postData.ssv == true) {
							$('#notepad-body > div').attr('data-is-checked', postData.isChecked ? 1 : 0);
							$('#notepad-header .checkbox').attr('data-check-state', postData.isChecked ? 1 : 0);
							for (let n in notepads[notepadIdLocal]) notepads[notepadIdLocal][n]["isChecked"] = postData.isChecked ? 1 : 0;
						}
						for (let n in notepads[notepadIdLocal]) {
							notepads[notepadIdLocal][n]["lastEdit"] = postData.lastEdit;
							notepads[notepadIdLocal][n]["synced"] = 1;
						}
						noteCommitHandler("resolve", "all", wasSynced, tsAction, undefined);
						break;
				}
			}
		});
	} else {// if offline
		noteCommitHandler("offline", "all", wasSynced, undefined, undefined);
	}
}

// display the light / dark mode modal window
function lightDarkModal() {
	if (idbSupport) {
		var thisMode = (darkMode) ? locale.modal.light_dark.dark_mode : locale.modal.light_dark.light_mode;
		var otherMode = (darkMode) ? locale.modal.light_dark.light_mode : locale.modal.light_dark.dark_mode;
		var otherBool = (darkMode) ? false : true;
		var bulb = (darkMode) ? "outline" : "fill";
		var extraStyle = (darkMode) ? "" : " color: #bdc435;";
		var buttonColor = (darkMode) ? "yellow" : "black";
		var modalContent = [
			'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
			'<div class="row modal-window-wrapper-top">',
			'	<span class="center"><i class="fa fa-bulb-'+ bulb +'" style="font-size: 5em;'+ extraStyle +'"></i></span>',
			'	<div class="spacer10"></div>',
			'	<p class="bold">'+ locale.modal.light_dark.prompt +' '+ thisMode +'</p>',
			'	<p>'+ locale.modal.light_dark.prompt_detail +'</p>',
			'	<p class="smaller ital">'+ locale.modal.light_dark.additional_notice +'</p>',
			'</div>',
			'<div class="row modal-window-wrapper-bottom">',
			'	<button type="button" class="button color '+ buttonColor +' large" aria-label="'+ locale.modal.light_dark.change_mode +' '+ otherMode +'" onclick="darkMode='+ otherBool +';idbSnapshotUpdate(\'mode\').then(function() { window.location.replace(window.location.href+\'?override=1\'); });">'+ locale.modal.light_dark.change_mode +' '+ otherMode +'</button>',
			'	<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
			'</div>'
		].join("\n");
	} else {
		var modalContent = [
			'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
			'<div class="row modal-window-wrapper-top">',
			'	<p class="bold">'+ locale.modal.light_dark.error +'</p>',
			'</div>',
			'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button large" aria-label="'+ locale.general.close +'" onclick="modalToggle(\'off\');">'+ locale.general.close +'</button>',
			'</div>'
		].join("\n");
	}
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
}

// display the advanced settings modal window
function advancedModal() {
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row modal-window-wrapper-top">',
		'	<span class="smaller"><span class="bold">'+ locale.modal.advanced.local_version +': </span>'+ appVer +'</span>',
		'	<div class="spacer5"></div>',
		'	<span class="smaller"><span class="bold">'+ locale.modal.advanced.current_version +': </span><span class="app-ver"></span><div class="loading-placeholder"><div></div><div></div><div></div><div></div></div></span>',
		'	<div class="spacer20"></div>',
		'	<span>'+ locale.modal.advanced.prompt_detail +'</span>',
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		'	<button type="button" class="button color red large" aria-label="'+ locale.modal.advanced.idb +'" onclick="idbEmpty().then(function() { window.location.replace(window.location.href+\'?override=1\'); });">'+ locale.modal.advanced.idb +'</button>',
		'	<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
	getAppVer(function(verNum) {
		$('.modal-window-wrapper-top .loading-placeholder').remove();
		$('.modal-window-wrapper-top .app-ver').text(verNum);
	}); 
}

// get the current version number of the application
function getAppVer(callback) {
	if ([0, 3].includes(offlineState)) {// if online
		$.ajax({
			type: "GET",
			url: "/ajax/current-version",
			contentType: "application/x-www-form-urlencoded; charset=UTF-8",
			success: function(postData) {
				if (typeof postData.version !== 'undefined') callback(postData.version);
			},
			error: function() {}// override the global AJAX error with nothing; fail silently
		});
	}
}

// sync all local-only IndexedDB changes --> MySQL, in not only this notepad but all notepads opened on the device
function syncAll(toggle) {
	// variables, objects, arrays
	var oosIndex = {};
	for (let npid in catalog) {
		oosIndex[npid] = {};
		for (let ntid in notepads[npid]) { if (notepads[npid][ntid]['synced'] === 0) oosIndex[npid][ntid] = notepads[npid][ntid]; }
		if ((Object.keys(oosIndex[npid]).length > 0) || (catalog[npid]['synced'] === 0)) oosIndex[npid]['notepad'] = catalog[npid];
		if (Object.keys(oosIndex[npid]).length === 0) delete oosIndex[npid];
	}
	// conditions for early bailing
	if ((globalSync) || (Object.keys(oosIndex).length === 0)) {
		setOfflineState("system", 0);
		modalToggle("off");
		popupMsg(locale.popup.sync.already, "blue");
		globalSync = true;
		idbSnapshotUpdate("sync");
		return;
	} else {
		// MySQL update
		$.ajax({
			type: "POST",
			url: "/ajax/sync-all",
			data: JSON.stringify({
				oosNotes: oosIndex,
				override: toggle
			}),
			beforeSend: function() {
				syncModal("process");
				modalForce = true;
			},
			complete: function() {
				modalForce = false;
			},
			success: function(postData) {
				if (postData.warning == true) {
					syncModal("error", postData);
				} else {
					idbEmpty().then(function() {
						if ((appLoc == "notepad") && (typeof catalog[notepadIdLocal]["nphash"] === 'undefined') && (postData[notepadIdLocal]["nphash"] != null)) {
							window.location.replace(window.location.protocol+'//'+window.location.hostname+'/np/'+postData[notepadIdLocal]["nphash"]+'?override=1');
						} else {
							window.location.replace(window.location.href+'?override=1');
						}
					});
				}
			},
			error: function(xhr, status, errorThrown) {
				modalToggle("off");
				popupMsg(locale.popup.sync.error, "red");
				if (offlineState == 2) setOfflineState("system", 1, "override");// if the user had set Offline Mode, it's now the system that's saying we need to remain in it
			}
		});
	}
}

// all the modal screens that compromise the IndexedDB --> MySQL sync
function syncModal(syncstep, ajaxData) {
	switch (syncstep) {
		case "dialog":
			if (offlineState == 1) setOfflineState("system", 2, "override");// if the system had set Offline Mode, whether or not to remain in it now belongs to the user
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p class="bold">'+ locale.modal.sync.dialog.prompt +'</p>',
				'	<p class="smaller">'+ locale.modal.sync.dialog.prompt_detail +'</p>',
				'	<p class="smaller ital">'+ locale.modal.sync.dialog.prompt_warning +'</p>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button color green large next" aria-label="'+ locale.modal.sync.dialog.sync_confirm +'" onclick="syncAll();">'+ locale.modal.sync.dialog.sync_confirm +'</button>',
				'	<button type="button" class="button large" aria-label="'+ locale.modal.sync.dialog.sync_decline +'" onclick="modalToggle(\'off\');">'+ locale.modal.sync.dialog.sync_decline +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			modalToggle("on");
			break;
		case "process":
			var modalContent = [
				'<div class="row" style="display: flex; justify-content: center; padding: 75px 25px;">',
				'	<div id="icon-sync-process"><i class="fa fa-refresh fa-spin"></i></div>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			break;
		case "error":
			var warnings = {
				"npnamefail": locale.modal.sync.error.npnamefail,
				"nprenamefail": locale.modal.sync.error.nprenamefail,
				"lockfail": locale.modal.sync.error.lockfail,
				"hashfail": locale.modal.sync.error.hashfail,
				"findfail": locale.modal.sync.error.findfail
			};
			var warningContent = [];
			for (let n in ajaxData) {
				if ((n != "warning") && (ajaxData[n]['result'] != "success")) {
					warningContent.push(
						'<div class="row">',
						'	<span class="bold"><i class="fa fa-pencil"></i>&nbsp;&nbsp;'+ ajaxData[n]["npname"] +'</span>',
						'	<p class="smaller" style="text-align: left;">'+ warnings[ajaxData[n]["result"]] +'</p>',
						'</div>'
					);
				}
			}
			var modalContent = [
				'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
				'<div class="row modal-window-wrapper-top">',
				'	<p class="bold">'+ locale.modal.sync.error.prompt +'</p>',
				'	<p>'+ locale.modal.sync.error.prompt_detail +'</p>',
				'	<hr />',
				'	<div id="warning-details"></div>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				'	<button type="button" class="button color cyan large" aria-label="'+ locale.modal.sync.error.override +'" onclick="syncAll(\'override\');">'+ locale.modal.sync.error.override +'</button>',
				'	<button type="button" class="button large" aria-label="'+ locale.general.cancel +'" onclick="modalToggle(\'off\');">'+ locale.general.cancel +'</button>',
				'</div>'
			].join("\n");
			$('#modal-window').empty().append(modalContent);
			$('#warning-details').append(warningContent.join("\n"));
			break;
	}
}


//** ASSIST FUNCTIONS **//

// create or destroy the notepad root as a result of it becoming empty or getting its first note
// also handle the display of buttons in response
function notepadRoot(ntpdstate) {
	switch (ntpdstate) {
		case "create":
			$('#notepad-empty').remove();
			var notepadContent = [
				'<div id="notepad-table">',
				'	<div id="notepad-header">',
				'		<div class="col-1"></div>',
				'		<div class="col-2">',
				'			<div id="spectrum-change-all">',
				'				<button type="button" class="button empty white palette color-selector" aria-label="'+ locale.notepad.change_colors +'" title="'+ locale.notepad.change_colors +'">',
				'					<i class="fa fa-palette"></i>',
				'				</button>',
				'			</div>',
				'		</div>',
				'		<div class="col-3">',
				'			<button type="button" class="button empty white checkbox" aria-label="'+ locale.notepad.check_all +'" title="'+ locale.notepad.check_all +'" data-check-state="0" onclick="checkAllBox();">',
				'					<i class="fa fa-checkbox"></i>',
				'			</button>',
				'		</div>',
				'		<div class="col-4">',
				'			<i id="logo-nphead"><svg  version="1.1" xmlns="http://www.w3.org/2000/svg" class="logo-nphead-svg" viewBox="0 0 122 32"><path class="logo-nphead-path" d="M117.41,11.35c.1.2.1.2,0,.7-.2,1.69-2.3,2.89-3.7,3.59a4.64,4.64,0,0,0-2.3,1.2,1.57,1.57,0,0,0,.2,2.19c1.1,1,4,.7,5.29.3,1-.3,1.9-.8,2.9-1s2.8,0,2,1.39c-.6,1.1-2.4,1.69-3.4,2.09a13.62,13.62,0,0,1-5.29.7,6.71,6.71,0,0,1-3.1-.7A3.39,3.39,0,0,1,108,19a19.15,19.15,0,0,1-.1-2.39,1,1,0,0,0-.1-.3c-.6-.2-.7-.8-.8-1.3a1.8,1.8,0,0,1,1.3-2.29.44.44,0,0,0,.3-.4c.1-.2.1-.5.2-.7s0-.4-.3-.4c-1.1.1-2.1.2-3.2.4a15,15,0,0,1-2,.2c-.4,0-.5.2-.6.5-.2,1.39-.4,3-.7,4.28-.4,1.79-.4,3.59-.9,5.28a1.39,1.39,0,0,1-1.2.7c-.7-.1-1.4-.2-1.7-1a.6.6,0,0,1-.1-.4,7.22,7.22,0,0,1,.4-2.49c.4-1.69.5-3.49.9-5.18.1-.4.1-1.1.2-1.39s0-.4-.3-.4l-3.8.3a1.63,1.63,0,0,1-1.7-1.3,2.24,2.24,0,0,1,.1-1.39c.2-.5.6-.6,1.1-.6s1.1.1,1.7.1c1,0,2.1-.1,3.1-.2a.45.45,0,0,0,.3-.3c.2-1.1.3-2,.4-3.09l.2-1.39c.1-.5,0-.9.1-1.39a9.31,9.31,0,0,1,.4-1.59,1.27,1.27,0,0,1,1.6-.8,5.36,5.36,0,0,1,1.1.5.81.81,0,0,1,.4.8c-.4,2.19-.4,1.39-.8,3.59-.2,1.2-.1,2.19-.3,3.39-.1.4,0,.4.4.4,1.9-.1,3.7-.2,5.59-.2.3,0,.6.1.8.1a4.87,4.87,0,0,0,1.2-.1,4.75,4.75,0,0,1,3.7.2,4.69,4.69,0,0,1,2.5,2.29v.3m-4.3-.3c-.2,0-.4.1-.6.1a2,2,0,0,0-1.2,1c-.1.5.5.6.9.6a2.23,2.23,0,0,0,1.3-.6c.3-.2.8-.6.6-1A1.1,1.1,0,0,0,113.12,11Z"/><path class="logo-nphead-path" d="M88.55,8.16a5.42,5.42,0,0,1,1.9.3,4.48,4.48,0,0,1,2,1.2,6,6,0,0,1,.7,1,1.92,1.92,0,0,1,.3,1,21.53,21.53,0,0,1,.1,3.59,9.85,9.85,0,0,1-1.4,4.38A5.63,5.63,0,0,1,89.94,22a3.6,3.6,0,0,1-4.4-.4,7.51,7.51,0,0,1-2.3-3.79,7.1,7.1,0,0,1-.1-4.09,16.51,16.51,0,0,1,.6-1.59c.2-.3,0-.4-.3-.5s-.4-.2-.5-.5c-.2-.8.2-1.2,1.1-1.49a8,8,0,0,0,1.6-.8,5.09,5.09,0,0,1,1.7-.7Zm-2.6,7a6.92,6.92,0,0,0,.5,2.49c.2.6.8,2.09,1.8,1.79.8-.2,1.4-1.39,1.7-2a7.8,7.8,0,0,0,1.3-5.08,2.35,2.35,0,0,0-.9-1.59,3.72,3.72,0,0,0-2.1-.2,2.25,2.25,0,0,0-1.8,1.69,15.44,15.44,0,0,0-.4,2.09C86,14.64,85.95,15,85.95,15.14Z"/><path class="logo-nphead-path" d="M74.36,9.56c0,.3-.1.5-.1.8,0,.1,0,.1.1.2s.1-.1.2-.1a4.33,4.33,0,0,1,2.6-2,3.44,3.44,0,0,1,2.6.5c1.3.7,1.5,2,1.7,3.19a21.5,21.5,0,0,1,.2,4.38c-.1,1.79-.3,3.69-.5,5.48,0,.4-.2.6-.7.5-.3-.1-.6.2-.9.2a1.8,1.8,0,0,1-.9-.4,1.2,1.2,0,0,1-.5-.5c-.5-.8.1-1.49.2-2.19.1-1.39.3-2.89.5-4.28a7.75,7.75,0,0,0-.3-3.69.37.37,0,0,0-.1-.3s-.3-.5-1-.1A10.33,10.33,0,0,0,75,14.34a30.21,30.21,0,0,0-2.3,6.58,1.69,1.69,0,0,0-.1.7c0,.7-.5,1.1-1.3,1h-.5a1.82,1.82,0,0,1-1.3-.8c-.4-.7-.1-1.3,0-2,.2-1.3.5-2.59.7-3.89.2-1.1.3-2.09.5-3.19l.6-3.89a1.6,1.6,0,0,1,2.2-1C73.86,8.36,74.46,8.76,74.36,9.56Z"/><path class="logo-nphead-path" d="M68.37,12.44c-.3,2.79-.4,4.78-.8,7.17-.2,1.2-.5,2.39-.7,3.79a15.13,15.13,0,0,1-2.8,5.68A6,6,0,0,1,60,32a4.1,4.1,0,0,1-4.1-2.19c-.7-1.39-1.5-3.79.3-4.38,2.6-.5,1,2.29,2.5,3.39s3.9-1.59,4.69-3.39a26.07,26.07,0,0,0,1.7-7.07c0-.1-.1-.2-.1-.3l-.2.2A18.06,18.06,0,0,1,63,20.32c-1,.9-1.8,1.89-3.4,2a2.1,2.1,0,0,1-1.8-1,6.81,6.81,0,0,1-.9-4.18c.2-1.69.6-3.49.9-5.18a11.16,11.16,0,0,1,.8-2.59c.3-.7.9-.9,1.8-.8a1.48,1.48,0,0,1,1.3,1.2,5.25,5.25,0,0,1-.4,2.49c-.3,1.3-.8,2.49-1.1,3.79-.1.4-.8,2.79.3,2.49.6-.2,1.1-1,1.5-1.39a15.53,15.53,0,0,0,1.6-2A11.19,11.19,0,0,0,65,11.55l.3-1.79a1.27,1.27,0,0,1,1-1.1A2.17,2.17,0,0,1,68,9c.7.5.7,1.1.6,1.89A3.88,3.88,0,0,0,68.37,12.44Z"/><path class="logo-nphead-path" d="M47.19,10.15c0,.5.1.9.1,1.3,0,.1.1.3.1.4l.3-.3c.7-.9,1.4-1.39,2.1-2.29a2.73,2.73,0,0,1,1.2-.9c1.5-.7,2.2-.4,3.2.8a6.15,6.15,0,0,1,1.1,3.69,20.36,20.36,0,0,1,.1,3.49c-.1,1.59-.4,3.69-.6,5.28a1,1,0,0,1-.7.8,3.93,3.93,0,0,1-1.4.3,1.11,1.11,0,0,1-.7-1.59,12.08,12.08,0,0,0,.7-5V12.25c0-.5.2-1.89-.7-1.79-.5,0-.8.5-1,.8a40.29,40.29,0,0,0-3,7.47c-.3,1.1-.5,1.59-.8,2.79a1.42,1.42,0,0,1-.8.9c-1,.6-2.3.2-2.4-.8a4,4,0,0,1,.3-1.49,13,13,0,0,0,.5-5.88c-.2-1.49-.4-3-.5-4.48a1,1,0,0,1,.6-.9,1.51,1.51,0,0,1,2,.3A3.79,3.79,0,0,1,47.19,10.15Z"/><path class="logo-nphead-path" d="M32,17.73a6.51,6.51,0,0,1,.4-3.39,1.38,1.38,0,0,1,.3-.4,1,1,0,0,0,0-1.3c-.2-.3,0-.5.1-.9a5.55,5.55,0,0,1,3.7-3.29,4.36,4.36,0,0,1,3.7.2,2.78,2.78,0,0,1,1.8,2,15.79,15.79,0,0,1,.7,2,11.17,11.17,0,0,1-.3,3.19,17.94,17.94,0,0,1-1.6,3.79,6.1,6.1,0,0,1-3.4,3.09,2.88,2.88,0,0,1-2.7-.1,6.4,6.4,0,0,1-2.8-4.48C32.11,17.93,32,17.83,32,17.73Zm3.1.2c.1.4.3,1,.5,1.59,0,.1.1.2.2.3A.71.71,0,0,0,37,20a4.73,4.73,0,0,0,1-1,11.06,11.06,0,0,0,2.3-5.88A3.05,3.05,0,0,0,40.1,11a1.37,1.37,0,0,0-.5-.8,2.28,2.28,0,0,0-2.8.4c-.5.7-1.4,1.1-1.1,2.09a.75.75,0,0,1-.2.4c0,.1-.1.2-.1.3a2.75,2.75,0,0,0-.1.9A7.09,7.09,0,0,0,35.11,17.93Z"/><path class="logo-nphead-path" d="M30.61,14a24.75,24.75,0,0,1-.8,6.08,20.26,20.26,0,0,1-.9,2.19,1.56,1.56,0,0,1-1.4.6,1.59,1.59,0,0,1-1.2-.4c-.3-.3-.7-1-.5-1.39,1.3-1.89,1.5-4.38,1.7-6.58a18.18,18.18,0,0,0-.2-3.29.75.75,0,0,0-.2-.4c-.1.1-.3.1-.4.2a11.06,11.06,0,0,0-3.6,4.48c-.8,1.69-1.5,3.49-2.3,5.28-.1.4-.2.7-.3,1.1a.81.81,0,0,1-.9.7c-.4,0-.7.2-1.1,0a2.76,2.76,0,0,1-1.3-1.1c-.3-.6,0-1,.2-1.39A12.49,12.49,0,0,0,19,14.84c.1-1.39.2-2.79.4-4.09v-1c-.1-.7,0-.8.8-1.1a1.69,1.69,0,0,1,1.7.2c.6.3.6.9.7,1.49v.3c.1-.1.2-.1.3-.2a9.78,9.78,0,0,1,3.3-2.29,3.21,3.21,0,0,1,1.4-.1,2.75,2.75,0,0,1,2.2,1.49c.2.8.4,1.49.6,2.29A17.85,17.85,0,0,0,30.61,14Z"/><path class="logo-nphead-path" d="M15,8.66v1.1c0,.5,0,.7.6.6a5,5,0,0,1,1.2-.2c.2,0,.7-.2.8,0s-.7.5-.9.5c.4,0,1.7-.5,2,0s-1,.8-1.3.9c.1,0,.2-.1.3-.1-.8.3-1.6.6-2.5.9-.2.1-.3.2-.3.4-.2,1.49-.3,2.89-.6,4.38a25.77,25.77,0,0,0-.4,4.78,1,1,0,0,1-1.5,1A2.55,2.55,0,0,1,11,20c.4-2.19.7-4.48,1.1-6.68.1-.4-.1-.4-.4-.4-.9.2-.6.3-1.4.6-1.8.6-3.6,1.39-5.39,2.09a.82.82,0,0,0-.4.6c-.4,1.69-.8,3.49-1.2,5.18-.3.1-.3.3-.3.6a1.11,1.11,0,0,1-1.4.9c-.9,0-1.2-.7-1.6-1.3-.1-.1,0-.3,0-.4.3-1.1.7-2.29,1-3.39l.6-2.39a4,4,0,0,0,0-1.1,1.34,1.34,0,0,1,.2-.9c.4-.4.4-.9.6-1.39.4-1.59.8-1.89,1.3-3.49.5-1.2.7-1.49,1.2-2.59l1.6-3c1.3-1.89,1.2-1.89,2-2.49a1.85,1.85,0,0,1,1.3-.4c1.8.3,2.8,2.19,3.7,3.59.4.9,0,0,.8,2.09A17.27,17.27,0,0,1,15,8.66Zm-2.8.3c-.1-.6-.1-.8-.2-1.2-.4-1.39-2-5.38-3.3-3s-.5,1-.9,1.59a13.16,13.16,0,0,0-.9,1.69,28.23,28.23,0,0,0-1.7,4.09v.3h.3c1.2-.4,2.3-.7,3.5-1.1a19.64,19.64,0,0,1,3-.8.21.21,0,0,0,.2-.2Z"/></svg></i>',
				'		</div>',
				'	</div>',
				'	<div id="notepad-body"></div>',
				'</div>'
			].join("\n");
			$('#notepad').append(notepadContent);
			// initiate Spectrum color selector plugin for the change all color button
			$('#spectrum-change-all .color-selector').spectrum({
				showPaletteOnly: true,
				hideAfterPaletteSelect: true,
				allowEmpty: true,
				preferredFormat: 'hex',
				change: function(color) {
					if (color != null) {// null indicates a clickout; if so, take no action
						changeAllColors();
						$(this).spectrum("set", "");
					}
				},
				palette: [
					[colors[0]['hex'], colors[1]['hex'], colors[2]['hex']],
					[colors[3]['hex'], colors[4]['hex'], colors[5]['hex']],
					[colors[6]['hex'], colors[7]['hex'], colors[8]['hex']]
				]
			});
			// make the notes sortable and movable
			$('#notepad-body').sortable({
				items: ".note-row",
				cursor: "move",
				handle: ".sort-button",
				cancel: "",
				delay: 150,
				distance: 5,
				placeholder: "sortable-placeholder",
				forcePlaceholderSize: true,
				update: function(event, ui) {
					reorderEntry();
				}
			});
			$('#delete-all-modal-button').removeClass('disabled');
			$('#sort-modal-button').removeClass('disabled');
			break;
		case "destroy":
			$('.color-selector').spectrum("destroy");// destroy all color picker instances
			$('#notepad-table').remove();
			var npEmptyContent = [
				'<div id="notepad-empty">',
				'	<i id="empty-folder">',
				'		<svg id="empty-folder-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle class="folder-bkg" cx="50" cy="50" r="49"/><path class="folder-otl" d="M47.7,71.36s-8.79,0-9.6,0c-3.18,0-6.21,0-9.63,0a20,20,0,0,1-3.19-.2,2.22,2.22,0,0,1-2.12-2.48c0-1.7,0-3.39,0-5.09q.06-13.87.11-27.75a6.63,6.63,0,0,1,.06-1,2.78,2.78,0,0,1,2.87-2.5c1.16,0,2.34,0,3.51,0,.85,0,1.6,0,2-.9.17-.46.45-.89.66-1.34a2,2,0,0,1,2-1.19h9.55c1.68,0,3.36,0,5,0a1.59,1.59,0,0,1,1.6,1c.25.52.53,1,.74,1.58a1.26,1.26,0,0,0,1.37.89c3.88,0,7.76-.07,11.64-.09,2,0,4,0,5.94,0a2.88,2.88,0,0,1,3,2.91c0,.83,0,1.67,0,2.5s.15.89.87.89h6.24c.24,0,.47,0,.7,0A1.79,1.79,0,0,1,82.7,41c-.23.85-.53,1.68-.83,2.51-1,2.76-2,5.51-3,8.27Q76.18,59.36,73.48,67c-.21.58-.41,1.16-.61,1.74a3.49,3.49,0,0,1-3.55,2.61c-3.46,0-3.46,0-10.39.06-3.74,0-3.74,0-11.23,0Z"/><path class="folder-bkg" d="M81.12,40.38c0,.2,0,.07-.06.29s-1,2.85-1.52,4.26-1.14,3-1.7,4.52c-.71,1.89-1.41,3.77-2.1,5.66-1.55,4.23-3,8.49-4.54,12.74-.38,1.07-1,1.33-2.06,1.33-12.76,0-25.46,0-38.22,0h-5c-.27,0-.33-.12-.28-.4a3.06,3.06,0,0,1,.13-.43c.83-2.32,1.69-4.63,2.51-6.95s1.56-4.56,2.36-6.84c.93-2.66,1.89-5.33,2.84-8q.89-2.43,1.79-4.87a7.41,7.41,0,0,1,.4-.86,1.14,1.14,0,0,1,1.13-.55H76.29c1.58,0,1.24,0,4,0h.58C81,40.29,81.14,40.27,81.12,40.38Z"/></svg>',
				'	</i>',
				'	<p class="larger">'+ locale.notepad.empty_msg +'</p>',
				'	<p class="ital">'+ locale.notepad.empty_tip +'</p>',
				'</div>'
			].join("\n");
			$('#notepad').append(npEmptyContent);
			$('#delete-all-modal-button').addClass('disabled');
			$('#sort-modal-button').addClass('disabled');
			break;
	}
}

// fill in notepad name element
function fillNotepadName() {
	var npnameContent = [
		'<div id="np-name-wrapper">',
		'	<div id="np-name" onclick="renameNotepad(\'edit\');">'+ catalog[notepadIdLocal]["npname"] +'</div>',
		'</div>'
	].join("\n");
	$('#np-rename').empty().append(npnameContent);
}

// fill in notepad description element
function fillNotepadDesc() {
	var npdescContent = [
		'<span id="np-desc-textarea" class="break-word" contenteditable="true" spellcheck="false" data-placeholder="'+ locale.notepad.desc_placeholder +'"></span>',
		'<span id="np-desc-label"><span id="np-desc-char">'+ charSplitter.countGraphemes($('#np-desc-textarea').text()) +'</span>/'+ npdescMaxChar +' '+ locale.notepad.desc_char +'</span>'
	].join("\n");
	$('#np-desc').empty().append(npdescContent);
	if (typeof catalog[notepadIdLocal]["npdesc"] !== 'undefined') $('#np-desc-textarea').text(catalog[notepadIdLocal]["npdesc"]);
	$('#np-desc-textarea').on({
		'keypress': function(e) {
			if (e.keyCode == 8 ||// backspace
				e.keyCode == 33 ||// pgup
				e.keyCode == 34 ||// pgdown
				e.keyCode == 35 ||// end
				e.keyCode == 36 ||// home
				e.keyCode == 37 ||// left
				e.keyCode == 38 ||// up
				e.keyCode == 39 ||// right
				e.keyCode == 40 ||// down
				e.keyCode == 46) {// delete
					// always allow these keys
			} else if (e.keyCode == 13) {// enter
				e.preventDefault();
				$('#np-desc-textarea').blur();
			} else {
				return charSplitter.countGraphemes($('#np-desc-textarea').text()) < npdescMaxChar;// block all other keys if we're at the character limit
			}
		},
		'keyup': function(e) {
			$('#np-desc-char').text(charSplitter.countGraphemes($('#np-desc-textarea').text()));
			 if (e.keyCode == 27) {// escape
				e.preventDefault();
				if (typeof catalog[notepadIdLocal]["npdesc"] === 'undefined') {
					$('#np-desc-textarea').text("");
				} else {
					$('#np-desc-textarea').text(catalog[notepadIdLocal]["npdesc"]);
				}
				$('#np-desc-textarea').blur();
			}
		},
		'drop': function(e) {
			e.preventDefault();
			e.stopPropagation();
		},
		'focusin': function() {
			$('#np-desc-char').text(charSplitter.countGraphemes($('#np-desc-textarea').text()));
			$('#np-desc-label').addClass("show");
			if (typeof quickAddFocusOut !== 'undefined') {
				clearTimeout(quickAddFocusOut);
				quickAddFocusOut = void 0;
			} else {
				stickyButtonsToggle("hide");
			}
			if ($(this).text().length == 0) $(this).empty();// clear any stray tags
		},
		'focusout': function() {
			$('#np-desc-label').removeClass("show");
			stickyButtonsToggle("show");
			changeNotepadDesc();
			if ($(this).text().length == 0) {
				$(this).empty();// clear any stray tags
				$(document).one("click", function() { $('#np-desc-textarea').empty(); });// IE fix
			}
		}
	});
	document.getElementById('np-desc-textarea').addEventListener("paste", function(e) {
		if (clipboardAccess) {
			e.preventDefault();
			navigator.clipboard.readText().then(function(clipText) {
				var clipboard = clipText;
				var originalDesc = document.getElementById('np-desc-textarea').textContent;
				var originalCount = charSplitter.countGraphemes(originalDesc);
				var pasteCount = charSplitter.countGraphemes(clipText);
				if ((originalCount + pasteCount) > npdescMaxChar) {
					var clipboardMax = npdescMaxChar - originalCount;
					clipboard = charSplitter.splitGraphemes(clipText).slice(0, clipboardMax).join('');
				}
				var selection = window.getSelection();
				if (!selection.rangeCount) return;
				selection.deleteFromDocument();
				selection.getRangeAt(0).insertNode(document.createTextNode(clipboard));
				selection.collapseToEnd();
			});
		}
	});
}

// return (and optionally append) the note DOM elements on a specified note
function fillNoteText(resultAction, thisId, thisNote) {
	var isCut = false;
	if (thisNote.length > truncateNote) {
		var cutPos = null;
		var nextSpace = thisNote.indexOf(" ", truncateNote);
		var nextLb = thisNote.indexOf("\n", truncateNote);
		if (nextSpace != -1) {
			if (nextLb != -1) {
				cutPos = Math.min(nextSpace, nextLb);
			} else {
				cutPos = nextSpace;
			}
		} else if (nextLb != -1) {
			cutPos = nextLb;
		}
		if ((cutPos != null) && ((cutPos/thisNote.length) < 0.90)) {
			var cutStr = '... <a href="#" class="nolink read-more" title="'+ locale.notepad.expand +'">'+ locale.notepad.expand.toLowerCase() +'</a>';
			isCut = true;
		}
	}
	var noteFull = thisNote.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	if (isCut == true) {
		var noteCut = thisNote.substr(0, cutPos).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + cutStr;
	} else {
		var noteCut = noteFull;
	}
	var noteContent = [
		'<span class="note-short">'+ noteCut +'</span>',
		'<span class="note-full">'+ noteFull +'</span>'
	].join("\n");
	if (resultAction== "append") $(thisId+' .note').empty().append(noteContent);
	return noteContent;
}

// build the notepad rows (notes)
function rowBuilder(thisLocalId, thisRemoteId, thisColor, thisChecked, thisNote) {
	var inputDomId = notePrefix + thisLocalId;
	var inputRemoteId = ((thisRemoteId == 0) || (thisRemoteId == "") || (thisRemoteId == null) || (typeof thisRemoteId === 'undefined')) ? "" : thisRemoteId;
	var colorHex = colors[thisColor]["hex"];
	var noteContent = fillNoteText("return", "#"+inputDomId, thisNote);
	var desktopTools = ($(window).width() < desktopWidth) ? false : true;
	var thisRow = [
		'<div id="'+ inputDomId +'" class="note-row" data-local-id="'+ thisLocalId +'" data-remote-id="'+ inputRemoteId +'" data-color="'+ thisColor +'" data-is-checked="'+ thisChecked +'">',
		'	<div class="col-1">',
		'		<button type="button" class="button circle move-up-button" aria-label="'+ locale.notepad.moveup +'" title="'+ locale.notepad.moveup +'"><i class="fa fa-arrow-up"></i></button>',
		'		<button type="button" class="button circle move-down-button" aria-label="'+ locale.notepad.movedown +'" title="'+ locale.notepad.movedown +'"><i class="fa fa-arrow-down"></i></button>',
		'	</div>',
		'	<div class="col-2">',
		'		<button type="button" class="button circle expand-button" aria-label="'+ locale.notepad.options +'" title="'+ locale.notepad.options +'"><i class="fa fa-ellipsis-h"></i></button>',
		... desktopTools ? ['		<div class="note-tool-btns">'] : [],
		... desktopTools ? ['			<button type="button" class="button circle sort-button" aria-label="'+ locale.notepad.reorder +'" title="'+ locale.notepad.reorder +'"><i class="fa fa-arrows"></i></button>'] : [],
		... desktopTools ? ['			<button type="button" class="button circle delete-button" aria-label="'+ locale.general.delete +'" title="'+ locale.general.delete +'"><i class="fa fa-trash"></i></button>'] : [],
		... desktopTools ? ['			<button type="button" class="button circle edit-button" aria-label="'+ locale.notepad.edit +'" title="'+ locale.notepad.edit +'"><i class="fa fa-pencil"></i></button>'] : [],
		... desktopTools ? ['			<div class="spectrum" title="'+ locale.notepad.change_color +'"><input type="text" class="color-selector" value="#'+ colorHex +'"/></div>'] : [],
		... desktopTools ? ['		</div>'] : [],
		'	</div>',
		'	<div class="col-3">',
		'		<button type="button" class="button empty black checkbox" aria-label="'+ locale.notepad.check +'" title="'+ locale.notepad.check +'"><i class="fa fa-checkbox"></i></button>',
		'	</div>',
		'	<div class="col-4">',
		'		<div class="note break-word">'+ noteContent +'</div>',
		'	</div>',
		... clipboardAccess ? ['	<button class="copy-button" aria-label="'+ locale.notepad.note_copy +'" title="'+ locale.notepad.note_copy +'"><i class="fa fa-copy"></i></button>'] : [],
		'</div>'
	].join("\n");
	return thisRow;
}

// fully display a truncated note
function readMore(domID) {
	$(domID).find('.note-short').addClass('hidden');
	$(domID).find('.note-full').addClass('display');
}

// initialize Spectrum color picker
function spectrumInit(whichtarget) {
	if (whichtarget == "all") {
		var spectrumTarget = $('#notepad-body .color-selector');
	} else {
		var spectrumTarget = $(whichtarget+' .color-selector');
	}
	spectrumTarget.spectrum({
		showPaletteOnly: true,
		showSelectionPalette: false,
		hideAfterPaletteSelect: true,
		preferredFormat: 'hex',
		change: function(color) {
			var domID = '#' + $(this).parents('.note-row').attr('id');
			changeColor(domID, color.toHexString());
		},
		palette: [
			[colors[0]['hex'], colors[1]['hex'], colors[2]['hex']],
			[colors[3]['hex'], colors[4]['hex'], colors[5]['hex']],
			[colors[6]['hex'], colors[7]['hex'], colors[8]['hex']]
		]
	});
	$('.sp-container .sp-picker-container').remove();// extra, possibly useless, DOM elements
}

// Linkify URLs in notes
function linkifyInit(whichtarget) {
	if (whichtarget == "all") {
		var linkifyTarget = $('#notepad-body');
	} else {
		var linkifyTarget = $('#notepad-body '+whichtarget);
	}
	linkifyTarget.linkify({
		tagName: 'a',
		target: '_blank'
	});
	linkifyTarget.find('a').attr('rel', 'noopener noreferrer');
}

// set the state of the check all button
function setCheckAllState() {
	var noteAttrTotal = 0;
	$('#notepad-body > div').each(function(index) {
		noteAttrTotal += Number($(this).attr('data-is-checked'));
	});
	if (noteAttrTotal == 0) {
		$('#notepad-header .checkbox').attr('data-check-state', 0);
	} else if (noteAttrTotal == $('#notepad-body > div').length) {
		$('#notepad-header .checkbox').attr('data-check-state', 1);
	} else {
		$('#notepad-header .checkbox').attr('data-check-state', 2);
	}
}

// build the note tools overlay
function toolsToggle(domID) {
	var thisnote = $(domID).find('.col-4');
	var thisbtn = $(domID).find('.expand-button i');
	if ($(domID + ' .col-4 .note-tool-btns').length) {
		$(domID + ' .col-4 .note-tool-btns .color-selector').spectrum("destroy");
		$(domID + ' .col-4 .note-tool-btns').remove();
	}
	if (!thisnote.hasClass('tools-disp')) {// if currently off
		var colorHex = colors[Number($(domID).attr('data-color'))]["hex"];
		var toolsContent = [
			'<div class="note-tool-btns">',
			'	<div class="spectrum" title="'+ locale.notepad.change_color +'"><input type="text" class="color-selector" value="#'+ colorHex +'"/></div>',
			'	<button type="button" class="button circle edit-button" aria-label="'+ locale.notepad.edit +'" title="'+ locale.notepad.edit +'"><i class="fa fa-pencil"></i></button>',
			'	<button type="button" class="button circle delete-button" aria-label="'+ locale.general.delete +'" title="'+ locale.general.delete +'"><i class="fa fa-trash"></i></button>',
			'</div>'
		].join("\n");
		thisnote.prepend(toolsContent);
		spectrumInit(domID + ' .col-4');
	}
	thisnote.toggleClass('tools-disp');
	thisbtn.toggleClass('fa-ellipsis-h');
	thisbtn.toggleClass('fa-ellipsis-v');
}

// remove all tool overlays
function removeAllToolOverlays() {
	$('#notepad-body').find('.tools-disp').removeClass('tools-disp');
	$('#notepad-body').find('.expand-button i').removeClass();
	$('#notepad-body').find('.expand-button i').addClass('fa fa-ellipsis-h');
	$('#notepad-body .col-4 .color-selector').spectrum("destroy");
}

// toggle the display of the notepad sticky buttons
function stickyButtonsToggle(showOrHide) {
	switch (showOrHide) {
		case "show":
			if (!$('#sticky-buttons').hasClass('display')) $('#sticky-buttons').addClass('display');
			break;
		case "hide":
			if ($('#sticky-buttons').hasClass('display')) $('#sticky-buttons').removeClass('display');
			break;
	}
}

// toggle the display of the notepad expanded sticky buttons
function stickyExpandToggle() {
	if (!$('#sticky-buttons-expand').hasClass('display')) {
		anime({
			targets: '#sticky-toggle .fa-ellipsis-v',
			rotate: { value: 90, duration: speed, easing: 'easeInOutSine' }
		});
		$('#sticky-buttons-expand').addClass('display');
		$('#sticky-top').css('scale', 0);
		$('#sticky-sort').css('scale', 0);
		$('#sticky-refresh').css('scale', 0);
		anime({
			targets: '#sticky-top',
			scale: { value: 1, duration: speed, easing: 'easeInOutSine' }
		});
		anime({
			targets: '#sticky-sort',
			scale: { value: 1, duration: speed, delay: 100, easing: 'easeInOutSine' }
		});
		anime({
			targets: '#sticky-refresh',
			scale: { value: 1, duration: speed, delay: 200, easing: 'easeInOutSine' }
		});
	} else if ($('#sticky-buttons-expand').hasClass('display')) {
		anime({
			targets: '#sticky-toggle .fa-ellipsis-v',
			rotate: { value: 0, duration: speed, easing: 'easeInOutSine' }
		});
		anime({
			targets: '#sticky-buttons-expand button',
			scale: { value: 0, duration: speed, easing: 'easeInOutSine' },
			complete: function(anim) {
				$('#sticky-buttons-expand').removeClass('display');
			}
		});
	}
}

// make the notepad sticky expanded buttons available or not based on document scroll position
// show it if the document y scroll position > 500px
function dispStickyExpand() {
	if ($(document).scrollTop() > 500) {
		if (!$('#sticky-buttons-expand-group').hasClass('display')) {
			$('#sticky-toggle').css('display', 'inline');
			$('#sticky-buttons-expand-group').addClass('display');
		}
	} else {
		if ($('#sticky-buttons-expand-group').hasClass('display')) {
			$('#sticky-buttons-expand-group').removeClass('display');
			setTimeout(function() { $('#sticky-toggle').css('display', ''); }, 400);
			if ($('#sticky-buttons-expand').hasClass('display')) stickyExpandToggle();
		}
	}
}

// display video modal
function videoModal() {
	var modalContent = [
		'<i id="modal-close" class="fa fa-times" title="'+ locale.general.close +'" onclick="modalToggle(\'off\');"></i>',
		'<div class="row video-row">',
		'	<div class="video-wrap">',
		'		<div class="video-container">',
		'			<iframe src="https://www.youtube.com/embed/rGf_xXftWbA?autoplay=1&rel=0" frameborder="0" allowfullscreen></iframe>',
		'		</div>',
		'	</div>',
		'</div>'
	].join("\n");
	$('#modal-window').empty().append(modalContent);
	modalToggle("on");
}


//** HELPER FUNCTIONS **//

// expand shorthand hex form (e.g. "03F") to full form (e.g. "0033FF"), by Igor Grinchesku: https://gist.github.com/Arahnoid/9923989
function hexReturnFull(hex) {
	var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
	return hex.replace(shorthandRegex, function(m, r, g, b) {
		return "#" + r + r + g + g + b + b;
	});
}

// convert RGB to hex, by Erick Petrucelli: http://stackoverflow.com/questions/1740700/how-to-get-hex-color-value-rather-than-rgb-value
function rgb2hex(rgb) {
	if (/^#[0-9A-F]{6}$/i.test(rgb)) return rgb;
	rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
	function hex(x) {
		return ("0" + parseInt(x).toString(16)).slice(-2);
	}
	return "#" + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3]);
}

function getUnixTimestamp() {
	var clientDate = new Date();
	var secondsUnix = Math.floor(clientDate.getTime()/1000);// number of seconds since Unix epoch
	return secondsUnix;
}

function getUnixTimestampMS() {
	var clientDate = new Date();
	var msUnix = clientDate.getTime();// number of milliseconds since Unix epoch
	return msUnix;
}


//** ON DOCUMENT READY, START THE APPLICATION **//

$(document).ready(function() {
	// now that we have the current offline state, potentially toggle it based on internet connectivity
	if (internetConn) {
		console.log('Internet connection detected.');
		if (offlineState == 1) setOfflineState("system", 0);
	} else {
		console.log('Internet connection not detected. Turning on Offline Mode.');
		setOfflineState("system", 1);
		recheckInternet(15, 12);
	}
	$('body').attr('data-internet', (internetConn) ? 1 : 0);
	// now that we've determined whether we're in dark mode or not, set it as a body tag attribute
	$('body').attr('data-dark-mode', (darkMode) ? 1 : 0);
	// pull color palette from anonynote.css
	var root = document.querySelector(':root');
	var rootStyles = getComputedStyle(root);
	var d = (darkMode) ? 'dark-' : '';
	var colorWhite = hexReturnFull(rootStyles.getPropertyValue('--'+d+'white-color'));
	var colorGray = hexReturnFull(rootStyles.getPropertyValue('--'+d+'gray-color'));
	var colorYellow = hexReturnFull(rootStyles.getPropertyValue('--'+d+'yellow-color'));
	var colorGreen = hexReturnFull(rootStyles.getPropertyValue('--'+d+'green-color'));
	var colorCyan = hexReturnFull(rootStyles.getPropertyValue('--'+d+'cyan-color'));
	var colorBlue = hexReturnFull(rootStyles.getPropertyValue('--'+d+'blue-color'));
	var colorPurple = hexReturnFull(rootStyles.getPropertyValue('--'+d+'purple-color'));
	var colorRed = hexReturnFull(rootStyles.getPropertyValue('--'+d+'red-color'));
	var colorOrange = hexReturnFull(rootStyles.getPropertyValue('--'+d+'orange-color'));
	// populate color arrays
	colors[0] = { "name" : "White", "hex" : colorWhite };
	colors[1] = { "name" : "Gray", "hex" : colorGray };
	colors[2] = { "name" : "Yellow", "hex" : colorYellow };
	colors[3] = { "name" : "Green", "hex" : colorGreen };
	colors[4] = { "name" : "Cyan", "hex" : colorCyan };
	colors[5] = { "name" : "Blue", "hex" : colorBlue };
	colors[6] = { "name" : "Purple", "hex" : colorPurple };
	colors[7] = { "name" : "Red", "hex" : colorRed };
	colors[8] = { "name" : "Orange", "hex" : colorOrange };
	for (var c = 0; c < colors.length; c++) {
		colorHexToId[colors[c]["hex"]] = c;
	}
	// add styles that utilize JSON data
	var styleEl = document.createElement('style'), jsSheet;
	document.head.appendChild(styleEl);
	jsSheet = styleEl.sheet;
	jsSheet.insertRule('.sp-container.sp-clear-enabled .sp-palette-container:before { content: "'+ locale.notepad.change_colors +'"; }');
	// prevent all form submits from reloading the page
	$(document).on("submit", 'form', function(e) {
		e.preventDefault();
	});
	// declare modal window click actions
	$('#modal').on("click", function(e) {
		if (!modalForce) modalToggle("off");
	});
	$('#modal-window').on("click", function(e) {
		e.stopPropagation();
	});
	// add listener to home page input
	$('#notepad-input').on({
		'input': function() {
			if ($(this).val() == "") {
				if (!$('#find-notepad-button').hasClass('disabled')) $('#find-notepad-button').addClass('disabled');
			} else {
				if ($('#find-notepad-button').hasClass('disabled')) $('#find-notepad-button').removeClass('disabled');
				if (charSplitter.countGraphemes($(this).val()) >= npnameMaxChar) { $(this).val(charSplitter.splitGraphemes($(this).val()).slice(0, npnameMaxChar).join('')); }
			}
		},
		'keyup': function(e) {
			if ((e.keyCode == 13) && (!$('#find-notepad-button').hasClass('disabled'))) {
				$(':focus').blur();
				$('#find-notepad-button').click();
			}
		}
	});
	// set the web app mode status as a body tag attribute; if web app, add listener
	$('body').attr('data-web-app', (isInWebApp) ? 1 : 0);
	if (isInWebApp) {
		$('#recent-notepads-button').on({
			'touchstart': function() {
				touchStatus = 'touchstart';
			},
			'touchmove': function() {
				touchStatus = 'touchmove';
			},
			'click touchend': function(event) {
				if ((event.type == 'click') || ((event.type == 'touchend') && (touchStatus == 'touchstart'))) {
					$(this).toggleClass('active');
					if ($('#recent-notepads').css('max-height') != '0px') {
						$('#recent-notepads').css('max-height', '0px');
					} else {
						$('#recent-notepads').css('max-height', $('#recent-notepads').prop('scrollHeight'));
					}
				}
				if (event.type == 'touchend') touchStatus = void 0;
			}
		});
	}
	// IndexedDB snapshot includes scroll position. Keep that updated on scroll.
	$(window).scroll($.debounce(500, false, function() { idbSnapshotUpdate("pos"); }));
	// run dispStickyExpand() now and also on screen scroll and resize
	dispStickyExpand();
	$(window).scroll($.throttle(500, false, dispStickyExpand));
	$(window).resize($.debounce(500, false, dispStickyExpand));
	// if the browser window resizes from mobile to desktop size or vice versa, build/destroy buttons accordingly
	var winWidth = $(window).width();
	$(window).resize($.throttle(500, false, function() {
		if ($('#notepad').hasClass("active-loc") && $('#notepad-table').length) {
			if ((winWidth >= desktopWidth) && ($(window).width() < desktopWidth)) {// desktop --> mobile
				$('#notepad-body .col-2 .note-tool-btns .color-selector').spectrum("destroy");
				$('#notepad-body .col-2 .note-tool-btns').remove();
			} else if ((winWidth < desktopWidth) && ($(window).width() >= desktopWidth)) {// mobile --> desktop
				buildNotepad("refresh");// refresh the notepad so's to re-run row builder and re-create those missing tools buttons
			}
		}
		winWidth = $(window).width();	
	}));
	// populate sticky button content
	var stickyButtonContent = [
		'<div id="sticky-buttons-expand-group">',
		'	<div id="sticky-buttons-expand">',
		'		<button id="sticky-refresh" type="button" class="button transparent" aria-label="'+ locale.notepad.refresh +'" title="'+ locale.notepad.refresh +'" onclick="buildNotepad(\'refresh\');">',
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-repeat fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		'		<button id="sticky-sort" type="button" class="button transparent" aria-label="'+ locale.notepad.sort +'" title="'+ locale.notepad.sort +'" onclick="sortModal();">',
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-sort fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		'		<button id="sticky-top" type="button" class="button transparent" aria-label="'+ locale.notepad.go_to_top +'" title="'+ locale.notepad.go_to_top +'">',
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-arrow-up fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		'	</div>',
		'	<button id="sticky-toggle" type="button" class="button transparent" aria-label="'+ locale.notepad.sticky_toggle +'" title="'+ locale.notepad.sticky_toggle +'" onclick="stickyExpandToggle();">',
		'		<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-ellipsis-v fa-stack-1x fa-inverse"></i></span>',
		'	</button>',
		'</div>',
		'<button id="sticky-add" type="button" class="button transparent" aria-label="'+ locale.notepad.add_new +'" title="'+ locale.notepad.add_new +'" onclick="buildEdit();">',
		'	<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-plus fa-stack-1x fa-inverse"></i></span>',
		'</button>'
	].join("\n");
	$('#sticky-buttons').empty().append(stickyButtonContent);
	$('#sticky-top').on("click", function() {
		$('html, body').animate({
			scrollTop: 0
		}, 800);
		return false;
	});
	// define the onclick actions for all the buttons on the notes
	// these events are binded to document; they are not binded to any particular note and hence do not need to be called again
	$(document).on("click", '.note-row .move-up-button', function() {
		moveUp('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .move-down-button', function() {
		moveDown('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .expand-button', function() {
		toolsToggle('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .delete-button', function() {
		deleteNote('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .edit-button', function() {
		buildEdit('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .checkbox', function() {
		checkBox('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .read-more', function() {
		readMore('#'+$(this).closest('.note-row').attr('id'));
	});
	$(document).on("click", '.note-row .copy-button', function(e) {
		if (clipboardAccess) {
			var thisId = $(this).closest('.note-row').attr('id');
			window.clipboardButton = "#" + thisId + " .copy-button";
			window.clipboardTarget = "#" + thisId + " .note-full";
			navigator.clipboard.writeText(document.querySelector(window.clipboardTarget).textContent);
			$(this).addClass('tooltipped tooltipped-w');
			$(this).attr('aria-label', locale.notepad.note_copy_success);
			window.setTimeout(function() {
				$(window.clipboardButton).removeClass('tooltipped tooltipped-w');
				$(window.clipboardButton).removeAttr('aria-label');
			}, 1000);
		}
	});
	// listen for browser back and forward buttons
	$(window).on("popstate", function(event) {
		if ($('#splash').is(":visible")) splashHandler("clear");// the back button on Chrome for Android is doing strange things, like putting the splash screen back up and not clearing it
		var state = event.originalEvent.state;
		if (state) {
			switch (state.loc) {
				case "notepad":
					notepadIdLocal = state.npidLocal;
					catalog[notepadIdLocal]["lastOpen"] = getUnixTimestamp();
					idbCatalogUpdate();
					buildNotepad("jump");
					break;
				case "home":
					notepadIdLocal = void 0;
					buildHome("jump");
					break;
			}
		}
	});
	// build a list of recently opened notepads
	buildRecentNotepads();
	// execute launch state
	if (appLoc == "notepad") {
		if (typeof npScroll !== 'undefined') {
			buildNotepad("start", npScroll);
		} else {
			buildNotepad("start");
		}
	} else {
		buildHome("start");
		if (npLaunchFail) popupMsg(locale.popup.find_notepad_launch_fail, "red");
	}
});