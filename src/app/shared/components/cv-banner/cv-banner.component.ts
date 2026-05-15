import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-cv-banner',
  imports: [CommonModule, RouterLink],
  template: `
    <div *ngIf="!hasCv && isVisible" 
         class="premium-banner" 
         [class.dismissing]="isDismissing">
      <div class="banner-mesh"></div>
      <div class="banner-content-wrap">
        <div class="banner-icon-box">
          <div class="orb-pulse"></div>
          <i class="fas fa-rocket floating-icon"></i>
        </div>
        <div class="banner-text-info">
          <div class="banner-top-row">
            <span class="banner-badge">Priority Action</span>
            <span class="milestone-tag">Locked Feature</span>
          </div>
          <h3>Unlock your <span class="text-gradient">Career Potential</span></h3>
          <p>Your profile is currently invisible. <strong>Upload your CV</strong> to start appearing in search results.</p>
        </div>
        <div class="banner-actions-wrap">
          <button class="cb-btn cb-btn-primary exec-btn-chic" [routerLink]="['/profile']" fragment="cv-upload-section">
            <i class="fas fa-cloud-upload-alt"></i> 
            <span>Upload Now</span>
            <div class="btn-shimmer"></div>
          </button>
          <button class="close-banner-btn" (click)="dismiss()" title="Dismiss">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .premium-banner {
      position: relative;
      background: #ffffff;
      border: 1px solid rgba(15, 23, 42, 0.06);
      border-radius: 24px;
      padding: 18px 28px;
      margin-bottom: 24px;
      overflow: hidden;
      box-shadow: 
        0 10px 25px rgba(0, 0, 0, 0.04),
        0 4px 10px rgba(0, 0, 0, 0.02);
      animation: bannerSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .premium-banner.dismissing {
      opacity: 0;
      transform: translateY(-40px);
      margin-bottom: -100px;
      pointer-events: none;
    }

    .banner-mesh {
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 70% 30%, rgba(99, 102, 241, 0.06) 0%, transparent 40%);
      pointer-events: none;
      animation: meshMove 15s infinite linear;
    }

    @keyframes meshMove {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .banner-content-wrap {
      display: flex;
      align-items: center;
      gap: 24px;
      position: relative;
      z-index: 2;
    }

    .banner-icon-box {
      position: relative;
      width: 52px;
      height: 52px;
      background: #0f172a;
      color: white;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      flex-shrink: 0;
      box-shadow: 0 8px 20px rgba(15, 23, 42, 0.15);
    }

    .floating-icon {
      animation: iconFloat 3s infinite ease-in-out;
    }

    @keyframes iconFloat {
      0%, 100% { transform: translateY(0) rotate(0); }
      50% { transform: translateY(-5px) rotate(5deg); }
    }

    .orb-pulse {
      position: absolute;
      inset: -5px;
      border: 2px solid #6366f1;
      border-radius: 20px;
      opacity: 0.2;
      animation: pulseGrow 2s infinite ease-out;
    }

    .banner-text-info {
      flex: 1;
    }

    .banner-top-row {
      display: flex;
      gap: 8px;
      margin-bottom: 6px;
    }

    .banner-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #fef2f2;
      color: #ef4444;
      border-radius: 8px;
      font-size: 0.65rem;
      font-weight: 850;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .milestone-tag {
      font-size: 0.65rem;
      font-weight: 850;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
      background: #f1f5f9;
      padding: 4px 10px;
      border-radius: 8px;
    }

    .banner-text-info h3 {
      margin: 0 0 4px 0;
      font-size: 1.3rem;
      font-weight: 850;
      color: #0f172a;
      letter-spacing: -0.01em;
    }

    .text-gradient {
      background: linear-gradient(90deg, #0f172a, #6366f1);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .banner-text-info p {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
      line-height: 1.5;
    }

    .banner-actions-wrap {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    /* ── HIGH QUALITY BUTTON ── */
    .exec-btn-chic {
      position: relative;
      background: #0f172a !important;
      color: white !important;
      padding: 12px 28px !important;
      border-radius: 14px !important;
      font-size: 0.9rem !important;
      font-weight: 800 !important;
      border: none !important;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      overflow: hidden;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
      box-shadow: 0 8px 24px rgba(15, 23, 42, 0.2) !important;
    }

    .exec-btn-chic i {
      transition: transform 0.4s ease;
    }

    .exec-btn-chic:hover {
      transform: translateY(-4px) scale(1.03);
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.3) !important;
      background: #1a2333 !important;
    }

    .exec-btn-chic:hover i {
      transform: translateY(-3px) rotate(-10deg);
    }

    .btn-shimmer {
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
      transition: left 0.6s ease;
    }

    .exec-btn-chic:hover .btn-shimmer {
      left: 100%;
    }

    .close-banner-btn {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      width: 36px;
      height: 36px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .close-banner-btn:hover {
      background: #ffffff;
      color: #ef4444;
      border-color: #fecaca;
      transform: rotate(90deg);
    }

    @keyframes bannerSlideIn {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes pulseGrow {
      0% { transform: scale(1); opacity: 0.2; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    @media (max-width: 900px) {
      .banner-content-wrap { flex-direction: column; align-items: flex-start; gap: 16px; }
      .banner-actions-wrap { width: 100%; justify-content: space-between; }
      .exec-btn-chic { flex: 1; }
    }

    :host-context(body.dark) .premium-banner {
      background: #0f172a;
      border-color: rgba(255, 255, 255, 0.05);
    }
    :host-context(body.dark) .banner-text-info h3 { color: #f1f5f9; }
    :host-context(body.dark) .text-gradient { background: linear-gradient(90deg, #f1f5f9, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    :host-context(body.dark) .close-banner-btn { background: #1e293b; border-color: rgba(255, 255, 255, 0.05); }
    :host-context(body.dark) .milestone-tag { background: #1e293b; color: #8b9ab8; }
    :host-context(body.dark) .exec-btn-chic { background: #6366f1 !important; }
  `]
})
export class CvBannerComponent {
  @Input() hasCv: boolean = false;
  isVisible: boolean = true;
  isDismissing: boolean = false;

  dismiss() {
    this.isDismissing = true;
    setTimeout(() => {
      this.isVisible = false;
    }, 500); 
  }
}
