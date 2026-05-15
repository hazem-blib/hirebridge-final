import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { CandidateService } from '../../../core/services/candidate.service';
import { AuthService } from '../../../core/services/auth.service';
import { CvBannerComponent } from '../../../shared/components/cv-banner/cv-banner.component';

@Component({
  standalone: true,
  selector: 'app-candidate-dashboard',
  imports: [CommonModule, RouterLink, CvBannerComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class CandidateDashboardComponent implements OnInit, OnDestroy {
  loading = false;
  error = '';
  userName = 'Candidate';
  stats = {
    total: 0,
    accepted: 0,
    pending: 0,
    rejected: 0
  };
  recentApplications: any[] = [];
  hasCv = false;
  private cvSub: Subscription | null = null;

  constructor(
    private candidateService: CandidateService,
    private auth: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    const tokenUser = this.auth.getUserFromToken();
    if (tokenUser) {
      this.userName = this.extractName(tokenUser);
    }
  }

  ngOnInit() {
    this.loadDashboard();
    this.cvSub = this.candidateService.hasCv$.subscribe(status => {
      this.hasCv = status;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    if (this.cvSub) this.cvSub.unsubscribe();
  }

  private loadDashboard() {
    this.loading = true;
    this.candidateService.getCandidateProfile().subscribe({
      next: (res: any) => {
        this.loading = false;
        const user = this.extractResponseUser(res);
        this.userName = this.extractName(user);

        const applications =
          user?.applications ||
          res?.applications ||
          user?.candidateProfile?.applications ||
          [];

        const candidateProfile = user?.candidateProfile || res?.candidateProfile;
        if (candidateProfile) {
          const cvStr = candidateProfile.cv;
          const cvUrlStr = candidateProfile.cvUrl;
          if (typeof cvStr === 'string' && cvStr.trim() !== '' && cvStr !== 'null' && cvStr !== 'undefined') {
            this.hasCv = true;
          } else if (typeof cvUrlStr === 'string' && cvUrlStr.trim() !== '' && cvUrlStr !== 'null' && cvUrlStr !== 'undefined') {
            this.hasCv = true;
          } else if (candidateProfile.cvVerificationStatus === 'verified' || candidateProfile.isCvVerified === true) {
            this.hasCv = true;
          } else if (candidateProfile.fraudCheck && candidateProfile.fraudCheck.status === 'verified') {
            this.hasCv = true;
          }
        }

        this.stats.total = applications.length;
        this.stats.accepted = applications.filter((app: any) => {
          const status = this.normalizeStatus(app.status);
          return status === 'accepted' || status === 'hired';
        }).length;
        this.stats.pending = applications.filter((app: any) => this.normalizeStatus(app.status) === 'pending').length;
        this.stats.rejected = applications.filter((app: any) => this.normalizeStatus(app.status) === 'rejected').length;

        this.recentApplications = applications.slice(0, 5);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Unable to load dashboard data';
        this.cdr.detectChanges();
      }
    });
  }

  public normalizeStatus(value: any): string {
    return String(value || '').trim().toLowerCase();
  }

  public getStatusBadgeClass(value: any): string {
    const status = this.normalizeStatus(value) || 'pending';
    if (status === 'accepted' || status === 'hired') return 'bg-success';
    if (status === 'rejected') return 'bg-danger';
    return 'bg-warning text-dark';
  }

  private extractResponseUser(res: any): any {
    return (
      res?.data?.user ||
      res?.data ||
      res?.user ||
      res?.userDetails ||
      res
    );
  }

  private extractName(user: any): string {
    if (!user) return 'Candidate';
    return (
      user?.firstName ||
      user?.fullName ||
      user?.username ||
      user?.email?.split('@')[0] ||
      'Candidate'
    );
  }
}
