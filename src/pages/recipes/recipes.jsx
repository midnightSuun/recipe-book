import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { RecipeBook } from '../../components/recipe-book'
import styles from './recipes.module.css'

const SEARCH_DEBOUNCE_MS = 300

export const Recipes = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const qFromUrl = searchParams.get('q') ?? ''
    const [searchValue, setSearchValue] = useState(qFromUrl)
    const [syncedQuery, setSyncedQuery] = useState(qFromUrl)

    if (qFromUrl !== syncedQuery) {
        setSyncedQuery(qFromUrl)
        setSearchValue(qFromUrl)
    }

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            const nextQuery = searchValue.trim()
            const currentQuery = (searchParams.get('q') ?? '').trim()

            if (nextQuery === currentQuery) return

            const nextParams = new URLSearchParams(searchParams)

            if (nextQuery) nextParams.set('q', nextQuery)
            else nextParams.delete('q')

            nextParams.set('page', '1')
            setSearchParams(nextParams)
        }, SEARCH_DEBOUNCE_MS)

        return () => clearTimeout(timeoutId)
    }, [searchValue, searchParams, setSearchParams])

    const handleSearchChange = (event) => {
        setSearchValue(event.target.value)
    }

    return (
        <div className={styles.page}>
            <section className={styles.hero}>
                <h1>Recipe book</h1>
                <p>Flip the pages and collect dish cards</p>
                <input
                    className={styles.search}
                    type="search"
                    value={searchValue}
                    onChange={handleSearchChange}
                    placeholder="Search by recipe name"
                    aria-label="Search by recipe name"
                />
            </section>
            <RecipeBook />
            <p className={styles.hint}>
                title spread · 4 recipes per spread · use arrows or dots
            </p>
        </div>
    )
}
