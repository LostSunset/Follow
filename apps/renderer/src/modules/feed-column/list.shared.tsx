import type { FeedViewType } from "@follow/constants"
import { views } from "@follow/constants"
import { stopPropagation } from "@follow/utils/dom"
import { cn } from "@follow/utils/utils"
import * as HoverCard from "@radix-ui/react-hover-card"
import { AnimatePresence, m } from "framer-motion"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { useGeneralSettingSelector } from "~/atoms/settings/general"
import { IconOpacityTransition } from "~/components/ux/transition/icon"
import { useNavigateEntry } from "~/hooks/biz/useNavigateEntry"
import { useAuthQuery } from "~/hooks/common"
import { Queries } from "~/queries"
import {
  subscriptionActions,
  useCategoryOpenStateByView,
  useSubscriptionByView,
} from "~/store/subscription"
import { useFeedUnreadStore } from "~/store/unread"

import { getFeedListSort, setFeedListSortBy, setFeedListSortOrder, useFeedListSort } from "./atom"
import { UnreadNumber } from "./unread-number"

export const useFeedsGroupedData = (view: FeedViewType) => {
  const { data: remoteData } = useAuthQuery(Queries.subscription.byView(view))

  const data = useSubscriptionByView(view) || remoteData

  const autoGroup = useGeneralSettingSelector((state) => state.autoGroup)

  return useMemo(() => {
    if (!data || data.length === 0) return {}

    const groupFolder = {} as Record<string, string[]>

    for (const subscription of data) {
      const category =
        subscription.category || (autoGroup ? subscription.defaultCategory : subscription.feedId)

      if (category) {
        if (!groupFolder[category]) {
          groupFolder[category] = []
        }
        groupFolder[category].push(subscription.feedId)
      }
    }

    return groupFolder
  }, [autoGroup, data])
}

export const useListsGroupedData = (view: FeedViewType) => {
  const { data: remoteData } = useAuthQuery(Queries.subscription.byView(view))

  const data = useSubscriptionByView(view) || remoteData

  return useMemo(() => {
    if (!data || data.length === 0) return {}

    const lists = data.filter((s) => "listId" in s)

    const groupFolder = {} as Record<string, string[]>

    for (const subscription of lists) {
      groupFolder[subscription.feedId] = [subscription.feedId]
    }

    return groupFolder
  }, [data])
}

export const useInboxesGroupedData = (view: FeedViewType) => {
  const { data: remoteData } = useAuthQuery(Queries.subscription.byView(view))

  const data = useSubscriptionByView(view) || remoteData

  return useMemo(() => {
    if (!data || data.length === 0) return {}

    const inboxes = data.filter((s) => "inboxId" in s)

    const groupFolder = {} as Record<string, string[]>

    for (const subscription of inboxes) {
      if (!subscription.inboxId) continue
      groupFolder[subscription.inboxId] = [subscription.inboxId]
    }

    return groupFolder
  }, [data])
}

const useUpdateUnreadCount = () => {
  useAuthQuery(Queries.subscription.unreadAll(), {
    refetchInterval: false,
  })
}

export const ListHeader = ({ view }: { view: number }) => {
  const { t } = useTranslation()
  const feedsData = useFeedsGroupedData(view)
  const categoryOpenStateData = useCategoryOpenStateByView(view)
  const expansion = Object.values(categoryOpenStateData).every((value) => value === true)
  useUpdateUnreadCount()

  const totalUnread = useFeedUnreadStore(
    useCallback(
      (state) => {
        let unread = 0

        for (const category in feedsData) {
          for (const feedId of feedsData[category]) {
            unread += state.data[feedId] || 0
          }
        }
        return unread
      },
      [feedsData],
    ),
  )

  const navigateEntry = useNavigateEntry()

  return (
    <div onClick={stopPropagation} className="mx-3 flex items-center justify-between px-2.5 py-1">
      <div
        className="text-base font-bold"
        onClick={(e) => {
          e.stopPropagation()
          if (!document.hasFocus()) return
          if (view !== undefined) {
            navigateEntry({
              entryId: null,
              feedId: null,
              view,
            })
          }
        }}
      >
        {view !== undefined && t(views[view].name)}
      </div>
      <div className="ml-2 flex items-center gap-3 text-base text-zinc-400 dark:text-zinc-600 lg:text-sm lg:!text-theme-vibrancyFg">
        <SortButton />
        {expansion ? (
          <i
            className="i-mgc-list-collapse-cute-re"
            onClick={() => subscriptionActions.expandCategoryOpenStateByView(view, false)}
          />
        ) : (
          <i
            className="i-mgc-list-expansion-cute-re"
            onClick={() => subscriptionActions.expandCategoryOpenStateByView(view, true)}
          />
        )}
        <UnreadNumber unread={totalUnread} className="text-xs !text-inherit" />
      </div>
    </div>
  )
}

const SORT_LIST = [
  { icon: "i-mgc-sort-ascending-cute-re", by: "count", order: "asc" },
  { icon: "i-mgc-sort-descending-cute-re", by: "count", order: "desc" },

  {
    icon: "i-mgc-az-sort-descending-letters-cute-re",
    by: "alphabetical",
    order: "asc",
  },
  {
    icon: "i-mgc-az-sort-ascending-letters-cute-re",
    by: "alphabetical",
    order: "desc",
  },
] as const

const SortButton = () => {
  const { by, order } = useFeedListSort()
  const { t } = useTranslation()

  const [open, setOpen] = useState(false)

  return (
    <HoverCard.Root open={open} onOpenChange={setOpen}>
      <HoverCard.Trigger
        onClick={() => {
          setFeedListSortBy(by === "count" ? "alphabetical" : "count")
        }}
        className="center"
      >
        <IconOpacityTransition
          icon2={
            order === "asc"
              ? tw`i-mgc-az-sort-descending-letters-cute-re`
              : tw`i-mgc-az-sort-ascending-letters-cute-re`
          }
          icon1={
            order === "asc" ? tw`i-mgc-sort-ascending-cute-re` : tw`i-mgc-sort-descending-cute-re`
          }
          status={by === "count" ? "init" : "done"}
        />
      </HoverCard.Trigger>

      <HoverCard.Portal forceMount>
        <HoverCard.Content className="z-10 -translate-x-4" sideOffset={5} forceMount>
          <AnimatePresence>
            {open && (
              <m.div
                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 10 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="relative z-10 rounded-md border border-border bg-theme-modal-background-opaque p-3 shadow-md dark:shadow-zinc-500/20"
              >
                <HoverCard.Arrow className="-translate-x-4 fill-border" />
                <section className="w-[170px] text-center">
                  <span className="text-[13px]">{t("sidebar.select_sort_method")}</span>
                  <div className="mt-4 grid grid-cols-2 grid-rows-2 gap-2">
                    {SORT_LIST.map(({ icon, by, order }) => {
                      const current = getFeedListSort()
                      const active = by === current.by && order === current.order
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setFeedListSortBy(by)
                            setFeedListSortOrder(order)
                          }}
                          key={`${by}-${order}`}
                          className={cn(
                            "center flex aspect-square rounded border border-border",

                            "ring-0 ring-accent/20 duration-200",
                            active && "border-accent bg-accent/5 ring-2",
                          )}
                        >
                          <i className={`${icon} size-5`} />
                        </button>
                      )
                    })}
                  </div>
                </section>
              </m.div>
            )}
          </AnimatePresence>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
