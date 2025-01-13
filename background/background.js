function updateHostnameOptions() {
	browser.tabs.query({ currentWindow: true, active: true }).then((tabs) => {
		const hostname = new URL(tabs[0].url).hostname;
		browser.storage.local.get(hostname).then((hostnameOptions) => {
			let hostnameOptionsValue = hostnameOptions[hostname];
			hostnameOptionsValue = {
				...hostnameOptionsValue,
				enabled: hostnameOptionsValue
					? !hostnameOptionsValue.enabled
					: false,
			};
			browser.storage.local.set({ [hostname]: hostnameOptionsValue });
		});
	});
}

const sendBlurToggleCmd = (tabId) => {
	return browser.tabs
		.sendMessage(tabId, { command: "blur_toggle" })
		.catch((_) => {});
};

function isAllowed(url) {
	const restricted = [
		"accounts-static.cdn.mozilla.net",
		"accounts.firefox.com",
		"addons.cdn.mozilla.net",
		"addons.mozilla.org",
		"api.accounts.firefox.com",
		"content.cdn.mozilla.net",
		"discovery.addons.mozilla.org",
		"install.mozilla.org",
		"oauth.accounts.firefox.com",
		"profile.accounts.firefox.com",
		"support.mozilla.org",
		"sync.services.mozilla.com",
	];
	const urlObj = new URL(url);
	if (
		!["http:", "https:"].includes(urlObj.protocol) ||
		restricted.includes(urlObj.hostname)
	) {
		return false;
	}
	return true;
}

function createContextMenu() {
	browser.menus.create({
		id: "unblur",
		title: "Unblur element",
		onclick(_, tab) {
			browser.tabs.sendMessage(tab.id, {
				command: "unblur_element",
			});
		},
	});

	browser.menus.create({
		id: "blur",
		title: "Blur element",
		onclick(_, tab) {
			browser.tabs.sendMessage(tab.id, {
				command: "blur_element",
			});
		},
	});
}

function removeContextMenu() {
	browser.menus.removeAll();
}

(() => {
	createContextMenu();

	browser.tabs.onUpdated.addListener(
		(_tabId, _info, tab) => {
			if (tab.status == "complete") {
				if (!isAllowed(tab.url)) {
					removeContextMenu();
				} else {
					createContextMenu();
				}
			}
		},
		{ properties: ["status", "url"] },
	);

	browser.tabs.onActivated.addListener(({ tabId }) => {
		browser.tabs.get(tabId).then((tab) => {
			if (!isAllowed(tab.url)) {
				removeContextMenu();
			} else {
				createContextMenu();
			}
		});
	});

	browser.commands.onCommand.addListener((command) => {
		if (command == "blur_toggle") {
			browser.storage.local
				.get("global_options")
				.then((globalOptions) => {
					let globalOptionsValue = globalOptions.global_options;
					if (
						!globalOptionsValue ||
						(globalOptionsValue && globalOptionsValue.enabled)
					) {
						browser.tabs.query(
							{ currentWindow: true, active: true },
							(tabs) => {
								const hostname = new URL(tabs[0].url).hostname;
								browser.tabs.query(
									{ url: `*://${hostname}/*` },
									(tabs) => {
										Promise.allSettled(
											tabs.map((tab) => {
												const { id: tabId } = tab;
												return sendBlurToggleCmd(tabId);
											}),
										).then(() => {
											updateHostnameOptions();
										});
									},
								);
							},
						);
					}
				});
		}
	});
})();
