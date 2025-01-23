const filterValue = "blur(15px)";
let hostname, hostnameOptions, globalOptions;
const unsavedElements = {
	blured: new Set(),
	unblured: new Set(),
};
const selectorCache = new Map();

(async () => {
	if (window.blur_guard_extension_loaded) return;
	window.blur_guard_extension_loaded = true;

	await getOptions();

	let hostnameOptionsValue = hostnameOptions;
	let globalOptionsValue = globalOptions;
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

	browser.runtime.onMessage.addListener(async ({ command, isGlobal }) => {
		await getOptions();

		let globalOptionsValue = globalOptions;
		let globalEnabled =
			globalOptionsValue && globalOptionsValue.enabled != undefined
				? globalOptionsValue.enabled
				: true;
		let saveChangesEnabled =
			globalOptionsValue && globalOptionsValue.save_changes != undefined
				? globalOptionsValue.save_changes
				: true;

		let hostnameOptionsValue = hostnameOptions;
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
			const { stopElementSelection, selectionAbortSignal } =
				startElementSelection();
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
						if (saveChangesEnabled) {
							saveBluredElement(targetedElement);
						} else {
							unsavedElements.blured.add(
								getCSSSelector(targetedElement),
							);
						}
					});
				},
				{
					once: true,
					capture: true,
					signal: selectionAbortSignal,
				},
			);
		} else if (command == "unblur_element") {
			const { stopElementSelection, selectionAbortSignal } =
				startElementSelection();
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
						if (saveChangesEnabled) {
							saveUnbluredElement(targetedElement);
						} else {
							unsavedElements.unblured.add(
								getCSSSelector(targetedElement),
							);
						}
					});
				},
				{
					once: true,
					capture: true,
					signal: selectionAbortSignal,
				},
			);
		}
	});
})();

async function getOptions() {
	hostname = window.location.hostname;
	options = await browser.storage.local.get([hostname, "global_options"]);
	hostnameOptions = options[hostname];
	globalOptions = options["global_options"];
}

function canIncludeDistraction(node) {
	computedStyle = getComputedStyle(node);
	if (
		computedStyle.backgroundImage.toLowerCase().includes("url") ||
		computedStyle.background.toLowerCase().includes("url") ||
		["IMG", "VIDEO", "IFRAME"].includes(node.tagName)
	) {
		return true;
	}
	return false;
}

function isBlured(element) {
	if (!element) return false;
	const savedBluredElements = hostnameOptions?.blured_elements || [];
	return Array.from(
		new Set([...savedBluredElements, ...unsavedElements.blured]),
	).some((elementPathStr) => {
		const elementPath = elementPathStr.split(" >>> ");
		if (elementPath.length == 1) {
			const bluredElement = document.querySelector(elementPath[0]);
			return bluredElement && bluredElement.contains(element);
		} else {
			const selectorCacheKey = elementPath;
			if (selectorCache.has(selectorCacheKey)) {
				const cachedElement = selectorCache.get(selectorCacheKey);
				return cachedElement.contains(element);
			}
			let currentElement = document;
			for (let i = 0; i < elementPath.length; i++) {
				let selectorPart = elementPath[i];
				currentElement = currentElement.querySelector(selectorPart);
				if (currentElement) {
					currentElement =
						currentElement.openOrClosedShadowRoot || currentElement;
				} else return false;
				if (i == elementPath.length - 1) {
					selectorCache.set(selectorCacheKey, currentElement);
					return currentElement.contains(element);
				}
			}
		}
	});
}

function isUnblured(element) {
	if (!element) return false;
	const savedUnbluredElements = hostnameOptions?.unblured_elements || [];
	return Array.from(
		new Set([...savedUnbluredElements, ...unsavedElements.unblured]),
	).some((elementPathStr) => {
		const elementPath = elementPathStr.split(" >>> ");
		if (elementPath.length == 1) {
			const unbluredElement = document.querySelector(elementPath[0]);
			return unbluredElement && unbluredElement.contains(element);
		} else {
			const selectorCacheKey = elementPath;
			if (selectorCache.has(selectorCacheKey)) {
				const cachedElement = selectorCache.get(selectorCacheKey);
				return cachedElement.contains(element);
			}
			let currentElement = document;
			for (let i = 0; i < elementPath.length; i++) {
				let selectorPart = elementPath[i];
				currentElement = currentElement.querySelector(selectorPart);
				if (currentElement) {
					currentElement =
						currentElement.openOrClosedShadowRoot || currentElement;
				} else return false;
				if (i == elementPath.length - 1) {
					selectorCache.set(selectorCacheKey, currentElement);
					return currentElement.contains(element);
				}
			}
		}
	});
}

function setBlurFilter(rootNode, skipSavedElements = false) {
	if (
		rootNode.nodeType == Node.ELEMENT_NODE &&
		canIncludeDistraction(rootNode) &&
		rootNode.tagName != "BODY"
	) {
		const skip = isUnblured(skipSavedElements ? rootNode : null);
		if (!skip) {
			rootNode.style.setProperty("filter", filterValue, "important");
			intersectionObserver.observe(rootNode);
		}
	}

	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);

	while (treeWalker.nextNode()) {
		const node = treeWalker.currentNode;
		const skip = isUnblured(skipSavedElements ? node : null);
		if (!skip) {
			if (canIncludeDistraction(node) && node.tagName != "BODY") {
				node.style.setProperty("filter", filterValue, "important");
				intersectionObserver.observe(node);
			}
			if (node.openOrClosedShadowRoot) {
				mutationObserver.observe(
					node.openOrClosedShadowRoot,
					mutationObserverOptions,
				);
				setBlurFilter(node.openOrClosedShadowRoot, skipSavedElements);
			}
		}
	}
}

function unsetBlurFilter(rootNode, skipSavedElements = false) {
	if (
		rootNode.nodeType == Node.ELEMENT_NODE &&
		canIncludeDistraction(rootNode) &&
		rootNode.tagName != "BODY"
	) {
		const skip = isBlured(skipSavedElements ? rootNode : null);
		if (!skip) {
			rootNode.style.removeProperty("filter");
			intersectionObserver.unobserve(rootNode);
		}
	}

	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);

	while (treeWalker.nextNode()) {
		const node = treeWalker.currentNode;
		const skip = isBlured(skipSavedElements ? node : null);
		if (!skip) {
			if (canIncludeDistraction(node) && node.tagName != "BODY") {
				node.style.removeProperty("filter");
				intersectionObserver.unobserve(node);
			}
			if (node.openOrClosedShadowRoot) {
				unsetBlurFilter(node.openOrClosedShadowRoot, skipSavedElements);
			}
		}
	}
}

const intersectionObserver = new IntersectionObserver(
	(entries) => {
		entries.forEach((entry) => {
			if (entry.isIntersecting) setBlurFilter(entry.target, true);
		});
	},
	{ threshold: 0.1 },
);

const mutationObserverOptions = {
	childList: true,
	subtree: true,
	attributes: true,
};

const mutationObserver = new MutationObserver((mutations) => {
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

async function startObserver() {
	let globalEnabled =
		globalOptions && globalOptions.enabled != undefined
			? globalOptions.enabled
			: true;

	let hostnameEnabled = hostnameOptions ? hostnameOptions.enabled : true;

	const isObserved = globalEnabled && hostnameEnabled;
	if (isObserved) {
		mutationObserver.observe(document.body, mutationObserverOptions);
	}
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
			setBlurFilter(document.body, true);
			bodyBlurStyle.remove();
			startObserver();
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
	if (element) {
		element.style.removeProperty("cursor");
	}
}

function prepareIframesForSelection(rootNode = document.body) {
	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);
	while (treeWalker.nextNode()) {
		const currentNode = treeWalker.currentNode;
		if (currentNode.tagName == "IFRAME") {
			currentNode.style.setProperty(
				"pointer-events",
				"none",
				"important",
			);
		}
		if (currentNode.openOrClosedShadowRoot) {
			prepareIframesForSelection(currentNode.openOrClosedShadowRoot);
		}
	}
}

function resetIframesAfterSelection(rootNode = document.body) {
	const treeWalker = document.createTreeWalker(
		rootNode,
		NodeFilter.SHOW_ELEMENT,
	);
	while (treeWalker.nextNode()) {
		const currentNode = treeWalker.currentNode;
		if (currentNode.tagName == "IFRAME") {
			currentNode.style.removeProperty("pointer-events");
		}
		if (currentNode.openOrClosedShadowRoot) {
			resetIframesAfterSelection(currentNode.openOrClosedShadowRoot);
		}
	}
}

function startElementSelection() {
	prepareIframesForSelection();

	const selectionAbortController = new AbortController();
	let selectedElement;
	let animationFrameId;
	document.body.addEventListener(
		"mousemove",
		(e) => {
			e.stopPropagation();
			const currentSelectedElement = e.composed
				? e.composedPath()[0]
				: e.target;
			unobserve(() => {
				cancelAnimationFrame(animationFrameId);
				animationFrameId = requestAnimationFrame(() => {
					if (currentSelectedElement != selectedElement) {
						if (selectedElement) {
							removeSelectionBox(selectedElement);
						}
						selectedElement = currentSelectedElement;
						showSelectionBox(selectedElement);
					}
				});
			});
		},
		{
			signal: selectionAbortController.signal,
		},
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

	const stopElementSelection = () => {
		removeSelectionBox(selectedElement);
		selectionAbortController.abort();
		resetIframesAfterSelection();
	};

	window.addEventListener(
		"keydown",
		(e) => {
			if (e.key == "Escape") {
				stopElementSelection();
			}
		},
		{ signal: selectionAbortController.signal },
	);

	return {
		stopElementSelection,
		selectionAbortSignal: selectionAbortController.signal,
	};
}

function getCSSSelector(element) {
	let path = "";
	let nextPathChar = ">";
	const pathPart = () => `${path ? `${nextPathChar} ${path}` : ""}`;
	while (element) {
		if (element === document.documentElement) {
			path = `${element.tagName.toLowerCase()} ${pathPart()}`;
			break;
		}

		if (element.getRootNode() instanceof ShadowRoot) {
			path = `${element.nodeName.toLowerCase()} ${pathPart()}`;
			element = element.getRootNode().host;
			nextPathChar = ">>>";
		} else {
			let selector = element.tagName.toLowerCase();
			if (element.id) {
				selector = `#${element.id}`;
				path = `${selector} ${pathPart()}`;
				break;
			} else {
				let sibling = element;
				let nth = 1;
				while (sibling.previousElementSibling) {
					sibling = sibling.previousElementSibling;
					if (sibling.nodeName.toLowerCase() === selector) nth++;
				}
				if (nth !== 1) selector += `:nth-of-type(${nth})`;
				path = `${selector} ${pathPart()}`;
			}
			element = element.parentElement;
			nextPathChar = ">";
		}
	}
	return path.trim();
}

function saveBluredElement(element) {
	let hostnameOptionsValue = hostnameOptions || { enabled: true };
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
}

function saveUnbluredElement(element) {
	let hostnameOptionsValue = hostnameOptions || { enabled: true };
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
}
