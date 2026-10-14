import { Component, ChangeDetectorRef } from '@angular/core';
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

  constructor(
    private api: ApiService,
    private router: Router,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {}

  async login() {
    this.message = '';
    if (!/^\d{8,15}$/.test(this.phone) || !/^\d{4}$/.test(this.pin)) {
      this.message = 'Numero (chiffres uniquement) ou code PIN (4 chiffres) invalide';
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    try {
      await this.api.login(this.phone, this.pin);
      // After login, fetch balance to update the shared observable
      await this.api.getBalance();
      this.pin = '';
      await this.router.navigate(['/home']);
    } catch (e: any) {
      this.message = e.message;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}