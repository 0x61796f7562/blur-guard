const filterValue = "blur(15px)";

function canIncludeDistraction(node) {
	computedStyle = getComputedStyle(node);
	if (
		computedStyle.backgroundImage.toLowerCase().includes("url") ||
		computedStyle.background.toLowerCase().includes("url") ||
		["IMG", "PICTURE", "VIDEO", "IFRAME"].includes(node.tagName)
	) {
		return true;
	}
	return false;
}

function setBlurFilter(rootNode) {
	const nodesStack = [rootNode];
	while (nodesStack.length) {
		const node = nodesStack.pop();
		if (node.nodeType == Node.ELEMENT_NODE) {
			if (canIncludeDistraction(node) && node.tagName != "BODY") {
				node.style.setProperty("filter", filterValue, "important");
			}
			for (childNode of node.childNodes) nodesStack.push(childNode);
		}
	}
}

function unsetBlurFilter(rootNode) {
	const nodesStack = [rootNode];
	while (nodesStack.length) {
		const node = nodesStack.pop();
		if (node.nodeType == Node.ELEMENT_NODE) {
			if (canIncludeDistraction(node) && node.tagName != "BODY") {
				node.style.removeProperty("filter");
			}
			for (childNode of node.childNodes) nodesStack.push(childNode);
		}
	}
}

const observer = new MutationObserver((mutations) => {
	unobserve(() => {
		for (const { type, attributeName, addedNodes, target } of mutations) {
			if (type == "childList") {
				if (addedNodes) {
					addedNodes.forEach((node) => {
						setBlurFilter(node);
					});
				}
			} else if (type == "attributes") {
				if (attributeName == "style") {
					if (canIncludeDistraction(target)) {
						if (getComputedStyle(target).filter != filterValue) {
							setBlurFilter(target);
						}
					}
				}
			}
		}
	});
});

function startObserver() {
	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
	});
}

function stopObserver() {
	observer.disconnect();
}

function unobserve(callback) {
	stopObserver();
	callback();
	startObserver();
}

function applyPageBlur() {
	const bodyBlurStyle = document.createElement("style");
	bodyBlurStyle.textContent = `body { filter: ${filterValue} !important; }`;
	document.head.appendChild(bodyBlurStyle);

	if (document.readyState == "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			setBlurFilter(document.body);
			bodyBlurStyle.remove();
			startObserver();
		});
	} else {
		setBlurFilter(document.body);
		bodyBlurStyle.remove();
		startObserver();
	}
}

function removePageBlur() {
	stopObserver();
	unsetBlurFilter(document.body);
}

const selectionBox = document.createElement("div");
const overlay = document.createElement("div");
function showSelectionBox(element) {
	let boundingRect = element.getBoundingClientRect();
	element.style.setProperty("cursor", "crosshair");
	selectionBox.style.pointerEvents = "none";
	selectionBox.style.outline = "1px solid yellow";
	selectionBox.style.backgroundColor = "rgba(255, 255, 0, 0.2)";
	selectionBox.style.top = boundingRect.top + "px";
	selectionBox.style.left = boundingRect.left + "px";
	selectionBox.style.width = boundingRect.width + "px";
	selectionBox.style.height = boundingRect.height + "px";
	selectionBox.style.position = "fixed";
	selectionBox.style.setProperty("z-index", "2147483647", "important");

	overlay.style.pointerEvents = "none";
	overlay.style.backgroundColor = "black";
	overlay.style.opacity = "0.5";
	overlay.style.top = "0";
	overlay.style.left = "0";
	overlay.style.width = "100%";
	overlay.style.height = "100%";
	overlay.style.position = "fixed";
	selectionBox.style.setProperty("z-index", "2147483646", "important");

	document.body.appendChild(overlay);
	document.body.appendChild(selectionBox);
}

function removeSelectionBox(element) {
	overlay.remove();
	selectionBox.remove();
	if (element) element.style.removeProperty("cursor");
}

function startElementSelection() {
	const selectionAbortController = new AbortController();
	let selectedElement;
	document.body.addEventListener(
		"mouseover",
		(e) => {
			e.stopPropagation();
			selectedElement = e.target;
			unobserve(() => {
				showSelectionBox(selectedElement);
			});
		},
		{ signal: selectionAbortController.signal },
	);
	document.body.addEventListener(
		"mouseout",
		(e) => {
			e.stopPropagation();
			unobserve(() => {
				removeSelectionBox(selectedElement);
			});
		},
		{ signal: selectionAbortController.signal },
	);
	return () => {
		removeSelectionBox(selectedElement);
		selectionAbortController.abort();
	};
}

(() => {
	if (window.blur_guard_extension_loaded) return;
	window.blur_guard_extension_loaded = true;

	const hostname = window.location.hostname;
	browser.storage.local.get(["global_options", hostname]).then((options) => {
		let hostnameOptionsValue = options[hostname];
		let globalOptionsValue = options["global_options"];
		if (
			!globalOptionsValue ||
			(globalOptionsValue && globalOptionsValue.enabled)
		) {
			if (hostnameOptionsValue) {
				if (hostnameOptionsValue.enabled) {
					applyPageBlur();
				}
			} else {
				applyPageBlur();
			}
		}
	});

	browser.runtime.onMessage.addListener(({ command, isGlobal }) => {
		browser.storage.local
			.get(["global_options", hostname])
			.then((options) => {
				let globalOptionsValue = options["global_options"];
				let globalEnabled = globalOptionsValue
					? globalOptionsValue.enabled
					: true;

				let hostnameOptionsValue = options[hostname];
				let hostnameEnabled = hostnameOptionsValue
					? hostnameOptionsValue.enabled
					: true;

				if (command == "blur_toggle") {
					if (isGlobal) {
						if (!globalEnabled) {
							if (hostnameEnabled) {
								applyPageBlur();
							}
						} else {
							removePageBlur();
						}
					} else {
						if (!hostnameEnabled) {
							applyPageBlur();
						} else {
							removePageBlur();
						}
					}
				} else if (command == "blur_element") {
					const stopElementSelection = startElementSelection();
					document.body.addEventListener(
						"click",
						(e) => {
							e.preventDefault();
							e.stopImmediatePropagation();
							unobserve(() => {
								setBlurFilter(e.target);
								stopElementSelection();
							});
						},
						{ once: true, capture: true },
					);
				} else if (command == "unblur_element") {
					const stopElementSelection = startElementSelection();
					document.body.addEventListener(
						"click",
						(e) => {
							e.preventDefault();
							e.stopImmediatePropagation();
							unobserve(() => {
								unsetBlurFilter(e.target);
								stopElementSelection();
							});
						},
						{ once: true, capture: true },
					);
				}
			});
	});
})();
