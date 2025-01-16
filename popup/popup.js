const blurToggleByHostnameSwitchInput = document.getElementById(
	"blur_toggle_by_hostname_switch_input",
);
const blurToggleByHostnameSwitch = document.getElementById(
	"blur_toggle_by_hostname_switch",
);

const blurToggleGlobalSwitchInput = document.getElementById(
	"blur_toggle_global_switch_input",
);
const blurToggleGlobalSwitch = document.getElementById(
	"blur_toggle_global_switch",
);
const saveChangesToggleSwitchInput = document.getElementById(
	"save_changes_toggle_switch_input",
);
const saveChangesToggleSwitch = document.getElementById(
	"save_changes_toggle_switch",
);
const resetSavedChangesButtonByHostname = document.getElementById(
	"reset_by_hostname_button",
);

function applySettings() {
	browser.tabs.query({ currentWindow: true, active: true }).then((tabs) => {
		const hostname = new URL(tabs[0].url).hostname;
		browser.storage.local
			.get(["global_options", hostname])
			.then((options) => {
				let hostnameOptionsValue = options[hostname];
				let globalOptionsValue = options["global_options"];
				if (hostnameOptionsValue) {
					if (!hostnameOptionsValue.enabled) {
						blurToggleByHostnameSwitch.title =
							"Enable on this website (Ctrl+Alt+B)";
						blurToggleByHostnameSwitchInput.checked = false;
					} else {
						blurToggleByHostnameSwitch.title =
							"Disable on this website (Ctrl+Alt+B)";
						blurToggleByHostnameSwitchInput.checked = true;
					}
					if (
						!hostnameOptionsValue.blured_elements &&
						!hostnameOptionsValue.unblured_elements
					) {
						resetSavedChangesButtonByHostname.disabled = true;
						resetSavedChangesButtonByHostname.style.backgroundColor =
							"gray";
						resetSavedChangesButtonByHostname.style.cursor =
							"not-allowed";
					}
				} else {
					blurToggleByHostnameSwitch.title =
						"Disable on this website (Ctrl+Alt+B)";
					blurToggleByHostnameSwitchInput.checked = true;

					resetSavedChangesButtonByHostname.disabled = true;
					resetSavedChangesButtonByHostname.style.backgroundColor =
						"gray";
					resetSavedChangesButtonByHostname.style.cursor =
						"not-allowed";
				}
				if (globalOptionsValue) {
					if (!globalOptionsValue.enabled) {
						blurToggleGlobalSwitch.title = "Enable on all websites";
						blurToggleGlobalSwitchInput.checked = false;

						blurToggleByHostnameSwitchInput.disabled = true;
						blurToggleByHostnameSwitch.style.filter =
							"grayscale(100%)";
						blurToggleByHostnameSwitch.querySelector(
							".slider",
						).style.cursor = "not-allowed";
					} else {
						blurToggleGlobalSwitch.title =
							"Disable on all websites";
						blurToggleGlobalSwitchInput.checked = true;

						blurToggleByHostnameSwitchInput.disabled = false;
						blurToggleByHostnameSwitch.style.filter = "";
						blurToggleByHostnameSwitch.querySelector(
							".slider",
						).style.cursor = "pointer";
					}
					if (!globalOptionsValue.save_changes) {
						saveChangesToggleSwitch.title = "Enable saving changes";
						saveChangesToggleSwitchInput.checked = false;
					} else {
						saveChangesToggleSwitch.title =
							"Disable saving changes";
						saveChangesToggleSwitchInput.checked = true;
					}
				} else {
					blurToggleGlobalSwitch.title = "Disable on all websites";
					blurToggleGlobalSwitchInput.checked = true;

					saveChangesToggleSwitch.title = "Disable saving changes";
					saveChangesToggleSwitchInput.checked = true;
				}
			});
	});
}

function updateHostnameOptions() {
	browser.tabs.query({ currentWindow: true, active: true }).then((tabs) => {
		const hostname = new URL(tabs[0].url).hostname;
		browser.storage.local.get(hostname).then((options) => {
			let hostnameOptionsValue = options[hostname];
			hostnameOptionsValue = {
				...hostnameOptionsValue,
				enabled: blurToggleByHostnameSwitchInput.checked,
			};
			browser.storage.local
				.set({
					[hostname]: hostnameOptionsValue,
				})
				.then(() => {
					if (!hostnameOptionsValue.enabled) {
						blurToggleByHostnameSwitch.title =
							"Enable on this website (Ctrl+Alt+B)";
					} else {
						blurToggleByHostnameSwitch.title =
							"Disable on this website (Ctrl+Alt+B)";
					}
				});
		});
	});
}

function updateGlobalOptions() {
	browser.storage.local.get("global_options").then((options) => {
		let globalOptionsValue = options["global_options"];
		globalOptionsValue = {
			...globalOptionsValue,
			enabled: blurToggleGlobalSwitchInput.checked,
			save_changes: saveChangesToggleSwitchInput.checked,
		};
		browser.storage.local
			.set({
				global_options: globalOptionsValue,
			})
			.then(() => {
				if (!globalOptionsValue.enabled) {
					blurToggleGlobalSwitch.title = "Enable on all websites";

					blurToggleByHostnameSwitchInput.disabled = true;
					blurToggleByHostnameSwitch.style.filter = "grayscale(100%)";
					blurToggleByHostnameSwitch.querySelector(
						".slider",
					).style.cursor = "not-allowed";
				} else {
					blurToggleGlobalSwitch.title = "Disable on all websites";

					blurToggleByHostnameSwitchInput.disabled = false;
					blurToggleByHostnameSwitch.style.filter = "";
					blurToggleByHostnameSwitch.querySelector(
						".slider",
					).style.cursor = "pointer";
				}
				if (!globalOptionsValue.save_changes) {
					saveChangesToggleSwitch.title = "Enable saving changes";
				} else {
					saveChangesToggleSwitch.title = "Disable saving changes";
				}
			});
	});
}

const sendBlurToggleCmd = (tabId, isGlobal = false) => {
	return browser.tabs
		.sendMessage(tabId, { command: "blur_toggle", isGlobal })
		.catch(() => {});
};

(() => {
	applySettings();

	blurToggleByHostnameSwitchInput.addEventListener("click", () => {
		browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
			const hostname = new URL(tabs[0].url).hostname;
			browser.tabs.query({ url: `*://${hostname}/*` }, (tabs) => {
				Promise.allSettled(
					tabs.map((tab) => {
						const { id: tabId } = tab;
						return sendBlurToggleCmd(tabId);
					}),
				).then(() => {
					updateHostnameOptions();
				});
			});
		});
	});

	blurToggleGlobalSwitchInput.addEventListener("click", (e) => {
		browser.tabs.query({ url: `*://*/*` }, (tabs) => {
			if (e.target.checked) {
				Promise.allSettled(
					tabs.map((tab) => {
						const { id: tabId } = tab;
						return sendBlurToggleCmd(tabId, true);
					}),
				).then(() => {
					updateGlobalOptions();
				});
			} else {
				Promise.allSettled(
					tabs.map((tab) => {
						const { id: tabId } = tab;
						return sendBlurToggleCmd(tabId, true);
					}),
				).then(() => {
					updateGlobalOptions();
				});
			}
		});
	});

	saveChangesToggleSwitchInput.addEventListener("click", () => {
		updateGlobalOptions();
	});

	resetSavedChangesButtonByHostname.addEventListener("click", () => {
		browser.tabs
			.query({ currentWindow: true, active: true })
			.then((tabs) => {
				const hostname = new URL(tabs[0].url).hostname;
				browser.storage.local.get(hostname).then((options) => {
					const hostnameOptionsValue = options[hostname];
					if (hostnameOptionsValue) {
						delete hostnameOptionsValue.blured_elements;
						delete hostnameOptionsValue.unblured_elements;
						browser.storage.local
							.set({
								[hostname]: hostnameOptionsValue,
							})
							.then(() => {
								resetSavedChangesButtonByHostname.disabled = true;
								resetSavedChangesButtonByHostname.style.backgroundColor =
									"gray";
								resetSavedChangesButtonByHostname.style.cursor =
									"not-allowed";
							});
					}
				});
			});
	});
})();
