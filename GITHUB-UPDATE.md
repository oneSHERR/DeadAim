# Обновление GitHub до DEADAIM 3.0

## Самый простой способ

1. Скачай **DEADAIM-v3.zip** и распакуй.
2. Открой папку **deadaim** внутри архива.
3. Открой свой репозиторий на GitHub — ту папку, где уже лежит `index.html`.
4. Нажми **Add file → Upload files**.
5. Перетащи **содержимое папки deadaim**, включая папку tests, в окно загрузки. Не загружай сам ZIP и не добавляй лишнюю вложенную папку deadaim.
6. Внизу напиши `DEADAIM 3.0: training, accounts and friends` и нажми **Commit changes**.
7. Дождись окончания GitHub Pages deployment во вкладке **Actions**, затем открой сайт и нажми **Ctrl+F5**.
8. Выполни два обязательных пункта из **FIREBASE.md**: включи Email/Password и опубликуй новые правила.

## Что заменить

Все одноимённые файлы из архива можно заменить новыми:

`index.html`, `app.js`, `engine.js`, `training.js`, `dashboard.js`, `cloud.js`, `identity.js`, `style.css`, `favicon.svg`, `firebase-config.js`, `firestore.rules`, `firebase.json`, `package.json`, `server.js`, `README.md`, `FIREBASE.md`, `GITHUB-UPDATE.md`, тесты в `tests/`.

`firebase-config.js` уже содержит данные твоего проекта **deadaim**. Если ты впоследствии самостоятельно подключил другой Firebase-проект, сохрани его конфигурацию вместо приложенной.

## Какие файлы новые

Обязательно добавь:

- `scenarios.js` — все игровые упражнения;
- `renderer.js` — отображение арены и укрытий;
- `account-model.js` — подготовка аккаунта и данных;
- `v3.css` — оформление нового каталога и входа;
- `tests/scenarios.test.js`, `tests/account.test.js`, `tests/firestore.emulator.mjs` — новые проверки.

Без новых JS-файлов страница не сможет запуститься.

## Что оставить

- **CNAME**, если подключён свой домен.
- **.github/** и существующие настройки GitHub Pages, если они у тебя есть.
- **LICENSE** и другие твои отдельные файлы.
- **.nojekyll** и **.gitignore** — оставь; они также включены в архив.
- Репозиторий и Firebase-базу удалять не нужно.

## Про tests и лишние папки

Папку **tests** заливать можно и желательно: там нет паролей, она не влияет на работу сайта. GitHub Pages не запускает тесты автоматически.

Не загружай `node_modules`, рабочие папки с Java/эмулятором, служебные ZIP-архивы и service-account JSON. В готовом архиве этих файлов нет.

Публикация файлов сайта не публикует правила Firestore. Новый вход заработает после настройки Firebase по инструкции.
