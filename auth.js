class AuthManager {
    constructor() {
        // Инициализация Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyDKPa0Q3kF5aR-N-u25GA2SpQ5MWBXnii4",
            authDomain: "cbworlds-a8b71.firebaseapp.com",
            projectId: "cbworlds-a8b71",
            storageBucket: "cbworlds-a8b71.appspot.com",
            messagingSenderId: "769755269110",
            appId: "1:769755269110:web:7716cbaf3a3d3d193369d7",
            measurementId: "G-VS3T407KK9"
        };
        firebase.initializeApp(firebaseConfig);

        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.user = null;

        this.setLoadingState();
        this.handleAuthentication();

        // Слушатель для кнопки выхода в личном кабинете
        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) this.signOut();
        });
    }

    // Показывает "Проверка..." при загрузке
    setLoadingState() {
        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.innerHTML = '<div class="login-btn loading-auth">Проверка...</div>';
        }
    }

    // Эта функция теперь просто слушает сохраненную сессию при загрузке страницы
    handleAuthentication() {
        console.log("Auth: Установка слушателя onAuthStateChanged.");
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            console.log("Auth: Сработал onAuthStateChanged.");
            if (firebaseUser) {
                console.log("Auth: Пользователь найден:", firebaseUser.uid);
                await this.loadUserProfile(firebaseUser);
            } else {
                console.log("Auth: Пользователь НЕ найден.");
                this.user = null;
                this.updateUIAndNotify();
            }
        });
    }

    // Загружает или создает профиль в Firestore
    async loadUserProfile(firebaseUser) {
        console.log(`Auth: Загрузка профиля для ${firebaseUser.uid}`);
        const userDocRef = this.db.collection('profiles').doc(firebaseUser.uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            console.log("Auth: Профиль не существует, создаем новый...");
            const profileData = {
                username: firebaseUser.displayName || 'Пользователь',
                email: firebaseUser.email,
                avatar_url: firebaseUser.photoURL,
                role: 'Игрок'
            };
            try {
                await userDocRef.set(profileData);
                console.log("Auth: Профиль успешно создан.");
                this.user = { uid: firebaseUser.uid, ...profileData };
            } catch (error) {
                console.error("Auth: КРИТИЧЕСКАЯ ОШИБКА! Не удалось создать профиль!", error);
                await this.auth.signOut();
                this.user = null;
            }
        } else {
            console.log("Auth: Профиль найден в базе данных.");
            this.user = { uid: firebaseUser.uid, ...userDoc.data() };
        }
        this.updateUIAndNotify();
    }

    // Обновляет интерфейс
    updateUIAndNotify() {
        console.log("Auth: Обновление UI. Текущий пользователь:", this.user ? this.user.username : "null");
        document.querySelector('#authPage')?.classList.remove('active');
        this.updateUserUI(this.user);
        document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
    }

    // ГЛАВНОЕ ИЗМЕНЕНИЕ: Вход через всплывающее окно
    async signInWithDiscord() {
        console.log("Auth: Попытка входа через POPUP...");
        const provider = new firebase.auth.OAuthProvider('oidc.openid-connect');
        try {
            await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            const result = await this.auth.signInWithPopup(provider);
            
            // Если popup успешен, onAuthStateChanged сработает автоматически,
            // и пользователь будет обработан.
            if (result.user) {
                console.log("Auth: Вход через POPUP успешен!", result.user);
            }
        } catch (error) {
            console.error("Auth: Ошибка входа через POPUP:", error);
            if (error.code === 'auth/popup-blocked') {
                alert('Всплывающее окно было заблокировано вашим браузером. Пожалуйста, разрешите всплывающие окна для этого сайта и попробуйте снова.');
            }
        }
    }

    // Выход из системы
    async signOut() {
        await this.auth.signOut();
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 250);
    }

    // Обновляет HTML-код в header
    updateUserUI(user) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;
        if (user) {
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            const avatarImg = avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style='width:100%;height:100%;border-radius:50%;'>` : name.charAt(0).toUpperCase();
            userSection.innerHTML = `<div class="user-info"><div class="user-dropdown"><div class="user-name"><div class="user-avatar" title="${name}">${avatarImg}</div><span>${name}</span></div><div class="dropdown-menu"><a href="account.html" class="dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z"></path></svg><span>Личный кабинет</span></a><button class="logout-btn dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 11H16V13H12V16L8 12L12 8V11Z"></path></svg><span>Выйти</span></button></div></div></div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
            // Добавляем слушатель клика на кнопку "Войти", так как она пересоздается
            const loginBtn = userSection.querySelector('.login-btn');
            if(loginBtn) {
                 loginBtn.addEventListener('click', () => {
                     const authPage = document.querySelector('#authPage');
                     if(authPage) authPage.classList.add('active');
                 });
            }
        }
    }
}
