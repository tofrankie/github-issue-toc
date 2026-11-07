import type { PlasmoCSConfig, PlasmoCSUIJSXContainer, PlasmoGetStyle, PlasmoRender } from 'plasmo'
import type { Root } from 'react-dom/client'
import type { Heading } from '@/utils'
import styleText from 'data-text:./toc.css'
import { useCallback, useEffect, useState } from 'react'

import { createRoot } from 'react-dom/client'
import { MESSAGE_TYPE } from '@/constants'
import { findHeadings, formatHeadings, isGitHubIssuePage, throttle } from '@/utils'

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
  run_at: 'document_end',
}

/**
 * 超时保护：选择器失效（GitHub 改版）时避免轮询空转、recreatingRoot 卡死。
 * 注意不能用函数参数承载（默认值会被 plasmo 传入的 { anchor, mountState } 顶掉，导致 setTimeout delay 收到对象 → 立即触发 → 永远 resolve null）。
 */
const GET_ROOT_CONTAINER_TIMEOUT = 15000

export function getRootContainer() {
  return new Promise(resolve => {
    const finish = (value: Element | null) => {
      clearInterval(timer)
      clearTimeout(timeoutTimer)
      resolve(value)
    }

    const timer = setInterval(() => {
      // SPA 离开 issue 页后停止轮询，避免 Promise 永远 pending
      if (!isGitHubIssuePage(document.location.href)) {
        finish(null)
        return
      }

      const rootContainer = document.querySelector('#plasmo-toc')
      if (rootContainer) {
        finish(rootContainer)
        return
      }

      const contentAndSidebarWrapper = document.querySelector(
        '[class*="contentAndSidebarWrapper__"]'
      )
      const rootContainerParent = contentAndSidebarWrapper as HTMLElement | null
      if (rootContainerParent) {
        const rootContainer = document.createElement('div')
        rootContainer.id = 'plasmo-toc'
        rootContainerParent.prepend(rootContainer)

        finish(rootContainer)
      }
    }, 200)

    // 超时保护：选择器失效（GitHub 改版）时避免轮询空转、recreatingRoot 卡死
    const timeoutTimer = setTimeout(finish, GET_ROOT_CONTAINER_TIMEOUT, null)
  })
}

export const render: PlasmoRender<PlasmoCSUIJSXContainer> = async ({ createRootContainer }) => {
  const url = document.location.href
  if (!isGitHubIssuePage(url)) return

  const rootContainer = await createRootContainer()
  if (!rootContainer) return
  const root = createRoot(rootContainer)
  window.__plasmoTocRoot = root
  root.render(<Toc />)

  onIssueUpdate()
  watchRootContainer()
}

let observer: MutationObserver | undefined
let rootContainerObserver: MutationObserver | undefined
let recreatingRoot = false
let recreateTimer: ReturnType<typeof setTimeout> | undefined

// 防抖：mutation 突发（虚拟列表批量加载、hydration 多阶段替换）合并为一次重挂
function scheduleRecreateRoot(delay = 300) {
  clearTimeout(recreateTimer)
  recreateTimer = setTimeout(recreateRoot, delay)
}

// TODO: 监听内容高度变化，调整 toc 容器高度
function onIssueUpdate() {
  observer?.disconnect()

  // hydration 期间 issue-body 可能暂时不存在，此时由 watchRootContainer 兜底
  const node = document.querySelector('[data-testid="issue-body"]')
  if (!node) return

  // 监听 issue 内容更新
  observer = new MutationObserver(mutationsList => {
    const addedNodeList = mutationsList
      .filter(mutationRecord => {
        return mutationRecord.type === 'childList' && mutationRecord.addedNodes.length > 0
      })
      .map(mutationRecord => mutationRecord.addedNodes)
      .flat()

    if (addedNodeList.length === 0) return

    scheduleRecreateRoot()
  })

  observer.observe(node, {
    childList: true,
    subtree: true,
    characterData: true,
  })
}

/**
 * GitHub hydration / React 重渲染会整体替换 issue viewer 子树，挂载点 #plasmo-toc 会随宿主子树被一并销毁；
 * 且绑定在旧 issue-body 上的 observer 会随节点脱离文档而失效，无法再触发重挂。
 * 因此在 body 级监听容器是否存活，丢失后自动重挂，实现自愈。
 */
function watchRootContainer() {
  rootContainerObserver?.disconnect()

  rootContainerObserver = new MutationObserver(() => {
    if (!isGitHubIssuePage(document.location.href)) {
      stopWatching()
      return
    }

    if (!document.querySelector('#plasmo-toc')) {
      scheduleRecreateRoot()
    }
  })

  rootContainerObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

function stopWatching() {
  observer?.disconnect()
  rootContainerObserver?.disconnect()
  observer = undefined
  rootContainerObserver = undefined
}

async function recreateRoot() {
  // 本次重挂已覆盖待执行的防抖任务，取消之
  clearTimeout(recreateTimer)
  if (recreatingRoot) return
  recreatingRoot = true

  try {
    const rootContainer = (await getRootContainer()) as HTMLElement | null
    if (!rootContainer) return

    if (window.__plasmoTocRoot) {
      window.__plasmoTocRoot.unmount()
    }

    const root = createRoot(rootContainer)
    window.__plasmoTocRoot = root
    root.render(<Toc />)

    onIssueUpdate()
    watchRootContainer()
  } finally {
    recreatingRoot = false
  }
}

export default function Toc() {
  const [headings, setHeadings] = useState<Heading[]>([])
  const [activeHeadingId, setActiveHeadingId] = useState('')
  const [isLogin, setIsLogin] = useState(false)

  useEffect(() => {
    const loginIndicator =
      document.querySelector('header button [data-login]') ??
      document.querySelector('header button[data-login]')
    setIsLogin(Boolean(loginIndicator))
  }, [])

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
    if (!headings.length || activeHeadingId) return
    updateActiveToc()
  }, [headings, activeHeadingId])

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

  const scrollToHeading = useCallback(
    (e: React.MouseEvent<HTMLLIElement>) => {
      const headingId = e.currentTarget.dataset.href?.split('#')[1]
      const headingElement = document.getElementById(headingId)
      if (!headingElement) return

      /**
       * 不同登录态下 issue title 距离屏幕顶部的距离：
       * 未登录: header(72) + repository-container-header(120) = 192
       * 已登录: header(100) = 100
       *
       * 计算点击目录时的 top 值:
       * 已登陆时: offsetTop + 24 ✅ 效果良好，所以点击时设置的 top 应该是 124
       * 未登录时: offsetTop + x ✅ 加上高度差值，验证 OK
       */
      const customOffset = isLogin ? 24 : 24 + 92
      window.scrollTo({ top: headingElement.offsetTop + customOffset, behavior: 'instant' })
    },
    [isLogin]
  )

  if (headings.length === 0) return null

  const minLevel = Math.min(...headings.map(heading => heading.level))
  return (
    <div className="toc-container">
      <div className="toc">
        <div className="toc-heading text-bold discussion-sidebar-heading">Table of contents</div>
        <ul className="toc-ul">
          {headings.map((heading, index) => {
            const { level, text } = heading
            return (
              <li
                key={`${text}_${level}_${index}`}
                data-href={`#heading-${index}`}
                onClick={scrollToHeading}
                className={`toc-li ${activeHeadingId === `heading-${index}` ? 'toc-li-active' : ''}`}
              >
                <div
                  className="toc-li-text"
                  style={{ paddingLeft: `${(heading.level - minLevel) * 16 + 8}px` }}
                >
                  {text}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

chrome.runtime.onMessage.addListener(throttle(onBackgroundMessage, 500))

function onBackgroundMessage(message: { type: string; payload: any }) {
  if (message.type !== MESSAGE_TYPE.PLASMO_TOC_MOUNT) return

  // SPA 导航到 issue 页：无论容器是否残留都重建，顺带刷新目录数据
  // （并发由 recreateRoot 内部的 recreatingRoot 兜底）
  recreateRoot()
}
