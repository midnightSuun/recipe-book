# Recipe Book

SPA-каталог рецептов в виде книги: вход, поиск, листание разворотов и карточка блюда.

Данные и авторизация — [DummyJSON](https://dummyjson.com/).

**Live:** [https://task5-yana-5742.vercel.app](https://task5-yana-5742.vercel.app)

## Функциональность

- вход по username/password (DummyJSON Auth)
- защищённые маршруты: без токена редирект на `/sign-in`
- список рецептов в виде книги (титульный разворот, по 4 карточки на разворот)
- поиск по названию, пагинация через query-параметры `page` и `q`
- страница рецепта: ингредиенты, шаги, рейтинг
- обновление access-токена при 401
- состояния загрузки, ошибок и пустого поиска
- страница 404
- адаптивная вёрстка (desktop и mobile)

## Стек

- React 19
- React Router
- Redux Toolkit + RTK Query
- Webpack, Babel
- CSS Modules (без UI-библиотек)

## Зависимости


| Пакет                                           | Зачем                   |
| ----------------------------------------------- | ----------------------- |
| `react`, `react-dom`                            | UI                      |
| `react-router`                                  | маршруты                |
| `@reduxjs/toolkit`, `react-redux`               | store, RTK Query        |
| `react-hook-form`, `@hookform/resolvers`, `zod` | форма входа и валидация |
| `classnames`                                    | классы                  |


Сборка: `webpack`, `webpack-cli`, `webpack-dev-server`, `babel-loader`, `@babel/*`, `css-loader`, `style-loader`, `html-webpack-plugin`, `@svgr/webpack`. Форматирование: `prettier`.

Полный список версий — в `package.json`.

## Запуск

Нужны Node.js 18+ и npm.

```bash
git clone https://github.com/midnightSuun/task5.git
cd task5
npm install
npm start
```

Приложение откроется на [http://localhost:3000](http://localhost:3000).

Продакшен-сборка:

```bash
npm run build
```

Артефакты — в `dist/`. Для SPA на Vercel есть `vercel.json` (rewrite всех путей на `index.html`).

Проверки:

```bash
npm run lint
npm test
npm run build
```

GitHub Actions на push и pull request запускает их в том же порядке: lint, затем сборка, затем тесты.

## Тестовый аккаунт

Любой пользователь из [dummyjson.com/users](https://dummyjson.com/users), например:

- username: `emilys`
- password: `emilyspass`

## Деплой

- репозиторий: [https://github.com/midnightSuun/task5](https://github.com/midnightSuun/task5)
- live: [https://task5-yana-5742.vercel.app](https://task5-yana-5742.vercel.app)

## Как устроено

- `store.js` — `configureStore`: `auth` slice и `api` reducer + middleware RTK Query.
- `api.js` / `auth-api.js` / `recipes-api.js` — один `createApi`, эндпоинты через `injectEndpoints`. Кэш RTK Query ключуется по имени эндпоинта и аргументам (`limit`, `skip`, `q`, id).
- `base-query.js` — `fetchBaseQuery` + refresh access-токена при 401, общий `refreshPromise` чтобы параллельные запросы не дергали refresh несколько раз. Пути `auth/login` и `auth/refresh` сравниваются по нормализованному pathname. Запросы обрываются через 15 с.
- `routes.js` — `PublicRoute` (логин) и `ProtectedRoute` (книга и карточка рецепта).

## Токены

[DummyJSON Auth](https://dummyjson.com/docs/auth) отдаёт `accessToken` и `refreshToken` в JSON. Обновление сессии — `POST /auth/refresh` с `refreshToken` в теле. Своего backend в проекте нет, поэтому HttpOnly-cookie поставить нельзя: такую куку для `dummyjson.com` может выставить только сам DummyJSON, а не страница на нашем origin.

Сессия живёт в Redux (`auth` slice). Оба токена дополнительно пишутся в `localStorage`, чтобы перезагрузка не разлогинивала: `ProtectedRoute` смотрит на access token синхронно, до сети. `prepareHeaders` читает его из store и ставит `Authorization: Bearer`. Пустую строку и ответ refresh без токена в storage не записываем. Если `localStorage` недоступен, сессия остаётся в памяти до закрытия вкладки.

Это компромисс для демо против публичного fake API. Любой XSS на странице прочитает `localStorage`. Держать только access token в памяти, а refresh — в `localStorage`, от этого не спасает: по refresh выпускается новый access.

В проде со своим API схема другая:

- refresh-токен — HttpOnly, Secure, SameSite cookie, JS его не видит;
- access-токен — короткий, только в памяти (Redux), без `localStorage`;
- мутации с cookie — с защитой от CSRF.

Пока API чужой и контракт refresh — JSON-тело, остаёмся на Redux + `localStorage`.

Ошибки refresh:

- 401 или 403, либо тело без `accessToken` — сессия сбрасывается (`logOut`);
- таймаут и сетевая ошибка сессию не сбрасывают: refresh-токен мог остаться валидным, запрос можно повторить. Сообщение берётся из `getErrorMessage` (`TIMEOUT_ERROR`, `FETCH_ERROR`).

