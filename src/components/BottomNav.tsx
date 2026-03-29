import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: '홈' },
  { to: '/create', label: '생성' },
  { to: '/library', label: '보관함' },
  { to: '/settings', label: '설정' },
]

export function BottomNav({ disabled = false }: { disabled?: boolean }) {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {navItems.map((item) => {
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={
              disabled
                ? (event) => {
                    event.preventDefault()
                  }
                : undefined
            }
            className={({ isActive }) => {
              return `nav-link${isActive ? ' active' : ''}${disabled ? ' disabled' : ''}`
            }}
          >
            {item.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
