import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

const UserContext = createContext(null)
const USER_STORAGE_KEY = "soanhang.auth.user"
const USER_TTL_MS = 24 * 60 * 60 * 1000

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
      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify({
          user: nextUser,
          expiresAt: Date.now() + USER_TTL_MS,
        }),
      )
    } else {
      localStorage.removeItem(USER_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (!user) return
    const raw = localStorage.getItem(USER_STORAGE_KEY)
    if (!raw) {
      setUserState(null)
      return
    }
    try {
      const parsed = JSON.parse(raw)
      const expiresAt = Number(parsed?.expiresAt || 0)
      if (!expiresAt || Date.now() >= expiresAt) {
        localStorage.removeItem(USER_STORAGE_KEY)
        setUserState(null)
        return
      }
      const timeoutMs = expiresAt - Date.now()
      const timer = setTimeout(() => {
        localStorage.removeItem(USER_STORAGE_KEY)
        setUserState(null)
      }, timeoutMs)
      return () => clearTimeout(timer)
    } catch (e) {
      localStorage.removeItem(USER_STORAGE_KEY)
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

