import './index.css'

export default function Popup() {
  return (
    <div className="popup">
      <div className="greeting"> Enjoy it. ❤️</div>
      <div className="links">
        <a className="link" href="https://github.com/toFrankie/github-issue-toc" target="_blank">
          Homepage
        </a>
        <span className="separator">•</span>
        <a
          className="link"
          href="https://github.com/toFrankie/github-issue-toc/issues"
          target="_blank">
          Report issue
        </a>
      </div>
    </div>
  )
}
