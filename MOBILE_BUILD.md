# Сборка мобильного приложения CoonChat

## Что нужно установить на компьютер

- [Node.js 18+](https://nodejs.org)
- [Android Studio](https://developer.android.com/studio) — для Android (.apk)
- [Xcode 15+](https://developer.apple.com/xcode/) — для iOS (.ipa), только на Mac

---

## Android (.apk) — пошаговая инструкция

### 1. Скачай код проекта
Через **Скачать → Скачать код** или **Скачать → Подключить GitHub**

### 2. Установи зависимости
```bash
npm install
```

### 3. Собери веб-часть и синхронизируй с Android
```bash
npm run build
npx cap sync android
```

### 4. Открой в Android Studio
```bash
npx cap open android
```

### 5. Собери .apk в Android Studio
- Меню **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Готовый файл будет в `android/app/build/outputs/apk/debug/app-debug.apk`

---

## iOS (.ipa) — только на Mac

### 1–3. Те же шаги, что для Android

### 4. Открой в Xcode
```bash
npx cap open ios
```

### 5. Собери в Xcode
- Выбери устройство или симулятор
- Меню **Product → Build**
- Для публикации в App Store нужен аккаунт Apple Developer ($99/год)

---

## Важные замечания

- Приложение обращается к серверу через интернет — нужно подключение к сети
- Для видеозвонков Android/iOS требуют разрешений на камеру и микрофон (запрашиваются автоматически)
- Для публикации в Google Play нужен аккаунт разработчика ($25 единоразово)
