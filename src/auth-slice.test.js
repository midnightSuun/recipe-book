import { beforeEach, describe, expect, it, vi } from 'vitest'
import reducer, {
    logOut,
    selectAccessToken,
    setCredentials,
} from './auth-slice'

const emptySession = {
    accessToken: null,
    refreshToken: null,
    user: null,
}

describe('auth slice', () => {
    beforeEach(() => {
        localStorage.clear()
        vi.restoreAllMocks()
    })

    it('stores both tokens and the user', () => {
        const next = reducer(
            emptySession,
            setCredentials({
                accessToken: 'access',
                refreshToken: 'refresh',
                id: 1,
                username: 'emilys',
            })
        )

        expect(next).toEqual({
            accessToken: 'access',
            refreshToken: 'refresh',
            user: { id: 1, username: 'emilys' },
        })
        expect(localStorage.getItem('accessToken')).toBe('access')
        expect(localStorage.getItem('refreshToken')).toBe('refresh')
        expect(selectAccessToken({ auth: next })).toBe('access')
    })

    it('ignores an empty token and a payload without a user id', () => {
        const current = {
            accessToken: 'access',
            refreshToken: 'refresh',
            user: { id: 1, username: 'emilys' },
        }

        const next = reducer(
            current,
            setCredentials({
                accessToken: '',
                refreshToken: '',
                username: 'someone',
            })
        )

        expect(next).toEqual(current)
        expect(localStorage.getItem('accessToken')).toBeNull()
    })

    it('keeps the in-memory session when storage writes fail', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('quota')
        })

        const next = reducer(
            emptySession,
            setCredentials({
                accessToken: 'access',
                refreshToken: 'refresh',
                id: 1,
                username: 'emilys',
            })
        )

        expect(next.accessToken).toBe('access')
        expect(next.refreshToken).toBe('refresh')
    })

    it('clears the session and stored tokens on logout', () => {
        localStorage.setItem('accessToken', 'access')
        localStorage.setItem('refreshToken', 'refresh')

        const next = reducer(
            {
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 1, username: 'emilys' },
            },
            logOut()
        )

        expect(next).toEqual(emptySession)
        expect(localStorage.getItem('accessToken')).toBeNull()
        expect(localStorage.getItem('refreshToken')).toBeNull()
    })

    it('still clears Redux state when storage removal fails', () => {
        vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
            throw new Error('blocked')
        })

        const next = reducer(
            {
                accessToken: 'access',
                refreshToken: 'refresh',
                user: { id: 1 },
            },
            logOut()
        )

        expect(next).toEqual(emptySession)
    })

    it('reads stored tokens when the module loads', async () => {
        localStorage.setItem('accessToken', 'stored-access')
        localStorage.setItem('refreshToken', 'stored-refresh')
        vi.resetModules()

        const { default: freshReducer } = await import('./auth-slice')

        expect(freshReducer(undefined, { type: '@@INIT' })).toMatchObject({
            accessToken: 'stored-access',
            refreshToken: 'stored-refresh',
            user: null,
        })
    })

    it('starts with an empty session when storage cannot be read', async () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('denied')
        })
        vi.resetModules()

        const { default: freshReducer } = await import('./auth-slice')

        expect(freshReducer(undefined, { type: '@@INIT' })).toEqual(
            emptySession
        )
    })
})
