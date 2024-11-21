/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from "workbox-precaching"
import { NavigationRoute, registerRoute } from "workbox-routing"

declare let self: ServiceWorkerGlobalScope

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

// self.__WB_MANIFEST is the default injection point
precacheAndRoute(self.__WB_MANIFEST)

// clean old assets
cleanupOutdatedCaches()

/** @type {RegExp[] | undefined} */
let allowlist
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV) allowlist = [/^\/$/]

let denylist: undefined | RegExp[]
if (import.meta.env.PROD) {
  denylist = [
    // exclude sw: if the user navigates to it, fallback to index.html
    /^\/sw.js$/,
    // exclude webmanifest: has its own cache
    /^\/manifest-(.*).webmanifest$/,
  ]
}

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), { allowlist, denylist }))
