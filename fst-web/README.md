# FST — облачная версия

Веб-версия **FST** (табель + склад) с входом по email и синхронизацией через **Firebase Firestore**.

Локальная версия остаётся в корне репозитория (`npm run dev`).

## Запуск локально

1. Создайте проект [Firebase](https://console.firebase.google.com/) с ID `fst-uchet` (или свой).
2. Включите **Authentication → Email/Password** и **Firestore**.
3. Скопируйте ключи в `.env` из `.env.example`.
4. Из корня репозитория:

```bash
npm install
npm run dev:fst-web
```

## Сборка

```bash
npm run build:fst-web
```

Результат: `fst-web/dist/`

## Деплой Vercel

Репозиторий: https://github.com/DMDAdmin/FST-uchet

Production: https://fst-uchet.vercel.app

Корневой `vercel.json` собирает `fst-web` из монорепозитория:

```bash
vercel --prod
```

Или подключите GitHub — **Root Directory:** корень репозитория (не `fst-web`).

Переменные окружения `VITE_FIREBASE_*` задайте в Vercel Dashboard → Project → Settings → Environment Variables.

## Деплой Firebase Hosting

```bash
cd fst-web
npm run build
firebase login
firebase deploy
```

## Аккаунт

Рекомендуемый владелец: `nikegeorgian@gmail.com` — добавьте как Owner в Firebase / Vercel / GitHub.

Первый пользователь регистрируется на экране входа FST.
