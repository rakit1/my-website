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

        if (sessionStorage.getItem('isLoggedIn') === 'true') {
            this.setPlaceholderState();
        } else {
            this.setLoadingState();
        }

        this.handleAuthentication();

        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) this.signOut();
        });
    }

    setLoadingState() {
        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.innerHTML = '<div class="login-btn loading-auth">Проверка...</div>';
        }
    }
    
    setPlaceholderState() {
        const userSection = document.getElementById('userSection');
        const name = sessionStorage.getItem('username');
        const avatarUrl = sessionStorage.getItem('avatar');
        if (userSection && name) {
            this.updateUserUI({ username: name, avatar_url: avatarUrl });
        } else {
            this.setLoadingState();
        }
    }

    handleAuthentication() {
        // ИЗМЕНЕНО: Добавлена обработка результата после редиректа
        this.auth.getRedirectResult()
            .then(async (result) => {
                if (result.user) {
                    const firebaseUser = result.user;
                    const userDocRef = this.db.collection('profiles').doc(firebaseUser.uid);
                    const userDoc = await userDocRef.get();

                    // Если профиля нет, создаем его. Это важно для новых пользователей.
                    if (!userDoc.exists) {
                        const profileData = {
                            email: firebaseUser.email,
                            username: result.additionalUserInfo.profile.username || firebaseUser.displayName,
                            avatar_url: result.additionalUserInfo.profile.avatar ? `https://cdn.discordapp.com/avatars/${firebaseUser.providerData[0].uid}/${result.additionalUserInfo.profile.avatar}.png` : firebaseUser.photoURL,
                            role: 'Игрок' // Роль по умолчанию
                        };
                        await userDocRef.set(profileData);
                    }
                }
            }).catch((error) => {
                console.error("Auth: Ошибка обработки редиректа:", error);
            });

        // Этот обработчик теперь сработает корректно после getRedirectResult
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userDocRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userDoc = await userDocRef.get();
                if (userDoc.exists) {
                    this.user = { uid: firebaseUser.uid, ...userDoc.data() };
                    sessionStorage.setItem('isLoggedIn', 'true');
                    sessionStorage.setItem('username', this.user.username);
                    sessionStorage.setItem('avatar', this.user.avatar_url || '');
                } else {
                    console.error("Пользователь авторизован, но профиль отсутствует.");
                    this.user = null;
                    sessionStorage.clear();
                }
            } else {
                this.user = null;
                sessionStorage.clear();
            }
            this.updateUIAndNotify();
        });
    }

    updateUIAndNotify() {
        this.updateUserUI(this.user);
        document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
    }

    async signInWithDiscord() {
        // ИЗМЕНЕНО: Указан правильный провайдер и добавлены 'scopes'
        const provider = new firebase.auth.OAuthProvider('oidc.discord.com');
        provider.addScope('identify');
        provider.addScope('email');
        
        try {
            await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
            await this.auth.signInWithRedirect(provider);
        } catch (error) {
            console.error("Auth: Ошибка входа через REDIRECT:", error);
        }
    }

    async signOut() {
        sessionStorage.clear();
        await this.auth.signOut();
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 250);
    }
    
    updateUserUI(user) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;
        if (user) {
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            const avatarImg = (avatarUrl && avatarUrl !== 'null') ? `<img src="${avatarUrl}" alt="Аватар" style='width:100%;height:100%;border-radius:50%;'>` : name.charAt(0).toUpperCase();
            userSection.innerHTML = `<div class="user-info"><div class="user-dropdown"><div class="user-name"><div class="user-avatar" title="${name}">${avatarImg}</div><span>${name}</span></div><div class="dropdown-menu"><a href="account.html" class="dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z"></path></svg><span>Личный кабинет</span></a><button class="logout-btn dropdown-item"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 11H16V13H12V16L8 12L12 8V11Z"></path></svg><span>Выйти</span></button></div></div></div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
            const loginBtn = userSection.querySelector('.login-btn');
            if(loginBtn) {
                 loginBtn.addEventListener('click', () => this.signInWithDiscord());
            }
        }
    }
}
