import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebaseConfig);
const firebaseAuth = getAuth(app);

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Ouvre la session Firebase avec le jeton delivre par le backend
  signInWithToken(token: string) {
    return signInWithCustomToken(firebaseAuth, token);
  }

  // Attend que Firebase soit prêt avant de récupérer le token
  async getToken(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Si l'utilisateur est déjà chargé, on renvoie directement
      if (firebaseAuth.currentUser) {
        firebaseAuth.currentUser.getIdToken()
          .then(resolve)
          .catch(() => reject(new Error('Erreur de jeton')));
        return;
      }
      // Sinon on attend l'initialisation Firebase (max 5s)
      const timer = setTimeout(() => {
        unsub();
        reject(new Error('Non connecté. Veuillez vous reconnecter.'));
      }, 5000);

      const unsub = onAuthStateChanged(firebaseAuth, (user: User | null) => {
        clearTimeout(timer);
        unsub();
        if (user) {
          user.getIdToken().then(resolve).catch(() => reject(new Error('Erreur de jeton')));
        } else {
          reject(new Error('Non connecté. Veuillez vous reconnecter.'));
        }
      });
    });
  }

  // User info stored after login
  private phone: string = localStorage.getItem('wari_phone') || '';
  private name: string = localStorage.getItem('wari_name') || '';

  setUser(phone: string, name: string = '') {
    this.phone = phone;
    this.name = name ? name.trim() : (this.name || '');
    localStorage.setItem('wari_phone', this.phone);
    if (this.name) {
      localStorage.setItem('wari_name', this.name);
    }
  }

  setName(name: string) {
    if (name && name.trim()) {
      this.name = name.trim();
      localStorage.setItem('wari_name', this.name);
    }
  }

  logout() {
    localStorage.removeItem('wari_phone');
    localStorage.removeItem('wari_name');
    this.phone = '';
    this.name = '';
    return signOut(firebaseAuth);
  }

  getPhone(): string {
    return this.phone;
  }

  getName(): string {
    return this.name || '';
  }
}
