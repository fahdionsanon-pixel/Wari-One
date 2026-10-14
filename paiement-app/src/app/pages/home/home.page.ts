import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { Subscription } from 'rxjs';
import * as QRCode from 'qrcode';
import jsQR from 'jsqr';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage implements OnInit, OnDestroy {
  balance: number | null = null;
  message = '';
  isBalanceVisible = true;
  qrCodeDataUrl = '';
  isQrModalOpen = false;
  isScannerModalOpen = false;
  toastMessage = '';
  copyFeedback = false;

  // État du Scanner Réel (Caméra + Image)
  scannerStream: MediaStream | null = null;
  scannerAnimationId: any = null;
  scannerCanvas: HTMLCanvasElement | null = null;
  scannerLoading = false;
  scannerError = '';
  scannerSuccess = false;
  scannedPhone = '';
  cameraFacingMode: 'environment' | 'user' = 'environment';
  hasMultipleCameras = false;

  // Modales Dépôt et Retrait
  isDepositModalOpen = false;
  depositAmount: number | null = null;
  depositLoading = false;
  depositError = '';

  isWithdrawModalOpen = false;
  withdrawAmount: number | null = null;
  withdrawPin = '';
  withdrawLoading = false;
  withdrawError = '';

  // Filtres et recherche pour les transactions
  currentFilter: 'all' | 'in' | 'out' = 'all';
  searchQuery = '';
  transactions: any[] = [];
  filteredTransactions: any[] = [];
  loadingTransactions = false;

  private balanceSub!: Subscription;

  constructor(
    public auth: AuthService,
    private api: ApiService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  get userPhone(): string {
    const raw = this.auth.getPhone() || '22657762673';
    return raw.startsWith('+') ? raw : '+' + raw;
  }

  get userName(): string {
    const name = this.auth.getName();
    if (name && name.trim()) {
      return name.trim();
    }
    return this.auth.getPhone() || 'Wari';
  }

  async ngOnInit() {
    // Solde
    this.api.getBalance().catch(() => {});
    this.balanceSub = this.api.balance$.subscribe({
      next: (bal) => {
        this.balance = bal;
        if (this.message) this.message = '';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.message = err.message;
        this.cdr.detectChanges();
        this.router.navigate(['/login']);
      }
    });

    // Génération du QR Code
    await this.generateQrCode();

    // Chargement des transactions
    await this.loadTransactions();
  }

  ngOnDestroy() {
    this.stopScannerStream();
    if (this.balanceSub) {
      this.balanceSub.unsubscribe();
    }
  }

  async ionViewWillEnter() {
    await this.api.getBalance().catch(() => {});
    await this.generateQrCode();
    await this.loadTransactions();
    this.cdr.detectChanges();
  }

  async generateQrCode() {
    try {
      const payload = this.userPhone;
      this.qrCodeDataUrl = await QRCode.toDataURL(payload, {
        color: {
          dark: '#1d4ed8', // Bleu roi fidèle à la maquette
          light: '#ffffff',
        },
        margin: 1,
        width: 260,
        errorCorrectionLevel: 'M',
      });
      this.cdr.detectChanges();
    } catch (e) {
      console.error('Erreur génération QR Code', e);
    }
  }

  toggleBalanceVisibility() {
    this.isBalanceVisible = !this.isBalanceVisible;
    this.cdr.detectChanges();
  }

  async loadTransactions() {
    this.loadingTransactions = true;
    try {
      this.transactions = await this.api.getTransactions();
      this.filterTransactions();
    } catch (e: any) {
      this.transactions = [];
      this.filteredTransactions = [];
    } finally {
      this.loadingTransactions = false;
      this.cdr.detectChanges();
    }
  }

  setFilter(filter: 'all' | 'in' | 'out') {
    this.currentFilter = filter;
    this.filterTransactions();
  }

  filterTransactions() {
    let list = [...this.transactions];

    if (this.currentFilter === 'in') {
      list = list.filter((t) => t.type === 'recu' || t.type === 'depot');
    } else if (this.currentFilter === 'out') {
      list = list.filter((t) => t.type === 'envoye' || t.type === 'retrait');
    }

    if (this.searchQuery && this.searchQuery.trim() !== '') {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t.other && t.other.toString().toLowerCase().includes(q)) ||
          (t.amount && t.amount.toString().includes(q))
      );
    }

    this.filteredTransactions = list;
    this.cdr.detectChanges();
  }

  goTo(path: string) {
    this.router.navigate([path]);
  }

  openQrModal() {
    this.isQrModalOpen = true;
    this.cdr.detectChanges();
  }

  closeQrModal() {
    this.isQrModalOpen = false;
    this.cdr.detectChanges();
  }

  openScanner() {
    this.isScannerModalOpen = true;
    this.scannerError = '';
    this.scannerSuccess = false;
    this.scannedPhone = '';
    this.cdr.detectChanges();
    setTimeout(() => {
      this.startCameraScan();
    }, 150);
  }

  async startCameraScan() {
    this.stopScannerStream();
    this.scannerLoading = true;
    this.scannerError = '';
    this.cdr.detectChanges();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.scannerLoading = false;
      this.scannerError = 'Caméra non supportée sur ce navigateur. Vous pouvez importer une image du QR Code.';
      this.cdr.detectChanges();
      return;
    }

    try {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        this.hasMultipleCameras = videoDevices.length > 1;
      } catch {}

      this.scannerStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      const video = document.getElementById('scannerVideo') as HTMLVideoElement;
      if (video) {
        video.srcObject = this.scannerStream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        this.scannerLoading = false;
        this.cdr.detectChanges();
        this.scanTick();
      }
    } catch (err: any) {
      console.warn('Erreur accès caméra:', err);
      this.scannerLoading = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        this.scannerError = 'Permission caméra refusée. Vous pouvez importer une photo du QR Code ou saisir le numéro.';
      } else {
        this.scannerError = 'Impossible d\'activer la caméra. Utilisez l\'importation de photo ou la saisie manuelle.';
      }
      this.cdr.detectChanges();
    }
  }

  scanTick() {
    if (!this.isScannerModalOpen || this.scannerSuccess) return;

    const video = document.getElementById('scannerVideo') as HTMLVideoElement;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      if (!this.scannerCanvas) {
        this.scannerCanvas = document.createElement('canvas');
      }
      const canvas = this.scannerCanvas;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        if (code && code.data) {
          this.handleDecodedQr(code.data);
          return;
        }
      }
    }

    this.scannerAnimationId = requestAnimationFrame(() => this.scanTick());
  }

  handleDecodedQr(data: string) {
    const phone = this.extractPhoneFromQr(data);
    if (!phone) {
      this.scannerError = 'Format de QR Code inconnu : ' + data;
      this.cdr.detectChanges();
      return;
    }

    this.scannerSuccess = true;
    this.scannedPhone = phone;
    this.stopScannerStream();
    this.playScanBeep();
    this.cdr.detectChanges();

    setTimeout(() => {
      this.closeScanner();
      this.router.navigate(['/send'], { queryParams: { phone } });
    }, 700);
  }

  extractPhoneFromQr(raw: string): string {
    if (!raw) return '';
    raw = raw.trim();

    try {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.phone || parsed.num || parsed.to)) {
        return (parsed.phone || parsed.num || parsed.to).replace(/[^\d+]/g, '');
      }
    } catch {}

    if (raw.toLowerCase().startsWith('wari:')) {
      raw = raw.substring(5);
    }
    if (raw.toLowerCase().startsWith('tel:')) {
      raw = raw.substring(4);
    }

    const cleaned = raw.replace(/[^\d+]/g, '');
    return cleaned;
  }

  onQrFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;

    this.scannerLoading = true;
    this.scannerError = '';
    this.cdr.detectChanges();

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          this.scannerLoading = false;
          if (code && code.data) {
            this.handleDecodedQr(code.data);
          } else {
            this.scannerError = 'Aucun QR Code valide détecté sur cette photo.';
            this.cdr.detectChanges();
          }
        }
      };
      img.onerror = () => {
        this.scannerLoading = false;
        this.scannerError = 'Erreur lors de la lecture de l\'image';
        this.cdr.detectChanges();
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be selected again
    event.target.value = '';
  }

  toggleCameraFacing() {
    this.cameraFacingMode = this.cameraFacingMode === 'environment' ? 'user' : 'environment';
    this.startCameraScan();
  }

  playScanBeep() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {}
  }

  stopScannerStream() {
    if (this.scannerAnimationId) {
      cancelAnimationFrame(this.scannerAnimationId);
      this.scannerAnimationId = null;
    }
    if (this.scannerStream) {
      this.scannerStream.getTracks().forEach((track) => track.stop());
      this.scannerStream = null;
    }
    const video = document.getElementById('scannerVideo') as HTMLVideoElement;
    if (video) {
      video.srcObject = null;
    }
  }

  closeScanner() {
    this.stopScannerStream();
    this.isScannerModalOpen = false;
    this.scannerError = '';
    this.scannerSuccess = false;
    this.scannedPhone = '';
    this.cdr.detectChanges();
  }

  // Fonctions Dépôt
  openDeposit() {
    this.isDepositModalOpen = true;
    this.depositAmount = null;
    this.depositError = '';
    this.cdr.detectChanges();
  }

  closeDeposit() {
    this.isDepositModalOpen = false;
    this.depositError = '';
    this.cdr.detectChanges();
  }

  selectDepositAmount(amt: number) {
    this.depositAmount = amt;
    this.depositError = '';
    this.cdr.detectChanges();
  }

  async confirmDeposit() {
    this.depositError = '';
    const amt = Number(this.depositAmount);
    if (!amt || amt <= 0 || !Number.isInteger(amt)) {
      this.depositError = 'Veuillez saisir un montant valide en FCFA';
      this.cdr.detectChanges();
      return;
    }

    this.depositLoading = true;
    this.cdr.detectChanges();
    try {
      await this.api.deposit(amt);
      await this.api.getBalance();
      await this.loadTransactions();
      this.closeDeposit();
      this.showFeatureNotice(`Dépôt de ${amt.toLocaleString()} FCFA effectué avec succès !`);
    } catch (e: any) {
      this.depositError = e.message || 'Erreur lors du dépôt';
    } finally {
      this.depositLoading = false;
      this.cdr.detectChanges();
    }
  }

  // Fonctions Retrait
  openWithdraw() {
    this.isWithdrawModalOpen = true;
    this.withdrawAmount = null;
    this.withdrawPin = '';
    this.withdrawError = '';
    this.cdr.detectChanges();
  }

  closeWithdraw() {
    this.isWithdrawModalOpen = false;
    this.withdrawError = '';
    this.withdrawPin = '';
    this.cdr.detectChanges();
  }

  selectWithdrawAmount(amt: number) {
    this.withdrawAmount = amt;
    this.withdrawError = '';
    this.cdr.detectChanges();
  }

  async confirmWithdraw() {
    this.withdrawError = '';
    const amt = Number(this.withdrawAmount);
    if (!amt || amt <= 0 || !Number.isInteger(amt)) {
      this.withdrawError = 'Veuillez saisir un montant valide en FCFA';
      this.cdr.detectChanges();
      return;
    }
    const cleanPin = (this.withdrawPin || '').replace(/\D/g, '');
    if (!/^\d{4}$/.test(cleanPin)) {
      this.withdrawError = 'Code PIN à 4 chiffres requis pour confirmer le retrait';
      this.cdr.detectChanges();
      return;
    }

    this.withdrawLoading = true;
    this.cdr.detectChanges();
    try {
      await this.api.withdraw(amt, cleanPin);
      await this.api.getBalance();
      await this.loadTransactions();
      this.closeWithdraw();
      this.showFeatureNotice(`Retrait de ${amt.toLocaleString()} FCFA confirmé !`);
    } catch (e: any) {
      this.withdrawError = e.message || 'Erreur lors du retrait';
      this.withdrawPin = '';
    } finally {
      this.withdrawLoading = false;
      this.cdr.detectChanges();
    }
  }

  copyPhone() {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(this.userPhone);
    }
    this.copyFeedback = true;
    setTimeout(() => {
      this.copyFeedback = false;
      this.cdr.detectChanges();
    }, 2000);
    this.cdr.detectChanges();
  }

  showFeatureNotice(message: string) {
    this.toastMessage = message;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.toastMessage = '';
      this.cdr.detectChanges();
    }, 3200);
  }

  async logout() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}