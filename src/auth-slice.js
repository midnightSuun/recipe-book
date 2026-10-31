import { createSlice } from '@reduxjs/toolkit'

const ACCESS_TOKEN_KEY = 'accessToken'
const REFRESH_TOKEN_KEY = 'refreshToken'

const readStoredToken = (key) => {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

const writeStoredToken = (key, value) => {
    try {
        localStorage.setItem(key, value)
    } catch {
        // Private mode or a full quota should not break the in-memory session.
    }
}

const removeStoredToken = (key) => {
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage failures; Redux state is already cleared.
    }
}

const initialState = {
    accessToken: readStoredToken(ACCESS_TOKEN_KEY),
    refreshToken: readStoredToken(REFRESH_TOKEN_KEY),
    user: null,
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials: (state, action) => {
            const { accessToken, refreshToken, ...user } = action.payload

            if (typeof accessToken === 'string' && accessToken) {
                state.accessToken = accessToken
                writeStoredToken(ACCESS_TOKEN_KEY, accessToken)
            }

            if (typeof refreshToken === 'string' && refreshToken) {
                state.refreshToken = refreshToken
                writeStoredToken(REFRESH_TOKEN_KEY, refreshToken)
            }

            if (user.id != null) {
                state.user = user
            }
        },
        logOut: (state) => {
            state.accessToken = null
            state.refreshToken = null
            state.user = null
            removeStoredToken(ACCESS_TOKEN_KEY)
            removeStoredToken(REFRESH_TOKEN_KEY)
        },
    },
})

export const { setCredentials, logOut } = authSlice.actions
export const selectAccessToken = (state) => state.auth.accessToken
export default authSlice.reducer
