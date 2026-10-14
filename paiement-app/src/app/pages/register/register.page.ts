import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  step = 1; // 1 = numero, 2 = code OTP, 3 = creation du code PIN
  phone = '';
  otp = '';
  pin = '';
  pinConfirm = '';
  message = '';
  info = '';
  loading = false;

  constructor(private api: ApiService, private router: Router) {}

  // Etape 1 : demander le code OTP
  async sendOtp() {
    this.message = '';
    this.info = '';
    if (!/^\d{8,15}$/.test(this.phone)) {
      this.message = 'Numero invalide : 8 a 15 chiffres, sans espace ni +';
      return;
    }
    this.loading = true;
    try {
      const data = await this.api.requestOtp(this.phone);
      // En mode demo, le backend renvoie le code (aucun vrai SMS n'est envoye)
      if (data.demoCode) this.info = 'Mode demo : ton code est ' + data.demoCode;
      this.otp = '';
      this.step = 2;
    } catch (e: any) {
      this.message = e.message;
    }
    this.loading = false;
  }

  // Etape 2 : verifier le code OTP
  async checkOtp() {
    this.message = '';
    if (!/^\d{6}$/.test(this.otp)) {
      this.message = 'Le code OTP contient 6 chiffres';
      return;
    }
    this.loading = true;
    try {
      await this.api.verifyOtp(this.phone, this.otp);
      this.info = '';
      this.step = 3;
    } catch (e: any) {
      this.message = e.message;
    }
    this.loading = false;
  }

  // Etape 3 : creer le PIN et le compte
  async createAccount() {
    this.message = '';
    if (!/^\d{4}$/.test(this.pin)) {
      this.message = 'Le code PIN doit contenir exactement 4 chiffres';
      return;
    }
    if (this.pin !== this.pinConfirm) {
      this.message = 'Les deux codes PIN ne sont pas identiques';
      return;
    }
    this.loading = true;
    try {
      await this.api.register(this.phone, this.pin);
      this.pin = '';
      this.pinConfirm = '';
      this.router.navigateByUrl('/home');
    } catch (e: any) {
      this.message = e.message;
    }
    this.loading = false;
  }

  changeNumber() {
    this.message = '';
    this.info = '';
    this.step = 1;
  }

  // Permet de déclencher les clics sur la zone neutre en désactivant le focus tactile
  blurActiveElement() {
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }
  }
}
