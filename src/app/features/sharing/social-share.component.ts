import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-social-share',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatTooltipModule, MatSnackBarModule, TranslateModule],
  templateUrl: './social-share.component.html',
  styleUrl: './social-share.component.scss',
})
export class SocialShareComponent {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  private getShareUrl(): string {
    return window.location.href;
  }

  private getShareTitle(): string {
    return this.translate.instant('sharing.sharedMap');
  }

  shareFacebook(): void {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(this.getShareUrl())}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  shareTwitter(): void {
    const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(this.getShareUrl())}&text=${encodeURIComponent(this.getShareTitle())}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  shareWhatsApp(): void {
    const url = `https://wa.me/?text=${encodeURIComponent(this.getShareTitle() + ' ' + this.getShareUrl())}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  shareLinkedIn(): void {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.getShareUrl())}`;
    window.open(url, '_blank', 'width=600,height=400');
  }

  copyUrl(): void {
    navigator.clipboard.writeText(this.getShareUrl()).then(() => {
      this.snackBar.open(
        this.translate.instant('sharing.copied'),
        'OK',
        { duration: 2000 }
      );
    });
  }
}
