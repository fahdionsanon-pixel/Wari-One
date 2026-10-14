import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-send',
  standalone: false,
  templateUrl: './send.page.html',
  styleUrls: ['./send.page.scss'],
})
export class SendPage implements OnInit {
  toPhone = '';
  amount: number | null = null;
  pin = '';
  message = '';
  loading = false;

  constructor(
    private api: ApiService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['phone']) {
        let phone = params['phone'].toString().trim();
        if (phone.startsWith('+')) {
          phone = phone.substring(1);
        }
        this.toPhone = phone;
        this.cdr.detectChanges();
      }
    });
  }

  async send() {
    this.message = '';
    if (!/^\d{4}$/.test(this.pin)) {
      this.message = 'Saisis ton code PIN (4 chiffres) pour confirmer l\'envoi';
      this.cdr.detectChanges();
      return;
    }
    this.loading = true;
    this.cdr.detectChanges();
    try {
      await this.api.transfer(this.toPhone, Number(this.amount), this.pin);
      // Refresh balance after successful transfer
      await this.api.getBalance();
      this.pin = '';
      await this.router.navigate(['/home']);
    } catch (e: any) {
      this.message = e.message;
      this.pin = ''; // le PIN est toujours efface apres une tentative
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }
}