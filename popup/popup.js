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
const resetSavedChangesByHostnameButton = document.getElementById(
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
						resetSavedChangesByHostnameButton.disabled = true;
						resetSavedChangesByHostnameButton.style.backgroundColor =
							"gray";
						resetSavedChangesByHostnameButton.style.cursor =
							"not-allowed";
					}
				} else {
					blurToggleByHostnameSwitch.title =
						"Disable on this website (Ctrl+Alt+B)";
					blurToggleByHostnameSwitchInput.checked = true;

					resetSavedChangesByHostnameButton.disabled = true;
					resetSavedChangesByHostnameButton.style.backgroundColor =
						"gray";
					resetSavedChangesByHostnameButton.style.cursor =
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

(() => {
	applySettings();

	blurToggleByHostnameSwitchInput.addEventListener("click", (e) => {
		browser.tabs.query({ currentWindow: true, active: true }, (tabs) => {
			const hostname = new URL(tabs[0].url).hostname;
			browser.runtime.sendMessage({
				command: "hostname_enabled_toggle",
				hostname,
			});
			if (e.target.checked) {
				blurToggleByHostnameSwitch.title =
					"Disable on this website (Ctrl+Alt+B)";
			} else {
				blurToggleByHostnameSwitch.title =
					"Enable on this website (Ctrl+Alt+B)";
			}
		});
	});

	blurToggleGlobalSwitchInput.addEventListener("click", (e) => {
		browser.runtime.sendMessage({ command: "global_enabled_toggle" });
		if (e.target.checked) {
			blurToggleGlobalSwitch.title = "Disable on all websites";

			blurToggleByHostnameSwitchInput.disabled = false;
			blurToggleByHostnameSwitch.style.filter = "";
			blurToggleByHostnameSwitch.querySelector(".slider").style.cursor =
				"pointer";
		} else {
			blurToggleGlobalSwitch.title = "Enable on all websites";

			blurToggleByHostnameSwitchInput.disabled = true;
			blurToggleByHostnameSwitch.style.filter = "grayscale(100%)";
			blurToggleByHostnameSwitch.querySelector(".slider").style.cursor =
				"not-allowed";
		}
	});

	saveChangesToggleSwitchInput.addEventListener("click", (e) => {
		browser.runtime.sendMessage({ command: "global_save_changes_toggle" });
		if (e.target.checked) {
			saveChangesToggleSwitch.title = "Disable saving changes";
		} else {
			saveChangesToggleSwitch.title = "Enable saving changes";
		}
	});

	resetSavedChangesByHostnameButton.addEventListener("click", () => {
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
								resetSavedChangesByHostnameButton.disabled = true;
								resetSavedChangesByHostnameButton.style.backgroundColor =
									"gray";
								resetSavedChangesByHostnameButton.style.cursor =
									"not-allowed";
							});
					}
				});
			});
	});
})();
