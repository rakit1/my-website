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

        firebase.initializeApp(firebaseConfig);
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.user = null;

        // Мы используем onAuthStateChanged как единственный источник правды о состоянии пользователя.
        // Но чтобы обработать создание профиля после редиректа, нам нужно сначала
        // проверить результат редиректа.
        this.handleAuthentication();

        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) this.signOut();
        });
    }

    async handleAuthentication() {
        try {
            // Сначала пытаемся получить результат редиректа.
            // Это выполнится только на странице, куда пользователь вернулся после входа.
            const result = await this.auth.getRedirectResult();
            if (result.user) {
                // Если мы получили пользователя из редиректа, это может быть первый вход.
                // Проверим, есть ли у него профиль в нашей БД.
                const userDocRef = this.db.collection('profiles').doc(result.user.uid);
                const userDoc = await userDocRef.get();
                if (!userDoc.exists) {
                    // Профиля нет - создаем его.
                    const profileData = {
                        username: result.user.displayName || 'Пользователь',
                        email: result.user.email,
                        avatar_url: result.user.photoURL,
                        role: 'Игрок'
                    };
                    await userDocRef.set(profileData);
                }
            }
        } catch (error) {
            console.error("Ошибка обработки редиректа:", error);
        }

        // Теперь, когда редирект обработан (или его не было),
        // мы устанавливаем основной слушатель состояния авторизации.
        // Он будет срабатывать всегда при загрузке страницы и при изменении статуса входа/выхода.
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                // Пользователь вошел. Загружаем его профиль из Firestore.
                const userDocRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    this.user = { uid: firebaseUser.uid, ...userDoc.data() };
                } else {
                    // Этот случай маловероятен, если логика редиректа сработала,
                    // но это защита на случай, если пользователь есть в Auth, но нет в БД.
                    console.warn("Профиль не найден, создается резервная копия.");
                    const profileData = {
                        username: firebaseUser.displayName || 'Пользователь',
                        email: firebaseUser.email,
                        avatar_url: firebaseUser.photoURL,
                        role: 'Игрок'
                    };
                    await userDocRef.set(profileData);
                    this.user = { uid: firebaseUser.uid, ...profileData };
                }
            } else {
                // Пользователь не вошел в систему.
                this.user = null;
            }
            // Обновляем интерфейс и сообщаем другим скриптам о готовности.
            this.updateUIAndNotify();
        });
    }
    
    updateUIAndNotify() {
        // Закрываем модальное окно авторизации, если оно открыто
        document.querySelector('#authPage')?.classList.remove('active');
        this.updateUserUI(this.user);
        // Отправляем событие, чтобы другие части сайта знали, что статус пользователя определен
        document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
    }

    async signInWithDiscord() {
        const provider = new firebase.auth.OAuthProvider('oidc.openid-connect');
        await this.auth.signInWithRedirect(provider);
    }

    async signOut() {
        document.body.classList.add('fade-out');
        setTimeout(async () => {
            await this.auth.signOut();
            // После выхода всегда перенаправляем на главную
            window.location.href = 'index.html';
        }, 250);
    }
    
    updateUserUI(user) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;
        if (user) {
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            userSection.innerHTML = `<div class="user-info"><div class="user-dropdown"><div class="user-name"><div class="user-avatar" title="${name}">${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase()}</div><span>${name}</span></div><div class="dropdown-menu"><a href="account.html" class="dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z"></path></svg><span>Личный кабинет</span></a><button class="logout-btn dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 11H16V13H12V16L8 12L12 8V11Z"></path></svg><span>Выйти</span></button></div></div></div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }
}

