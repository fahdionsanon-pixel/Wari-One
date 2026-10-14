import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  balance: number | null = null;
  message = '';
  private balanceSub!: Subscription;

  constructor(
    private auth: AuthService,
    private api: ApiService,
    private router: Router
  ) {}

  ngOnInit() {
    // Fetch initial balance and subscribe to updates
    this.api.getBalance().catch(() => {}); // ignore errors here, handled in subscription
    this.balanceSub = this.api.balance$.subscribe({
      next: (bal) => {
        this.balance = bal;
        // Clear any error message when we successfully get balance
        if (this.message) {
          this.message = '';
        }
      },
      error: (err) => {
        this.message = err.message;
        this.router.navigate(['/login']);
      }
    });
  }

  ngOnDestroy() {
    if (this.balanceSub) {
      this.balanceSub.unsubscribe();
    }
  }

  async ionViewWillEnter() {
    // Ensure we have latest balance when entering the view
    await this.api.getBalance().catch(() => {});
  }

  async loadBalance() {
    try {
      const data = await this.api.getBalance();
      this.balance = data.balance;
    } catch (e: any) {
      this.message = e.message;
      this.router.navigate(['/login']);
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }

  // Permet de declencher les clics sur la zone neutre en desactivant le focus tactile
  blurActiveElement() {
    const active = document.activeElement as HTMLElement;
    if (active && active.blur) {
      active.blur();
    }
  }
}