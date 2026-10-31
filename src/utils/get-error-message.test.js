import { describe, expect, it } from 'vitest'
import { getErrorMessage } from './get-error-message'

describe('getErrorMessage', () => {
    it('returns a generic message when the error is missing', () => {
        expect(getErrorMessage(undefined)).toBe(
            'Something went wrong. Please try again.'
        )
        expect(getErrorMessage(null)).toBe(
            'Something went wrong. Please try again.'
        )
    })

    it('returns a string error as-is', () => {
        expect(getErrorMessage('Invalid credentials')).toBe(
            'Invalid credentials'
        )
    })

    it('explains network and timeout failures', () => {
        expect(getErrorMessage({ status: 'FETCH_ERROR' })).toBe(
            'Network error. Check your connection and try again.'
        )
        expect(getErrorMessage({ status: 'TIMEOUT_ERROR' })).toBe(
            'The request timed out. Please try again.'
        )
    })

    it('explains an expired session and a missing recipe', () => {
        expect(getErrorMessage({ status: 401 })).toBe(
            'Session expired. Please sign in again.'
        )
        expect(getErrorMessage({ status: 404 })).toBe(
            'This recipe is not in the book.'
        )
    })

    it('prefers the API message and otherwise includes the status', () => {
        expect(
            getErrorMessage({
                status: 400,
                data: { message: 'Username is required' },
            })
        ).toBe('Username is required')
        expect(getErrorMessage({ status: 500 })).toBe('Request failed (500)')
    })
})
