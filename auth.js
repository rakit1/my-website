class AuthManager {
    constructor() {
        // 1. ИНИЦИАЛИЗАЦИЯ FIREBASE
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
        this.user = null; // Здесь будет храниться информация о пользователе
        this.init();
    }

    // 2. ГЛАВНАЯ ЛОГИКА
    async init() {
        this.updateUserUI(null, true); // Сразу показываем "Проверка..."
        
        try {
            // Сначала обрабатываем результат редиректа
            const result = await this.auth.getRedirectResult();
            if (result && result.user) {
                // Если пользователь только что вошел, создаем для него профиль, если он новый
                await this.createUserProfileIfNotExists(result.user, result.additionalUserInfo.profile);
            }
            
            // Теперь устанавливаем постоянный слушатель на изменение статуса авторизации
            this.listenForAuthStateChanges();

        } catch (error) {
            console.error('Критическая ошибка при инициализации авторизации:', error);
            this.updateUserUI(null); // Если ошибка, показываем кнопку "Войти"
        }

        // Вешаем глобальный обработчик на кнопку выхода
        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) {
                this.signOut();
            }
        });
    }

    // 3. СЛУШАТЕЛЬ ИЗМЕНЕНИЯ СТАТУСА
    listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // Пользователь вошел. Загружаем его профиль.
                const userProfile = await this.getUserProfile(firebaseUser.uid);
                if (userProfile) {
                    this.user = userProfile;
                    this.updateUserUI(this.user);
                } else {
                    // Профиль не найден, хотя пользователь авторизован. Выходим из системы.
                    console.error("Профиль не найден, принудительный выход.");
                    this.signOut();
                    return; // Прерываем выполнение
                }
            } else {
                // Пользователь не авторизован.
                this.user = null;
                this.updateUserUI(null);
            }
            // Сообщаем всем остальным скриптам о текущем статусе пользователя
            document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
        });
    }

    // 4. СОЗДАНИЕ ПРОФИЛЯ (ЕСЛИ НУЖНО)
    async createUserProfileIfNotExists(firebaseUser, discordProfile) {
        const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
        const userProfileDoc = await userProfileRef.get();

        if (!userProfileDoc.exists) {
            const newProfileData = {
                username: discordProfile.username || firebaseUser.displayName,
                email: discordProfile.email || firebaseUser.email,
                avatar_url: discordProfile.avatar ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png` : firebaseUser.photoURL,
                role: 'Игрок'
            };
            await userProfileRef.set(newProfileData);
            console.log('Создан новый профиль:', newProfileData.username);
        }
    }

    // 5. ПОЛУЧЕНИЕ ПРОФИЛЯ ИЗ БД
    async getUserProfile(uid) {
        const userProfileRef = this.db.collection('profiles').doc(uid);
        const userProfileDoc = await userProfileRef.get();
        return userProfileDoc.exists ? { uid, ...userProfileDoc.data() } : null;
    }

    // 6. ВХОД ЧЕРЕЗ DISCORD
    async signInWithDiscord() {
        const provider = new firebase.auth.OAuthProvider('oidc.discord.com');
        provider.addScope('identify');
        provider.addScope('email');
        
        await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        this.auth.signInWithRedirect(provider);
    }

    // 7. ВЫХОД ИЗ АККАУНТА
    async signOut() {
        await this.auth.signOut();
        // Просто перезагружаем страницу, onAuthStateChanged сделает остальное.
        document.body.classList.add('fade-out');
        setTimeout(() => window.location.href = '/index.html', 250);
    }

    // 8. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
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
            const avatarImg = (avatarUrl && avatarUrl !== 'null') 
                ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` 
                : name.charAt(0).toUpperCase();

            userSection.innerHTML = `
                <div class.user-info">
                    <div class="user-dropdown">
                        <div class="user-name">
                            <div class="user-avatar" title="${name}">${avatarImg}</div>
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
            userSection.querySelector('.login-btn').addEventListener('click', () => this.signInWithDiscord());
        }
    }
}

// Запускаем наш менеджер авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});
