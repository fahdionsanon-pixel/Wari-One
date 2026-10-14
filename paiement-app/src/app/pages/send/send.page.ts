import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-send',
  standalone: false,
  templateUrl: './send.page.html',
  styleUrls: ['./send.page.scss'],
})
export class SendPage {
  toPhone = '';
  amount: number | null = null;
  pin = '';
  message = '';
  loading = false;

  constructor(private api: ApiService, private router: Router) {}

  async send() {
    this.message = '';
    if (!/^\d{4}$/.test(this.pin)) {
      this.message = 'Saisis ton code PIN (4 chiffres) pour confirmer l\'envoi';
      return;
    }
    this.loading = true;
    try {
      await this.api.transfer(this.toPhone, Number(this.amount), this.pin);
      // Refresh balance after successful transfer
      await this.api.getBalance();
      this.pin = '';
      this.router.navigate(['/home']);
    } catch (e: any) {
      this.message = e.message;
      this.pin = ''; // le PIN est toujours efface apres une tentative
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