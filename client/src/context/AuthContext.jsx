import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from '../services/api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [subscription, setSubscription] = useState(null)
  const [booting, setBooting] = useState(!!getToken())

  const clear = useCallback(() => {
    setToken(null)
    setUser(null)
    setSubscription(null)
  }, [])

  const refresh = useCallback(async () => {
    const d = await api.get('/auth/me')
    setUser(d.user)
    setSubscription(d.subscription)
    return d
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(clear)
    if (!getToken()) return
    refresh()
      .catch(clear)
      .finally(() => setBooting(false))
  }, [clear, refresh])

  const finish = async (d) => {
    setToken(d.token)
    await refresh()
    return d.user
  }
  const login = async (email, password) => finish(await api.post('/auth/login', { email, password }))
  const register = async (payload) => finish(await api.post('/auth/register', payload))
  const logout = async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      /* token is discarded regardless */
    }
    clear()
  }

  const value = useMemo(
    () => ({ user, subscription, booting, isAdmin: user?.role === 'admin', isSubscribed: !!subscription?.isActive, login, register, logout, refresh }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, subscription, booting]
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
