import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { CompanyService } from '../../core/services/company.service';
import { EmployerJobsService } from '../../core/services/employer-jobs.service';
import { ToastOutletComponent } from '../../shared/components/toast-outlet/toast-outlet.component';

interface MenuItem {
  label: string;
  icon: string;
  link: string;
  exact?: boolean;
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ToastOutletComponent],
  templateUrl: './layout-component.html',
  styleUrls: ['./layout-component.css']
})
export class LayoutComponent implements OnInit, OnDestroy {
  isSidebarCollapsed = false;
  menuOpen = false;
  isDarkMode = false;
  menuItems: MenuItem[] = [];
  readonly exactMatchOptions = { exact: true };
  readonly subsetMatchOptions = { exact: false };
  private firstEmployerJobId: string | null = null;
  private readonly subscriptions = new Subscription();
  private employerTouchStartX = 0;
  private employerTouchStartY = 0;

  private readonly candidateMenuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'fas fa-home', link: '/dashboard', exact: true },
    { label: 'Matched Opportunities', icon: 'fas fa-magic', link: '/matched-opportunities' },
    { label: 'Profile', icon: 'fas fa-user', link: '/profile' },
    { label: 'Settings', icon: 'fas fa-cog', link: '/settings' }
  ];

  private readonly employerMenuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'fas fa-home', link: '/employer/dashboard', exact: true },
    { label: 'Submit Request', icon: 'fas fa-plus-circle', link: '/employer/jobs/new', exact: true },
    { label: 'Hiring Requests', icon: 'fas fa-briefcase', link: '/employer/jobs', exact: true },
    { label: 'Interviews', icon: 'fas fa-calendar-check', link: '/employer/interviews' }
  ];

  private readonly clientMenuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'fas fa-home', link: '/client/dashboard', exact: true },
    { label: 'New Request', icon: 'fas fa-file-circle-plus', link: '/client/hiring-request' }
  ];

  private readonly adminMenuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'fas fa-home', link: '/admin/dashboard', exact: true },
    { label: 'Jobs', icon: 'fas fa-briefcase', link: '/admin/jobs' },
    { label: 'Candidates', icon: 'fas fa-users', link: '/admin/candidates' },
    { label: 'Companies', icon: 'fas fa-building', link: '/admin/companies' },
    { label: 'Interviews', icon: 'fas fa-calendar-check', link: '/admin/interviews' }
  ];

  constructor(
    public router: Router,
    private auth: AuthService,
    private employerJobsService: EmployerJobsService,
    private companyService: CompanyService
  ) { }

  ngOnInit(): void {
    this.isDarkMode = sessionStorage.getItem('theme') === 'dark';
    if (this.isDarkMode) {
      document.body.classList.add('dark');
    }

    this.refreshEmployerReviewLink();
    this.updateMenuItems();
    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => {
          this.refreshEmployerReviewLink();
          this.updateMenuItems();
        })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get currentRole(): string {
    const url = this.router.url;

    if (url.startsWith('/admin')) {
      return 'admin';
    }

    if (url.startsWith('/employer')) {
      return 'employer';
    }

    if (url.startsWith('/client')) {
      return 'client';
    }

    return this.auth.getUserFromToken()?.role || sessionStorage.getItem('role') || 'candidate';
  }

  get userName(): string {
    if (this.currentRole === 'client') {
      const companyAccess = JSON.parse(sessionStorage.getItem('companyAccess') || '{}');
      return companyAccess?.companyEmail?.split('@')[0] || 'Client';
    }

    const user = this.auth.getUserFromToken();

    if (!user) {
      if (this.currentRole === 'admin') return 'Admin';
      if (this.currentRole === 'employer') return 'Employer';
      if (this.currentRole === 'client') return 'Client';
      return 'Candidate';
    }

    return (
      user?.firstName ||
      user?.fullName ||
      user?.username ||
      user?.email?.split('@')[0] ||
      (this.currentRole === 'employer'
        ? 'Employer'
        : this.currentRole === 'admin'
          ? 'Admin'
          : this.currentRole === 'client'
            ? 'Client'
            : 'Candidate')
    );
  }

  get userEmail(): string {
    if (this.currentRole === 'client') {
      const companyAccess = JSON.parse(sessionStorage.getItem('companyAccess') || '{}');
      return companyAccess?.companyEmail || '';
    }

    return this.auth.getUserFromToken()?.email || '';
  }

  get portalLabel(): string {
    if (this.currentRole === 'admin') return 'Admin Panel';
    if (this.currentRole === 'employer') return 'Employer Panel';
    if (this.currentRole === 'client') return 'Client Portal';
    return 'Candidate Portal';
  }

  get searchPlaceholder(): string {
    if (this.currentRole === 'admin') {
      return 'Search jobs, candidates, companies, or interviews...';
    }

    if (this.currentRole === 'employer') {
      return 'Search jobs, interviews, or departments...';
    }

    if (this.currentRole === 'client') {
      return 'Search requests, roles, or statuses...';
    }

    return 'Search employees, files, or tasks...';
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (this.isDarkMode) {
      document.body.classList.add('dark');
      sessionStorage.setItem('theme', 'dark');
    } else {
      document.body.classList.remove('dark');
      sessionStorage.setItem('theme', 'light');
    }
  }

  onEmployerTouchStart(event: TouchEvent): void {
    const allowedRoles = ['employer', 'admin', 'candidate'];
    if (!allowedRoles.includes(this.currentRole) || window.innerWidth > 768 || !event.touches.length) {
      return;
    }

    this.employerTouchStartX = event.touches[0].clientX;
    this.employerTouchStartY = event.touches[0].clientY;
  }

  onEmployerTouchEnd(event: TouchEvent): void {
    const allowedRoles = ['employer', 'admin', 'candidate'];
    if (!allowedRoles.includes(this.currentRole) || window.innerWidth > 768 || !event.changedTouches.length) {
      return;
    }

    const dx = event.changedTouches[0].clientX - this.employerTouchStartX;
    const dy = event.changedTouches[0].clientY - this.employerTouchStartY;

    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.35) {
      return;
    }

    const employerTabs = ['/employer/dashboard', '/employer/jobs', '/employer/interviews', '/employer/settings'];
    const adminTabs = ['/admin/dashboard', '/admin/jobs', '/admin/candidates', '/admin/companies'];
    const candidateTabs = ['/dashboard', '/applications', '/profile', '/settings'];
    
    let tabs: string[] = [];
    if (this.currentRole === 'admin') tabs = adminTabs;
    else if (this.currentRole === 'employer') tabs = employerTabs;
    else if (this.currentRole === 'candidate') tabs = candidateTabs;

    const currentIndex = Math.max(0, tabs.findIndex(tab => this.router.url.startsWith(tab)));
    const nextIndex = dx < 0
      ? Math.min(tabs.length - 1, currentIndex + 1)
      : Math.max(0, currentIndex - 1);

    if (nextIndex !== currentIndex) {
      this.router.navigate([tabs[nextIndex]]);
    }
  }

  navigateFromSidebar(item: MenuItem): void {
    if (!item?.link) {
      return;
    }

    this.router.navigate([item.link], { queryParams: item.queryParams || undefined });
  }

  get pageTitle(): string {
    const url = this.router.url;

    if (url.includes('/admin/interviews')) return 'Admin Interviews';
    if (url.includes('/admin/companies')) return 'Admin Companies';
    if (url.includes('/admin/candidates')) return 'Admin Candidates';
    if (url.includes('/admin/jobs')) return 'Admin Jobs';
    if (url.includes('/admin/dashboard')) return 'Admin Dashboard';

    if (url.includes('/client/hiring-request')) return 'New Hiring Request';
    if (url.includes('/client/dashboard')) return 'Client Dashboard';

    if (url.includes('/employer/company-profile')) return 'Company Profile';
    if (url.includes('/employer/interviews')) return 'Interviews';
    if (url.includes('/employer/jobs/new')) return 'Submit Hiring Request';
    if (url.includes('/review-candidates')) return 'Review Candidates';
    if (url.includes('/employer/jobs/') && !url.endsWith('/employer/jobs')) return 'Request Details';
    if (url.includes('/employer/jobs')) return 'Hiring Requests';
    if (url.includes('/employer/dashboard')) return 'Employer Dashboard';
    if (url.includes('/applications')) return 'My Applications';
    if (url.includes('/profile')) return 'Profile';
    if (url.includes('/settings')) return 'Settings';

    return 'Dashboard';
  }

  logout(): void {
    this.auth.logout();
    this.employerJobsService.reset();
    this.companyService.reset();
    window.location.href = '/login';
  }

  private get reviewHiringLink(): string {
    return '/employer/review-candidates';
  }

  private get currentEmployerJobId(): string | null {
    const match = this.router.url.match(/^\/employer\/jobs\/([^/?]+)(?:\/|$)/);
    const id = match?.[1] || null;
    return id && id !== 'new' ? id : null;
  }

  private refreshEmployerReviewLink(): void {
    if (this.currentRole !== 'employer') {
      return;
    }

    this.subscriptions.add(
      this.employerJobsService.getJobs().subscribe({
        next: jobs => {
          this.firstEmployerJobId = jobs[0]?.id || null;
          this.updateMenuItems();
        }
      })
    );
  }

  getRouterLinkActiveOptions(item: MenuItem): { exact: boolean } {
    return item.exact ? this.exactMatchOptions : this.subsetMatchOptions;
  }

  isMenuItemActive(item: MenuItem): boolean {
    const url = this.router.url;

    // Custom logic for Interviews and Review Hiring
    if (item.link.includes('interviews') && url.includes('interviews')) {
      return true;
    }
    if (item.link.includes('review-candidates') && url.includes('review-candidates')) {
      return true;
    }

    if (item.exact) {
      return url === item.link;
    }

    return url.startsWith(item.link);
  }

  private updateMenuItems(): void {
    if (this.currentRole === 'admin') {
      this.menuItems = this.adminMenuItems;
      return;
    }

    if (this.currentRole === 'employer') {
      this.menuItems = [
        ...this.employerMenuItems,
        {
          label: 'Review Hiring',
          icon: 'fas fa-user-check',
          link: this.reviewHiringLink
        },
        {
          label: 'Company Profile',
          icon: 'fas fa-building',
          link: '/employer/company-profile'
        },
        {
          label: 'Settings',
          icon: 'fas fa-cog',
          link: '/employer/settings'
        }
      ];
      return;
    }

    if (this.currentRole === 'client') {
      this.menuItems = this.clientMenuItems;
      return;
    }

    this.menuItems = this.candidateMenuItems;
  }
}
