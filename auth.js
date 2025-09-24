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
        this.init();
    }

    async init() {
        this.updateUserUI(null, true); // Показываем "Проверка..."
        
        try {
            const result = await this.auth.getRedirectResult();
            if (result && result.user) {
                await this.createUserProfileIfNotExists(result.user, result.additionalUserInfo.profile);
            }
            this.listenForAuthStateChanges();
        } catch (error) {
            console.error('Критическая ошибка авторизации:', error);
            this.updateUserUI(null);
        }

        document.addEventListener('click', (event) => {
            if (event.target.closest('.logout-btn')) this.signOut();
        });
    }

    listenForAuthStateChanges() {
        this.auth.onAuthStateChanged(async (firebaseUser) => {
            if (firebaseUser) {
                const userProfile = await this.getUserProfile(firebaseUser.uid);
                this.user = userProfile;
                if (!this.user) {
                    console.error("Профиль не найден, выход.");
                    this.signOut();
                    return;
                }
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
            const newProfileData = {
                username: discordProfile.username || firebaseUser.displayName,
                email: discordProfile.email || firebaseUser.email,
                avatar_url: discordProfile.avatar ? `https://cdn.discordapp.com/avatars/${discordProfile.id}/${discordProfile.avatar}.png` : firebaseUser.photoURL,
                role: 'Игрок'
            };
            await userProfileRef.set(newProfileData);
        }
    }

    async getUserProfile(uid) {
        const doc = await this.db.collection('profiles').doc(uid).get();
        return doc.exists ? { uid, ...doc.data() } : null;
    }

    signInWithDiscord() {
        const provider = new firebase.auth.OAuthProvider('oidc.discord.com');
        provider.addScope('identify');
        provider.addScope('email');
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
            const avatarImg = avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase();

            userSection.innerHTML = `
                <div class="user-info">
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

// Создаем глобальный экземпляр, к которому будут обращаться все остальные скрипты
window.authManager = new AuthManager();
