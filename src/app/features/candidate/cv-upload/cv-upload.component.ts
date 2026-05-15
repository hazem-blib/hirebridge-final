import { Component, EventEmitter, Output, ChangeDetectorRef, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CandidateService } from '../../../core/services/candidate.service';

@Component({
  selector: 'app-cv-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cv-upload.component.html',
  styleUrls: ['./cv-upload.component.css']
})
export class CvUploadComponent {
  status: 'empty' | 'uploading' | 'uploaded_unverified' | 'checking' | 'success' | 'error' = 'empty';
  errorMessage = '';
  fileName = '';
  isDragging = false;
  selectedFile: File | null = null;
  private _currentCvUrl: string | null = null;
  @Input() set currentCvUrl(value: string | null) {
    this._currentCvUrl = value;
    if (value && this.status === 'empty') {
      this.status = 'success';
      this.fileName = value.split('/').pop() || 'Existing_CV.pdf';
      this.cdr.detectChanges();
    }
  }
  get currentCvUrl(): string | null {
    return this._currentCvUrl;
  }

  @Output() cvVerified = new EventEmitter<boolean>();

  constructor(
    private candidateService: CandidateService,
    private cdr: ChangeDetectorRef
  ) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.handleFile(event.dataTransfer.files[0]);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      this.status = 'error';
      this.errorMessage = 'Invalid file type. Please upload a PDF file only.';
      this.cdr.detectChanges();
      return;
    }

    this.fileName = file.name;
    this.selectedFile = file;
    this.status = 'uploading';
    this.errorMessage = '';
    this.cdr.detectChanges();

    // Stage 1: Intelligent Transmission
    this.candidateService.uploadCv(file).subscribe({
      next: () => {
        // Automatically transition to Security Analysis
        this.status = 'checking';
        this.cdr.detectChanges();
        
        // Stage 2: Intelligent Verification Cycle
        // We trigger the fraud check ONCE, then poll the profile for the AI verdict
        this.candidateService.checkCvFraud(file).subscribe({
          next: () => {
            let attempts = 0;
            const maxAttempts = 6; // Poll for up to 12 seconds
            
            const pollForVerdict = () => {
              this.candidateService.getCandidateProfile(true).subscribe({
                next: (profileRes: any) => {
                  const user = profileRes?.data?.user || profileRes?.user || profileRes?.data || profileRes;
                  const profile = user?.candidateProfile || profileRes?.candidateProfile || user || profileRes;
                  const analysis = profile?.cvSummary || profile?.cv_summary || profile?.summary || '';
                  
                  // If AI is still processing, wait and retry
                  if (!analysis && attempts < maxAttempts) {
                    attempts++;
                    setTimeout(pollForVerdict, 2000);
                    return;
                  }

                  const lowerAnalysis = analysis.toLowerCase().trim();
                  const nonCvMarkers = [
                    'not a curriculum vitae', 'exam paper', 'not a professional cv',
                    'does not contain any personal', 'nature of the input text',
                    'academic document', 'not a resume', 'operation research',
                    'course material', 'not found in a c.v.', 'cannot be performed'
                  ];
                  
                  const isFlaggedAsNonCv = nonCvMarkers.some(marker => lowerAnalysis.includes(marker));

                  if (isFlaggedAsNonCv && lowerAnalysis !== '') {
                    this.status = 'error';
                    this.errorMessage = 'Strict Verification Failed: Our AI identified this as non-professional content. Please upload a valid CV.';
                    this.cvVerified.emit(false);
                    this.cdr.detectChanges();
                    return;
                  }

                  // Verification confirmed
                  this.status = 'success';
                  this.candidateService.setHasCv(true);
                  this.cvVerified.emit(true);
                  this.cdr.detectChanges();
                },
                error: () => {
                  // Fallback to success if profile sync fails but fraud check passed
                  this.status = 'success';
                  this.candidateService.setHasCv(true);
                  this.cvVerified.emit(true);
                  this.cdr.detectChanges();
                }
              });
            };

            // Start polling for results
            pollForVerdict();
          },
          error: (err) => {
            this.status = 'error';
            this.errorMessage = err.error?.message || 'Security Check Failed. Document authenticity could not be verified.';
            this.cvVerified.emit(false);
            this.cdr.detectChanges();
          }
        });
      },
      error: (err) => {
        this.status = 'error';
        this.errorMessage = err.error?.message || 'Failed to upload CV. Please try again.';
        this.cvVerified.emit(false);
        this.cdr.detectChanges();
      }
    });
  }

  // verifyCv is now automated within handleFile, but keeping it for compatibility if needed
  verifyCv() {
    if (this.selectedFile) {
      this.handleFile(this.selectedFile);
    }
  }

  viewCv() {
    if (this.currentCvUrl) {
      let url = this.currentCvUrl;
      
      // If it's a relative path, prepend the backend base URL
      if (!url.startsWith('http') && !url.startsWith('blob:')) {
        const baseUrl = `http://${window.location.hostname}:3004`;
        // Ensure no double slashes
        const normalizedPath = url.startsWith('/') ? url : `/${url}`;
        url = `${baseUrl}${normalizedPath}`;
      }
      
      window.open(url, '_blank');
    }
  }

  reset() {
    this.status = 'empty';
    this.errorMessage = '';
    this.fileName = '';
    this.cvVerified.emit(false);
    this.cdr.detectChanges();
  }
}
