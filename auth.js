class AuthManager {
    constructor() {
        // 1. ИНИЦИАЛИЗАЦИЯ FIREBASE
        // Эти данные используются для подключения к вашему проекту Firebase.
        const firebaseConfig = {
            apiKey: "AIzaSyDKPa0Q3kF5aR-N-u25GA2SpQ5MWBXnii4",
            authDomain: "cbworlds-a8b71.firebaseapp.com",
            projectId: "cbworlds-a8b71",
            storageBucket: "cbworlds-a8b71.appspot.com",
            messagingSenderId: "769755269110",
            appId: "1:769755269110:web:7716cbaf3a3d3d193369d7",
            measurementId: "G-VS3T407KK9"
        };
        
        // Проверяем, чтобы Firebase не инициализировался повторно.
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.user = null; // Здесь будет храниться информация о пользователе

        this.init();
    }

    // 2. ЗАПУСК ВСЕХ ПРОЦЕССОВ
    init() {
        this.updateUserUI(null, true); // Сразу показываем статус "Проверка..."
        this.handleRedirectResult();   // Проверяем, не вернулся ли пользователь с Discord
        this.listenForAuthStateChanges(); // Следим за входом/выходом пользователя

        // Добавляем обработчик для кнопки выхода
        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) {
                this.signOut();
            }
        });
    }
    
    // 3. ОБРАБОТКА ВОЗВРАЩЕНИЯ С DISCORD
    // Это ключевая функция. Она срабатывает один раз после редиректа.
    async handleRedirectResult() {
        try {
            const result = await this.auth.getRedirectResult();
            // Если `result.user` существует, значит, пользователь только что успешно вошел через Discord.
            if (result && result.user) {
                const firebaseUser = result.user;
                const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userProfileDoc = await userProfileRef.get();

                // Если профиля в базе данных нет, создаем его
                if (!userProfileDoc.exists) {
                    const profile = result.additionalUserInfo.profile;
                    const newProfileData = {
                        username: profile.username || firebaseUser.displayName,
                        email: profile.email || firebaseUser.email,
                        avatar_url: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : firebaseUser.photoURL,
                        role: 'Игрок' // Роль по умолчанию для всех новых пользователей
                    };
                    await userProfileRef.set(newProfileData);
                    console.log('Создан новый профиль для пользователя:', newProfileData.username);
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке редиректа:', error.code, error.message);
        }
    }

    // 4. СЛЕЖЕНИЕ ЗА СТАТУСОМ АВТОРИЗАЦИИ
    // Эта функция автоматически вызывается Firebase, когда пользователь входит или выходит.
    listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // Пользователь вошел. Загружаем его профиль из базы данных.
                const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userProfileDoc = await userProfileRef.get();

                if (userProfileDoc.exists) {
                    this.user = { uid: firebaseUser.uid, ...userProfileDoc.data() };
                    this.updateUserUI(this.user);
                } else {
                    // Такая ситуация может возникнуть, если профиль был удален вручную
                    console.error('Профиль не найден для авторизованного пользователя. Выход...');
                    this.signOut();
                }
            } else {
                // Пользователь вышел или не авторизован.
                this.user = null;
                this.updateUserUI(null);
            }
            // Отправляем событие для других скриптов (account.js, support.js и т.д.)
            document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
        });
    }

    // 5. ВХОД ЧЕРЕЗ DISCORD (РЕДИРЕКТ)
    async signInWithDiscord() {
        const provider = new firebase.auth.OAuthProvider('oidc.discord.com');
        provider.addScope('identify'); // Запрашиваем доступ к никнейму и аватару
        provider.addScope('email');    // Запрашиваем доступ к email

        // Сохраняем информацию о входе, чтобы она не терялась после перезагрузки страницы
        await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        this.auth.signInWithRedirect(provider);
    }

    // 6. ВЫХОД ИЗ АККАУНТА
    async signOut() {
        try {
            await this.auth.signOut();
            // Плавное исчезновение и перезагрузка страницы для чистого выхода
            document.body.classList.add('fade-out');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 250);
        } catch (error) {
            console.error('Ошибка при выходе:', error);
        }
    }

    // 7. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    // Одна функция, которая отвечает за отображение либо кнопки "Войти", либо профиля пользователя.
    updateUserUI(user, isLoading = false) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        if (isLoading) {
            userSection.innerHTML = '<div class="login-btn loading-auth">Проверка...</div>';
            return;
        }

        if (user) {
            // Пользователь вошел: показываем аватар, имя и выпадающее меню
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            const avatarImg = (avatarUrl && avatarUrl !== 'null') 
                ? `<img src="${avatarUrl}" alt="Аватар" style='width:100%;height:100%;border-radius:50%;'>` 
                : name.charAt(0).toUpperCase();

            userSection.innerHTML = `
                <div class="user-info">
                    <div class="user-dropdown">
                        <div class="user-name">
                            <div class="user-avatar" title="${name}">${avatarImg}</div>
                            <span>${name}</span>
                        </div>
                        <div class="dropdown-menu">
                            <a href="account.html" class="dropdown-item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z"></path></svg>
                                <span>Личный кабинет</span>
                            </a>
                            <button class="logout-btn dropdown-item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 11H16V13H12V16L8 12L12 8V11Z"></path></svg>
                                <span>Выйти</span>
                            </button>
                        </div>
                    </div>
                </div>`;
        } else {
            // Пользователь не вошел: показываем кнопку "Войти"
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
            const loginBtn = userSection.querySelector('.login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => this.signInWithDiscord());
            }
        }
    }
}

// Запускаем наш менеджер авторизации при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});
