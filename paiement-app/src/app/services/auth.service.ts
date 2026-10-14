import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { environment } from '../../environments/environment';

const app = initializeApp(environment.firebaseConfig);
const auth = getAuth(app);

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Ouvre la session Firebase avec le jeton delivre par le backend
  signInWithToken(token: string) {
    return signInWithCustomToken(auth, token);
  }

  logout() {
    return signOut(auth);
  }

  async getToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new Error('Non connecte');
    return user.getIdToken();
  }
}
