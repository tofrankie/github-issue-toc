import styleText from 'data-text:./toc.css'
import type { PlasmoCSConfig, PlasmoCSUIJSXContainer, PlasmoGetStyle, PlasmoRender } from 'plasmo'
import { useCallback, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { MESSAGE_TYPE } from '@/constants'
import { findHeadings, formatHeadings, isGitHubIssuePage, throttle, type Heading } from '@/utils'

declare global {
  interface Window {
    __plasmoTocRoot: Root
  }
}

export const getStyle: PlasmoGetStyle = () => {
  const style = document.createElement('style')
  style.textContent = styleText
  return style
}

export const config: PlasmoCSConfig = {
  matches: ['https://github.com/*'], // https://github.com/*/*/issues/*
  css: ['./toc.css'],
  run_at: 'document_end'
}

export const getRootContainer = () => {
  return new Promise(resolve => {
    const timer = setInterval(() => {
      const rootContainer = document.querySelector('#plasmo-toc')
      if (rootContainer) {
        clearInterval(timer)
        resolve(rootContainer)
        return
      }

      const rootContainerParent = document.querySelector('.Layout-sidebar')
      if (rootContainerParent) {
        clearInterval(timer)

        const rootContainer = document.createElement('div')
        rootContainer.id = 'plasmo-toc'
        rootContainerParent.appendChild(rootContainer)

        resolve(rootContainer)
      }
    }, 200)
  })
}

export const render: PlasmoRender<PlasmoCSUIJSXContainer> = async ({ createRootContainer }) => {
  const url = document.location.href
  if (!isGitHubIssuePage(url)) return

  const rootContainer = await createRootContainer()
  const root = createRoot(rootContainer)
  window.__plasmoTocRoot = root
  root.render(<Toc />)

  onIssueUpdate()
}

let observer: MutationObserver

// TODO: 监听内容高度变化，调整 toc 容器高度
function onIssueUpdate() {
  if (observer) observer.disconnect()

  observer = new MutationObserver(mutationsList => {
    // 当 issue 内容更新时，会先移除 TimelineItem 再重新添加
    const addedNodeList = mutationsList
      .filter(mutationRecord => {
        return mutationRecord.type === 'childList' && mutationRecord.addedNodes.length > 0
      })
      .map(mutationRecord => mutationRecord.addedNodes)
      .flat()

    if (addedNodeList.length === 0) return

    const firstCommentContainer = document.querySelector(
      '.js-discussion .TimelineItem .timeline-comment'
    )

    // @ts-ignore
    if (addedNodeList.includes(firstCommentContainer)) return

    recreateRoot()
  })

  const node = document.querySelector('.js-discussion')
  observer.observe(node, {
    childList: true,
    subtree: true
  })
}

async function recreateRoot() {
  const rootContainer = await getRootContainer()

  if (window.__plasmoTocRoot) {
    window.__plasmoTocRoot.unmount()
  }

  const root = createRoot(rootContainer as Element)
  window.__plasmoTocRoot = root
  root.render(<Toc />)

  onIssueUpdate()
}

export default function Toc() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState('')

  useEffect(() => {
    const headings = findHeadings()
    const formattedHeadings = formatHeadings(headings)

    headings.forEach((heading, index) => {
      heading.setAttribute('id', `heading-${index}`)
    })

    setHeadings(formattedHeadings)
  }, [])

  useEffect(() => {
    window.removeEventListener('scroll', updateActiveToc)
    if (headings.length === 0) return

    window.addEventListener('scroll', updateActiveToc)
    return () => {
      window.removeEventListener('scroll', updateActiveToc)
    }
  }, [headings])

  useEffect(() => {
    if (headings.length === 0) return

    const layoutSidebar = document.querySelector('.Layout-sidebar')
    const partialDiscussionSidebar = document.querySelector('#partial-discussion-sidebar')
    const plasmoToc = layoutSidebar.querySelector('#plasmo-toc') as HTMLElement

    // margin-top + boder
    const extraHeight = 16 + 1
    const stickyContainerHeight =
      layoutSidebar.clientHeight - partialDiscussionSidebar.clientHeight - extraHeight

    plasmoToc.style.height = `${stickyContainerHeight}px`
  }, [headings])

  const updateActiveToc = useCallback(
    throttle(() => {
      const headingsWithTop = headings.map(item => {
        const { top } = item.element.getBoundingClientRect()
        return { ...item, top: top - 84 } // 72 + 24
      })

      let matchedIndex = headingsWithTop.findIndex(item => item.top >= 0)

      const allHeadingInvisible = matchedIndex === -1
      const reachedBottom =
        document.documentElement.clientHeight + window.scrollY ===
        document.documentElement.scrollHeight

      if (allHeadingInvisible || reachedBottom) {
        matchedIndex = headingsWithTop.length - 1
      } else if (headingsWithTop[matchedIndex].top > 0 && matchedIndex > 0) {
        matchedIndex--
      }

      const activeHeadingId = headingsWithTop[matchedIndex].element.id
      setActiveHeadingId(activeHeadingId)
    }, 100),
    [headings]
  )

  if (headings.length === 0) return null

  const minLevel = Math.min(...headings.map(heading => heading.level))
  return (
    <div className="toc">
      <div className="toc-heading text-bold discussion-sidebar-heading">Table of contents</div>
      <ul className="toc-ul">
        {headings.map((heading, index) => {
          const { level, text } = heading
          return (
            <li
              key={`${text}_${level}_${index}`}
              className={`toc-li ${activeHeadingId === `heading-${index}` ? 'toc-li-active' : ''}`}>
              <a
                href={`#heading-${index}`}
                style={{ paddingLeft: `${(heading.level - minLevel) * 16 + 8}px` }}>
                {text}
              </a>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

chrome.runtime.onMessage.addListener(throttle(onBackgroundMessage, 500))

let plasmoTocMounting = false

function onBackgroundMessage(message: { type: string; payload: any }) {
  try {
    if (message.type !== MESSAGE_TYPE.PLASMO_TOC_MOUNT) return

    if (plasmoTocMounting) return
    plasmoTocMounting = true

    const rootContainer = document.querySelector('#plasmo-toc')
    if (rootContainer) return

    recreateRoot()
  } finally {
    plasmoTocMounting = false
  }
}
