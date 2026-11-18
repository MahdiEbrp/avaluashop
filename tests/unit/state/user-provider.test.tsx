import { act, render, screen, waitFor } from '@testing-library/react'

import {
   UserContextProvider as RealUserContextProvider,
   useUserContext as useRealUserContext,
} from '@/state/User'

/* The signed-in state is driven by a cookie in the real hook; here it is a
   switch so each test can choose guest or member. */
const authenticated = vi.fn(() => ({ authenticated: false }))

vi.mock('@/hooks/useAuthentication', () => ({
   useAuthenticated: () => authenticated(),
}))

describe('UserContextProvider', () => {
   function Probe() {
      const { user, loading, refreshUser } = useRealUserContext()

      return (
         <div>
            <span data-testid="user">{JSON.stringify(user)}</span>
            <span data-testid="loading">{String(loading)}</span>
            <button onClick={refreshUser}>refresh</button>
         </div>
      )
   }

   afterEach(() => {
      vi.unstubAllGlobals()
      authenticated.mockReturnValue({ authenticated: false })
   })

   it('does not fetch for a guest and is never loading', () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      render(
         <RealUserContextProvider>
            <Probe />
         </RealUserContextProvider>
      )

      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      expect(fetchMock).not.toHaveBeenCalled()
   })

   it('fetches the profile when the visitor is signed in', async () => {
      authenticated.mockReturnValue({ authenticated: true })
      vi.stubGlobal(
         'fetch',
         vi.fn(async () =>
            new Response(JSON.stringify({ id: 'u1', email: 'a@b.co' }), {
               headers: { 'content-type': 'application/json' },
            })
         )
      )

      render(
         <RealUserContextProvider>
            <Probe />
         </RealUserContextProvider>
      )

      await waitFor(() =>
         expect(screen.getByTestId('user')).toHaveTextContent('"email":"a@b.co"')
      )
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
   })

   it('refreshes on demand', async () => {
      authenticated.mockReturnValue({ authenticated: true })
      const fetchMock = vi.fn(async () =>
         new Response(JSON.stringify({ id: 'u1', name: 'Ada' }), {
            headers: { 'content-type': 'application/json' },
         })
      )
      vi.stubGlobal('fetch', fetchMock)

      render(
         <RealUserContextProvider>
            <Probe />
         </RealUserContextProvider>
      )

      await waitFor(() => expect(fetchMock).toHaveBeenCalled())
      await act(async () => {
         screen.getByText('refresh').click()
      })

      await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2))
   })

   it('logs and keeps the previous user when the profile fetch fails', async () => {
      authenticated.mockReturnValue({ authenticated: true })
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
         <RealUserContextProvider>
            <Probe />
         </RealUserContextProvider>
      )

      await waitFor(() => expect(errorSpy).toHaveBeenCalled())
      expect(screen.getByTestId('user')).toHaveTextContent('null')
   })
})
