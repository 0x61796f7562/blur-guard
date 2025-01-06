const filterValue = "blur(15px)";
const firstPageLoadDelay = 1000;

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
	if (
		rootNode.nodeType == Node.ELEMENT_NODE &&
		canIncludeDistraction(rootNode) &&
		rootNode.tagName != "BODY"
	) {
		rootNode.style.setProperty("filter", filterValue, "important");
		intersectionObserver.observe(rootNode);
	}

	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);

	while (treeWalker.nextNode()) {
		const node = treeWalker.currentNode;
		if (canIncludeDistraction(node) && node.tagName != "BODY") {
			node.style.setProperty("filter", filterValue, "important");
			intersectionObserver.observe(node);
		}
		if (node.openOrClosedShadowRoot && node.tagName != "VIDEO") {
			mutationObserver.observe(
				node.openOrClosedShadowRoot,
				mutationObserverOptions,
			);
			setBlurFilter(node.openOrClosedShadowRoot);
		}
	}
}

function unsetBlurFilter(rootNode) {
	if (
		rootNode.nodeType == Node.ELEMENT_NODE &&
		canIncludeDistraction(rootNode) &&
		rootNode.tagName != "BODY"
	) {
		rootNode.style.removeProperty("filter");
		intersectionObserver.unobserve(rootNode);
	}

	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);

	while (treeWalker.nextNode()) {
		const node = treeWalker.currentNode;
		if (canIncludeDistraction(node) && node.tagName != "BODY") {
			node.style.removeProperty("filter");
			intersectionObserver.unobserve(node);
		}
		if (node.openOrClosedShadowRoot && node.tagName != "VIDEO") {
			unsetBlurFilter(node.openOrClosedShadowRoot);
		}
	}
}

const intersectionObserver = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) setBlurFilter(entry.target);
		});
	},
	{ threshold: 0 },
);

const mutationObserverOptions = {
	childList: true,
	subtree: true,
	attributes: true,
};

const mutationObserver = new MutationObserver((mutations) => {
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
	mutationObserver.observe(document.body, mutationObserverOptions);
}

function stopObserver() {
	mutationObserver.disconnect();
	intersectionObserver.disconnect();
}

function unobserve(callback) {
	stopObserver();
	callback();
	startObserver();
}

function applyPageBlur() {
	const bodyBlurStyle = document.createElement("style");
	bodyBlurStyle.textContent = `body { filter: ${filterValue} !important; }`;
	document.head && document.head.appendChild(bodyBlurStyle);

	if (document.readyState == "loading") {
		document.addEventListener("DOMContentLoaded", () => {
			setTimeout(() => {
				setBlurFilter(document.body);
				bodyBlurStyle.remove();
				startObserver();
			}, firstPageLoadDelay);
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
		"mousemove",
		(e) => {
			e.stopPropagation();
			selectedElement = e.composed ? e.composedPath()[0] : e.target;
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
								setBlurFilter(
									e.composed ? e.composedPath()[0] : e.target,
								);
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
								unsetBlurFilter(
									e.composed ? e.composedPath()[0] : e.target,
								);
								stopElementSelection();
							});
						},
						{ once: true, capture: true },
					);
				}
			});
	});
})();
