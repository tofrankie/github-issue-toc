import { MESSAGE_TYPE } from '@/constants'
import { isGitHubIssuePage } from '@/utils'

chrome.webNavigation.onCompleted.addListener(() => {
  /**
   * 监听历史记录变化
   *
   * https://github.com/owner/repo -> https://github.com/owner/repo/issues/1
   * https://github.com/owner/repo/issues -> https://github.com/owner/repo/issues/1
   * ...
   *
   * 以上这些情况无法在 document_end 时挂载目录，因为从 /issues 到 issues/1 不会重新加载页面，因为使用了 pushState() 方法。
   */
  chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    const { url, tabId } = details
    if (!isGitHubIssuePage(url)) return
    sendMessageToContentScript(tabId, { type: MESSAGE_TYPE.PLASMO_TOC_MOUNT, payload: details })
  })
})

async function sendMessageToContentScript(tabId: number, message: any) {
  try {
    chrome.tabs.sendMessage(tabId, message)
  } catch (error) {
    console.error(`Failed to send message: ${error}`)
  }
}
