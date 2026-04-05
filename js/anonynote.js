//** CONSTANTS & CONFIGURATION **//

let _appReady; const _appReadyPromise = new Promise(function(resolve) { _appReady = resolve; });// hold document ready
let holdReleaseCurrent = 0;// number; 0 to start, then increment upward until we hit holdReleaseTarget
const holdReleaseTarget = 6;// how many checks are needed before we release the hold on document ready. 1) Check internet connection, 2) Google Fonts loaded, 3) CSS loaded, 4) Locale loaded, 5) Core app variables set, 6) IndexedDB initialized

const speed = 400;// milliseconds; transition speed
const timeoutInternet = 5000;// milliseconds; how long to wait before bailing on an internet connection check
const timeoutPopup = 5000;// milliseconds; how long to wait before auto-dismissing the bottom screen popup
const timeoutApi = 7500;// milliseconds; how long to wait before bailing on an API call
const funcThrottle = 3000;// milliseconds; certain functions are throttled so as to not rapid-fire, but will trigger after no more than the provided number of milliseconds
const charSplitter = new Intl.Segmenter();// used for accurate character counting, correctly handling emojis and multi-byte characters
const desktopWidth = 768;// number; the pixel width at which desktop screen size begins
const noteColorCount = 9;// number; total colors in the color palette
const npnameMaxChar = 16;// number; notepad name character limit, also applies to lock password limit -- also defined in global.php
const npdescMaxChar = 160;// number; notepad description character limit, also defined in global.php
const truncateNote = 150;// number; note characters to show before hiding the rest behind a 'read more' link (on mobile only)
const notePrefix = "note-";// string; prefix for note ids

const isInWebApp = ((window.navigator.standalone == true) || (window.matchMedia('(display-mode: standalone)').matches)) ? true : false;// boolean; whether we're operating from within an iOS or Android web app environment
const clipboardAccess = (typeof navigator.clipboard === 'undefined') ? false : true;// boolean; whether there is access to the clipboard
const themeRegistry = [
	{ id: 0, key: 'light'         },
	{ id: 1, key: 'dark'          },
	{ id: 2, key: 'desert_sunset' }
];// ordered list of available themes; id matches data-theme attribute and localStorage value; key maps to locale.themes[key]

//** STATE VARIABLES **//

// variables stored in and retrieved from IndexedDB object stores
const idbDB = "anonynote";// the IDB database name
let idbVersion;// holds the current database version number
let notepadIdLocal;// number; if in notepad location, holds that notepad local ID
let offlineState = 0;// 0 = offline mode off (default); 1 = offline mode on; 2 = offline mode on by user choice; 3 = unavailable (no IDB support)
let localPadCounter = 0;// local notepad counter; default to 0, unless later pulled from an IndexedDB stored value
let localNoteCounter = 0;// local note counter; default to 0, unless later pulled from an IndexedDB stored value
let _storedLang = localStorage.getItem('_language');
let langCode = (_storedLang && (typeof availableLangs !== 'undefined') && (_storedLang in availableLangs)) ? _storedLang : 'en-US';// current language code
let globalSync = true;// boolean; set to false if anything at all is out-of-sync between IndexedDB and MySQL
const _storedTheme = localStorage.getItem('_theme');
let currentTheme;
if (_storedTheme !== null && themeRegistry[parseInt(_storedTheme)] !== undefined) {
	currentTheme = parseInt(_storedTheme);
} else {
	currentTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 1 : 0;
	localStorage.setItem('_theme', String(currentTheme));
}// number; current theme ID — 0 = light (OS default), 1 = dark (OS default), 2+ = user selection only
let catalog = {};// object; holds information on every notepad opened on this device
let notepads = {};// object; holds all the notes for all the notepads opened on this device

// declare IndexedDB snapshot object store variables; temp variables to use or discard depending on conditions
let snapshotLoc, snapshotNotepadIdLocal, snapshotScroll;

let locale;// holds all the language for the app
let npScroll;// holds notepad scroll position for notepad <--> edit movement
let editDomId;// holds the domID of the note currently open in the edit screen
let modalScroll;// holds notepad scroll position when toggling the modal window
let modalForce = false;// boolean; set to true to prevent escaping and clicking to turn off the modal window
let touchStatus, touchTime, touchCoorStart, touchCoorMove, touchId;// variables that hold data on the most recent touch event
let statusQueue = 0;// number; increments up and down for actions triggering the status icon
let statusComplete = 1;// boolean (1 or 0); indicates whether the statusQueue is clear or not

let npLaunchFail;// boolean; set to true if there was a failed attempt to launch directly to a notepad page
let appLoc = "home";// holds the current application location (home, notepad, or edit); "home" by default
let appLaunched = false;// boolean; set to true when the application is finished prepping and actually running
let actionQueue = [];// array; for temporary storage, used in the delay and execution of IDB puts
let quickAddFocusOut = void 0;// holds a timer from the setTimeout() function
let _renameSaving = false;// boolean; guard to prevent concurrent rename save calls (focusout + Enter can both trigger save)
let notepadSortable = null;// holds the SortableJS instance for the notepad

let idbSupport;// boolean; holds whether there is IDB support
let deferredPrompt = null;// holds the beforeinstallprompt event for the PWA install prompt

let networkConn, internetConn;
networkConn = internetConn = (navigator.onLine) ? true : false;// boolean; whether network and internet connections are detected. assume their statuses are the same unless proven otherwise

const urlParams = {};// object; holds all URL parameters
window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, val) {
	urlParams[key] = val;
});

window.addEventListener('beforeinstallprompt', function(e) {
	e.preventDefault();
	deferredPrompt = e;
});
window.addEventListener('appinstalled', function() {
	deferredPrompt = null;
});

//** UTILITIES **//

// throttle: execute fn at most once per delay ms (trailing)
function throttle(fn, delay) {
	let timer;
	return function() {
		if (!timer) {
			let ctx = this, args = arguments;
			timer = setTimeout(function() { timer = null; fn.apply(ctx, args); }, delay);
		}
	};
}

// debounce: execute fn after delay ms of inactivity
function debounce(fn, delay) {
	let timer;
	return function() {
		let ctx = this, args = arguments;
		clearTimeout(timer);
		timer = setTimeout(function() { fn.apply(ctx, args); }, delay);
	};
}

function getUnixTimestamp() {
	let clientDate = new Date();
	let secondsUnix = Math.floor(clientDate.getTime()/1000);// number of seconds since Unix epoch
	return secondsUnix;
}

function getUnixTimestampMS() {
	let clientDate = new Date();
	let msUnix = clientDate.getTime();// number of milliseconds since Unix epoch
	return msUnix;
}

//** NETWORK **//

function apiFetch(opts) {
	let method = (opts.type || "GET").toUpperCase();
	let url = opts.url;
	let dataType = opts.dataType || "json";
	let timeout = opts.timeout || timeoutApi;
	let controller = new AbortController();
	let timeoutId = setTimeout(function() { controller.abort(); }, timeout);
	let fetchOpts = { method: method, signal: controller.signal, headers: { "X-Requested-With": "XMLHttpRequest" } };
	if (method === "POST") {
		fetchOpts.headers["Content-Type"] = "application/json";
		if (opts.data) fetchOpts.body = (typeof opts.data === "string") ? opts.data : JSON.stringify(opts.data);
	} else if (opts.data && typeof opts.data === "object") {
		url += `?${new URLSearchParams(opts.data).toString()}`;
	}
	if (opts.beforeSend) opts.beforeSend();
	fetch(url, fetchOpts)
		.then(function(response) {
			clearTimeout(timeoutId);
			if (!response.ok) throw { status: response.status, type: "error" };
			return (dataType === "text") ? response.text() : response.json();
		})
		.then(function(data) {
			if (opts.success) opts.success(data);
			if (opts.complete) opts.complete();
		})
		.catch(function(err) {
			clearTimeout(timeoutId);
			// Re-throw JS runtime errors so they surface in the console as unhandled rejections.
			// Only plain network errors ({status, type}), AbortError, and TypeError (offline/CORS) belong here.
			if (err instanceof Error && err.name !== "AbortError" && !(err instanceof TypeError)) throw err;
			let isTimeout = (err && err.name === "AbortError");
			let status = isTimeout ? "timeout" : "error";
			let xhr = { status: isTimeout ? 0 : (err.status || 0) };
			if (opts.error) {
				opts.error(xhr, status, "");
			} else {
				userControl("open");
				statusIndicator("error");
				if (appLaunched == false) {
					if (appLoc == "notepad") {
						let _np = document.getElementById('notepad');
						_np.innerHTML = '';
						_np.removeAttribute('style');
						_np.classList.remove('active-loc');
						let _home = document.getElementById('home');
						_home.removeAttribute('style');
						_home.classList.add('active-loc');
						updateState("home", "replace");
						popupMsg(locale.popup.notepad_launch_timeout, "red");
					}
					document.getElementById('notepad-input').focus();
					splashHandler("clear");
				} else if (status == "timeout") {
					if (offlineState == 3) {
						errorModal("timeout");
					} else {
						internetConn = false;
						document.body.setAttribute('data-internet', 0);
						setOfflineState("system", 1);
						recheckInternet(15, 8);
					}
				} else {
					errorModal(xhr.status);
				}
			}
			if (opts.complete) opts.complete();
		});
}

// re-check for an internet connection at an interval
function recheckInternet(maxTimes, intervalSeconds) {
	if ((internetConn) || (!networkConn)) return;// conditions for early bailing
	clearTimeout(window.internetCheckFirst);
	clearInterval(window.internetCheck);
	let internetCheckCount = 0;
	function checkIsConnected() {
		apiFetch({
			type: "GET",
			dataType: "text",
			timeout: timeoutInternet,
			url: "/api/is-connected",
			success: function() {
				internetConn = true;
				document.body.setAttribute('data-internet', 1);
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
	apiFetch({
		type: "GET",
		url: `/locales/${langCode}.json?v=${appVer}`,
		dataType: "json",
		success: function(data) {
			locale = data;
			holdRelease();
		},
		error: function() {
			splashHandler("doa");// an app without language is unusable
		}
	});
}

// trigger on changes to network connection status
function updateOnlineStatus(event) {
	console.log(`Network connection status change: ${event.type}.`);
	networkConn = navigator.onLine ? true : false;
	if (!networkConn) {// if the network connection has been lost
		internetConn = false;
		document.body.setAttribute('data-internet', 0);
		setOfflineState("system", 1);
		if (!idbSupport) splashHandler("doa");// without either IndexedDB or a network connection, this app can't run
	} else {// if the network connection has been re-established
		apiFetch({
			type: "GET",
			dataType: "text",
			timeout: timeoutInternet,
			url: "/api/is-connected",
			success: function() {
				internetConn = true;
				document.body.setAttribute('data-internet', 1);
				setOfflineState("system", 0);
			},
			error: function(xhr, status, errorThrown) {
				internetConn = false;
				document.body.setAttribute('data-internet', 0);
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
		document.body.setAttribute('data-offline-mode', offlineState);
		idbSnapshotUpdate("conn");
		return offlineState;
	}
	if (offlineState == 3) return null;// this variable can never be other than "3" in the absence of IDB support; bail
	let originalState = offlineState;
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
		document.body.setAttribute('data-offline-mode', offlineState);
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

//** INDEXEDDB **//

// either build the core IDB object stores on first use, or retrieve the stored values, or determine IDB is unsupported
// then call holdRelease() to proceed with releasing the hold on document ready
function idbInit() {
	let os = 'snapshot';
	let dbCheckPromise = idb.openDB(idbDB);
	dbCheckPromise.catch(function() {
		// IndexedDB is supported but not accessible, probably as a result of private browsing mode.
		// Effectively, it's unsupported. Flag it as such. Proceed with application.
		if (!internetConn) {
			splashHandler("doa");// without either IndexedDB or an internet connection, this app can't run
		} else {
			idbSupport = false;
			document.body.setAttribute('data-idb-support', 0);
			setOfflineState("system", 3);// without IDB support, offline mode is unavailable
			loadLocale();// document hold release #4: load the default language code locale
			prepLaunchState();// document hold release #5: set core app variables
			holdRelease();// document hold release #6: no IDB to initialize, so skip it
		}
	});
	dbCheckPromise.then(function(db) {
		idbSupport = true;
		document.body.setAttribute('data-idb-support', 1);
		idbVersion = db.version;
		db.close();
		if (idbVersion == 1) {
			// V1 means application is running for the first time. Proceed to the build function where we upgrade to V2 and create core object stores.
			document.body.setAttribute('data-offline-mode', offlineState);
			loadLocale();// document hold release #4: load the default language code locale
			prepLaunchState();// document hold release #5: set core app variables
			idbBuild();
		} else {
			// any other version, pull stored variables
			idbGetAll(os).then(function(snapshotArray) {
				for (let s=0; s<snapshotArray.length; s++) {
					if (snapshotArray[s]["entry"] == "conn") offlineState = snapshotArray[s]["offline"];
					if (snapshotArray[s]["entry"] == "sync") globalSync = Boolean(snapshotArray[s]["synced"]);
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
				document.body.setAttribute('data-offline-mode', offlineState);
				loadLocale();// document hold release #4: load the stored language code locale
				idbGetAll('catalog').then(function(catalogArray) {
					if (catalogArray.length == 0) {
						prepLaunchState();// document hold release #5: set core app variables
						holdRelease();// document hold release #6: completed IDB initialization
					} else {
						for (let c=0; c<catalogArray.length; c++) {
							catalog[catalogArray[c]["npidLocal"]] = {
								'npname': catalogArray[c]["npname"],
								'nphash': catalogArray[c]["nphash"],
								'npdesc': catalogArray[c]["npdesc"],
								'lastEdit': catalogArray[c]["lastEdit"],
								'lastOpen': catalogArray[c]["lastOpen"],
								'synced': catalogArray[c]["synced"]
							}
						}
						let cycles = 0;
						Object.keys(catalog).forEach(function(key) { let value = catalog[key];
							idbGetAll(key).then(function(notesArray) {
								cycles++;
								notepads[key] = {};
								for (let n=0; n<notesArray.length; n++) {
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
		let dbPromise = idb.openDB(idbDB, idbVersion, { upgrade: function(db) {
			let snapshotOS = db.createObjectStore(os, {keyPath: 'entry'});
			snapshotOS.createIndex('loc', 'loc', {unique: false});
			snapshotOS.createIndex('npidLocal', 'npidLocal', {unique: true});
			snapshotOS.createIndex('scrollPos', 'scrollPos', {unique: false});
			snapshotOS.createIndex('offline', 'offline', {unique: false});
			snapshotOS.createIndex('padCount', 'padCount', {unique: false});
			snapshotOS.createIndex('noteCount', 'noteCount', {unique: false});
			snapshotOS.createIndex('synced', 'synced', {unique: false});
			let catalogOS = db.createObjectStore('catalog', {keyPath: 'npidLocal'});
			catalogOS.createIndex('npname', 'npname', {unique: false});
			catalogOS.createIndex('nphash', 'nphash', {unique: false});
			catalogOS.createIndex('npdesc', 'npdesc', {unique: false});
			catalogOS.createIndex('lastEdit', 'lastEdit', {unique: false});
			catalogOS.createIndex('lastOpen', 'lastOpen', {unique: false});
			catalogOS.createIndex('synced', 'synced', {unique: false});
		}});
		dbPromise.then(function(db) {
			let tx = db.transaction(os, 'readwrite');
			let store = tx.objectStore(os);
			let itemConn = { entry: "conn", offline: offlineState };
			let itemCount = { entry: "count", padCount: localPadCounter, noteCount: localNoteCounter };
			let itemSync = { entry: "sync", synced: (globalSync) ? 1 : 0 };
			store.put(itemConn);
			store.put(itemCount);
			store.put(itemSync);
			db.close();
			return tx.done;
		}).then(function() {
			console.log('First time visit. Core application object stores defined.');
			holdRelease();// document hold release #6: completed IDB initialization
		});
	}
}

// get all values from the specified object store; returns Promise
function idbGetAll(os) {
	if (!idbSupport) return;
	let dbPromise = idb.openDB(idbDB);
	return dbPromise.then(function(db) {
		let tx = db.transaction(os, 'readonly');
		let store = tx.objectStore(os);
		let val = store.getAll();
		db.close();
		return val;
	});
}

// update the IndexedDB snapshot object store
function idbSnapshotUpdate(whichEntry) {
	if (!idbSupport) return;
	const os = 'snapshot';
	let item, verbiage;
	switch (whichEntry) {
		case "pos":   item = { entry: "pos",   loc: appLoc, npidLocal: notepadIdLocal, scrollPos: window.scrollY }; verbiage = "position";      break;
		case "count": item = { entry: "count", padCount: localPadCounter, noteCount: localNoteCounter };            verbiage = "counters";      break;
		case "conn":  item = { entry: "conn",  offline: offlineState };                                             verbiage = "offline state"; break;
		case "sync":  item = { entry: "sync",  synced: (globalSync) ? 1 : 0 };                                      verbiage = "data sync";     break;
		default: return;
	}
	let dbPromise = idb.openDB(idbDB);
	return dbPromise.then(function(db) {
		let tx = db.transaction(os, 'readwrite');
		let store = tx.objectStore(os);
		store.put(item);
		db.close();
		return tx.done;
	}).then(function() {
		console.log(`Snapshot ${verbiage} updated:`, item);
		return item;
	});
}

// commit the current notepad hash, name, description, last edit timestamp, and sync status to the IndexedDB catalog object store
function idbCatalogUpdate() {
	if (!idbSupport) return;
	let os = 'catalog';
	let item = {
		npidLocal: notepadIdLocal,
		npname: catalog[notepadIdLocal]["npname"],
		nphash: catalog[notepadIdLocal]["nphash"],
		npdesc: catalog[notepadIdLocal]["npdesc"],
		lastEdit: catalog[notepadIdLocal]["lastEdit"],
		lastOpen: catalog[notepadIdLocal]["lastOpen"],
		synced: catalog[notepadIdLocal]["synced"]
	};
	let dbPromise = idb.openDB(idbDB);
	return dbPromise.then(function(db) {
		let tx = db.transaction(os, 'readwrite');
		let store = tx.objectStore(os);
		store.put(item);
		db.close();
		return tx.done;
	}).then(function() {
		console.log('Notepad details updated to catalog object store:', item);
		return item;
	});
}

// update one or all notes in the current IndexedDB notepad object store
function idbNoteUpdate(whichTar) {
	if (!idbSupport) return;
	let os = notepadIdLocal;
	let thisTarget, items, item;
	if (whichTar == "all") {
		items = [];
		for (let n in notepads[os]) {
			thisTarget = { "idLocal": Number(n) };
			items.push(Object.assign({}, thisTarget, notepads[os][n]));
		}
	} else {
		thisTarget = { "idLocal": whichTar };
		item = Object.assign({}, thisTarget, notepads[os][whichTar]);
	}
	let dbPromise = idb.openDB(idbDB);
	return dbPromise.then(function(db) {
		let tx = db.transaction(os, 'readwrite');
		let store = tx.objectStore(os);
		if (whichTar == "all") {
			items.forEach(function(item) { store.put(item); });
		} else {
			store.put(item);
		}
		db.close();
		return tx.done;
	}).then(function() {
		if (whichTar == "all") {
			console.log(`All notes in object store "${os}" updated:`, items);
			return items;
		} else {
			console.log(`Note ${whichTar} in object store "${os}" updated:`, item);
			return item;
		}
	});
}

// delete one or all notes in the current IndexedDB notepad object store
function idbNoteDelete(whichTar) {
	if (!idbSupport) return;
	let os = notepadIdLocal;
	let dbPromise = idb.openDB(idbDB);
	return dbPromise.then(function(db) {
		let tx = db.transaction(os, 'readwrite');
		let store = tx.objectStore(os);
		if (whichTar == "all") {
			store.clear();
		} else {
			store.delete(whichTar);
		}
		db.close();
		return tx.done;
	}).then(function() {
		if (whichTar == "all") {
			console.log(`All notes deleted from the "${os}" object store.`);
		} else {
			console.log(`Note ${whichTar} deleted from the "${os}" object store.`);
		}
		return true;
	});
}

// clear notepad IndexedDB object store (if exists) and do a full refresh with a MySQL-gotten array
function idbNotepadRefresh(dataArray) {
	if (!idbSupport) return;
	let os = notepadIdLocal;
	let osCheckPromise = idb.openDB(idbDB);
	return osCheckPromise.then(function(db) {
		let osInDB = (db.objectStoreNames.contains(os) ? true : false);
		db.close();
		if (!osInDB) {
			return idbCreateNotepadOS(os).then(function() { return arrayAddProceed(); });
		} else {
			console.log(`Object store "${os}" already exists. Proceeding to purge.`);
			return clearOS().then(function() { return arrayAddProceed(); });
		}
	});
	function clearOS() {
		let dbPromise = idb.openDB(idbDB);
		return dbPromise.then(function(db) {
			let tx = db.transaction(os, 'readwrite');
			let store = tx.objectStore(os);
			store.clear();
			db.close();
			return tx.done;
		}).then(function() {
			console.log(`All items purged from the "${os}" object store.`);
			return true;
		});
	}
	function arrayAddProceed() {
		if (typeof dataArray === 'undefined') return true;// there aren't any notes to add
		let dbPromise = idb.openDB(idbDB);
		return dbPromise.then(function(db) {
			let tx = db.transaction(os, 'readwrite');
			let store = tx.objectStore(os);
			for (let n=0; n<dataArray.length; n++) { store.put(dataArray[n]); }
			db.close();
			return tx.done;
		}).then(function() {
			console.log(`All notes added to the "${os}" object store. Values:`, dataArray);
			return true;
		});
	}
}

// create a new IndexedDB object store for the specified local notepad ID
function idbCreateNotepadOS(osNum) {
	idbVersion++;
	let dbPromise = idb.openDB(idbDB, idbVersion, { upgrade: function(db) {
		let npOS = db.createObjectStore(osNum, {keyPath: 'idLocal'});
		npOS.createIndex('idRemote', 'idRemote', {unique: false});
		npOS.createIndex('org', 'org', {unique: false});
		npOS.createIndex('color', 'color', {unique: false});
		npOS.createIndex('isChecked', 'isChecked', {unique: false});
		npOS.createIndex('text', 'text', {unique: false});
		npOS.createIndex('lastEdit', 'lastEdit', {unique: false});
		npOS.createIndex('deleted', 'deleted', {unique: false});
		npOS.createIndex('synced', 'synced', {unique: false});
	}});
	return dbPromise.then(function(db) {
		db.close();
		console.log(`Object store "${osNum}" created.`);
		return true;
	});
}

// after a successful sync: update catalog entries with server-assigned data and clear all note stores
// preserves catalog (and lastOpen timestamps) while wiping stale note data
function idbSyncWipe(postData) {
	if (!idbSupport) return Promise.resolve();
	// patch in-memory catalog: assign new hashes for newly synced notepads, mark all as synced
	for (let npid in catalog) {
		if (!catalog[npid]["nphash"] && postData[npid] && postData[npid]["nphash"]) {
			catalog[npid]["nphash"] = postData[npid]["nphash"];
		}
		catalog[npid]["synced"] = 1;
	}
	// open IDB and in one transaction: update catalog entries, clear all note stores
	return idb.openDB(idbDB).then(function(db) {
		let noteStores = Array.from(db.objectStoreNames).filter(function(name) { return !isNaN(name); });
		let tx = db.transaction(['catalog', ...noteStores], 'readwrite');
		let catalogStore = tx.objectStore('catalog');
		for (let npid in catalog) {
			catalogStore.put({
				npidLocal: Number(npid),
				npname: catalog[npid]["npname"],
				nphash: catalog[npid]["nphash"],
				npdesc: catalog[npid]["npdesc"],
				lastEdit: catalog[npid]["lastEdit"],
				lastOpen: catalog[npid]["lastOpen"],
				synced: catalog[npid]["synced"]
			});
		}
		noteStores.forEach(function(name) { tx.objectStore(name).clear(); });
		db.close();
		return tx.done;
	}).then(function() {
		globalSync = true;
		offlineState = 0;// ensure the app reloads in online mode after sync
		return Promise.all([idbSnapshotUpdate("sync"), idbSnapshotUpdate("conn")]);
	}).then(function() {
		console.log('IDB sync wipe complete: catalog preserved, note stores cleared.');
		return true;
	});
}

// delete the entire IndexedDB application database
function idbEmpty() {
	if (!idbSupport) return;
	let dbPromise = idb.deleteDB(idbDB);
	return dbPromise.then(function() {
		console.log(`Entire ${idbDB} IndexedDB database deleted.`);
		return true;
	});
}

//** PALETTE PICKER **//

let _pp = new Map();// stores picker state keyed by element
let _ppPopup = null;// singleton popup element, built once and reused
let _ppActiveEl = null;// trigger element whose picker is currently open

function _ppBuildPopup() {
	let popup = document.createElement('div');
	popup.className = 'pp-popup';
	let grid = document.createElement('div');
	grid.className = 'pp-grid';
	let lbl = document.createElement('div');
	lbl.className = 'pp-label';
	grid.appendChild(lbl);
	for (let i = 0; i < noteColorCount; i++) {
		let sw = document.createElement('button');
		sw.type = 'button';
		sw.className = 'pp-swatch';
		sw.style.backgroundColor = `var(--color-${i})`;
		sw.setAttribute('data-color-id', i);
		sw.addEventListener('click', function(e) {
			e.stopPropagation();
			if (_ppActiveEl) _ppSelectColor(_ppActiveEl, _pp.get(_ppActiveEl), i);
		});
		grid.appendChild(sw);
	}
	popup.appendChild(grid);
	popup.addEventListener('click', function(e) { e.stopPropagation(); });
	document.body.appendChild(popup);
	_ppPopup = popup;
}

function _ppPositionPopup(el) {
	let rect = el.getBoundingClientRect();
	let spaceBelow = window.innerHeight - rect.bottom;
	let popH = _ppPopup.offsetHeight || 130;
	if (spaceBelow < popH && rect.top > popH) {
		_ppPopup.style.top = `${rect.top + window.scrollY - popH - 4}px`;
	} else {
		_ppPopup.style.top = `${rect.bottom + window.scrollY + 4}px`;
	}
	let popW = _ppPopup.offsetWidth || 150;
	let leftPos = Math.min(rect.left, window.innerWidth - popW - 24);
	_ppPopup.style.left = `${leftPos}px`;
}

function _ppOpen(el, state) {
	if (state.open) { _ppClose(el, state); return; }
	if (_ppActiveEl && _ppActiveEl !== el) { let os = _pp.get(_ppActiveEl); if (os) _ppClose(_ppActiveEl, os); }
	let lbl = _ppPopup.querySelector('.pp-label');
	if (state.opts.label) { lbl.textContent = state.opts.label; lbl.style.display = ''; } else { lbl.style.display = 'none'; }
	_ppPopup.querySelectorAll('.pp-swatch').forEach(function(sw) { sw.classList.remove('active'); });
	if (state.colorId !== null && state.colorId !== undefined) {
		let activeSw = _ppPopup.querySelector(`.pp-swatch[data-color-id="${state.colorId}"]`);
		if (activeSw) activeSw.classList.add('active');
	}
	_ppActiveEl = el;
	_ppPopup.offsetHeight;// force reflow so CSS transitions fire
	_ppPopup.classList.add('pp-open');
	state.open = true;
	_ppPositionPopup(el);
	setTimeout(function() {
		state.onDocClick = function() { _ppClose(el, state); };
		document.addEventListener('click', state.onDocClick);
	}, 0);
}

function _ppSelectColor(el, state, colorId) {
	state.colorId = colorId;
	_ppClose(el, state);
	if (state.opts.change) state.opts.change.call(el, colorId);
}

function _ppClose(el, state) {
	if (_ppPopup) _ppPopup.classList.remove('pp-open');
	_ppActiveEl = null;
	state.open = false;
	if (state.onDocClick) {
		document.removeEventListener('click', state.onDocClick);
		state.onDocClick = null;
	}
}

function _ppGet(el) {
	let state = _pp.get(el);
	return state ? state.colorId : null;
}

function _ppSet(el, colorId) {
	let state = _pp.get(el);
	if (!state) return;
	state.colorId = (colorId !== null && colorId !== undefined) ? Number(colorId) : null;
}

function _ppClear(el) {
	let state = _pp.get(el);
	if (!state) return;
	if (state.onDocClick) document.removeEventListener('click', state.onDocClick);
	if (_ppActiveEl === el) { if (_ppPopup) _ppPopup.classList.remove('pp-open'); _ppActiveEl = null; }
	_pp.delete(el);
}

function _ppClearAll() {
	_pp.forEach(function(state) {
		if (state.onDocClick) document.removeEventListener('click', state.onDocClick);
	});
	_pp.clear();
	if (_ppPopup) _ppPopup.classList.remove('pp-open');
	_ppActiveEl = null;
}

//** STARTUP **//

// increment holdReleaseCurrent until it hits the target, then allow document ready
function holdRelease() {
	holdReleaseCurrent++;
	if (holdReleaseCurrent >= holdReleaseTarget) {
		_appReady();
	}
}

// determine internet connection status
apiFetch({
	type: "GET",
	dataType: "text",
	timeout: timeoutInternet,
	url: "/api/is-connected",
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
				document.body.setAttribute('data-idb-support', 0);
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

Promise.race([// document hold release #2: wait for Google Fonts to load, or bail after 3 seconds
	document.fonts.ready,
	new Promise(function(resolve) { setTimeout(resolve, 3000); })
]).then(function() { holdRelease(); });

let cssCheck = setInterval(function(){// document hold release #3: CSS is being loaded asynchronously on the index.php page; wait for the presence of one of its styles to confirm it's ready
	if (getComputedStyle(document.querySelector(':root')).getPropertyValue('--color-0') != "") {
		holdRelease();
		clearInterval(cssCheck);
	}
}, 250);

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
		let notepadHash = window.location.pathname.substring(4,10);
		if (([0, 3].includes(offlineState)) && (internetConn)) {
			apiFetch({
				type: "GET",
				url: "/api/find-notepad-by-hash",
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
							'synced': 1
						}
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

// clear or otherwise modify the splash screen
function splashHandler(toggle) {
	switch (toggle) {
		case "clear":
			if (window.syncOnLaunch == true) {// if the offline state changed during the application launch, bring up the sync modal
				window.syncOnLaunch = void 0;
				syncModal("dialog");
			}
			document.body.classList.remove("noscroll"); {
			const _splash = document.getElementById('splash');
			_splash.innerHTML = '';
			_splash.style.display = 'none';
			appLaunched = true;
			break;
		} case "doa": {
			document.body.classList.add("noscroll");
			const _splash = document.getElementById('splash');
			_splash.innerHTML = "<button type='button' class='button transparent' onclick='window.location.reload();'><i class='error fa fa-warning'></i></button>";
			_splash.style.display = '';
			break;
		}
	}
}

//** STATUS & INDICATORS **//

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

// update menu bar status indicator icon
function statusIndicator(toggle) {
	let _si = document.getElementById('icon-status');
	let _sii = _si.querySelector('i');
	switch (toggle) {
		case "process":
			statusQueue++;
			statusComplete = 0;
			_sii.className = 'fa fa-refresh fa-spin';
			_si.classList.add('display');
			break;
		case "success":
			statusComplete = 1;
			_sii.className = 'fa fa-check';
			hideIndicator(statusQueue);
			break;
		case "error":
			statusComplete = 1;
			_sii.className = 'fa fa-warning';
			hideIndicator(statusQueue);
			break;
		case "hide":
			statusComplete = 1;
			_sii.className = 'fa';
			_si.classList.remove('display');
			break;
	}
}

// hide menu bar status indicator icon
function hideIndicator(queueNum) {
	window.setTimeout(function() {
		if (statusQueue == queueNum) document.getElementById('icon-status').classList.remove('display');
	}, 3000);
}

// display a popup message on screen bottom
// duration: milliseconds to display before auto-dismiss; otherwise null for sticky (dismissed by user)
// onDismiss: optional string, the onclick function call for the dismiss button (defaults to 'popupDismiss();')
function popupMsg(popupTxt, optColor, duration, onDismiss) {
	if (typeof duration === 'undefined') duration = timeoutPopup;
	let dismissFn = (typeof onDismiss !== 'undefined') ? onDismiss : 'popupDismiss();';
	clearTimeout(window.popupTimeout);
	let _ps = document.getElementById('popup-status');
	_ps.classList.remove('red', 'green', 'blue', 'yellow', 'sticky');
	if (typeof optColor !== 'undefined') _ps.classList.add(optColor);
	if (duration === null) {
		document.getElementById('popup-msg').innerHTML = `${popupTxt}<i id="popup-dismiss" class="fa fa-times" title="${locale.general.close}" onclick="${dismissFn}"></i>`;
		_ps.classList.add('show', 'sticky');
	} else {
		document.getElementById('popup-msg').innerHTML = popupTxt;
		_ps.classList.add('show');
		window.popupTimeout = setTimeout(function() {
			_ps.classList.remove('show', 'sticky');
		}, duration);
	}
}

// dismiss a sticky popup message
function popupDismiss() {
	clearTimeout(window.popupTimeout);
	document.getElementById('popup-status').classList.remove('show', 'sticky');
}

// show the PWA install prompt popup if conditions are met
function showInstallPrompt() {
	if (isInWebApp) return;
	if (!deferredPrompt || localStorage.getItem("_installPromptShown")) return;
	popupMsg(`<a href="#" onclick="installPromptAccept(); return false;">${locale.popup.install}</a>`, void 0, null, 'installPromptDismiss();');
}

// user tapped the install link: trigger the native install dialog
function installPromptAccept() {
	if (!deferredPrompt) return;
	deferredPrompt.prompt();
	deferredPrompt.userChoice.then(function() {
		deferredPrompt = null;
		localStorage.setItem("_installPromptShown", "1");
		popupDismiss();
	});
}

// user dismissed the install prompt with the X: don't show it again
function installPromptDismiss() {
	localStorage.setItem("_installPromptShown", "1");
	deferredPrompt = null;
	popupDismiss();
}

//** NAVIGATION **//

// update the display URL and store location information
function updateState(appLocation, pushAction) {
	let pushObject, pushTitle, pushURL;
	switch (appLocation) {
		case "home":
			pushObject = { loc: 'home' };
			pushTitle = `${locale.core.app_name} - ${locale.app.tagline}`;
			pushURL = "/";
			notepadIdLocal = void 0;
			break;
		case "notepad":
			pushObject = { loc: 'notepad', npidLocal: notepadIdLocal };
			pushTitle = `${catalog[notepadIdLocal]["npname"]} - ${locale.core.app_name}`;
			pushURL = (typeof catalog[notepadIdLocal]["nphash"] !== 'undefined') ? `/np/${catalog[notepadIdLocal]["nphash"]}` : `/local/${notepadIdLocal}`;
			break;
		case "edit":
			pushTitle = `${catalog[notepadIdLocal]["npname"]} - ${locale.core.app_name}`;
			break;
		default:
			return;
	}
	if (pushAction == "replace") {
		history.replaceState(pushObject, pushTitle, pushURL);
	} else if (pushAction == "push") {
		history.pushState(pushObject, pushTitle, pushURL);
	}
	document.title = pushTitle;
	appLoc = appLocation;
	idbSnapshotUpdate("pos");
}

// present the homepage
function buildHome(dir) {
	switch (dir) {
		case "start":
			statusIndicator("success");
			document.getElementById('home').classList.add('active-loc');
			updateState("home", "replace");
			document.getElementById('notepad-input').focus();
			splashHandler("clear");
			break;
		case "jump":
			_ppClearAll();// close and clear all palette picker state
			document.querySelectorAll('.active-loc').forEach(function(el) { el.innerHTML = ''; el.removeAttribute('style'); el.classList.remove('active-loc'); });
			let _np2 = document.getElementById('notepad'); _np2.innerHTML = ''; _np2.removeAttribute('style');// just in case the jump was from the edit dialog
			window.scrollTo(0, 0);
			let _home = document.getElementById('home'); _home.classList.add('active-loc'); _home.removeAttribute('style');
			let _ni = document.getElementById('notepad-input'); _ni.value = ''; _ni.focus();
			document.getElementById('find-notepad-button').classList.add('disabled');
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
			anime.animate('#notepad', {
				opacity: [1, 0],
				translateX: ['0%', '50%'],
				duration: speed,
				ease: 'inOutQuad',
				onComplete: function() {
					updateState("home", "push");
					_ppClearAll();// close and clear all palette picker state
					let _np = document.getElementById('notepad'); _np.innerHTML = ''; _np.removeAttribute('style'); _np.classList.remove('active-loc');
					document.getElementById('home').classList.add('active-loc');
					window.scrollTo(0, 0);
					document.getElementById('notepad-input').value = '';
					document.getElementById('find-notepad-button').classList.add('disabled');
					anime.animate('#home', {
						opacity: [0, 1],
						translateX: ['-50%', '0%'],
						duration: speed,
						ease: 'inOutQuad',
						onComplete: function() {
							document.getElementById('home').removeAttribute('style');
							document.getElementById('notepad-input').focus();
						}
					});
				}
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
		apiFetch({
			type: "POST",
			url: "/api/find-notepad-by-name",
			data: JSON.stringify({
				npname: pad
			}),
			beforeSend: function() {
				userControl("lock");
				statusIndicator("process");
			},
			success: function(postData) {
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

// find the notepad db entry based on the hash; used when opening a notepad from the localStorage-restored recent notepads list
function findNotepadByHash(hash) {
	for (let k in catalog) {
		if (catalog[k]["nphash"] === hash) {
			notepadIdLocal = Number(k);
			buildNotepad("forward");
			return;
		}
	}
	apiFetch({
		type: "GET",
		url: "/api/find-notepad-by-hash",
		data: { nphash: hash },
		beforeSend: function() {
			userControl("lock");
			statusIndicator("process");
		},
		success: function(postData) {
			if (postData["result"] == "success") {
				localPadCounter++;
				notepadIdLocal = localPadCounter;
				idbSnapshotUpdate("count");
				catalog[notepadIdLocal] = {
					'npname': postData.npname,
					'nphash': hash,
					'npdesc': ((postData.npdesc == "") || (postData.npdesc == null) || (typeof postData.npdesc === 'undefined')) ? void 0 : postData.npdesc,
					'lastEdit': postData.lastEdit,
					'lastOpen': getUnixTimestamp(),
					'synced': 1
				};
				idbCatalogUpdate();
				buildNotepad("forward");
			}
		}
	});
}

// build or re-build the recently opened notepads list
// home page, web app mode only, max 10
function buildRecentNotepads() {
	if (!isInWebApp) return;
	let _rnw = document.getElementById('recent-notepads-wrapper');
	if (Object.keys(catalog).length == 0) {
		_rnw.style.display = 'none';
		return;
	} else {
		_rnw.style.display = '';
	}
	let _rn = document.getElementById('recent-notepads');
	_rn.innerHTML = '';
	let catalogOrdered = [];
	Object.keys(catalog).forEach(function(key) {
		let value = catalog[key];
		catalogOrdered[key] = { "npidLocal": key, "npname": value["npname"], "lastOpen": value["lastOpen"] };
	});
	catalogOrdered.sort(function(a, b){return b.lastOpen - a.lastOpen}).slice(0, 10).forEach(function(c) {
		_rn.insertAdjacentHTML('beforeend',
			`<button type="button" class="button large full-width white" onclick="notepadIdLocal=${c.npidLocal};buildNotepad('forward');">${c.npname}</button>`
		);
	});
	document.getElementById('recent-notepads-button').classList.remove('active');
	_rn.style.maxHeight = '0px';
}

//** NOTEPAD **//

// open the specified notepad
function returnToNotepad(scrPos, elem) {
	anime.animate('#edit', {
		opacity: [1, 0],
		translateX: ['0%', '50%'],
		duration: speed,
		ease: 'inOutQuad',
		onComplete: function() {
			_ppClear(document.getElementById('edit-color-selector'));
			let _edit = document.getElementById('edit'); _edit.innerHTML = ''; _edit.removeAttribute('style'); _edit.classList.remove('active-loc');
			document.getElementById('notepad').classList.add('active-loc');
			if (typeof scrPos === 'undefined') {
				window.scrollTo(0, 0);
			} else {
				window.scrollTo(0, scrPos);
			}
			stickyButtonsToggle("show");
			updateState("notepad", "jump");
			anime.animate('#notepad', {
				opacity: [0, 1],
				translateX: ['-50%', '0%'],
				duration: speed,
				ease: 'inOutQuad',
				onComplete: function() {
					document.getElementById('notepad').removeAttribute('style');// anime.js leaves inline transform/opacity on the element after animation; remove so SortableJS reads clean geometry
					// Linkify must run after the animation completes. During initial notepad build, Linkify runs before any layout is painted so visibility is irrelevant.
					// When returning from edit, the notepad is already in the rendered layout and iOS withholds geometry for off-screen transformed elements, making Linkify unreliable mid-animation.
					if (typeof elem !== 'undefined') linkifyInit(elem);
				}
			});
		}
	});
}

function buildNotepad(arg, scrPos, elem) {
	let lockStatus = false, hasNotes = false, allNotes = "";
	if ([0, 3].includes(offlineState) && (typeof catalog[notepadIdLocal]["nphash"] !== 'undefined')) {// if online and notepad hash is defined, MySQL query
		apiFetch({
			type: "GET",
			url: "/api/build-notepad",
			data: {
				nphash: catalog[notepadIdLocal]["nphash"]
			},
			beforeSend: function() {
				userControl("lock");
				statusIndicator("process");
			},
			success: function(postData) {
				if (postData["result"] == "hashfail") {
					errorModal("manual", locale.modal.error.critical);
					return;
				}
				delete notepads[notepadIdLocal];
				notepads[notepadIdLocal] = {};
				let npdescCheck = ((postData["npdesc"] == "") || (postData["npdesc"] == null) || (typeof postData["npdesc"] === 'undefined')) ? void 0 : postData["npdesc"];
				if ((catalog[notepadIdLocal]["npname"] != postData["npname"]) || (catalog[notepadIdLocal]["npdesc"] != npdescCheck)) {
					catalog[notepadIdLocal]["npname"] = postData["npname"];
					catalog[notepadIdLocal]["npdesc"] = npdescCheck;
					catalog[notepadIdLocal]["lastEdit"] = postData["lastEdit"];
					idbCatalogUpdate();
				}
				if (postData["lockstatus"] == true) lockStatus = true;
				if (postData["size"] != 0) {// if there are any notes, parse through them
					hasNotes = true;
					let thisTarget;
					let idbArray = [];
					for (let i=0; i<postData["size"]; i++) {
						localNoteCounter++;
						thisTarget = { "idLocal": localNoteCounter };
						notepads[notepadIdLocal][localNoteCounter] = { "idRemote": Number(postData[i]["id"]), "org": Number(postData[i]["org"]), "color": Number(postData[i]["color"]), "isChecked": Number(postData[i]["isChecked"]), "text": postData[i]["text"], "lastEdit": Number(postData[i]["lastEdit"]), "deleted": 0, "synced": 1 };
						idbArray[i] = Object.assign({}, thisTarget, notepads[notepadIdLocal][localNoteCounter]);
						allNotes += rowBuilder(localNoteCounter, postData[i]["id"], postData[i]["color"], postData[i]["isChecked"], postData[i]["text"]);
					}
					idbSnapshotUpdate("count");// update the counter
					idbNotepadRefresh(idbArray);// refresh (or create) an object store with this notepad's notes
				} else {
					idbNotepadRefresh();// give it no parameter so that it will simply create an empty OS or clear an existing one
				}
				buildNotepadRender(arg, scrPos, elem, lockStatus, hasNotes, allNotes);
			}
		});
	} else {// if offline, pull from IDB catalog
		if (Object.keys(notepads[notepadIdLocal]).length > 0) {// if there are any notes, parse through them
			let orderedNotesObj = {};
			for (let n in notepads[notepadIdLocal]) {
				if (notepads[notepadIdLocal][n]["deleted"] == 0) {// discard deleted notes; use org as key to put them in order
					orderedNotesObj[notepads[notepadIdLocal][n]["org"]] = { "idLocal" : Number(n), "idRemote" : notepads[notepadIdLocal][n]["idRemote"], "color" : notepads[notepadIdLocal][n]["color"], "isChecked" : notepads[notepadIdLocal][n]["isChecked"], "text" : notepads[notepadIdLocal][n]["text"] };
				}
			}
			if (Object.keys(orderedNotesObj).length > 0) {// proceed if there are any non-deleted notes
				let orderedNotes = Object.entries(orderedNotesObj);// convert to array
				orderedNotes.reverse();// reverse the array, since we display descending order
				hasNotes = true;
				for (let o=0; o<orderedNotes.length; o++) {
					allNotes += rowBuilder(orderedNotes[o][1]["idLocal"], orderedNotes[o][1]["idRemote"], orderedNotes[o][1]["color"], orderedNotes[o][1]["isChecked"], orderedNotes[o][1]["text"]);
				}
			}
		}
		buildNotepadRender(arg, scrPos, elem, lockStatus, hasNotes, allNotes);
	}
}

function buildNotepadRender(arg, scrPos, elem, lockStatus, hasNotes, allNotes) {
	statusIndicator("success");
	let previousScroll;
	if (arg == "refresh") previousScroll = window.scrollY;
	let _npEl = document.getElementById('notepad');
	if (_npEl.innerHTML.trim() !== '') {
		_ppClearAll();// close and clear all palette picker state
		_npEl.innerHTML = '';
	}
	let notepadTop = [
		'<div id="notepad-top">',
		'	<div id="np-top-row">',
		`		<div id="lock-button-wrapper"><button id="lock-button" type="button" class="button circle" aria-label="${locale.notepad.lock}" title="${locale.notepad.lock}"><i class="fa fa-unlock"></i></button></div>`,
		'		<div id="np-rename" class="h1"></div>',
		'	</div>',
		'	<div id="np-desc"></div>',
		'	<div id="notepad-btns">',
		`		<button id="home-button" type="button" class="button responsive" aria-label="${locale.notepad.home}" onclick="buildHome('backward');">`,
		`			<i class="fa fa-home"></i><span> ${locale.notepad.home}</span>`,
		'		</button>',
		`		<button id="delete-all-modal-button" type="button" class="button color red responsive" aria-label="${locale.notepad.delete_all}" onclick="deleteAllModal();">`,
		`			<i class="fa fa-trash"></i><span> ${locale.notepad.delete_all}</span>`,
		'		</button>',
		`		<button id="sort-modal-button" type="button" class="button color orange responsive" aria-label="${locale.notepad.sort}" onclick="sortModal();">`,
		`			<i class="fa fa-sort"></i><span> ${locale.notepad.sort}</span>`,
		'		</button>',
		`		<button id="json-modal-button" type="button" class="button color blue responsive" aria-label="${locale.notepad.api}" onclick="apiModal();">`,
		`			<i class="fa fa-code"></i><span> ${locale.notepad.api}</span>`,
		'		</button>',
		`		<button id="refresh-button" type="button" class="button color green responsive" aria-label="${locale.notepad.refresh}" onclick="buildNotepad('refresh');">`,
		`			<i class="fa fa-repeat"></i><span> ${locale.notepad.refresh}</span>`,
		'		</button>',
		'	</div>',
		'	<div id="quick-add"><form>',
		`		<input id="quick-add-input" type="text" aria-label="${locale.notepad.quick_add_placeholder}" placeholder="${locale.notepad.quick_add_placeholder}" onkeydown="return event.key!=='Enter';"/>`,
		`		<button id="quick-add-button" type="submit" class="button color cyan square disabled" aria-label="${locale.notepad.quick_add_label}" onclick="quickAdd();"><i class="fa fa-enter"></i></button>`,
		'	</form></div>',
		'</div>'
	].join("\n");
	document.getElementById('notepad').insertAdjacentHTML('beforeend', notepadTop);
	if (typeof catalog[notepadIdLocal]["nphash"] === 'undefined') document.getElementById('json-modal-button').classList.add('disabled');
	// fill in top with additional elements
	fillNotepadName();
	fillNotepadDesc();
	// add listeners to quick add input
	let _qai = document.getElementById('quick-add-input');
	let _qab = document.getElementById('quick-add-button');
	_qai.addEventListener('input', function() {
		if (this.value == "") {
			_qab.classList.add('disabled');
		} else {
			_qab.classList.remove('disabled');
		}
	});
	_qai.addEventListener('keyup', function(e) {
		if ((e.key === "Enter") && (!_qab.classList.contains('disabled'))) {
			_qab.click();
		}
	});
	_qai.addEventListener('focusin', function() {
		if (typeof quickAddFocusOut !== 'undefined') {
			clearTimeout(quickAddFocusOut);
			quickAddFocusOut = void 0;
		} else {
			stickyButtonsToggle("hide");
		}
	});
	_qai.addEventListener('focusout', function() {
		quickAddFocusOut = setTimeout(function() { stickyButtonsToggle("show"); quickAddFocusOut = void 0; }, 100);
	});
	// lock the notepad if specified in database
	if (lockStatus) {
		lockToggle("lock");
	} else {
		document.getElementById('notepad').removeAttribute('data-lock-status');// clear any stale lock state left by a previously visited locked notepad
		document.getElementById('sticky-add').style.display = '';// same -- sticky-add lives outside #notepad so isn't cleared by innerHTML reset
		document.getElementById('lock-button').onclick = function() { lockModal(); };
	}
	// check for presence of notes and build accordingly
	if (!hasNotes) {
		// no notes = no notepad
		notepadRoot("destroy");
	} else {
		// create the notepad root
		notepadRoot("create");
		// populate notes
		document.getElementById('notepad-body').insertAdjacentHTML('beforeend', allNotes);
		// toggle the state of the Check All button
		setCheckAllState();
		// Linkify these notes
		linkifyInit("all");
	}
	// open user control
	userControl("open");
	// animate it in
	switch (arg) {
		case "start":
			document.getElementById('notepad').classList.add('active-loc');
			stickyButtonsToggle("show");
			splashHandler("clear");
			if (typeof scrPos !== 'undefined') window.scrollTo(0, scrPos);
			updateState("notepad", "replace");
			catalog[notepadIdLocal]["lastOpen"] = getUnixTimestamp();
			idbCatalogUpdate();
			showInstallPrompt();
			break;
		case "refresh":
			window.scrollTo(0, previousScroll);
			break;
		case "jump":
			let _activeLoc = document.querySelector('.active-loc');
			if (_activeLoc && _activeLoc.id == "home") {
				_activeLoc.classList.remove('active-loc'); _activeLoc.removeAttribute('style');
			} else if (_activeLoc) {
				_activeLoc.innerHTML = ''; _activeLoc.classList.remove('active-loc'); _activeLoc.removeAttribute('style');
			}
			document.getElementById('notepad').classList.add('active-loc');
			stickyButtonsToggle("show");
			updateState("notepad", "jump");
			catalog[notepadIdLocal]["lastOpen"] = getUnixTimestamp();
			idbCatalogUpdate();
			buildRecentNotepads();
			showInstallPrompt();
			break;
		case "forward":
			catalog[notepadIdLocal]["lastOpen"] = getUnixTimestamp();
			idbCatalogUpdate();
			anime.animate('#home', {
				opacity: [1, 0],
				translateX: ['0%', '-50%'],
				duration: speed,
				ease: 'inOutQuad',
				onComplete: function() {
					document.getElementById('home').classList.remove('active-loc'); document.getElementById('home').removeAttribute('style');
					document.getElementById('notepad').classList.add('active-loc');
					window.scrollTo(0, 0);
					stickyButtonsToggle("show");
					updateState("notepad", "push");
					anime.animate('#notepad', {
						opacity: [0, 1],
						translateX: ['50%', '0%'],
						duration: speed,
						ease: 'inOutQuad',
						onComplete: function() {
							document.getElementById('notepad').removeAttribute('style');// anime.js leaves inline transform/opacity on the element after animation; remove so SortableJS reads clean geometry
							buildRecentNotepads();
							showInstallPrompt();
						}
					});
				}
			});
			break;
	}
}

// rename the notepad
function renameNotepad(action) {
	switch (action) {
		case "edit":
			let renameHtml = '<input id="np-rename-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>';
			document.getElementById('np-rename').innerHTML = renameHtml;
			let _nri = document.getElementById('np-rename-input');
			_nri.value = catalog[notepadIdLocal]["npname"];
			_nri.addEventListener('input', function() {
				if (this.value == "") {
					if (!this.classList.contains('warning')) this.classList.add('warning');
				} else {
					if (this.classList.contains('warning')) this.classList.remove('warning');
					if ([...charSplitter.segment(this.value)].length >= npnameMaxChar) { this.value = [...charSplitter.segment(this.value)].slice(0, npnameMaxChar).map(function(s){return s.segment;}).join(''); }
				}
			});
			_nri.addEventListener('keyup', function(e) {
				if (e.key === "Enter") {
					if ((this.value != "") && (!this.classList.contains('warning'))) {
						renameNotepad("save");
					}
				} else if (e.key === "Escape") {
					renameNotepad("cancel");
				}
			});
			_nri.addEventListener('focusout', function() {
				renameNotepad("save");
			});
			_nri.focus();
			if (typeof quickAddFocusOut !== 'undefined') {
				clearTimeout(quickAddFocusOut);
				quickAddFocusOut = void 0;
			} else {
				stickyButtonsToggle("hide");
			}
			break;
		case "save":
			if (_renameSaving) return;
			// variables, objects, arrays; conditions for early bailing
			let proposedName = document.getElementById('np-rename-input').value;
			let formerName = catalog[notepadIdLocal]["npname"];
			if (proposedName == "") return;
			if (proposedName == formerName) {
				renameNotepad("cancel");
				return;
			}
			_renameSaving = true;
			// IDB and MySQL updates
			if ([0, 3].includes(offlineState)) {// if online
				apiFetch({
					type: "POST",
					url: "/api/rename-notepad",
					data: JSON.stringify({
						npname: proposedName,
						nphash: catalog[notepadIdLocal]["nphash"]
					}),
					beforeSend: function() {
						userControl("lock");
						statusIndicator("process");
					},
					success: function(postData) {
						switch (postData["result"]) {
							case "is-empty":
								document.getElementById('np-rename-input').value = formerName;
								fillNotepadName();
								errorModal();
								break;
							case "hashfail":
								document.getElementById('np-rename-input').value = formerName;
								fillNotepadName();
								errorModal("manual", locale.modal.error.critical);
								break;
							case "lockfail":
								document.getElementById('np-rename-input').value = formerName;
								fillNotepadName();
								errorModal("manual", locale.modal.error.locked);
								break;
							case "actionfail":
								userControl("open");
								statusIndicator("error");
								document.getElementById('np-rename-input').classList.add('warning');
								popupMsg(locale.popup.rename, "red");
								break;
							default:
								userControl("open");
								statusIndicator("success");
								catalog[notepadIdLocal]["npname"] = postData.npname;
								catalog[notepadIdLocal]["lastEdit"] = postData.lastEdit;
								idbCatalogUpdate();
								document.getElementById('np-rename-input').value = postData.npname;
								fillNotepadName();
								updateState("notepad", "replace");
								break;
						}
					},
					complete: function() {
						_renameSaving = false;
						stickyButtonsToggle("show");
					}
				});
			} else {// if offline
				let proceed = true;
				for (let k in catalog) { if (catalog[k]["npname"] == proposedName) proceed = false; }
				if (proceed) {
					catalog[notepadIdLocal]["npname"] = proposedName;
					catalog[notepadIdLocal]["lastEdit"] = getUnixTimestamp();
					catalog[notepadIdLocal]["synced"] = 0;
					npCommitHandler("offline", globalSync, undefined);
					_renameSaving = false;
					fillNotepadName();
					stickyButtonsToggle("show");
					updateState("notepad", "replace");
				} else {// error
					_renameSaving = false;
					document.getElementById('np-rename-input').classList.add('warning');
					popupMsg(locale.popup.rename, "red");
				}
			}
			break;
		case "cancel":
			_renameSaving = true;
			stickyButtonsToggle("show");
			fillNotepadName();
			_renameSaving = false;
			break;
			
	}
}

// change the notepad description
function changeNotepadDesc() {
	// conditions for early bailing
	if (catalog[notepadIdLocal]["npdesc"] == document.getElementById('np-desc-textarea').value) return;
	if ((typeof catalog[notepadIdLocal]["npdesc"] === 'undefined') && (document.getElementById('np-desc-textarea').value == "")) return;
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	catalog[notepadIdLocal]["npdesc"] = (document.getElementById('np-desc-textarea').value == "") ? void 0 : document.getElementById('np-desc-textarea').value;
	catalog[notepadIdLocal]["lastEdit"] = Math.floor(tsAction/1000);
	catalog[notepadIdLocal]["synced"] = 0;
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/change-notepad-desc",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				npdesc: document.getElementById('np-desc-textarea').value
			}),
			beforeSend: function() {
				statusIndicator("process");
				npCommitHandler("delay", wasSynced, tsAction);
			},
			success: function(postData) {
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
							document.getElementById('np-desc-textarea').value = postData.npdesc;
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
	apiFetch({
		type: "POST",
		url: "/api/lock-notepad",
		data: JSON.stringify({
			nphash: catalog[notepadIdLocal]["nphash"],
			lockpass: whatpass
		}),
		beforeSend: function() {
			userControl("lock");
			statusIndicator("process");
		},
		success: function(postData) {
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
	apiFetch({
		type: "POST",
		url: "/api/unlock-notepad",
		data: JSON.stringify({
			nphash: catalog[notepadIdLocal]["nphash"],
			lockpass: whichpass
		}),
		beforeSend: function() {
			userControl("lock");
			statusIndicator("process");
		},
		success: function(postData) {
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
let password1, password2;
function lockModal(lockstep) {
	let modalContent;
	switch (lockstep) {
		case "validate1":
			if (document.getElementById('lock-password-input-1').value != "") {
				password1 = document.getElementById('lock-password-input-1').value;
				lockModal("prompt2");
			}
			break;
		case "validate2":
			if (document.getElementById('lock-password-input-2').value != "") {
				password2 = document.getElementById('lock-password-input-2').value;
				if (password1 == password2) {
					lockNotepad(password2);
				} else {
					lockModal("mismatch");
				}
			}
			break;
		case "success":
			lockToggle("lock");
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p>${locale.modal.lock.success}</p>`,
				`	<p class="smaller ital">${locale.modal.lock.success_detail}</p>`,
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button large" aria-label="${locale.general.close}" onclick="modalToggle('off');">${locale.general.close}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			break;
		case "mismatch":
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p>${locale.modal.lock.mismatch}</p>`,
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button color cyan large" aria-label="${locale.general.retry}" onclick="lockModal('prompt1');">${locale.general.retry}</button>`,
				`	<button type="button" class="button large" aria-label="${locale.general.close}" onclick="modalToggle('off');">${locale.general.close}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			break;
		case "prompt2":
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top"><form>',
				`	<input id="lock-password-input-2" type="password" aria-label="${locale.modal.lock.reenter_placeholder}" placeholder="${locale.modal.lock.reenter_placeholder}" onkeydown="return event.key!=='Enter';" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>`,
				'	<div class="spacer20"></div>',
				'	<div class="modal-window-wrapper-bottom">',
				`		<button type="button" class="button color red large" aria-label="${locale.general.back}" onclick="lockModal('prompt1');">${locale.general.back}</button>`,
				`		<button type="submit" class="button color green large next" aria-label="${locale.general.next}" onclick="lockModal('validate2');">${locale.general.next}</button>`,
				`		<button type="button" class="button large" aria-label="${locale.general.cancel}" onclick="modalToggle('off');">${locale.general.cancel}</button>`,
				'	</div>',
				'</form></div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			let _mwNext2 = document.querySelector('#modal-window .next');
			_mwNext2.classList.add('disabled');
			let _lpi2 = document.getElementById('lock-password-input-2');
			_lpi2.classList.add('invalid');
			_lpi2.addEventListener('input', function() {
				if (this.value == "") {
					if (!this.classList.contains('invalid')) { this.classList.add('invalid'); _mwNext2.classList.add('disabled'); }
				} else {
					if ([...charSplitter.segment(this.value)].length >= npnameMaxChar) { this.value = [...charSplitter.segment(this.value)].slice(0, npnameMaxChar).map(function(s){return s.segment;}).join(''); }
					if (this.classList.contains('invalid')) { this.classList.remove('invalid'); _mwNext2.classList.remove('disabled'); }
				}
			});
			_lpi2.addEventListener('keyup', function(e) {
				if ((e.key === "Enter") && (!this.classList.contains('invalid'))) {
					if (document.activeElement) document.activeElement.blur();
					_mwNext2.click();
				}
			});
			_lpi2.value = ''; _lpi2.focus();
			break;
		case "prompt1":
		default:
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top"><form>',
				`	<p class="bold">${locale.modal.lock.prompt}</p>`,
				`	<p>${locale.modal.lock.prompt_detail}</p>`,
				`	<input id="lock-password-input-1" type="password" aria-label="${locale.modal.lock.password_placeholder}" placeholder="${locale.modal.lock.password_placeholder}" onkeydown="return event.key!=='Enter';" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>`,
				`	<p class="smaller ital">${locale.modal.lock.password_detail}</p>`,
				'	<div class="modal-window-wrapper-bottom">',
				`		<button type="submit" class="button color green large next" aria-label="${locale.general.next}" onclick="lockModal('validate1');">${locale.general.next}</button>`,
				`		<button type="button" class="button large" aria-label="${locale.general.cancel}" onclick="modalToggle('off');">${locale.general.cancel}</button>`,
				'	</div>',
				'</form></div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			let _mwNext1 = document.querySelector('#modal-window .next');
			_mwNext1.classList.add('disabled');
			let _lpi1 = document.getElementById('lock-password-input-1');
			_lpi1.classList.add('invalid');
			_lpi1.addEventListener('input', function() {
				if (this.value == "") {
					if (!this.classList.contains('invalid')) { this.classList.add('invalid'); _mwNext1.classList.add('disabled'); }
				} else {
					if ([...charSplitter.segment(this.value)].length >= npnameMaxChar) { this.value = [...charSplitter.segment(this.value)].slice(0, npnameMaxChar).map(function(s){return s.segment;}).join(''); }
					if (this.classList.contains('invalid')) { this.classList.remove('invalid'); _mwNext1.classList.remove('disabled'); }
				}
			});
			_lpi1.addEventListener('keyup', function(e) {
				if ((e.key === "Enter") && (!this.classList.contains('invalid'))) {
					if (document.activeElement) document.activeElement.blur();
					_mwNext1.click();
				}
			});
			if (typeof lockstep === 'undefined') modalToggle("on");
			_lpi1.value = ''; _lpi1.focus();
			break;
	}
}

// display unlock modal
function unlockModal(unlockstep) {
	let modalContent;
	switch (unlockstep) {
		case "validate":
			let _upiVal = document.getElementById('unlock-password-input');
			if (_upiVal && _upiVal.value != "") {
				unlockNotepad(_upiVal.value);
			}
			break;
		case "success":
			lockToggle("unlock");
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p>${locale.modal.unlock.success}</p>`,
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button large" aria-label="${locale.general.close}" onclick="modalToggle('off');">${locale.general.close}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			break;
		case "incorrect":
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p>${locale.modal.unlock.incorrect}</p>`,
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button color cyan large" aria-label="${locale.general.retry}" onclick="unlockModal('prompt');">${locale.general.retry}</button>`,
				`	<button type="button" class="button large" aria-label="${locale.general.close}" onclick="modalToggle('off');">${locale.general.close}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			break;
		case "prompt":
		default:
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top"><form>',
				`	<p>${locale.modal.unlock.prompt}</p>`,
				`	<input id="unlock-password-input" type="password" aria-label="${locale.modal.lock.password_placeholder}" placeholder="${locale.modal.lock.password_placeholder}" onkeydown="return event.key!=='Enter';" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>`,
				`	<p class="smaller ital">${locale.modal.unlock.prompt_detail}</p>`,
				'	<div class="modal-window-wrapper-bottom">',
				`		<button type="submit" class="button color green large next" aria-label="${locale.general.next}" onclick="unlockModal('validate');">${locale.general.next}</button>`,
				`		<button type="button" class="button large" aria-label="${locale.general.cancel}" onclick="modalToggle('off');">${locale.general.cancel}</button>`,
				'	</div>',
				'</form></div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			let _mwNextU = document.querySelector('#modal-window .next');
			_mwNextU.classList.add('disabled');
			let _upi = document.getElementById('unlock-password-input');
			_upi.classList.add('invalid');
			_upi.addEventListener('input', function() {
				if (this.value == "") {
					if (!this.classList.contains('invalid')) { this.classList.add('invalid'); _mwNextU.classList.add('disabled'); }
				} else {
					if ([...charSplitter.segment(this.value)].length >= npnameMaxChar) { this.value = [...charSplitter.segment(this.value)].slice(0, npnameMaxChar).map(function(s){return s.segment;}).join(''); }
					if (this.classList.contains('invalid')) { this.classList.remove('invalid'); _mwNextU.classList.remove('disabled'); }
				}
			});
			_upi.addEventListener('keyup', function(e) {
				if ((e.key === "Enter") && (!this.classList.contains('invalid'))) {
					if (document.activeElement) document.activeElement.blur();
					_mwNextU.click();
				}
			});
			if (typeof unlockstep === 'undefined') modalToggle("on");
			_upi.value = ''; _upi.focus();
			break;
	}
}

// lock or unlock the display of the notepad
function lockToggle(lockstate) {
	switch (lockstate) {
		case "lock":
			document.getElementById('notepad').setAttribute('data-lock-status', 'locked');
			let _npName = document.getElementById('np-name');
			if (_npName) _npName.onclick = null;
			document.getElementById('np-desc-textarea').readOnly = true;
			if (document.getElementById('np-desc-textarea').value == "") document.getElementById('np-desc').classList.add('hidden');
			document.getElementById('sticky-add').style.display = 'none';
			let _lbFa = document.querySelector('#lock-button .fa');
			_lbFa.classList.remove('fa-unlock'); _lbFa.classList.add('fa-lock');
			document.getElementById('lock-button').onclick = function() { unlockModal(); };
			break;
		case "unlock":
			document.getElementById('notepad').removeAttribute('data-lock-status');
			fillNotepadName();
			document.getElementById('np-desc-textarea').readOnly = false;
			if (document.getElementById('np-desc').classList.contains('hidden')) document.getElementById('np-desc').classList.remove('hidden');
			document.getElementById('sticky-add').style.display = '';
			let _lbFa2 = document.querySelector('#lock-button .fa');
			_lbFa2.classList.remove('fa-lock'); _lbFa2.classList.add('fa-unlock');
			document.getElementById('lock-button').onclick = function() { lockModal(); };
			break;
	}
}

// create or destroy the notepad root as a result of it becoming empty or getting its first note
// also handle the display of buttons in response
function notepadRoot(ntpdstate) {
	switch (ntpdstate) {
		case "create":
			let _ne = document.getElementById('notepad-empty'); if (_ne) _ne.remove();
			let notepadContent = [
				'<div id="notepad-table">',
				'	<div id="notepad-header">',
				'		<div class="col-1"></div>',
				'		<div class="col-2">',
				`			<button id="color-change-all-button" type="button" class="button empty palette color-selector" aria-label="${locale.notepad.change_colors}" title="${locale.notepad.change_colors}">`,
				'				<i class="fa fa-palette"></i>',
				'			</button>',
				'		</div>',
				'		<div class="col-3">',
				`			<button id="check-all-button" type="button" class="button empty checkbox" aria-label="${locale.notepad.check_all}" title="${locale.notepad.check_all}" data-check-state="0" onclick="checkAllBox();">`,
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
			document.getElementById('notepad').insertAdjacentHTML('beforeend', notepadContent);
			// make the notes sortable and movable
			notepadSortable = new Sortable(document.getElementById('notepad-body'), {
				animation: 150,
				handle: '.sort-button',
				delay: 150,
				delayOnTouchOnly: true,
				ghostClass: 'sortable-placeholder',
				onEnd: function() {
					reorderEntry();
				}
			});
			document.getElementById('delete-all-modal-button').classList.remove('disabled');
			document.getElementById('sort-modal-button').classList.remove('disabled');
			break;
		case "destroy":
			_ppClearAll();// close and clear all palette picker state
			if (notepadSortable) { notepadSortable.destroy(); notepadSortable = null; }
			let _nt = document.getElementById('notepad-table'); if (_nt) _nt.remove();
			let npEmptyContent = [
				'<div id="notepad-empty">',
				'	<i id="empty-folder">',
				'		<svg id="empty-folder-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle class="folder-bkg" cx="50" cy="50" r="49"/><path class="folder-otl" d="M47.7,71.36s-8.79,0-9.6,0c-3.18,0-6.21,0-9.63,0a20,20,0,0,1-3.19-.2,2.22,2.22,0,0,1-2.12-2.48c0-1.7,0-3.39,0-5.09q.06-13.87.11-27.75a6.63,6.63,0,0,1,.06-1,2.78,2.78,0,0,1,2.87-2.5c1.16,0,2.34,0,3.51,0,.85,0,1.6,0,2-.9.17-.46.45-.89.66-1.34a2,2,0,0,1,2-1.19h9.55c1.68,0,3.36,0,5,0a1.59,1.59,0,0,1,1.6,1c.25.52.53,1,.74,1.58a1.26,1.26,0,0,0,1.37.89c3.88,0,7.76-.07,11.64-.09,2,0,4,0,5.94,0a2.88,2.88,0,0,1,3,2.91c0,.83,0,1.67,0,2.5s.15.89.87.89h6.24c.24,0,.47,0,.7,0A1.79,1.79,0,0,1,82.7,41c-.23.85-.53,1.68-.83,2.51-1,2.76-2,5.51-3,8.27Q76.18,59.36,73.48,67c-.21.58-.41,1.16-.61,1.74a3.49,3.49,0,0,1-3.55,2.61c-3.46,0-3.46,0-10.39.06-3.74,0-3.74,0-11.23,0Z"/><path class="folder-bkg" d="M81.12,40.38c0,.2,0,.07-.06.29s-1,2.85-1.52,4.26-1.14,3-1.7,4.52c-.71,1.89-1.41,3.77-2.1,5.66-1.55,4.23-3,8.49-4.54,12.74-.38,1.07-1,1.33-2.06,1.33-12.76,0-25.46,0-38.22,0h-5c-.27,0-.33-.12-.28-.4a3.06,3.06,0,0,1,.13-.43c.83-2.32,1.69-4.63,2.51-6.95s1.56-4.56,2.36-6.84c.93-2.66,1.89-5.33,2.84-8q.89-2.43,1.79-4.87a7.41,7.41,0,0,1,.4-.86,1.14,1.14,0,0,1,1.13-.55H76.29c1.58,0,1.24,0,4,0h.58C81,40.29,81.14,40.27,81.12,40.38Z"/></svg>',
				'	</i>',
				`	<p class="larger">${locale.notepad.empty_msg}</p>`,
				`	<p class="ital">${locale.notepad.empty_tip}</p>`,
				'</div>'
			].join("\n");
			document.getElementById('notepad').insertAdjacentHTML('beforeend', npEmptyContent);
			document.getElementById('delete-all-modal-button').classList.add('disabled');
			document.getElementById('sort-modal-button').classList.add('disabled');
			break;
	}
}

// fill in notepad name element
function fillNotepadName() {
	let npnameContent = [
		'<div id="np-name-wrapper">',
		`	<div id="np-name" onclick="renameNotepad('edit');">${catalog[notepadIdLocal]["npname"]}</div>`,
		'</div>'
	].join("\n");
	document.getElementById('np-rename').innerHTML = npnameContent;
}

// fill in notepad description element
function fillNotepadDesc() {
	let npdescContent = [
		`<textarea id="np-desc-textarea" class="break-word" spellcheck="false" placeholder="${locale.notepad.desc_placeholder}" rows="1"></textarea>`,
		`<span id="np-desc-label"><span id="np-desc-char">0</span>/${npdescMaxChar} ${locale.notepad.desc_char}</span>`
	].join("\n");
	document.getElementById('np-desc').innerHTML = npdescContent;
	let _ndta = document.getElementById('np-desc-textarea');
	let _ndChar = document.getElementById('np-desc-char');
	let _ndLabel = document.getElementById('np-desc-label');
	function resizeDesc() {
		_ndta.style.height = 'auto';
		_ndta.style.height = _ndta.scrollHeight + 'px';
	}
	if (typeof catalog[notepadIdLocal]["npdesc"] !== 'undefined') {
		_ndta.value = catalog[notepadIdLocal]["npdesc"];
		let _ro = new ResizeObserver(function() {
			if (_ndta.offsetHeight > 0) {
				resizeDesc();
				_ro.disconnect();
			}
		});
		_ro.observe(_ndta);
	}
	_ndta.addEventListener('input', resizeDesc);
	_ndta.addEventListener('keydown', function(e) {
		if (e.key === "Enter") {
			e.preventDefault();
			_ndta.blur();
		} else if (
			e.key !== "Backspace" && e.key !== "Delete" &&
			e.key !== "PageUp" && e.key !== "PageDown" &&
			e.key !== "End" && e.key !== "Home" &&
			e.key !== "ArrowLeft" && e.key !== "ArrowUp" &&
			e.key !== "ArrowRight" && e.key !== "ArrowDown" &&
			!e.ctrlKey && !e.metaKey &&
			[...charSplitter.segment(_ndta.value)].length >= npdescMaxChar
		) {
			e.preventDefault();// block all other keys if at the character limit
		}
	});
	_ndta.addEventListener('keyup', function(e) {
		_ndChar.textContent = [...charSplitter.segment(_ndta.value)].length;
		if (e.key === "Escape") {// escape
			e.preventDefault();
			_ndta.value = (typeof catalog[notepadIdLocal]["npdesc"] !== 'undefined') ? catalog[notepadIdLocal]["npdesc"] : "";
			resizeDesc();
			_ndta.blur();
		}
	});
	_ndta.addEventListener('focusin', function() {
		_ndChar.textContent = [...charSplitter.segment(_ndta.value)].length;
		_ndLabel.classList.add("show");
		if (typeof quickAddFocusOut !== 'undefined') {
			clearTimeout(quickAddFocusOut);
			quickAddFocusOut = void 0;
		} else {
			stickyButtonsToggle("hide");
		}
	});
	_ndta.addEventListener('focusout', function() {
		_ndLabel.classList.remove("show");
		stickyButtonsToggle("show");
		changeNotepadDesc();
	});
	_ndta.addEventListener("paste", function(e) {
		if (clipboardAccess) {
			e.preventDefault();
			navigator.clipboard.readText().then(function(clipText) {
				let clipboard = clipText;
				let originalCount = [...charSplitter.segment(_ndta.value)].length;
				let pasteCount = [...charSplitter.segment(clipText)].length;
				if ((originalCount + pasteCount) > npdescMaxChar) {
					let clipboardMax = npdescMaxChar - originalCount;
					clipboard = [...charSplitter.segment(clipText)].slice(0, clipboardMax).map(function(s){return s.segment;}).join('');
				}
				_ndta.setRangeText(clipboard, _ndta.selectionStart, _ndta.selectionEnd, 'end');
				resizeDesc();
			});
		}
	});
}

//** NOTES **//

// create the edit note dialog
function buildEdit(domID) {
	// variables, objects, arrays
	npScroll = window.scrollY;// remember notepad scroll position, for when we return to it
	let ntColor, ntText;
	editDomId = domID;// store for saveNote() and deleteNoteOnEdit()
	if (typeof domID === 'undefined') {// are we pulling up an existing note or a blank new note?
		ntText = "";
		ntColor = 0;
	} else {
		let thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
		ntColor = notepads[notepadIdLocal][thisLocalId]["color"];
		ntText = notepads[notepadIdLocal][thisLocalId]["text"];
	}
	let editContent = [
		'<div id="color-selector-wrapper">',
		`	<div class="h3">${locale.edit.pick}</div>`,
		`	<button type="button" class="button circle color-selector" id="edit-color-selector" aria-label="${locale.notepad.change_color}" title="${locale.notepad.change_color}"><i class="fa fa-palette"></i></button>`,
		'</div>',
		'<form>',
		`	<textarea id="note-text" placeholder="${locale.edit.placeholder}" style="background-color: var(--color-${ntColor})"></textarea>`,
		'	<div id="note-edit-btns">',
		'		<div>',
		`			<button type="submit" class="button color green responsive" aria-label="${locale.general.save}" onclick="saveNote();">`,
		`				<i class="fa fa-check"></i><span> ${locale.general.save}</span>`,
		'			</button>',
		`			<button type="button" class="button responsive" aria-label="${locale.general.cancel}" onclick="returnToNotepad(npScroll);">`,
		`				<i class="fa fa-arrow-down fa-rotate-90"></i><span> ${locale.general.cancel}</span>`,
		'			</button>',
		'		</div>',
		'		<div>',
		`			<button type="button" class="button color red responsive" aria-label="${locale.general.delete}" onclick="deleteNoteOnEdit();">`,
		`				<i class="fa fa-trash"></i><span> ${locale.general.delete}</span>`,
		'			</button>',
		'		</div>',
		'	</div>',
		'</form>'
	].join("\n");
	document.getElementById('edit').insertAdjacentHTML('beforeend', editContent);
	let _editEl = document.getElementById('edit-color-selector');
	_pp.set(_editEl, { colorId: ntColor, opts: { change: function(colorId) { document.getElementById('note-text').style.backgroundColor = `var(--color-${colorId})`; } }, open: false, onDocClick: null });
	document.getElementById('note-text').value = ntText;// set note text
	if (typeof quickAddFocusOut !== 'undefined') {
		clearTimeout(quickAddFocusOut);
		quickAddFocusOut = void 0;
	} else {
		stickyButtonsToggle("hide");
	}
	anime.animate('#notepad', {
		opacity: [1, 0],
		translateX: ['0%', '-50%'],
		duration: speed,
		ease: 'inOutQuad',
		onComplete: function() {
			removeAllToolOverlays();// if any options overlays were visible back in the notepad we've now left, turn them off now
			document.getElementById('notepad').classList.remove('active-loc'); document.getElementById('notepad').removeAttribute('style');
			document.getElementById('edit').classList.add('active-loc');
			window.scrollTo(0, 0);
			updateState("edit", "jump");
			let noteText = document.getElementById('note-text');
			noteText.scrollTop = noteText.scrollHeight - noteText.clientHeight;// scroll note bottom
			anime.animate('#edit', {
				opacity: [0, 1],
				translateX: ['50%', '0%'],
				duration: speed,
				ease: 'inOutQuad',
				onComplete: function() {
					document.getElementById('edit').removeAttribute('style');
					noteText.focus();// focus note
					let inputLength = noteText.value.length;
					noteText.setSelectionRange(inputLength, inputLength);// set caret to note end
					noteText.scrollTop = noteText.scrollHeight - noteText.clientHeight;// scroll note bottom again, because, Safari
				}
			});
		}
	});
}

// save a note
function saveNote() {
	let domID = editDomId;
	// conditions for early bailing
	let _noteText = document.getElementById('note-text');
	if (_noteText.value == "") {
		popupMsg(locale.popup.empty, "red");
		return;
	}
	// variables, objects, arrays; visual updates
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	let thisColorId = _ppGet(document.getElementById('edit-color-selector'));
	let thisText = _noteText.value;
	let thisLocalId, thisRemoteId;
	if (typeof domID === 'undefined') {// create new note
		localNoteCounter++;
		thisLocalId = localNoteCounter;
		thisRemoteId = 0;
		domID = `#${notePrefix}${thisLocalId}`;
		editDomId = domID;// update so async callback can reference the new row
		idbSnapshotUpdate("count");
		let newNote = rowBuilder(thisLocalId, 0, thisColorId, 0, thisText);
		let maxOrg = 0;
		for (let n in notepads[notepadIdLocal]) { if (notepads[notepadIdLocal][n]["org"] > maxOrg) maxOrg = notepads[notepadIdLocal][n]["org"]; }
		notepads[notepadIdLocal][thisLocalId] = { "idRemote": 0, "org": maxOrg+1, "color": thisColorId, "isChecked": 0, "text": thisText, "lastEdit": Math.floor(tsAction/1000), "deleted": 0, "synced": 0 };
		if (!document.getElementById('notepad-table')) notepadRoot("create");
		document.getElementById('notepad-body').insertAdjacentHTML('afterbegin', newNote);
		setCheckAllState();
		returnToNotepad(undefined, domID);//it's a new note: don't specify previous scroll position (scroll to top)
	} else {// edit existing note
		thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
		thisRemoteId = Number(document.querySelector(domID).getAttribute('data-remote-id'));
		notepads[notepadIdLocal][thisLocalId]["color"] = thisColorId;
		notepads[notepadIdLocal][thisLocalId]["text"] = thisText;
		notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
		document.querySelector(domID).setAttribute('data-color', thisColorId);
		_ppSet(document.querySelector(`${domID} .color-selector`), thisColorId);
		fillNoteText("append", domID, thisText);
		returnToNotepad(npScroll, domID);
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/save-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: thisRemoteId,
				notetext: thisText,
				notecolor: thisColorId
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
							document.querySelector(domID).setAttribute('data-color', postData.color);
							_ppSet(document.querySelector(`${domID} .color-selector`), postData.color);
							fillNoteText("append", domID, postData.text);
							notepads[notepadIdLocal][thisLocalId]["color"] = postData.color;
							notepads[notepadIdLocal][thisLocalId]["text"] = postData.text;
						}
						if (postData["result"] == "success-new") {
							document.querySelector(domID).setAttribute('data-remote-id', postData.idRemote);
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
	let _qai = document.getElementById('quick-add-input');
	if (_qai.value == "") {
		popupMsg(locale.popup.empty, "red");
		return;
	}
	// variables, objects, arrays
	localNoteCounter++;
	let thisLocalId = localNoteCounter;
	idbSnapshotUpdate("count");
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	let domID = `#${notePrefix}${thisLocalId}`;
	let quickAddText = _qai.value;
	let newNote = rowBuilder(thisLocalId, 0, 0, 0, quickAddText);
	let maxOrg = 0;
	for (let n in notepads[notepadIdLocal]) { if (notepads[notepadIdLocal][n]["org"] > maxOrg) maxOrg = notepads[notepadIdLocal][n]["org"]; }
	notepads[notepadIdLocal][thisLocalId] = { "idRemote": 0, "org": maxOrg+1, "color": 0, "isChecked": 0, "text": quickAddText, "lastEdit": Math.floor(tsAction/1000), "deleted": 0, "synced": 0 };
	// visual updates
	if (!document.getElementById('notepad-table')) notepadRoot("create");
	document.getElementById('notepad-body').insertAdjacentHTML('afterbegin', newNote);
	setCheckAllState();
	linkifyInit(domID);
	_qai.addEventListener('blur', function() {// a long, crazy method of focusing out and in again, so as to reset any mobile keyboard autocompletes
		const quickAddInput = _qai;
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
	}, { once: true });
	_qai.value = ""; _qai.blur();
	document.getElementById('quick-add-button').classList.add('disabled');
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/quick-add",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				notetext: quickAddText
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
						document.querySelector(domID).setAttribute('data-remote-id', postData.idRemote);
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
	let thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	notepads[notepadIdLocal][thisLocalId]["deleted"] = 1;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	anime.animate(domID, {
		scale: { to: 0, duration: speed, ease: 'outSine' },
		onComplete: function(anim) {
			_ppClear(document.querySelector(`${domID} .color-selector`));
			document.querySelector(domID).remove();
			if (document.querySelectorAll('#notepad-body > div').length == 0) notepadRoot("destroy");
			setCheckAllState();
		}
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/delete-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number(document.querySelector(domID).getAttribute('data-remote-id'))
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
function deleteNoteOnEdit() {
	let domID = editDomId;
	// conditions for early bailing
	if (typeof domID === 'undefined') {
		returnToNotepad(npScroll);
		return;
	}
	// variables, objects, arrays
	let thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
	let thisRemoteId = Number(document.querySelector(domID).getAttribute('data-remote-id'));
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	notepads[notepadIdLocal][thisLocalId]["deleted"] = 1;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	_ppClear(document.querySelector(`${domID} .color-selector`));
	document.querySelector(domID).remove();
	if (document.querySelectorAll('#notepad-body > div').length == 0) notepadRoot("destroy");
	setCheckAllState();
	returnToNotepad(npScroll);
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/delete-note",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: thisRemoteId
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
	if (!document.getElementById('notepad-table')) return;
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["deleted"] = 1;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// visual updates
	anime.animate('#notepad-body > div', {
		scale: { to: 0, duration: speed, ease: 'outSine' },
		onComplete: function(anim) {
			notepadRoot("destroy");
		}
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/delete-all-notes",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"]
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row modal-window-wrapper-top">',
		`	<p>${locale.modal.delete_all}</p>`,
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		`	<button type="button" class="color red button large" aria-label="${locale.general.yes}" onclick="deleteAllNotes();">${locale.general.yes}</button>`,
		`	<button type="button" class="color green button large" aria-label="${locale.general.no}" onclick="modalToggle('off');">${locale.general.no}</button>`,
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
}

// display the API modal
function apiModal() {
	let apiURL = `/json/${catalog[notepadIdLocal]["nphash"]}`;
	let apiURLFull = `${window.location.origin}/json/${catalog[notepadIdLocal]["nphash"]}`;
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row modal-window-wrapper-top">',
		`	<p class="bold">${locale.modal.api.prompt}</p>`,
		`	<p>${locale.modal.api.prompt_detail}</p>`,
		`	<p><i class="fa fa-link"></i> <a id="api-modal-link" href="${apiURL}" target="_blank">${apiURLFull}</a></p>`,
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		`	<button type="button" class="button large" aria-label="${locale.general.close}" onclick="modalToggle('off');">${locale.general.close}</button>`,
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
}

// shuffle the note order around
function reorderEntry() {
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	let _sortedRows = Array.from(document.querySelectorAll('#notepad-body .note-row'));
	let orderArrayLocalId = _sortedRows.map(function(el) { return el.getAttribute('data-local-id'); });
	let orderArrayRemoteId = _sortedRows.map(function(el) { return el.getAttribute('data-remote-id'); });
	let c = 0;
	orderArrayLocalId.forEach(function(n) {
		notepads[notepadIdLocal][n]["org"] = orderArrayLocalId.length - c;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
		c++;
	});
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/reorder-entry",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				noteorder: orderArrayRemoteId
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
	let _nb = document.getElementById('notepad-body');
	let _rows = Array.from(document.querySelectorAll('.note-row'));
	switch (sortorder) {
		case "az":
			_rows.sort(function(a, b) {
				return a.querySelector(".note-full").textContent.toLowerCase() < b.querySelector(".note-full").textContent.toLowerCase() ? -1 : 1;
			});
			break;
		case "za":
			_rows.sort(function(a, b) {
				return a.querySelector(".note-full").textContent.toLowerCase() < b.querySelector(".note-full").textContent.toLowerCase() ? 1 : -1;
			});
			break;
		case "color":
			_rows.sort(function(a, b) {
				return a.getAttribute("data-color") > b.getAttribute("data-color") ? 1 : -1;
			});
			break;
		case "checked":
			_rows.sort(function(a, b) {
				return a.getAttribute("data-is-checked") < b.getAttribute("data-is-checked") ? 1 : -1;
			});
			break;
		case "unchecked":
			_rows.sort(function(a, b) {
				return a.getAttribute("data-is-checked") > b.getAttribute("data-is-checked") ? 1 : -1;
			});
			break;
	}
	_rows.forEach(function(row) { _nb.appendChild(row); });
	modalToggle("off");
	reorderEntry();
}

// display sort modal
function sortModal() {
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row modal-window-wrapper-top">',
		`	<p>${locale.modal.sort}</p>`,
		`	<button type="button" class="color red button large" aria-label="${locale.notepad.sort_az}" onclick="noteSort('az');"><i class="fa fa-sort-az"></i> ${locale.notepad.sort_az}</button>`,
		`	<button type="button" class="color orange button large" aria-label="${locale.notepad.sort_za}" onclick="noteSort('za');"><i class="fa fa-sort-za"></i> ${locale.notepad.sort_za}</button>`,
		`	<button type="button" class="color yellow button large" aria-label="${locale.notepad.sort_color}" onclick="noteSort('color');"><i class="fa fa-palette"></i> ${locale.notepad.sort_color}</button>`,
		'	<div class="spacer0"></div>',
		`	<button type="button" class="color cyan button large" aria-label="${locale.notepad.sort_checked}" onclick="noteSort('checked');"><i class="fa fa-checkbox-checked"></i> ${locale.notepad.sort_checked}</button>`,
		`	<button type="button" class="color blue button large" aria-label="${locale.notepad.sort_unchecked}" onclick="noteSort('unchecked');"><i class="fa fa-checkbox-unchecked"></i> ${locale.notepad.sort_unchecked}</button>`,
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		`	<button type="button" class="button large" aria-label="${locale.general.cancel}" onclick="modalToggle('off');">${locale.general.cancel}</button>`,
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
}

// move notes up and down
function moveUp(domID) {
	let targetRow = document.querySelector(domID);
	let prevRow = targetRow.previousElementSibling;
	if (!prevRow) return;
	removeAllToolOverlays();
	let prevClone = prevRow.cloneNode(true);
	prevClone.id = 'prev-clone';
	prevClone.style.zIndex = 999;
	prevClone.style.position = 'relative';
	prevRow.parentNode.insertBefore(prevClone, prevRow);
	prevRow.style.display = 'none';
	let targetClone = targetRow.cloneNode(true);
	targetClone.id = 'target-clone';
	targetClone.style.zIndex = 1000;
	targetClone.style.position = 'relative';
	targetRow.parentNode.insertBefore(targetClone, targetRow);
	targetRow.style.display = 'none';
	anime.animate('#prev-clone', {
		translateY: { to: targetClone.clientHeight, duration: speed, ease: 'inOutSine' }
	});
	anime.animate('#target-clone', {
		translateY: { to: `-${prevClone.clientHeight}`, duration: speed, ease: 'inOutSine' },
		onComplete: function(anim) {
			prevClone.remove();
			targetClone.remove();
			prevRow.parentNode.insertBefore(targetRow, prevRow);
			prevRow.style.display = '';
			targetRow.style.display = '';
			reorderEntry();
		}
	});
}

function moveDown(domID) {
	let targetRow = document.querySelector(domID);
	let nextRow = targetRow.nextElementSibling;
	if (!nextRow) return;
	removeAllToolOverlays();
	let nextClone = nextRow.cloneNode(true);
	nextClone.id = 'next-clone';
	nextClone.style.zIndex = 999;
	nextClone.style.position = 'relative';
	nextRow.parentNode.insertBefore(nextClone, nextRow);
	nextRow.style.display = 'none';
	let targetClone = targetRow.cloneNode(true);
	targetClone.id = 'target-clone';
	targetClone.style.zIndex = 1000;
	targetClone.style.position = 'relative';
	targetRow.parentNode.insertBefore(targetClone, targetRow);
	targetRow.style.display = 'none';
	anime.animate('#next-clone', {
		translateY: { to: `-${targetClone.clientHeight}`, duration: speed, ease: 'inOutSine' }
	});
	anime.animate('#target-clone', {
		translateY: { to: nextClone.clientHeight, duration: speed, ease: 'inOutSine' },
		onComplete: function(anim) {
			nextClone.remove();
			targetClone.remove();
			nextRow.parentNode.insertBefore(targetRow, nextRow.nextElementSibling);
			nextRow.style.display = '';
			targetRow.style.display = '';
			reorderEntry();
		}
	});
}

// change a note color
function changeColor(domID, colorId) {
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	let thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
	notepads[notepadIdLocal][thisLocalId]["color"] = colorId;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// visual updates
	document.querySelector(domID).setAttribute('data-color', colorId);
	_ppSet(document.querySelector(`${domID} .color-selector`), colorId);
	if (document.querySelector(`${domID} .col-4`).classList.contains('tools-disp')) {
		document.querySelectorAll(`${domID} .tools-disp`).forEach(function(el) { el.classList.remove('tools-disp'); });
		document.querySelectorAll(`${domID} .expand-button i`).forEach(function(el) { el.classList.toggle('fa-ellipsis-h'); el.classList.toggle('fa-ellipsis-v'); });
		_ppClear(document.querySelector(`${domID} .col-4 .color-selector`));
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/change-color",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number(document.querySelector(domID).getAttribute('data-remote-id')),
				notecolor: colorId
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
							document.querySelector(domID).setAttribute('data-color', postData.color);
							_ppSet(document.querySelector(`${domID} .color-selector`), postData.color);
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
function changeAllColors(colorId) {
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["color"] = colorId;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// visual updates
	document.querySelectorAll('#notepad-body > div').forEach(function(el) { el.setAttribute('data-color', colorId); });
	document.querySelectorAll('#notepad-body .color-selector').forEach(function(el) { _ppSet(el, colorId); });
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/change-color-all",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				notecolor: colorId
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
							document.querySelectorAll('#notepad-body > div').forEach(function(el) { el.setAttribute('data-color', postData.color); });
							document.querySelectorAll('#notepad-body .color-selector').forEach(function(el) { _ppSet(el, postData.color); });
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
	let toCheck = false;
	if (document.querySelector(domID).getAttribute('data-is-checked') == 0) toCheck = true;
	document.querySelector(domID).setAttribute('data-is-checked', toCheck ? 1 : 0);
	setCheckAllState();
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	let thisLocalId = Number(document.querySelector(domID).getAttribute('data-local-id'));
	notepads[notepadIdLocal][thisLocalId]["isChecked"] = toCheck ? 1 : 0;
	notepads[notepadIdLocal][thisLocalId]["lastEdit"] = Math.floor(tsAction/1000);
	notepads[notepadIdLocal][thisLocalId]["synced"] = 0;
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/check-box",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				ntid: Number(document.querySelector(domID).getAttribute('data-remote-id')),
				checkaction: toCheck
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", thisLocalId, wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
							document.querySelector(domID).setAttribute('data-is-checked', postData.isChecked ? 1 : 0);
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
	let checkState;
	if (document.querySelector('#notepad-header .checkbox').getAttribute('data-check-state') == 1) {
		// uncheck all
		document.querySelectorAll('#notepad-body > div').forEach(function(el) { el.setAttribute('data-is-checked', 0); });
		document.querySelector('#notepad-header .checkbox').setAttribute('data-check-state', 0);
		checkState = false;
	} else {
		// check all
		document.querySelectorAll('#notepad-body > div').forEach(function(el) { el.setAttribute('data-is-checked', 1); });
		document.querySelector('#notepad-header .checkbox').setAttribute('data-check-state', 1);
		checkState = true;
	}
	// variables, objects, arrays
	let wasSynced = globalSync;
	let tsAction = getUnixTimestampMS();
	for (let n in notepads[notepadIdLocal]) {
		notepads[notepadIdLocal][n]["isChecked"] = checkState ? 1 : 0;
		notepads[notepadIdLocal][n]["lastEdit"] = Math.floor(tsAction/1000);
		notepads[notepadIdLocal][n]["synced"] = 0;
	}
	// IDB and MySQL updates
	if ([0, 3].includes(offlineState)) {// if online
		apiFetch({
			type: "POST",
			url: "/api/check-all-box",
			data: JSON.stringify({
				nphash: catalog[notepadIdLocal]["nphash"],
				checkaction: checkState
			}),
			beforeSend: function() {
				statusIndicator("process");
				noteCommitHandler("delay", "all", wasSynced, tsAction, undefined);
			},
			success: function(postData) {
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
							document.querySelectorAll('#notepad-body > div').forEach(function(el) { el.setAttribute('data-is-checked', postData.isChecked ? 1 : 0); });
							document.querySelector('#notepad-header .checkbox').setAttribute('data-check-state', postData.isChecked ? 1 : 0);
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

// return (and optionally append) the note DOM elements on a specified note
function fillNoteText(resultAction, thisId, thisNote) {
	let isCut = false;
	let cutPos = null;
	let cutStr;
	if (thisNote.length > truncateNote) {
		let nextSpace = thisNote.indexOf(" ", truncateNote);
		let nextLb = thisNote.indexOf("\n", truncateNote);
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
			cutStr = `... <a href="#" class="nolink read-more" title="${locale.notepad.expand}">${locale.notepad.expand.toLowerCase()}</a>`;
			isCut = true;
		}
	}
	let noteFull = thisNote.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	let noteCut;
	if (isCut == true) {
		noteCut = thisNote.substr(0, cutPos).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#039;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + cutStr;
	} else {
		noteCut = noteFull;
	}
	let noteContent = [
		`<span class="note-short">${noteCut}</span>`,
		`<span class="note-full">${noteFull}</span>`
	].join("\n");
	if (resultAction== "append") { let _noteEl = document.querySelector(`${thisId} .note`); if (_noteEl) { _noteEl.innerHTML = ''; _noteEl.insertAdjacentHTML('beforeend', noteContent); } }
	return noteContent;
}

// build the notepad rows (notes)
function rowBuilder(thisLocalId, thisRemoteId, thisColor, thisChecked, thisNote) {
	let inputDomId = notePrefix + thisLocalId;
	let inputRemoteId = ((thisRemoteId == 0) || (thisRemoteId == "") || (thisRemoteId == null) || (typeof thisRemoteId === 'undefined')) ? "" : thisRemoteId;
	let noteContent = fillNoteText("return", `#${inputDomId}`, thisNote);
	let desktopTools = (window.innerWidth < desktopWidth) ? false : true;
	let thisRow = [
		`<div id="${inputDomId}" class="note-row" data-local-id="${thisLocalId}" data-remote-id="${inputRemoteId}" data-color="${thisColor}" data-is-checked="${thisChecked}">`,
		'	<div class="col-1">',
		`		<button type="button" class="button circle move-up-button" aria-label="${locale.notepad.moveup}" title="${locale.notepad.moveup}"><i class="fa fa-arrow-up"></i></button>`,
		`		<button type="button" class="button circle move-down-button" aria-label="${locale.notepad.movedown}" title="${locale.notepad.movedown}"><i class="fa fa-arrow-down"></i></button>`,
		'	</div>',
		'	<div class="col-2">',
		`		<button type="button" class="button circle expand-button" aria-label="${locale.notepad.options}" title="${locale.notepad.options}"><i class="fa fa-ellipsis-h"></i></button>`,
		... desktopTools ? ['		<div class="note-tool-btns">'] : [],
		... desktopTools ? [`			<button type="button" class="button circle sort-button" aria-label="${locale.notepad.reorder}" title="${locale.notepad.reorder}"><i class="fa fa-arrows"></i></button>`] : [],
		... desktopTools ? [`			<button type="button" class="button circle delete-button" aria-label="${locale.general.delete}" title="${locale.general.delete}"><i class="fa fa-trash"></i></button>`] : [],
		... desktopTools ? [`			<button type="button" class="button circle edit-button" aria-label="${locale.notepad.edit}" title="${locale.notepad.edit}"><i class="fa fa-pencil"></i></button>`] : [],
		... desktopTools ? [`			<button type="button" class="button circle color-selector" aria-label="${locale.notepad.change_color}" title="${locale.notepad.change_color}"><i class="fa fa-palette"></i></button>`] : [],
		... desktopTools ? ['		</div>'] : [],
		'	</div>',
		'	<div class="col-3">',
		`		<button type="button" class="button empty checkbox" aria-label="${locale.notepad.check}" title="${locale.notepad.check}"><i class="fa fa-checkbox"></i></button>`,
		'	</div>',
		'	<div class="col-4">',
		`		<div class="note break-word">${noteContent}</div>`,
		'	</div>',
		... clipboardAccess ? [`	<button class="copy-button" aria-label="${locale.notepad.note_copy}" title="${locale.notepad.note_copy}"><i class="fa fa-copy"></i></button>`] : [],
		'</div>'
	].join("\n");
	return thisRow;
}

// fully display a truncated note
function readMore(domID) {
	document.querySelector(`${domID} .note-short`).classList.add('hidden');
	document.querySelector(`${domID} .note-full`).classList.add('display');
}

// Linkify URLs in notes
function linkifyInit(whichtarget) {
	let target = (whichtarget == "all")
		? document.getElementById('notepad-body')
		: document.querySelector(`#notepad-body ${whichtarget}`);
	linkifyElement(target, { target: '_blank' });
	target.querySelectorAll('a').forEach(function(a) { a.setAttribute('rel', 'noopener noreferrer'); });
}

//** MODAL & UI **//

// lockdown or allow user control
function userControl(directive) {
	switch (directive) {
		case "lock":
			document.getElementById('user-lock').classList.add("display");
			break;
		case "open":
			document.getElementById('user-lock').classList.remove("display");
			break;
	}
}

// toggle the modal window on and off
// a lot of hack-y styling to accommodate a position: fixed, 100% height, no-scroll body -- which is necessary to prevent background scrolling on iOS
function modalToggle(op) {
	if ((op == "on") && (document.getElementById('modal').classList.contains('display'))) return;
	switch (op) {
		case "on":
			modalScroll = window.scrollY;
			let offsetY = `${modalScroll * (-1)}px`;
			let footerLocationCalc = window.innerHeight - document.getElementById('container').clientHeight - document.getElementById('header').clientHeight;
			let _footer = document.getElementById('footer');
			let footerHeight = _footer.clientHeight;
			let isIE11 = document.documentElement.classList.contains('ie11');
			document.addEventListener("keyup", modalEsc);
			document.body.classList.add('noscroll');
			document.body.style.top = offsetY;
			if (footerLocationCalc <= 110) {
				_footer.style.position = 'relative';
				_footer.style.marginTop = isIE11 ? '0' : `${footerHeight * -1}px`;
			}
			requestAnimationFrame(() => {
				document.getElementById('modal').classList.add('display');
			});
			break;
		case "off":
			document.getElementById('modal').classList.remove('display');
			document.getElementById('modal-window').innerHTML = '';
			document.removeEventListener("keyup", modalEsc);
			modalForce = false;
			requestAnimationFrame(() => {
				let _footer = document.getElementById('footer');
				_footer.style.position = '';
				_footer.style.marginTop = '';
				document.body.classList.remove('noscroll');
				document.body.style.top = '';
				window.scrollTo(0, modalScroll);
			});
			break;
	}
}

// listen for ESC key when modal is active
function modalEsc(e) {
	if ((e.key === "Escape") && (document.getElementById('modal').classList.contains('display')) && (!modalForce)) {
		modalToggle("off");
	}
}

// produce an error message
function errorModal(errcode, manualtext) {
	let dialogTxt;
	switch (errcode) {
		case "timeout":   dialogTxt = locale.modal.error.timeout;       break;
		case 403:         dialogTxt = locale.modal.error.http_code_403; break;
		case 404:         dialogTxt = locale.modal.error.http_code_404; break;
		case 408:         dialogTxt = locale.modal.error.http_code_408; break;
		case 500:         dialogTxt = locale.modal.error.http_code_500; break;
		case "manual":
			if (typeof manualtext !== 'undefined') { dialogTxt = manualtext; break; }
		default:          dialogTxt = locale.modal.error.catchall;      break;
	}
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row modal-window-wrapper-top">',
		`	<p>${dialogTxt}</p>`,
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		`	<button type="button" class="button color green large" aria-label="${locale.general.continue}" onclick="modalToggle('off');">${locale.general.continue}</button>`,
		`	<button type="button" class="button color cyan large" aria-label="${locale.general.reload}" onclick="window.location.reload();">${locale.general.reload}</button>`,
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
	userControl("open");
	statusIndicator("error");
}

// set the state of the check all button
function setCheckAllState() {
	let noteAttrTotal = 0;
	let _nbDivs = document.querySelectorAll('#notepad-body > div');
	_nbDivs.forEach(function(el) {
		noteAttrTotal += Number(el.getAttribute('data-is-checked'));
	});
	let _chkAll = document.querySelector('#notepad-header .checkbox');
	if (noteAttrTotal == 0) {
		_chkAll.setAttribute('data-check-state', 0);
	} else if (noteAttrTotal == _nbDivs.length) {
		_chkAll.setAttribute('data-check-state', 1);
	} else {
		_chkAll.setAttribute('data-check-state', 2);
	}
}

// build the note tools overlay
function toolsToggle(domID) {
	let thisnote = document.querySelector(`${domID} .col-4`);
	let thisbtn = document.querySelector(`${domID} .expand-button i`);
	if (document.querySelector(`${domID} .col-4 .note-tool-btns`) !== null) {
		_ppClear(document.querySelector(`${domID} .col-4 .note-tool-btns .color-selector`));
		document.querySelector(`${domID} .col-4 .note-tool-btns`).remove();
	}
	if (!thisnote.classList.contains('tools-disp')) {// if currently off
		let toolsContent = [
			'<div class="note-tool-btns">',
			`	<button type="button" class="button circle color-selector" aria-label="${locale.notepad.change_color}" title="${locale.notepad.change_color}"><i class="fa fa-palette"></i></button>`,
			`	<button type="button" class="button circle edit-button" aria-label="${locale.notepad.edit}" title="${locale.notepad.edit}"><i class="fa fa-pencil"></i></button>`,
			`	<button type="button" class="button circle delete-button" aria-label="${locale.general.delete}" title="${locale.general.delete}"><i class="fa fa-trash"></i></button>`,
			'</div>'
		].join("\n");
		thisnote.insertAdjacentHTML('afterbegin', toolsContent);
		thisnote.offsetHeight; // force reflow so scale transition fires
	}
	thisnote.classList.toggle('tools-disp');
	thisbtn.classList.toggle('fa-ellipsis-h');
	thisbtn.classList.toggle('fa-ellipsis-v');
}

// remove all tool overlays
function removeAllToolOverlays() {
	document.querySelectorAll('#notepad-body .tools-disp').forEach(function(el) { el.classList.remove('tools-disp'); });
	document.querySelectorAll('#notepad-body .expand-button i').forEach(function(el) { el.className = 'fa fa-ellipsis-h'; });
	document.querySelectorAll('#notepad-body .col-4 .color-selector').forEach(function(el) { _ppClear(el); });
}

// toggle the display of the notepad sticky buttons
function stickyButtonsToggle(showOrHide) {
	switch (showOrHide) {
		case "show":
			document.getElementById('sticky-buttons').classList.add('display');
			break;
		case "hide":
			document.getElementById('sticky-buttons').classList.remove('display');
			break;
	}
}

// toggle the display of the notepad expanded sticky buttons
function stickyExpandToggle() {
	let _sbe = document.getElementById('sticky-buttons-expand');
	if (!_sbe.classList.contains('display')) {
		anime.animate('#sticky-toggle .fa-ellipsis-v', {
			rotate: { to: 90, duration: speed, ease: 'inOutSine' }
		});
		_sbe.classList.add('display');
		document.getElementById('sticky-top').style.transform = 'scale(0)';
		document.getElementById('sticky-sort').style.transform = 'scale(0)';
		document.getElementById('sticky-refresh').style.transform = 'scale(0)';
		anime.animate('#sticky-top', {
			scale: { to: 1, duration: speed, ease: 'inOutSine' }
		});
		anime.animate('#sticky-sort', {
			scale: { to: 1, duration: speed, delay: 100, ease: 'inOutSine' }
		});
		anime.animate('#sticky-refresh', {
			scale: { to: 1, duration: speed, delay: 200, ease: 'inOutSine' }
		});
	} else {
		anime.animate('#sticky-toggle .fa-ellipsis-v', {
			rotate: { to: 0, duration: speed, ease: 'inOutSine' }
		});
		anime.animate('#sticky-buttons-expand button', {
			scale: { to: 0, duration: speed, ease: 'inOutSine' },
			onComplete: function(anim) {
				_sbe.classList.remove('display');
			}
		});
	}
}

// make the notepad sticky expanded buttons available or not based on document scroll position
// show it if the document y scroll position > 500px
function dispStickyExpand() {
	let _sbeg = document.getElementById('sticky-buttons-expand-group');
	if (!_sbeg) return;
	if (window.scrollY > 500) {
		if (!_sbeg.classList.contains('display')) {
			document.getElementById('sticky-toggle').style.display = 'inline';
			_sbeg.classList.add('display');
		}
	} else {
		if (_sbeg.classList.contains('display')) {
			_sbeg.classList.remove('display');
			setTimeout(function() { document.getElementById('sticky-toggle').style.display = ''; }, 400);
			if (document.getElementById('sticky-buttons-expand').classList.contains('display')) stickyExpandToggle();
		}
	}
}

// start & stop long touch copy animation on notes
function noteCopyAnimation(target, action) {
	switch (action) {
		case "start":
			document.querySelector(target).insertAdjacentHTML('beforeend', '<div class="circle-1"></div><div class="circle-2"></div><div class="circle-3"></div>');
			break;
		case "end":
			document.querySelectorAll('.circle-1, .circle-2, .circle-3').forEach(function(el) { el.remove(); });
			break;
		default:
			return;
			break;
	}
}

// display video modal
function videoModal() {
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row video-row">',
		'	<div class="video-wrap">',
		'		<div class="video-container">',
		'			<iframe src="https://www.youtube.com/embed/rGf_xXftWbA?autoplay=1&rel=0" frameborder="0" allowfullscreen></iframe>',
		'		</div>',
		'	</div>',
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
}

//** SETTINGS & SYNC **//

// display the settings modal window
function settingsModal() {
	let langOptions = (typeof availableLangs !== 'undefined') ? Object.entries(availableLangs).map(function(entry) {
		return `<option value="${entry[0]}"${entry[0] === langCode ? ' selected' : ''}>${entry[1]}</option>`;
	}).join('') : `<option value="${langCode}" selected>${langCode}</option>`;
	let themeOptions = themeRegistry.map(function(theme) {
		return `<option value="${theme.id}"${theme.id === currentTheme ? ' selected' : ''}>${locale.themes[theme.key]}</option>`;
	}).join('');
	let modalContent = [
		`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
		'<div class="row modal-window-wrapper-top">',
		`	<p class="bold">${locale.modal.settings.title}</p>`,
		`	<span class="settings-section-label">${locale.modal.settings.about}</span>`,
		'	<div class="spacer10"></div>',
		`	<span class="smaller"><span class="bold">${locale.modal.settings.app_version}: </span>${appVer}</span>`,
		'	<div class="spacer20"></div>',
		`	<span class="settings-section-label">${locale.modal.settings.appearance}</span>`,
		'	<div class="spacer10"></div>',
		`	<select id="settings-theme-select" class="settings-select" onchange="settingsSetTheme(parseInt(this.value));">${themeOptions}</select>`,
		'	<div class="spacer20"></div>',
		`	<span class="settings-section-label">${locale.modal.settings.language}</span>`,
		'	<div class="spacer10"></div>',
		`	<select id="settings-language-select" class="settings-select" onchange="settingsChangeLanguage(this.value);">${langOptions}</select>`,
		'	<div class="spacer20"></div>',
		`	<span class="settings-section-label">${locale.modal.settings.data}</span>`,
		'	<div class="spacer10"></div>',
		`	<p class="smaller">${locale.modal.settings.data_detail}</p>`,
		`	<button type="button" class="button color red large" onclick="idbEmpty().then(function() { window.location.replace(window.location.href+'?override=1'); });">${locale.modal.settings.purge_idb}</button>`,
		'</div>',
		'<div class="row modal-window-wrapper-bottom">',
		`	<button type="button" class="button large" onclick="modalToggle('off');">${locale.general.close}</button>`,
		'</div>'
	].join("\n");
	document.getElementById('modal-window').innerHTML = modalContent;
	modalToggle("on");
}

// set theme by ID without reload
function settingsSetTheme(id) {
	if (!themeRegistry[id]) return;
	currentTheme = id;
	localStorage.setItem('_theme', String(currentTheme));
	document.body.setAttribute('data-theme', currentTheme);
}

// change language: store preference and reload
function settingsChangeLanguage(code) {
	if (code === langCode) return;
	localStorage.setItem('_language', code);
	document.cookie = `lang=${code}; max-age=${60*60*24*365}; path=/; SameSite=Lax`;
	window.location.reload();
}

// sync all local-only IndexedDB changes --> MySQL, in not only this notepad but all notepads opened on the device
function syncAll(toggle) {
	// variables, objects, arrays
	let oosIndex = {};
	for (let npid in catalog) {
		oosIndex[npid] = {};
		for (let ntid in notepads[npid]) { if (notepads[npid][ntid]['synced'] === 0) oosIndex[npid][ntid] = notepads[npid][ntid]; }
		if ((Object.keys(oosIndex[npid]).length > 0) || (catalog[npid]['synced'] === 0)) oosIndex[npid]['notepad'] = catalog[npid];
		if (Object.keys(oosIndex[npid]).length === 0) delete oosIndex[npid];
	}
	// conditions for early bailing
	if ((globalSync) || (Object.keys(oosIndex).length === 0)) {
		globalSync = true;
		idbSnapshotUpdate("sync");
		setOfflineState("system", 0);
		modalToggle("off");
		popupMsg(locale.popup.sync.already, "blue");
		return;
	} else {
		// MySQL update
		apiFetch({
			type: "POST",
			url: "/api/sync-all",
			data: JSON.stringify({
				oosNotes: oosIndex,
				override: toggle
			}),
			beforeSend: function() {
				syncModal("process");
				modalForce = true;
			},
			onComplete: function() {
				modalForce = false;
			},
			success: function(postData) {
				if (postData.warning == true) {
					syncModal("error", postData);
				} else {
					// capture redirect destination before idbSyncWipe patches the in-memory catalog
					let newHash = ((appLoc == "notepad") && (!catalog[notepadIdLocal]["nphash"]) && (postData[notepadIdLocal] && postData[notepadIdLocal]["nphash"])) ? postData[notepadIdLocal]["nphash"] : null;
					idbSyncWipe(postData).then(function() {
						if (newHash) {
							window.location.replace(`/np/${newHash}?override=1`);
						} else {
							let url = new URL(window.location.href);
							url.searchParams.set('override', '1');
							window.location.replace(url.toString());
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
function syncModal(syncstep, apiData) {
	let modalContent;
	switch (syncstep) {
		case "dialog":
			if (offlineState == 1) setOfflineState("system", 2, "override");// if the system had set Offline Mode, whether or not to remain in it now belongs to the user
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p class="bold">${locale.modal.sync.dialog.prompt}</p>`,
				`	<p class="smaller">${locale.modal.sync.dialog.prompt_warning}</p>`,
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button color green large next" aria-label="${locale.modal.sync.dialog.sync_confirm}" onclick="syncAll();">${locale.modal.sync.dialog.sync_confirm}</button>`,
				`	<button type="button" class="button large" aria-label="${locale.modal.sync.dialog.sync_decline}" onclick="modalToggle('off');">${locale.modal.sync.dialog.sync_decline}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			modalToggle("on");
			break;
		case "process":
			modalContent = [
				'<div class="row" style="display: flex; justify-content: center; padding: 75px 25px;">',
				'	<div id="icon-sync-process"><i class="fa fa-refresh fa-spin"></i></div>',
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			break;
		case "error":
			let warnings = {
				"npnamefail": locale.modal.sync.error.npnamefail,
				"nprenamefail": locale.modal.sync.error.nprenamefail,
				"lockfail": locale.modal.sync.error.lockfail,
				"hashfail": locale.modal.sync.error.hashfail,
				"findfail": locale.modal.sync.error.findfail
			};
			let warningContent = [];
			for (let n in apiData) {
				if ((n != "warning") && (apiData[n]['result'] != "success")) {
					warningContent.push(
						'<div class="row">',
						`	<span class="bold"><i class="fa fa-pencil"></i>&nbsp;&nbsp;${apiData[n]["npname"]}</span>`,
						`	<p class="smaller" style="text-align: left;">${warnings[apiData[n]["result"]]}</p>`,
						'</div>'
					);
				}
			}
			modalContent = [
				`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
				'<div class="row modal-window-wrapper-top">',
				`	<p class="bold">${locale.modal.sync.error.prompt}</p>`,
				`	<p>${locale.modal.sync.error.prompt_detail}</p>`,
				'	<hr />',
				'	<div id="warning-details"></div>',
				'</div>',
				'<div class="row modal-window-wrapper-bottom">',
				`	<button type="button" class="button color cyan large" aria-label="${locale.modal.sync.error.override}" onclick="syncAll('override');">${locale.modal.sync.error.override}</button>`,
				`	<button type="button" class="button large" aria-label="${locale.general.cancel}" onclick="modalToggle('off');">${locale.general.cancel}</button>`,
				'</div>'
			].join("\n");
			document.getElementById('modal-window').innerHTML = modalContent;
			document.getElementById('warning-details').insertAdjacentHTML('beforeend', warningContent.join("\n"));
			break;
	}
}

//** INITIALIZATION **//

document.addEventListener('DOMContentLoaded', function() { _appReadyPromise.then(function() {
	_ppBuildPopup();// build the singleton palette picker popup
	// now that we have the current offline state, potentially toggle it based on internet connectivity
	if (internetConn) {
		console.log('Internet connection detected.');
		if (offlineState == 1) setOfflineState("system", 0);
	} else {
		console.log('Internet connection not detected. Turning on Offline Mode.');
		setOfflineState("system", 1);
		recheckInternet(15, 12);
	}
	document.body.setAttribute('data-internet', (internetConn) ? 1 : 0);
	// apply the current theme to the body tag
	document.body.setAttribute('data-theme', currentTheme);
	// refresh language cookie so PHP renders correctly on next page load
	document.cookie = `lang=${langCode}; max-age=${60*60*24*365}; path=/; SameSite=Lax`;
	// update all PHP-rendered locale strings from the JS locale (cookie may not have existed on this load)
	document.getElementById('splash-reload-button').textContent = locale.general.reload;
	document.getElementById('menu-button').title = locale.header.menu;
	document.getElementById('menu-button').setAttribute('aria-label', locale.header.menu);
	document.querySelector('.menu-app a').setAttribute('aria-label', locale.app.title);
	document.querySelector('.menu-app a span').textContent = locale.app.title;
	document.querySelector('.menu-about a').setAttribute('aria-label', locale.about.title);
	document.querySelector('.menu-about a span').textContent = locale.about.title;
	document.querySelector('.menu-credits a').setAttribute('aria-label', locale.credits.title);
	document.querySelector('.menu-credits a span').textContent = locale.credits.title;
	document.querySelector('.menu-contact a').setAttribute('aria-label', locale.contact.title);
	document.querySelector('.menu-contact a span').textContent = locale.contact.title;
	document.getElementById('offline-button').title = locale.header.offline_mode;
	document.getElementById('offline-button').setAttribute('aria-label', locale.header.offline_mode);
	document.getElementById('offline-text').textContent = locale.general.offline;
	document.getElementById('online-text').textContent = locale.general.online;
	document.querySelector('#notepad-input-label .label-text').innerHTML = locale.app.input_label;
	document.getElementById('notepad-input-info-button').title = locale.app.info;
	document.querySelector('#recent-notepads-label .label-text').textContent = locale.app.recent_label;
	document.getElementById('recent-notepads-button').textContent = locale.app.recent;
	// inject settings gear button immediately before #menu-button
	let _settingsBtn = document.createElement('button');
	_settingsBtn.id = 'settings-button';
	_settingsBtn.type = 'button';
	_settingsBtn.setAttribute('aria-label', locale.header.settings);
	_settingsBtn.setAttribute('title', locale.header.settings);
	_settingsBtn.innerHTML = '<i class="fa fa-cog"></i>';
	_settingsBtn.addEventListener('click', function() { settingsModal(); });
	document.getElementById('menu-button').insertAdjacentElement('beforebegin', _settingsBtn);
	// prevent all form submits from reloading the page
	document.addEventListener('submit', function(e) {
		if (e.target.matches('form')) e.preventDefault();
	});
	// declare modal window click actions
	document.getElementById('modal').addEventListener('click', function(e) {
		if (!modalForce) modalToggle("off");
	});
	document.getElementById('modal-window').addEventListener('click', function(e) {
		e.stopPropagation();
	});
	// add listener to home page input
	let _npInput = document.getElementById('notepad-input');
	let _findBtn = document.getElementById('find-notepad-button');
	_npInput.addEventListener('input', function() {
		if (this.value == "") {
			if (!_findBtn.classList.contains('disabled')) _findBtn.classList.add('disabled');
		} else {
			if (_findBtn.classList.contains('disabled')) _findBtn.classList.remove('disabled');
			if ([...charSplitter.segment(this.value)].length >= npnameMaxChar) { this.value = [...charSplitter.segment(this.value)].slice(0, npnameMaxChar).map(function(s){return s.segment;}).join(''); }
		}
	});
	_npInput.addEventListener('keyup', function(e) {
		if ((e.key === "Enter") && (!_findBtn.classList.contains('disabled'))) {
			if (document.activeElement) document.activeElement.blur();
			_findBtn.click();
		}
	});
	// set the web app mode status as a body tag attribute; if web app, add listener
	document.body.setAttribute('data-web-app', (isInWebApp) ? 1 : 0);
	if (isInWebApp) {
		let _rnBtn = document.getElementById('recent-notepads-button');
		let _rn = document.getElementById('recent-notepads');
		let _rnTouchStatus;
		_rnBtn.addEventListener('touchstart', function() {
			_rnTouchStatus = 'touchstart';
		});
		_rnBtn.addEventListener('touchmove', function() {
			_rnTouchStatus = 'touchmove';
		});
		function _rnToggle(event) {
			if ((event.type == 'click') || ((event.type == 'touchend') && (_rnTouchStatus == 'touchstart'))) {
				this.classList.toggle('active');
				if (getComputedStyle(_rn).maxHeight != '0px') {
					_rn.style.maxHeight = '0px';
				} else {
					_rn.style.maxHeight = `${_rn.scrollHeight}px`;
				}
			}
			if (event.type == 'touchend') _rnTouchStatus = void 0;
		}
		_rnBtn.addEventListener('click', _rnToggle);
		_rnBtn.addEventListener('touchend', _rnToggle);
	}
	// IndexedDB snapshot includes scroll position. Keep that updated on scroll.
	window.addEventListener('scroll', debounce(function() { idbSnapshotUpdate("pos"); }, 500));
	// run dispStickyExpand() now and also on screen scroll and resize
	dispStickyExpand();
	window.addEventListener('scroll', throttle(dispStickyExpand, 500));
	window.addEventListener('resize', debounce(dispStickyExpand, 500));
	// if the browser window resizes from mobile to desktop size or vice versa, build/destroy buttons accordingly
	let winWidth = window.innerWidth;
	window.addEventListener('resize', throttle(function() {
		if (document.getElementById('notepad').classList.contains('active-loc') && document.getElementById('notepad-table') !== null) {
			if ((winWidth >= desktopWidth) && (window.innerWidth < desktopWidth)) {// desktop --> mobile
				_ppClear(document.querySelector('#notepad-body .col-2 .note-tool-btns .color-selector'));
				document.querySelectorAll('#notepad-body .col-2 .note-tool-btns').forEach(function(el) { el.remove(); });
			} else if ((winWidth < desktopWidth) && (window.innerWidth >= desktopWidth)) {// mobile --> desktop
				buildNotepad("refresh");// refresh the notepad so's to re-run row builder and re-create those missing tools buttons
			}
		}
		winWidth = window.innerWidth;
	}, 500));
	// populate sticky button content
	let stickyButtonContent = [
		'<div id="sticky-buttons-expand-group">',
		'	<div id="sticky-buttons-expand">',
		`		<button id="sticky-refresh" type="button" class="button transparent" aria-label="${locale.notepad.refresh}" title="${locale.notepad.refresh}" onclick="buildNotepad('refresh');">`,
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-repeat fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		`		<button id="sticky-sort" type="button" class="button transparent" aria-label="${locale.notepad.sort}" title="${locale.notepad.sort}" onclick="sortModal();">`,
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-sort fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		`		<button id="sticky-top" type="button" class="button transparent" aria-label="${locale.notepad.go_to_top}" title="${locale.notepad.go_to_top}">`,
		'			<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-arrow-up fa-stack-1x fa-inverse"></i></span>',
		'		</button>',
		'	</div>',
		`	<button id="sticky-toggle" type="button" class="button transparent" aria-label="${locale.notepad.sticky_toggle}" title="${locale.notepad.sticky_toggle}" onclick="stickyExpandToggle();">`,
		'		<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-ellipsis-v fa-stack-1x fa-inverse"></i></span>',
		'	</button>',
		'</div>',
		`<button id="sticky-add" type="button" class="button transparent" aria-label="${locale.notepad.add_new}" title="${locale.notepad.add_new}" onclick="buildEdit();">`,
		'	<span class="fa-stack"><i class="fa fa-circle fa-stack-2x"></i><i class="fa fa-plus fa-stack-1x fa-inverse"></i></span>',
		'</button>'
	].join("\n");
	document.getElementById('sticky-buttons').innerHTML = stickyButtonContent;
	document.getElementById('sticky-top').addEventListener('click', function() {
		window.scrollTo({top: 0, behavior: 'smooth'});
		return false;
	});
	// define the onclick actions for all the buttons on the notes
	// these events are binded to document; they are not binded to any particular note and hence do not need to be called again
	document.addEventListener('click', function(e) {
		let _row = e.target.closest('.note-row');
		if (!_row) return;
		if (e.target.closest('.color-selector')) return;// handled by separate color picker listener
		if (e.target.closest('.move-up-button')) { moveUp(`#${_row.id}`); return; }
		if (e.target.closest('.move-down-button')) { moveDown(`#${_row.id}`); return; }
		if (e.target.closest('.expand-button')) { toolsToggle(`#${_row.id}`); return; }
		if (e.target.closest('.delete-button')) { deleteNote(`#${_row.id}`); return; }
		if (e.target.closest('.edit-button')) { buildEdit(`#${_row.id}`); return; }
		if (e.target.closest('.checkbox')) { checkBox(`#${_row.id}`); return; }
		if (e.target.closest('.read-more')) { readMore(`#${_row.id}`); return; }
	});
	// handle all color-selector button clicks (note-row, edit screen, change-all)
	document.addEventListener('click', function(e) {
		let el = e.target.closest('.color-selector');
		if (!el) return;
		if (!_pp.has(el)) {
			let opts = {};
			let _row = el.closest('.note-row');
			if (_row) {
				let _localId = Number(_row.getAttribute('data-local-id'));
				opts = {
					colorId: notepads[notepadIdLocal][_localId]['color'],
					change: function(colorId) { changeColor(`#${_row.id}`, colorId); }
				};
			} else if (el.closest('#color-change-all-button')) {
				opts = {
					label: locale.notepad.change_colors,
					change: function(colorId) {
						changeAllColors(colorId);
						_ppClear(el);
					}
				};
			} else {
				return;
			}
			_pp.set(el, { colorId: opts.colorId !== undefined ? opts.colorId : null, opts: opts, open: false, onDocClick: null });
		}
		_ppOpen(el, _pp.get(el));
	});
	if (clipboardAccess) {
		document.addEventListener('click', function(e) {
			let _btn = e.target.closest('.copy-button');
			if (!_btn || !e.target.closest('.note-row')) return;
			let thisId = e.target.closest('.note-row').id;
			window.clipboardButton = `#${thisId} .copy-button`;
			window.clipboardTarget = `#${thisId} .note-full`;
			let ntText = document.querySelector(window.clipboardTarget).textContent;
			navigator.clipboard.writeText(ntText).then(
				() => {
					_btn.classList.add('tooltipped', 'tooltipped-w');
					_btn.setAttribute('aria-label', locale.notepad.note_copy_success);
					window.setTimeout(function() {
						let _cb = document.querySelector(window.clipboardButton);
						if (_cb) { _cb.classList.remove('tooltipped', 'tooltipped-w'); _cb.removeAttribute('aria-label'); }
					}, 1000);
				},
				() => {
					_btn.classList.add('tooltipped', 'tooltipped-w');
					_btn.setAttribute('aria-label', locale.general.error);
					window.setTimeout(function() {
						let _cb = document.querySelector(window.clipboardButton);
						if (_cb) { _cb.classList.remove('tooltipped', 'tooltipped-w'); _cb.removeAttribute('aria-label'); }
					}, 1000);
				}
			);
		});
		document.addEventListener('touchstart', function(e) {
			if (!e.target.closest('#notepad-table .col-4')) return;
			touchStatus = 'touchstart';
			touchTime = getUnixTimestampMS();
			touchCoorStart = e.targetTouches[0].clientY;
			touchId = `#${e.target.closest('.note-row').id}`;
			let _noteEl = document.querySelector(`${touchId} .col-4 .note`);
			if (_noteEl) _noteEl.classList.add('disable-select');
			noteCopyAnimation(touchId, "start");
		});
		document.addEventListener('touchmove', function(e) {
			if (!e.target.closest('#notepad-table .col-4')) return;
			touchCoorMove = e.targetTouches[0].clientY;
			if ((touchCoorMove > (touchCoorStart + 15)) || (touchCoorMove < (touchCoorStart - 15))) {
				touchStatus = 'touchmove';
				noteCopyAnimation(touchId, "end");
			}
		});
		document.addEventListener('touchend', function(e) {
			if (!e.target.closest('#notepad-table .col-4')) return;
			if (!touchId) return;
			noteCopyAnimation(touchId, "end");
			if (((getUnixTimestampMS() - touchTime) >= 1000) && (touchStatus == 'touchstart')) {
				window.noteCopyText = document.querySelector(`${touchId} .note-full`).textContent;
				navigator.clipboard.writeText(window.noteCopyText).then(
					() => {
						popupMsg(locale.popup.note_copied);
					},
					() => {
						let modalContent = [
							`<i id="modal-close" class="fa fa-times" title="${locale.general.close}" onclick="modalToggle('off');"></i>`,
							'<div class="row modal-window-wrapper-top">',
							`	<button type="button" class="color red button large" aria-label="${locale.notepad.note_copy}" onclick="navigator.clipboard.writeText(window.noteCopyText);this.classList.remove('red');this.classList.add('green');this.textContent=locale.notepad.note_copy_success;">${locale.notepad.note_copy}</button>`,
							'</div>'
						].join("\n");
						document.getElementById('modal-window').innerHTML = modalContent;
						modalToggle("on");
					}
				);
			}
			let _noteEl2 = document.querySelector(`${touchId} .col-4 .note`);
			if (_noteEl2) _noteEl2.classList.remove('disable-select');
			touchStatus = touchTime = touchCoorStart = touchCoorMove = touchId = void 0;
		});
	}
	// listen for browser back and forward buttons
	window.addEventListener('popstate', function(event) {
		if (document.getElementById('splash').offsetParent !== null) splashHandler("clear");// the back button on Chrome for Android is doing strange things, like putting the splash screen back up and not clearing it
		let state = event.state;
		if (state) {
			switch (state.loc) {
				case "notepad":
					notepadIdLocal = state.npidLocal;
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
}) });// end _appReadyPromise.then()
