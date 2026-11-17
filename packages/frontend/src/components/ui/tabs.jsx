import * as React from 'react'
import { cva } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

function Tabs({ className, orientation = 'horizontal', ...props }) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn('group/tabs flex gap-2 data-horizontal:flex-col', className)}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-muted',
        line: 'gap-1 bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

/**
 * The tabs of a choice. In the default variant, one pill sits under the picked tab and glides to the
 * next one picked, instead of each tab drawing its own background.
 */
function TabsList({ className, variant = 'default', children, ...props }) {
  const list = React.useRef(null)
  const [pill, setPill] = React.useState(null)

  React.useLayoutEffect(() => {
    const el = list.current
    if (!el || variant !== 'default') return
    const place = () => {
      const active = el.querySelector('[data-slot="tabs-trigger"][data-state="active"]')
      setPill(
        active && {
          left: active.offsetLeft,
          top: active.offsetTop,
          width: active.offsetWidth,
          height: active.offsetHeight,
        }
      )
    }
    place()
    const picked = new MutationObserver(place)
    picked.observe(el, { attributes: true, subtree: true, attributeFilter: ['data-state'] })
    // A label that changes (language, count) moves the tabs
    const resized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place)
    resized?.observe(el)
    return () => {
      picked.disconnect()
      resized?.disconnect()
    }
  }, [variant])

  return (
    <TabsPrimitive.List
      ref={list}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), 'relative', className)}
      {...props}
    >
      {pill && (
        <span
          aria-hidden="true"
          data-slot="tabs-pill"
          className="absolute left-0 rounded-md bg-background shadow-sm transition-[transform,width] duration-300 ease-[cubic-bezier(0.3,1,0.4,1)] motion-reduce:transition-none dark:border dark:border-input dark:bg-input/30"
          style={{ top: pill.top, width: pill.width, height: pill.height, transform: `translateX(${pill.left}px)` }}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        'group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent',
        'data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground',
        // The pill of the list is the picked tab's background
        'group-data-[variant=default]/tabs-list:data-active:bg-transparent! group-data-[variant=default]/tabs-list:data-active:shadow-none! dark:group-data-[variant=default]/tabs-list:data-active:border-transparent!',
        'after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 text-sm outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
