import { Component, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-register',
  standalone: false,
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
})
export class RegisterPage {
  step = 1; // 1 = numero, 2 = code OTP, 3 = nom de l'utilisateur, 4 = creation du code PIN
  phone = '';
  otp = '';
  name = '';
  pin = '';
  pinConfirm = '';
  message = '';
  info = '';
  demoCode = '';
  otpCopied = false;
  loading = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  onPhoneInput(event: any) {
    const raw = event.target ? event.target.value : this.phone;
    // Supprime automatiquement les espaces, tirets et caractères non numériques (sauf + éventuel au début)
    this.phone = (raw || '').replace(/[\s\-\(\)\.]/g, '');
  }

  onOtpInput(event: any) {
    const raw = event.target ? event.target.value : this.otp;
    this.otp = (raw || '').replace(/\D/g, '');
  }

  // Etape 1 : demander le code OTP
  async sendOtp() {
    this.message = '';
    this.info = '';
    this.demoCode = '';
    this.otpCopied = false;

    // Nettoyage automatique : supprime espaces, +, tirets, points
    const cleaned = (this.phone || '').replace(/[\s\+\-\(\)\.]/g, '');
    this.phone = cleaned;

    if (!/^\d{8,15}$/.test(cleaned)) {
      this.message = 'Numéro invalide : entrez entre 8 et 15 chiffres';
      this.cdr.detectChanges();
      return;
    }

    // Fermeture douce du clavier
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }

    this.loading = true;
    this.cdr.detectChanges();
    try {
      const data = await this.api.requestOtp(cleaned);
      // En mode demo, le backend renvoie le code
      if (data.demoCode) {
        this.demoCode = data.demoCode;
        this.info = 'Code de vérification : ' + data.demoCode;
      }
      this.otp = '';
      this.step = 2;
    } catch (e: any) {
      this.message = e.message;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // Etape 2 : verifier le code OTP
  async checkOtp() {
    this.message = '';
    const cleanOtp = (this.otp || '').replace(/\D/g, '');
    this.otp = cleanOtp;

    if (!/^\d{6}$/.test(cleanOtp)) {
      this.message = 'Le code OTP doit contenir exactement 6 chiffres';
      this.cdr.detectChanges();
      return;
    }

    // Fermeture douce du clavier
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }

    this.loading = true;
    this.cdr.detectChanges();
    try {
      await this.api.verifyOtp(this.phone, cleanOtp);
      this.info = '';
      this.step = 3; // Passe à l'étape de saisie du nom
    } catch (e: any) {
      this.message = e.message;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  // Etape 3 : valider le nom
  confirmName() {
    this.message = '';
    const cleanName = (this.name || '').trim();
    if (!cleanName) {
      this.message = 'Veuillez saisir votre nom';
      this.cdr.detectChanges();
      return;
    }
    this.name = cleanName;

    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }

    this.step = 4; // Passe à la création du code PIN
    this.cdr.detectChanges();
  }

  // Etape 4 : creer le PIN et le compte avec le nom
  async createAccount() {
    this.message = '';
    const cleanPin = (this.pin || '').replace(/\D/g, '');
    const cleanConfirm = (this.pinConfirm || '').replace(/\D/g, '');
    this.pin = cleanPin;
    this.pinConfirm = cleanConfirm;

    if (!/^\d{4}$/.test(cleanPin)) {
      this.message = 'Le code PIN doit contenir exactement 4 chiffres';
      this.cdr.detectChanges();
      return;
    }
    if (cleanPin !== cleanConfirm) {
      this.message = 'Les deux codes PIN ne sont pas identiques';
      this.cdr.detectChanges();
      return;
    }

    // Fermeture douce du clavier
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }

    this.loading = true;
    this.cdr.detectChanges();
    try {
      await this.api.register(this.phone, cleanPin, this.name);
      this.pin = '';
      this.pinConfirm = '';
      await this.router.navigateByUrl('/home');
    } catch (e: any) {
      this.message = e.message;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  copyOtp() {
    const code = this.demoCode || this.otp;
    if (code) {
      if (navigator && navigator.clipboard) {
        navigator.clipboard.writeText(code);
      }
      this.otp = code; // Remplit automatiquement le champ OTP
      this.otpCopied = true;
      setTimeout(() => {
        this.otpCopied = false;
        this.cdr.detectChanges();
      }, 2500);
      this.cdr.detectChanges();
    }
  }

  changeNumber() {
    this.message = '';
    this.info = '';
    this.demoCode = '';
    this.otpCopied = false;
    this.step = 1;
    this.cdr.detectChanges();
  }
}
