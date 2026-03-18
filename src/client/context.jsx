import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

const UserContext = createContext(null)
const USER_STORAGE_KEY = "soanhang.auth.user"
const USER_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const user = parsed?.user || null
    const expiresAt = Number(parsed?.expiresAt || 0)
    if (!user || !expiresAt || Date.now() >= expiresAt) {
      localStorage.removeItem(USER_STORAGE_KEY)
      return null
    }
    return user
  } catch (e) {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }
}

export function UserProvider({ children }) {
  const [user, setUserState] = useState(() => readStoredUser())

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser || null)
    if (nextUser) {
      try {
        localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify({
            user: nextUser,
            expiresAt: Date.now() + USER_TTL_MS,
          }),
        )
      } catch (e) {
        // ignore storage failures (private mode, blocked storage)
      }
    } else {
      try {
        localStorage.removeItem(USER_STORAGE_KEY)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  useEffect(() => {
    if (!user) return
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY)
      if (!raw) {
        setUserState(null)
        return
      }
      const parsed = JSON.parse(raw)
      const expiresAt = Number(parsed?.expiresAt || 0)
      if (!expiresAt || Date.now() >= expiresAt) {
        localStorage.removeItem(USER_STORAGE_KEY)
        setUserState(null)
        return
      }
      let timeoutMs = expiresAt - Date.now()
      // setTimeout dung lượng tối đa là số nguyên 32 bit (khoảng 24.8 ngày ~ 2147483647 ms).
      // Nếu timeoutMs lớn hơn con số này, setTimeout sẽ tràn ngập và thực thi ngay lập tức.
      const MAX_TIMEOUT = 2147483647
      if (timeoutMs > MAX_TIMEOUT) {
        timeoutMs = MAX_TIMEOUT
      }
      
      const timer = setTimeout(() => {
        if (Date.now() >= expiresAt) {
          try {
            localStorage.removeItem(USER_STORAGE_KEY)
          } catch (e) {
            // ignore
          }
          setUserState(null)
        }
      }, timeoutMs)
      return () => clearTimeout(timer)
    } catch (e) {
      try {
        localStorage.removeItem(USER_STORAGE_KEY)
      } catch (err) {
        // ignore
      }
      setUserState(null)
    }
  }, [user])

  const value = useMemo(
    () => ({
      user,
      setUser,
      logout: () => setUser(null),
    }),
    [user, setUser],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) {
    throw new Error("useUser must be used within <UserProvider>")
  }
  return ctx
}
