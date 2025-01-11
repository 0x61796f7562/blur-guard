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

async function isBlured(element) {
	if (!element) return false;
	const hostname = window.location.hostname;
	const options = await browser.storage.local.get([hostname]);
	const hostnameOptionsValue = options[hostname];
	if (!hostnameOptionsValue) return false;
	if (!hostnameOptionsValue.blured_elements) return false;
	return hostnameOptionsValue.blured_elements.some((selector) =>
		Boolean(element.closest(selector)),
	);
}

async function isUnblured(element) {
	if (!element) return false;
	const hostname = window.location.hostname;
	const options = await browser.storage.local.get([hostname]);
	const hostnameOptionsValue = options[hostname];
	if (!hostnameOptionsValue) return false;
	if (!hostnameOptionsValue.unblured_elements) return false;
	return hostnameOptionsValue.unblured_elements.some((selector) =>
		Boolean(element.closest(selector)),
	);
}

function setBlurFilter(rootNode, skipSavedElements = false) {
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
		isUnblured(skipSavedElements ? node : null).then((skip) => {
			if (!skip) {
				if (canIncludeDistraction(node) && node.tagName != "BODY") {
					node.style.setProperty("filter", filterValue, "important");
					intersectionObserver.observe(node);
				}
				if (node.openOrClosedShadowRoot && node.tagName != "VIDEO") {
					mutationObserver.observe(
						node.openOrClosedShadowRoot,
						mutationObserverOptions,
					);
					setBlurFilter(
						node.openOrClosedShadowRoot,
						skipSavedElements,
					);
				}
			}
		});
	}
}

function unsetBlurFilter(rootNode, skipSavedElements = false) {
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
		isBlured(skipSavedElements ? node : null).then((skip) => {
			if (!skip) {
				if (canIncludeDistraction(node) && node.tagName != "BODY") {
					node.style.removeProperty("filter");
					intersectionObserver.unobserve(node);
				}
				if (node.openOrClosedShadowRoot && node.tagName != "VIDEO") {
					unsetBlurFilter(
						node.openOrClosedShadowRoot,
						skipSavedElements,
					);
				}
			}
		});
	}
}

const intersectionObserver = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) setBlurFilter(entry.target, true);
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
						setBlurFilter(node, true);
					});
				}
			} else if (type == "attributes") {
				if (attributeName == "style") {
					if (canIncludeDistraction(target)) {
						if (getComputedStyle(target).filter != filterValue) {
							setBlurFilter(target, true);
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
				setBlurFilter(document.body, true);
				bodyBlurStyle.remove();
				startObserver();
			}, firstPageLoadDelay);
		});
	} else {
		setBlurFilter(document.body, true);
		bodyBlurStyle.remove();
		startObserver();
	}
}

function removePageBlur() {
	stopObserver();
	unsetBlurFilter(document.body, true);
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

function getCSSSelector(element) {
	const path = [];
	while (element) {
		if (element === document.documentElement) {
			path.unshift(element.tagName.toLowerCase());
			break;
		}

		if (element.getRootNode() instanceof ShadowRoot) {
			const shadowHost = element.getRootNode().host;
			path.unshift(`:host ${element.tagName.toLowerCase()}`);
			element = shadowHost;
		} else {
			let selector = element.tagName.toLowerCase();
			if (element.id) {
				selector = `#${element.id}`;
				path.unshift(selector);
				break;
			} else {
				let sibling = element;
				let nth = 1;
				while (sibling.previousElementSibling) {
					sibling = sibling.previousElementSibling;
					if (sibling.nodeName.toLowerCase() === selector) nth++;
				}
				if (nth !== 1) selector += `:nth-of-type(${nth})`;
				path.unshift(selector);
			}
			element = element.parentElement;
		}
	}
	return path.join(" > ");
}

function saveBluredElement(element) {
	const hostname = window.location.hostname;
	browser.storage.local.get([hostname]).then((options) => {
		let hostnameOptionsValue = options[hostname] || {};
		hostnameOptionsValue = {
			...hostnameOptionsValue,
			blured_elements: [
				...new Set([
					...(hostnameOptionsValue.blured_elements
						? hostnameOptionsValue.blured_elements
						: []),
					getCSSSelector(element),
				]),
			],
			unblured_elements: hostnameOptionsValue.unblured_elements
				? hostnameOptionsValue.unblured_elements.filter(
						(el) => getCSSSelector(element) != el,
					)
				: [],
		};
		browser.storage.local.set({
			[hostname]: hostnameOptionsValue,
		});
	});
}

function saveUnbluredElement(element) {
	const hostname = window.location.hostname;
	browser.storage.local.get([hostname]).then((options) => {
		let hostnameOptionsValue = options[hostname] || {};
		hostnameOptionsValue = {
			...hostnameOptionsValue,
			unblured_elements: [
				...new Set([
					...(hostnameOptionsValue.unblured_elements
						? hostnameOptionsValue.unblured_elements
						: []),
					getCSSSelector(element),
				]),
			],
			blured_elements: hostnameOptionsValue.blured_elements
				? hostnameOptionsValue.blured_elements.filter(
						(el) => getCSSSelector(element) != el,
					)
				: [],
		};
		browser.storage.local.set({
			[hostname]: hostnameOptionsValue,
		});
	});
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
							const targetedElement = e.composed
								? e.composedPath()[0]
								: e.target;
							unobserve(() => {
								setBlurFilter(targetedElement);
								stopElementSelection();
							});
							saveBluredElement(targetedElement);
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
							const targetedElement = e.composed
								? e.composedPath()[0]
								: e.target;
							unobserve(() => {
								unsetBlurFilter(targetedElement);
								stopElementSelection();
							});
							saveUnbluredElement(targetedElement);
						},
						{ once: true, capture: true },
					);
				}
			});
	});
})();
