import { beforeEach, describe, expect, it, vi } from 'vitest'

const { baseQueryMock, fetchBaseQueryMock, fetchBaseQueryCalls } = vi.hoisted(
    () => {
        const fetchBaseQueryCalls = []
        const baseQueryMock = vi.fn()
        const fetchBaseQueryMock = vi.fn((config) => {
            fetchBaseQueryCalls.push(config)
            return baseQueryMock
        })

        return { baseQueryMock, fetchBaseQueryMock, fetchBaseQueryCalls }
    }
)

vi.mock('@reduxjs/toolkit/query/react', () => ({
    fetchBaseQuery: fetchBaseQueryMock,
}))

import { logOut, setCredentials } from './auth-slice'
import { baseQueryWithReauth } from './base-query'

const session = {
    accessToken: 'access',
    refreshToken: 'refresh',
    user: null,
}

const createApi = (auth = session) => {
    const actions = []

    return {
        actions,
        getState: () => ({ auth }),
        dispatch: (action) => {
            actions.push(action)
        },
    }
}

const requestUrl = (args) => (typeof args === 'string' ? args : args?.url)

describe('baseQueryWithReauth', () => {
    beforeEach(() => {
        baseQueryMock.mockReset()
    })

    it('attaches the access token and aborts slow requests', () => {
        const [{ baseUrl, timeout, prepareHeaders }] = fetchBaseQueryCalls
        const headers = new Headers()

        prepareHeaders(headers, {
            getState: () => ({ auth: { accessToken: 'access' } }),
        })

        expect(baseUrl).toBe('https://dummyjson.com/')
        expect(timeout).toBe(15000)
        expect(headers.get('authorization')).toBe('Bearer access')

        const anonymous = new Headers()
        prepareHeaders(anonymous, {
            getState: () => ({ auth: { accessToken: null } }),
        })

        expect(anonymous.has('authorization')).toBe(false)
    })

    it('returns a successful response without refreshing', async () => {
        baseQueryMock.mockResolvedValueOnce({ data: { recipes: [] } })
        const api = createApi()

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            data: { recipes: [] },
        })
        expect(baseQueryMock).toHaveBeenCalledTimes(1)
        expect(api.actions).toEqual([])
    })

    it('does not refresh login or refresh requests', async () => {
        const api = createApi()
        const paths = [
            'auth/login',
            { url: '/auth/login/' },
            { url: 'https://dummyjson.com/auth/refresh?rotate=1' },
            { url: 'https://dummyjson.com/auth/login#form' },
        ]

        for (const args of paths) {
            baseQueryMock.mockResolvedValueOnce({ error: { status: 401 } })

            await expect(baseQueryWithReauth(args, api, {})).resolves.toEqual({
                error: { status: 401 },
            })
        }

        expect(baseQueryMock).toHaveBeenCalledTimes(paths.length)
        expect(api.actions).toEqual([])
    })

    it('logs out when a 401 has no refresh token', async () => {
        baseQueryMock.mockResolvedValueOnce({ error: { status: 401 } })
        const api = createApi({ ...session, refreshToken: '' })

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            error: { status: 401 },
        })
        expect(api.actions).toEqual([logOut()])
        expect(baseQueryMock).toHaveBeenCalledTimes(1)
    })

    it('stores the new session and retries the original request', async () => {
        const refreshed = {
            accessToken: 'next-access',
            refreshToken: 'next-refresh',
            id: 1,
            username: 'emilys',
        }

        baseQueryMock
            .mockResolvedValueOnce({ error: { status: 401 } })
            .mockResolvedValueOnce({ data: refreshed })
            .mockResolvedValueOnce({ data: { ok: true } })

        const api = createApi()
        const result = await baseQueryWithReauth({ url: 'recipes/1' }, api, {
            signal: 'extra',
        })

        expect(result).toEqual({ data: { ok: true } })
        expect(api.actions).toEqual([setCredentials(refreshed)])
        expect(baseQueryMock).toHaveBeenNthCalledWith(
            2,
            {
                url: 'auth/refresh',
                method: 'POST',
                body: { refreshToken: 'refresh', expiresInMins: 30 },
                timeout: 15000,
            },
            api,
            { signal: 'extra' }
        )
        expect(requestUrl(baseQueryMock.mock.calls[2][0])).toBe('recipes/1')
    })

    it('logs out when the refresh token is rejected', async () => {
        baseQueryMock
            .mockResolvedValueOnce({ error: { status: 401 } })
            .mockResolvedValueOnce({ error: { status: 403 } })

        const api = createApi()

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            error: { status: 403 },
        })
        expect(api.actions).toEqual([logOut()])
    })

    it('logs out when the refresh response has no access token', async () => {
        const original = { error: { status: 401 } }

        baseQueryMock
            .mockResolvedValueOnce(original)
            .mockResolvedValueOnce({ data: { refreshToken: 'only' } })

        const api = createApi()

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual(
            original
        )
        expect(api.actions).toEqual([logOut()])
        expect(baseQueryMock).toHaveBeenCalledTimes(2)
    })

    it('keeps the session when refresh times out or the network fails', async () => {
        const api = createApi()

        baseQueryMock
            .mockResolvedValueOnce({ error: { status: 401 } })
            .mockResolvedValueOnce({ error: { status: 'TIMEOUT_ERROR' } })

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            error: { status: 'TIMEOUT_ERROR' },
        })

        baseQueryMock
            .mockResolvedValueOnce({ error: { status: 401 } })
            .mockRejectedValueOnce(new Error('socket hang up'))

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            error: { status: 'FETCH_ERROR', error: 'socket hang up' },
        })

        baseQueryMock
            .mockResolvedValueOnce({ error: { status: 401 } })
            .mockRejectedValueOnce('offline')

        await expect(baseQueryWithReauth('recipes', api, {})).resolves.toEqual({
            error: { status: 'FETCH_ERROR', error: 'Refresh failed' },
        })

        expect(api.actions).toEqual([])
    })

    it('shares one refresh across parallel 401 responses', async () => {
        let refreshCalls = 0
        let releaseInitial
        let releaseRefresh
        const attempts = new Map()
        const initialGate = new Promise((resolve) => {
            releaseInitial = resolve
        })

        baseQueryMock.mockImplementation((args) => {
            const url = requestUrl(args)

            if (url === 'auth/refresh') {
                refreshCalls += 1

                return new Promise((resolve) => {
                    releaseRefresh = resolve
                })
            }

            const attempt = (attempts.get(url) ?? 0) + 1
            attempts.set(url, attempt)

            if (attempt === 1) {
                return initialGate.then(() => ({ error: { status: 401 } }))
            }

            return Promise.resolve({ data: { url } })
        })

        const api = createApi()
        const first = baseQueryWithReauth('recipes', api, {})
        const second = baseQueryWithReauth({ url: 'recipes/1' }, api, {})

        releaseInitial()

        await vi.waitFor(() => {
            expect(refreshCalls).toBe(1)
        })
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(refreshCalls).toBe(1)

        releaseRefresh({
            data: {
                accessToken: 'next-access',
                refreshToken: 'next-refresh',
            },
        })

        await expect(Promise.all([first, second])).resolves.toEqual([
            { data: { url: 'recipes' } },
            { data: { url: 'recipes/1' } },
        ])
        expect(refreshCalls).toBe(1)
        expect(api.actions).toEqual([
            setCredentials({
                accessToken: 'next-access',
                refreshToken: 'next-refresh',
            }),
            setCredentials({
                accessToken: 'next-access',
                refreshToken: 'next-refresh',
            }),
        ])
    })
})
