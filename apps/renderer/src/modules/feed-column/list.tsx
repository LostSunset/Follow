import { useDraggable } from "@dnd-kit/core"
import { useMobile } from "@follow/components/hooks/useMobile.js"
import { ScrollArea } from "@follow/components/ui/scroll-area/index.js"
import type { FeedViewType } from "@follow/constants"
import { views } from "@follow/constants"
import { stopPropagation } from "@follow/utils/dom"
import { cn } from "@follow/utils/utils"
import * as HoverCard from "@radix-ui/react-hover-card"
import { AnimatePresence, m } from "framer-motion"
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import Selecto from "react-selecto"
import { useEventListener } from "usehooks-ts"

import { useGeneralSettingSelector } from "~/atoms/settings/general"
import { IconOpacityTransition } from "~/components/ux/transition/icon"
import { FEED_COLLECTION_LIST } from "~/constants"
import { useNavigateEntry } from "~/hooks/biz/useNavigateEntry"
import { useRouteFeedId } from "~/hooks/biz/useRouteParams"
import { useAuthQuery } from "~/hooks/common"
import { Queries } from "~/queries"
import {
  subscriptionActions,
  useCategoryOpenStateByView,
  useSubscriptionByView,
} from "~/store/subscription"
import { useFeedUnreadStore } from "~/store/unread"

import {
  getFeedListSort,
  setFeedAreaScrollProgressValue,
  setFeedListSortBy,
  setFeedListSortOrder,
  useFeedListSort,
  useSelectedFeedIds,
} from "./atom"
import { DraggableContext } from "./context"
import { useShouldFreeUpSpace } from "./hook"
import { SortableFeedList, SortByAlphabeticalInbox, SortByAlphabeticalList } from "./sort-by"
import { feedColumnStyles } from "./styles"
import { UnreadNumber } from "./unread-number"

const useFeedsGroupedData = (view: FeedViewType) => {
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

const useListsGroupedData = (view: FeedViewType) => {
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

const useInboxesGroupedData = (view: FeedViewType) => {
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

const FeedListImpl = forwardRef<HTMLDivElement, { className?: string; view: number }>(
  ({ className, view }, ref) => {
    const feedsData = useFeedsGroupedData(view)
    const listsData = useListsGroupedData(view)
    const inboxesData = useInboxesGroupedData(view)
    const categoryOpenStateData = useCategoryOpenStateByView(view)

    const hasData =
      Object.keys(feedsData).length > 0 ||
      Object.keys(listsData).length > 0 ||
      Object.keys(inboxesData).length > 0

    const feedId = useRouteFeedId()
    const navigateEntry = useNavigateEntry()

    const { t } = useTranslation()

    // Data prefetch
    useAuthQuery(Queries.lists.list())

    const hasListData = Object.keys(listsData).length > 0
    const hasInboxData = Object.keys(inboxesData).length > 0

    const scrollerRef = useRef<HTMLDivElement>(null)
    const selectoRef = useRef<Selecto>(null)
    const [selectedFeedIds, setSelectedFeedIds] = useSelectedFeedIds()

    const { attributes, listeners, setNodeRef, transform } = useDraggable({
      id: "selected-feed",
      disabled: selectedFeedIds.length === 0,
    })
    const style = useMemo(
      () =>
        transform
          ? ({
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              transitionDuration: "0",
              transition: "none",
            } as React.CSSProperties)
          : undefined,
      [transform],
    )

    const draggableContextValue = useMemo(
      () => ({
        attributes,
        listeners,
        style: {
          ...style,
          willChange: "transform",
        },
      }),
      [attributes, listeners, style],
    )

    useImperativeHandle(ref, () => scrollerRef.current!)

    useEventListener(
      "scroll",
      () => {
        const round = (num: number) => Math.round(num * 1e2) / 1e2
        const getPositions = () => {
          const el = scrollerRef.current
          if (!el) return

          return {
            x: round(el.scrollLeft / (el.scrollWidth - el.clientWidth)),
            y: round(el.scrollTop / (el.scrollHeight - el.clientHeight)),
          }
        }

        const newScrollValues = getPositions()
        if (!newScrollValues) return

        const { y } = newScrollValues
        setFeedAreaScrollProgressValue(y)
      },
      scrollerRef,
      { capture: false, passive: true },
    )

    const shouldFreeUpSpace = useShouldFreeUpSpace()
    const isMobile = useMobile()

    return (
      <div className={cn(className, "font-medium")}>
        <ListHeader view={view} />
        {!isMobile && (
          <Selecto
            className="!border-theme-accent-400 !bg-theme-accent-400/60"
            ref={selectoRef}
            rootContainer={document.body}
            dragContainer={"#feeds-area"}
            dragCondition={(e) => {
              const inputEvent = e.inputEvent as MouseEvent
              const target = inputEvent.target as HTMLElement
              const closest = target.closest("[data-feed-id]") as HTMLElement | null
              const dataFeedId = closest?.dataset.feedId

              if (
                dataFeedId &&
                selectedFeedIds.includes(dataFeedId) &&
                !isKeyForMultiSelectPressed(inputEvent)
              )
                return false

              return true
            }}
            onDragStart={(e) => {
              if (!isKeyForMultiSelectPressed(e.inputEvent as MouseEvent)) {
                setSelectedFeedIds([])
              }
            }}
            selectableTargets={["[data-feed-id]"]}
            continueSelect
            hitRate={1}
            onSelect={(e) => {
              const allChanged = [...e.added, ...e.removed]
                .map((el) => el.dataset.feedId)
                .filter((id) => id !== undefined)

              setSelectedFeedIds((prev) => {
                const added = allChanged.filter((id) => !prev.includes(id))
                const removed = new Set(allChanged.filter((id) => prev.includes(id)))
                return [...prev.filter((id) => !removed.has(id)), ...added]
              })
            }}
            scrollOptions={{
              container: scrollerRef.current as HTMLElement,
              throttleTime: 30,
              threshold: 0,
            }}
            onScroll={(e) => {
              scrollerRef.current?.scrollBy(e.direction[0] * 10, e.direction[1] * 10)
            }}
          />
        )}

        <ScrollArea.ScrollArea
          ref={scrollerRef}
          onScroll={() => {
            selectoRef.current?.checkScroll()
          }}
          mask={false}
          flex
          viewportClassName={cn("!px-3", shouldFreeUpSpace && "!overflow-visible")}
          rootClassName={cn("h-full", shouldFreeUpSpace && "overflow-visible")}
        >
          <div
            data-active={feedId === FEED_COLLECTION_LIST}
            className={cn(
              "mt-1 flex h-8 w-full shrink-0 cursor-menu items-center gap-2 rounded-md px-2.5",
              feedColumnStyles.item,
            )}
            onClick={(e) => {
              e.stopPropagation()
              if (view !== undefined) {
                navigateEntry({
                  entryId: null,
                  feedId: FEED_COLLECTION_LIST,
                  view,
                })
              }
            }}
          >
            <i className="i-mgc-star-cute-fi size-4 -translate-y-px text-amber-500" />
            {t("words.starred")}
          </div>
          {hasListData && (
            <>
              <div className="mt-1 flex h-6 w-full shrink-0 items-center rounded-md px-2.5 text-xs font-semibold text-theme-vibrancyFg transition-colors">
                {t("words.lists")}
              </div>
              <SortByAlphabeticalList view={view} data={listsData} />
            </>
          )}
          {hasInboxData && (
            <>
              <div className="mt-1 flex h-6 w-full shrink-0 items-center rounded-md px-2.5 text-xs font-semibold text-theme-vibrancyFg transition-colors">
                {t("words.inbox")}
              </div>
              <SortByAlphabeticalInbox view={view} data={inboxesData} />
            </>
          )}

          <DraggableContext.Provider value={draggableContextValue}>
            <div className="space-y-px" id="feeds-area" ref={setNodeRef}>
              {(hasListData || hasInboxData) && (
                <div
                  className={cn(
                    "mb-1 flex h-6 w-full shrink-0 items-center rounded-md px-2.5 text-xs font-semibold text-theme-vibrancyFg transition-colors",
                    Object.keys(feedsData).length === 0 ? "mt-0" : "mt-1",
                  )}
                >
                  {t("words.feeds")}
                </div>
              )}
              {hasData ? (
                <SortableFeedList
                  view={view}
                  data={feedsData}
                  categoryOpenStateData={categoryOpenStateData}
                />
              ) : (
                <div className="flex h-full flex-1 items-center font-normal text-zinc-500">
                  <Link
                    to="/discover"
                    className="absolute inset-0 mt-[-3.75rem] flex h-full flex-1 cursor-menu flex-col items-center justify-center gap-2"
                    onClick={stopPropagation}
                  >
                    <i className="i-mgc-add-cute-re text-3xl" />
                    <span className="text-base">{t("sidebar.add_more_feeds")}</span>
                  </Link>
                </div>
              )}
            </div>
          </DraggableContext.Provider>
        </ScrollArea.ScrollArea>
      </div>
    )
  },
)
FeedListImpl.displayName = "FeedListImpl"

const ListHeader = ({ view }: { view: number }) => {
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

export const FeedList = memo(FeedListImpl)
