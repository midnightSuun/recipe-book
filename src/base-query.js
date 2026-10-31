import { fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { logOut, setCredentials } from './auth-slice'

const API_ORIGIN = 'https://dummyjson.com/'
const REQUEST_TIMEOUT_MS = 15000
const SKIP_REAUTH_PATHS = new Set(['auth/login', 'auth/refresh'])

const baseQuery = fetchBaseQuery({
    baseUrl: API_ORIGIN,
    timeout: REQUEST_TIMEOUT_MS,
    prepareHeaders: (headers, { getState }) => {
        const token = getState().auth.accessToken

        if (token) {
            headers.set('authorization', `Bearer ${token}`)
        }

        return headers
    },
})

const normalizeRequestPath = (args) => {
    const rawUrl = typeof args === 'string' ? args : args?.url

    if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
        return ''
    }

    try {
        return new URL(rawUrl, API_ORIGIN).pathname.replace(/^\/+|\/+$/g, '')
    } catch {
        return rawUrl.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '')
    }
}

const shouldSkipReauth = (args) =>
    SKIP_REAUTH_PATHS.has(normalizeRequestPath(args))

const hasAccessToken = (data) =>
    typeof data?.accessToken === 'string' && data.accessToken.length > 0

const isRejectedRefreshToken = (error) =>
    error?.status === 401 || error?.status === 403

let refreshPromise = null

const refreshSession = (refreshToken, api, extraOptions) => {
    if (!refreshPromise) {
        refreshPromise = baseQuery(
            {
                url: 'auth/refresh',
                method: 'POST',
                body: { refreshToken, expiresInMins: 30 },
                timeout: REQUEST_TIMEOUT_MS,
            },
            api,
            extraOptions
        )
            .catch((error) => ({
                error: {
                    status: 'FETCH_ERROR',
                    error:
                        error instanceof Error
                            ? error.message
                            : 'Refresh failed',
                },
            }))
            .finally(() => {
                refreshPromise = null
            })
    }

    return refreshPromise
}

export const baseQueryWithReauth = async (args, api, extraOptions) => {
    const result = await baseQuery(args, api, extraOptions)

    if (result.error?.status !== 401 || shouldSkipReauth(args)) {
        return result
    }

    const refreshToken = api.getState().auth.refreshToken

    if (!refreshToken) {
        api.dispatch(logOut())
        return result
    }

    const refreshResult = await refreshSession(
        refreshToken,
        api,
        extraOptions
    )

    if (
        isRejectedRefreshToken(refreshResult.error) ||
        (refreshResult.data && !hasAccessToken(refreshResult.data))
    ) {
        api.dispatch(logOut())
        return refreshResult.error ? refreshResult : result
    }

    if (!hasAccessToken(refreshResult.data)) {
        return refreshResult.error ? refreshResult : result
    }

    api.dispatch(setCredentials(refreshResult.data))

    return baseQuery(args, api, extraOptions)
}
