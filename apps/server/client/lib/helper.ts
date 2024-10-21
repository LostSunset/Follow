import type { FeedOrListRespModel } from "@follow/models/types"
import { DEEPLINK_SCHEME } from "@follow/shared/constants"

export const getPreferredTitle = (feed?: FeedOrListRespModel | null) => {
  if (!feed?.id) {
    return feed?.title
  }

  return feed.title
}

export const getHydrateData = (key: string) => {
  return window.__HYDRATE__?.[key]
}

export const openInFollowApp = (deeplink: string, fallback: () => void): Promise<boolean> => {
  return new Promise((resolve) => {
    const timeout = 500
    let isAppOpened = false

    const handleBlur = () => {
      isAppOpened = true
      cleanup()
      resolve(true)
    }

    const cleanup = () => {
      window.removeEventListener("blur", handleBlur)
    }

    window.addEventListener("blur", handleBlur)

    window.location.href = `${DEEPLINK_SCHEME}://${deeplink}`

    setTimeout(() => {
      cleanup()
      if (!isAppOpened) {
        fallback()
        resolve(false)
      } else {
        // TODO present a modal to the user asking if they want to open the app
      }
    }, timeout)
  })
}
