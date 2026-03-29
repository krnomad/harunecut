import { useEffect } from 'react'
import { Link, Outlet, useBeforeUnload, useLocation, useNavigate } from 'react-router-dom'
import { GenerationOverlay } from './GenerationOverlay'
import { BottomNav } from './BottomNav'
import { useApp } from '../providers/AppProvider'

function titleFromPath(pathname: string) {
  if (pathname === '/') {
    return '오늘의 기록'
  }

  if (pathname.startsWith('/create')) {
    return '생성하기'
  }

  if (pathname.startsWith('/generate')) {
    return '생성 진행'
  }

  if (pathname.startsWith('/result')) {
    return '결과 보기'
  }

  if (pathname.startsWith('/library/')) {
    return '상세 보기'
  }

  if (pathname.startsWith('/library')) {
    return '보관함'
  }

  return '설정'
}

export function AppLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { generation, cancelGeneration } = useApp()
  const isGenerationLocked = generation?.status === 'running'

  useBeforeUnload((event) => {
    if (!isGenerationLocked) {
      return
    }

    event.preventDefault()
    event.returnValue = ''
  })

  useEffect(() => {
    if (isGenerationLocked && location.pathname !== '/generate') {
      navigate('/generate', { replace: true })
    }
  }, [isGenerationLocked, location.pathname, navigate])

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link
          to="/"
          className="brand-lockup"
          aria-label="하루네컷 홈으로"
          onClick={(event) => {
            if (!isGenerationLocked) {
              return
            }

            event.preventDefault()
          }}
        >
          <span className="brand-badge">HN</span>
          <span>
            <strong className="brand-title">하루네컷</strong>
            <span className="brand-subtitle">일기를 네 컷 만화로 남기는 기록 앱</span>
          </span>
        </Link>
        <div className="topbar-label">{titleFromPath(location.pathname)}</div>
      </header>

      <main className="main-shell">
        <Outlet />
      </main>

      <BottomNav disabled={isGenerationLocked} />

      {generation?.status === 'running' ? (
        <GenerationOverlay generation={generation} onCancel={() => void cancelGeneration()} />
      ) : null}
    </div>
  )
}
