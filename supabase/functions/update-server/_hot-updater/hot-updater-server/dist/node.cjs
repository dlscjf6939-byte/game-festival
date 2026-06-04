Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/node.ts
/**
* Converts a Hot Updater handler to a Node.js-compatible middleware
* Works with Express, Connect, and other frameworks using Node.js req/res
*
* @example
* ```typescript
* import { toNodeHandler } from "@hot-updater/server/node";
* import express from "express";
*
* const app = express();
*
* // Mount middleware
* app.use(express.json());
*
* // Mount hot-updater handler
* app.all("/hot-updater/*", toNodeHandler(hotUpdater));
* ```
*/
function toNodeHandler(hotUpdater) {
	return async (req, res) => {
		try {
			const url = `${req.protocol || "http"}://${req.get?.("host") || "localhost"}${req.url || "/"}`;
			const headers = new Headers();
			for (const [key, value] of Object.entries(req.headers)) if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
			let body;
			if (req.method && req.method !== "GET" && req.method !== "HEAD" && req.body) body = JSON.stringify(req.body);
			const webRequest = new globalThis.Request(url, {
				method: req.method || "GET",
				headers,
				body
			});
			const response = await hotUpdater.handler(webRequest);
			res.status(response.status);
			response.headers.forEach((value, key) => {
				res.setHeader(key, value);
			});
			const text = await response.text();
			if (text) res.send(text);
			else res.end();
		} catch (error) {
			console.error("Hot Updater handler error:", error);
			res.status(500);
			res.send("Internal Server Error");
		}
	};
}
//#endregion
exports.toNodeHandler = toNodeHandler;
