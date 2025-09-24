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
        this.user = null;

        this.init();
    }

    // 2. ЗАПУСК ВСЕХ ПРОЦЕССОВ
    init() {
        this.updateUserUI(null, true); // Сразу показываем статус "Проверка..."
        this.handleRedirectResult();
        this.listenForAuthStateChanges();

        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) {
                this.signOut();
            }
        });
    }
    
    // 3. ОБРАБОТКА ВОЗВРАЩЕНИЯ С DISCORD
    async handleRedirectResult() {
        try {
            const result = await this.auth.getRedirectResult();
            if (result && result.user) {
                const firebaseUser = result.user;
                const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userProfileDoc = await userProfileRef.get();

                if (!userProfileDoc.exists) {
                    const profile = result.additionalUserInfo.profile;
                    const newProfileData = {
                        username: profile.username || firebaseUser.displayName,
                        email: profile.email || firebaseUser.email,
                        avatar_url: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : firebaseUser.photoURL,
                        role: 'Игрок'
                    };
                    await userProfileRef.set(newProfileData);
                }
            }
        } catch (error) {
            console.error('Ошибка при обработке редиректа:', error.code, error.message);
        }
    }

    // 4. СЛЕЖЕНИЕ ЗА СТАТУСОМ АВТОРИЗАЦИИ
    listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userProfileRef = this.db.collection('profiles').doc(firebaseUser.uid);
                const userProfileDoc = await userProfileRef.get();

                if (userProfileDoc.exists) {
                    this.user = { uid: firebaseUser.uid, ...userProfileDoc.data() };
                    this.updateUserUI(this.user);
                } else {
                    this.signOut();
                }
            } else {
                this.user = null;
                this.updateUserUI(null);
            }
            document.dispatchEvent(new CustomEvent('userStateReady', { detail: this.user }));
        });
    }

    // 5. ВХОД ЧЕРЕЗ DISCORD
    async signInWithDiscord() {
        const provider = new firebase.auth.OAuthProvider('oidc.discord.com');
        provider.addScope('identify');
        provider.addScope('email');
        
        await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        this.auth.signInWithRedirect(provider);
    }

    // 6. ВЫХОД ИЗ АККАУНТА
    async signOut() {
        await this.auth.signOut();
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 250);
    }

    // 7. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    updateUserUI(user, isLoading = false) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        if (isLoading) {
            userSection.innerHTML = '<div class="login-btn loading-auth">Проверка...</div>';
            return;
        }

        if (user) {
            const name = user.username || 'Пользователь';
            const avatarUrl = user.avatar_url;
            const avatarImg = (avatarUrl && avatarUrl !== 'null') 
                ? `<img src="${avatarUrl}" alt="Аватар" style='width:100%;height:100%;border-radius:50%;'>` 
                : name.charAt(0).toUpperCase();

            userSection.innerHTML = `
                <div class="user-info"><div class="user-dropdown"><div class="user-name"><div class="user-avatar" title="${name}">${avatarImg}</div><span>${name}</span></div><div class="dropdown-menu"><a href="account.html" class="dropdown-item"><span>Личный кабинет</span></a><button class="logout-btn dropdown-item"><span>Выйти</span></button></div></div></div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
            const loginBtn = userSection.querySelector('.login-btn');
            if (loginBtn) {
                loginBtn.addEventListener('click', () => this.signInWithDiscord());
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AuthManager();
});
