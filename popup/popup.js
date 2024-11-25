const blurToggleSwitchInput = document.getElementById(
	"blur_toggle_switch_input",
);
const blurToggleSwitch = document.getElementById("blur_toggle_switch");

const blurToggleSwitchInputGlobal = document.getElementById(
	"blur_toggle_switch_input_global",
);
const blurToggleSwitchGlobal = document.getElementById(
	"blur_toggle_switch_global",
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
						blurToggleSwitch.title =
							"Enable on this website (Ctrl+Alt+B)";
						blurToggleSwitchInput.checked = false;
					} else {
						blurToggleSwitch.title =
							"Disable on this website (Ctrl+Alt+B)";
						blurToggleSwitchInput.checked = true;
					}
				} else {
					blurToggleSwitch.title =
						"Disable on this website (Ctrl+Alt+B)";
					blurToggleSwitchInput.checked = true;
				}
				if (globalOptionsValue) {
					if (!globalOptionsValue.enabled) {
						blurToggleSwitchGlobal.title = "Enable on all websites";
						blurToggleSwitchInputGlobal.checked = false;

						blurToggleSwitchInput.disabled = true;
						blurToggleSwitch.style.filter = "grayscale(100%)";
						blurToggleSwitch.querySelector(".slider").style.cursor =
							"not-allowed";
					} else {
						blurToggleSwitchGlobal.title =
							"Disable on all websites";
						blurToggleSwitchInputGlobal.checked = true;

						blurToggleSwitchInput.disabled = false;
						blurToggleSwitch.style.filter = "";
						blurToggleSwitch.querySelector(".slider").style.cursor =
							"pointer";
					}
				} else {
					blurToggleSwitchGlobal.title = "Disable on all websites";
					blurToggleSwitchInputGlobal.checked = true;
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
				enabled: blurToggleSwitchInput.checked,
			};
			browser.storage.local
				.set({
					[hostname]: hostnameOptionsValue,
				})
				.then(() => {
					if (!hostnameOptionsValue.enabled) {
						blurToggleSwitch.title =
							"Enable on this website (Ctrl+Alt+B)";
					} else {
						blurToggleSwitch.title =
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
			enabled: blurToggleSwitchInputGlobal.checked,
		};
		browser.storage.local
			.set({
				global_options: globalOptionsValue,
			})
			.then(() => {
				if (!globalOptionsValue.enabled) {
					blurToggleSwitchGlobal.title = "Enable on all websites";

					blurToggleSwitchInput.disabled = true;
					blurToggleSwitch.style.filter = "grayscale(100%)";
					blurToggleSwitch.querySelector(".slider").style.cursor =
						"not-allowed";
				} else {
					blurToggleSwitchGlobal.title = "Disable on all websites";

					blurToggleSwitchInput.disabled = false;
					blurToggleSwitch.style.filter = "";
					blurToggleSwitch.querySelector(".slider").style.cursor =
						"pointer";
				}
			});
	});
}

const sendBlurToggleCmd = (tabId, isGlobal = false) => {
	return browser.tabs
		.sendMessage(tabId, { command: "blur_toggle", isGlobal })
		.catch((_) => {});
};

(() => {
	applySettings();

	blurToggleSwitchInput.addEventListener("click", () => {
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

	blurToggleSwitchInputGlobal.addEventListener("click", (e) => {
		browser.tabs.query({ url: `*://*/*` }, (tabs) => {
			if (e.target.checked) {
				browser.scripting
					.getRegisteredContentScripts({
						ids: ["css_for_body_blur"],
					})
					.then((contentScripts) => {
						if (!contentScripts[0]) {
							browser.scripting
								.registerContentScripts([
									{
										id: "css_for_body_blur",
										matches: ["<all_urls>"],
										css: [
											"content_scripts/css/body_blur.css",
										],
										runAt: "document_start",
									},
								])
								.then(() => {
									Promise.allSettled(
										tabs.map((tab) => {
											const { id: tabId } = tab;
											return sendBlurToggleCmd(
												tabId,
												true,
											);
										}),
									).then(() => {
										updateGlobalOptions();
									});
								});
						}
					});
			} else {
				Promise.allSettled(
					tabs.map((tab) => {
						const { id: tabId } = tab;
						return sendBlurToggleCmd(tabId, true);
					}),
				).then(() => {
					browser.scripting
						.getRegisteredContentScripts({
							ids: ["css_for_body_blur"],
						})
						.then((contentScripts) => {
							if (contentScripts[0]) {
								browser.scripting
									.unregisterContentScripts({
										ids: ["css_for_body_blur"],
									})
									.then(() => {
										updateGlobalOptions();
									});
							}
						});
				});
			}
		});
	});
})();
