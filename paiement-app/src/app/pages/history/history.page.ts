import { Component, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-history',
  standalone: false,
  templateUrl: './history.page.html',
  styleUrls: ['./history.page.scss'],
})
export class HistoryPage {
  transactions: any[] = [];
  message = '';

  constructor(
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  async ionViewWillEnter() {
    try {
      this.transactions = await this.api.getTransactions();
    } catch (e: any) {
      this.message = e.message;
    } finally {
      this.cdr.detectChanges();
    }
  }
}
