class AuthManager {
    constructor() {
        const firebaseConfig = {
            apiKey: "AIzaSyDKPa0Q3kF5aR-N-u25GA2SpQ5MWBXnii4",
            authDomain: "cbworlds-a8b71.firebaseapp.com",
            projectId: "cbworlds-a8b71",
            storageBucket: "cbworlds-a8b71.appspot.com",
            messagingSenderId: "769755269110",
            appId: "1:769755269110:web:7716cbaf3a3d3d193369d7",
            measurementId: "G-VS3T407KK9"
        };
        
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.user = null;
        // Устанавливаем язык для Firebase Auth на основе языка браузера
        // Это может помочь в локализации сообщений об ошибках или экранов аутентификации
        this.auth.languageCode = navigator.language.split('-')[0];
        this.init();
    }

    async init() {
        this.updateUserUI(null, true); // Показываем "Проверка..."
        
        try {
            // getRedirectResult() нужно вызывать при каждой загрузке страницы,
            // чтобы поймать результат после редиректа.
            const result = await this.auth.getRedirectResult();
            if (result && result.user) {
                // Если есть результат редиректа и пользователь,
                // значит, пользователь только что успешно вошел через Discord.
                console.log("Пользователь успешно вошел через Discord (редирект).", result.user);
                // discordProfile будет доступен через additionalUserInfo.profile
                // для OIDC провайдеров.
                await this.createUserProfileIfNotExists(result.user, result.additionalUserInfo.profile);
            }
            // Затем начинаем слушать изменения состояния аутентификации
            this.listenForAuthStateChanges();
        } catch (error) {
            console.error('Критическая ошибка при обработке редиректа авторизации:', error);
            // Если произошла ошибка при обработке редиректа (например, пользователь отменил)
            // или общая ошибка инициализации, показываем UI как для неавторизованного.
            this.updateUserUI(null);
            this.listenForAuthStateChanges(); // Все равно начинаем слушать изменения состояния
        }

        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) {
                event.preventDefault(); // Предотвращаем дефолтное поведение ссылки, если это <a>
                this.signOut();
            }
        });
    }

    listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userProfile = await this.getUserProfile(firebaseUser.uid);
                // Важно: если профиль не найден, это может быть первый вход.
                // Возможно, стоит позволить продолжить, если профиль создается сразу после входа.
                // Твоя текущая логика требует профиля в Firestore для продолжения.
                if (!userProfile) {
                    console.error("Профиль пользователя не найден в Firestore. Выход.");
                    this.signOut();
                    return;
                }
                this.user = { uid: firebaseUser.uid, ...userProfile }; // Сохраняем UID в объекте пользователя
            } else {
                this.user = null;
            }
            this.updateUserUI(this.user);
            document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
        });
    }

    async createUserProfileIfNotExists(firebaseUser, discordProfile) {
        const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
        const doc = await userProfileRef.get();
        if (!doc.exists) {
            console.log("Создаем новый профиль пользователя в Firestore.");
            const newProfileData = {
                // Discord profile содержит больше деталей, чем firebaseUser напрямую
                username: discordProfile.username || firebaseUser.displayName,
                email: discordProfile.email || firebaseUser.email,
                // Для аватара Discord часто использует id и avatar hash
                avatar_url: discordProfile.avatar ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png` : firebaseUser.photoURL,
                role: 'Игрок',
                created_at: firebase.firestore.FieldValue.serverTimestamp() // Добавляем метку времени создания
            };
            await userProfileRef.set(newProfileData);
        } else {
            console.log("Профиль пользователя уже существует.");
        }
    }

    async getUserProfile(uid) {
        const doc = await this.db.collection('profiles').doc(uid).get();
        return doc.exists ? doc.data() : null; // Возвращаем только данные, UID уже есть
    }

    signInWithDiscord() {
        // ИСПРАВЛЕНИЕ ЗДЕСЬ: Используй 'oidc.openid-connect' как providerId
        // Это ID провайдера, который ты настроил в консоли Firebase.
        const provider = new firebase.auth.OAuthProvider('oidc.openid-connect');
        provider.addScope('identify');
        provider.addScope('email');
        // Если ты хочешь запросить другие данные (например, Guilds для Discord),
        // тебе нужно добавить соответствующие скоупы здесь,
        // а также настроить их в Discord Developer Portal.

        this.auth.signInWithRedirect(provider);
    }

    signOut() {
        this.auth.signOut();
    }

    updateUserUI(user, isLoading = false) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        if (isLoading) {
            userSection.innerHTML = `<div class="login-btn loading-auth">Проверка...</div>`;
            return;
        }

        if (user) {
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            // Убедимся, что аватар отображается корректно, даже если нет URL
            const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : `<span style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;background-color:#ccc;">${name.charAt(0).toUpperCase()}</span>`;

            userSection.innerHTML = `
                <div class="user-info">
                    <div class="user-dropdown">
                        <div class="user-name">
                            <div class="user-avatar" title="${name}">${avatarHtml}</div>
                            <span>${name}</span>
                        </div>
                        <div class="dropdown-menu">
                            <a href="account.html" class="dropdown-item"><span>Личный кабинет</span></a>
                            <button class="logout-btn dropdown-item"><span>Выйти</span></button>
                        </div>
                    </div>
                </div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
            // Добавляем слушатель события только один раз при создании кнопки
            const loginButton = userSection.querySelector('.login-btn');
            if (loginButton) {
                loginButton.addEventListener('click', () => this.signInWithDiscord());
            }
        }
    }
}

// Создаем глобальный экземпляр, к которому будут обращаться все остальные скрипты
window.authManager = new AuthManager();
