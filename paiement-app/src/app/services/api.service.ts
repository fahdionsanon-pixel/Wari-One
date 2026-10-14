import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private balanceSubject = new BehaviorSubject<number | null>(null);
  balance$ = this.balanceSubject.asObservable();

  constructor(private auth: AuthService) {}

  // withToken = false pour les routes publiques (OTP, inscription, connexion)
  private async request(path: string, method = 'GET', body?: any, withToken = true) {
    const headers: any = { 'Content-Type': 'application/json' };
    if (withToken) {
      headers['Authorization'] = 'Bearer ' + (await this.auth.getToken());
    }
    const response = await fetch(environment.apiUrl + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let data: any = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`Erreur serveur (${response.status})`);
    }
    if (!response.ok) throw new Error(data.error || `Erreur (${response.status})`);
    return data;
  }

  // Verification du numero par code OTP
  requestOtp(phone: string) {
    return this.request('/otp/request', 'POST', { phone }, false);
  }
  verifyOtp(phone: string, code: string) {
    return this.request('/otp/verify', 'POST', { phone, code }, false);
  }

  // Inscription : cree le compte (numero verifie + PIN + nom) puis ouvre la session
  async register(phone: string, pin: string, name: string = '') {
    const data = await this.request('/register', 'POST', { phone, pin, name }, false);
    this.auth.setUser(phone, data.name || name);
    await this.auth.signInWithToken(data.token);
    return data;
  }

  // Connexion : verifie numero + PIN puis ouvre la session
  async login(phone: string, pin: string) {
    const data = await this.request('/login', 'POST', { phone, pin }, false);
    this.auth.setUser(phone, data.name || '');
    await this.auth.signInWithToken(data.token);
    return data;
  }

  getBalance() {
    return this.request('/balance').then(data => {
      this.balanceSubject.next(data.balance ?? null);
      if (data.name) {
        this.auth.setName(data.name);
      }
      return data;
    });
  }

  deposit(amount: number) {
    return this.request('/deposit', 'POST', { amount }).then(data => {
      if (data.balance !== undefined) {
        this.balanceSubject.next(data.balance);
      }
      return data;
    });
  }

  withdraw(amount: number, pin: string) {
    return this.request('/withdraw', 'POST', { amount, pin }).then(data => {
      if (data.balance !== undefined) {
        this.balanceSubject.next(data.balance);
      }
      return data;
    });
  }

  transfer(toPhone: string, amount: number, pin: string) {
    return this.request('/transfer', 'POST', { toPhone, amount, pin });
  }
  getTransactions() { return this.request('/transactions'); }
}
