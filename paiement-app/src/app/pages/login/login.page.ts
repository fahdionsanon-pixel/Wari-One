import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  phone = '';
  pin = '';
  message = '';
  loading = false;

  constructor(private api: ApiService, private router: Router, private auth: AuthService) {}

  async login() {
    this.message = '';
    if (!/^\d{8,15}$/.test(this.phone) || !/^\d{4}$/.test(this.pin)) {
      this.message = 'Numero (chiffres uniquement) ou code PIN (4 chiffres) invalide';
      return;
    }
    this.loading = true;
    try {
      await this.api.login(this.phone, this.pin);
      // After login, fetch balance to update the shared observable
      await this.api.getBalance();
      // Store user info (phone as name for now)
      this.auth.setUser(this.phone, this.phone);
      this.pin = '';
      this.router.navigate(['/home']);
    } catch (e: any) {
      this.message = e.message;
    }
    this.loading = false;
  }

  // Permet de declencher les clics sur la zone neutre en desactivant le focus tactile
  blurActiveElement() {
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }
  }
}