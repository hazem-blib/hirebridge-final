import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-cv-required-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content" (click)="$event.stopPropagation()">
        <button class="close-btn" (click)="close()">&times;</button>
        
        <div class="modal-header">
          <div class="icon-box">
            <i class="fas fa-file-upload"></i>
          </div>
          <p class="cb-eyebrow">Action Required</p>
          <h2>Upload your CV to continue</h2>
        </div>
        
        <div class="modal-body">
          <p>You need to upload and verify your CV before you can accept this application decision.</p>
        </div>
        
        <div class="modal-footer">
          <button class="cb-btn cb-btn-soft" (click)="close()">Cancel</button>
          <button class="cb-btn cb-btn-primary" (click)="goToProfile()">
            <i class="fas fa-upload" style="margin-right: 8px;"></i> Upload CV
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-out;
    }
    
    .modal-content {
      background: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 28px;
      width: 90%;
      max-width: 440px;
      padding: 40px;
      box-shadow: 
        0 20px 40px rgba(15, 23, 42, 0.12),
        0 1px 3px rgba(15, 23, 42, 0.05);
      animation: springUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }

    .close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: #f1f5f9;
      border: none;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #64748b;
      font-size: 1.2rem;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .close-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    
    .modal-header {
      text-align: center;
      margin-bottom: 24px;
    }
    
    .icon-box {
      width: 84px;
      height: 84px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      color: #1762d4;
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.4rem;
      margin: 0 auto 24px;
      border: 1px solid #bfdbfe;
      box-shadow: 0 10px 20px rgba(59, 130, 246, 0.1);
    }
    
    .cb-eyebrow {
      margin: 0 0 8px;
      color: #1762d4;
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      font-weight: 800;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 1.6rem;
      color: #0f1f3c;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    
    .modal-body {
      text-align: center;
      margin-bottom: 40px;
    }
    
    .modal-body p {
      color: #586b85;
      font-size: 1.05rem;
      line-height: 1.6;
      margin: 0;
    }
    
    .modal-footer {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    
    .cb-btn {
      flex: 1;
      height: 52px;
      border-radius: 16px;
      font-weight: 700;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      border: 1px solid transparent;
    }

    .cb-btn-soft {
      background: #f8fafc;
      color: #64748b;
      border-color: #e2e8f0;
    }

    .cb-btn-soft:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
      transform: translateY(-2px);
    }

    .cb-btn-primary {
      background: linear-gradient(180deg, #2563eb 0%, #1e40af 100%);
      color: #ffffff;
      box-shadow: 0 10px 20px rgba(37, 99, 235, 0.25);
    }

    .cb-btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 25px rgba(37, 99, 235, 0.35);
    }

    .cb-btn-primary:active {
      transform: translateY(-1px);
    }
    
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes springUp {
      from { 
        opacity: 0; 
        transform: scale(0.9) translateY(40px); 
      }
      to { 
        opacity: 1; 
        transform: scale(1) translateY(0); 
      }
    }

    @media (max-width: 480px) {
      .modal-content {
        padding: 30px 24px;
      }
      .modal-footer {
        flex-direction: column;
      }
    }
  `]
})
export class CvRequiredModalComponent {
  @Output() closeRequested = new EventEmitter<void>();

  constructor(private router: Router) {}

  close() {
    this.closeRequested.emit();
  }

  goToProfile() {
    this.close();
    this.router.navigate(['/profile'], { fragment: 'cv-upload-section' });
  }
}
