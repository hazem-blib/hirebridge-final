import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnDestroy } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap, combineLatest, startWith } from 'rxjs';
import { AdminCandidate, AdminService, AdminJob } from '../../services/admin.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-admin-candidates-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './candidates.component.html',
  styleUrl: './candidates.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCandidatesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adminService = inject(AdminService);
  private readonly toastService = inject(ToastService);

  readonly selectedCandidate = signal<AdminCandidate | null>(null);
  private readonly refreshTrigger = signal<number>(0);
  private readonly optimisticActions = signal<Map<string, 'Sent' | 'None'>>(new Map());
  readonly processingIds = signal<Set<string>>(new Set());

  readonly filterStatus = signal<'All' | 'Interviewing' | 'Hired'>('All');
  readonly searchQuery = signal<string>('');

  readonly currentJobId = toSignal(this.route.queryParamMap.pipe(map(params => params.get('jobId') || '')));

  readonly currentJob = toSignal(
    combineLatest([
      this.route.queryParamMap.pipe(map(params => params.get('jobId') || '')),
      toObservable(this.refreshTrigger).pipe(startWith(0))
    ]).pipe(
      switchMap(([id, _]) => id ? this.adminService.getJobById(id) : [null])
    )
  );

  readonly candidates = toSignal(
    combineLatest([
      this.route.queryParamMap.pipe(map(params => params.get('jobId') || '')),
      toObservable(this.refreshTrigger).pipe(startWith(0)),
      toObservable(this.searchQuery),
      toObservable(this.filterStatus)
    ]).pipe(
      switchMap(([jobId, _, query, statusFilter]) => {
        const stream = jobId ? this.adminService.getMatchingCandidates(jobId) : this.adminService.getCandidates();
        return stream.pipe(
          map(list => {
            this.hasLoadedOnce.set(true);
            let filtered = list;
            // Apply Search
            if (query) {
              const q = query.toLowerCase();
              filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.role.toLowerCase().includes(q)
              );
            }
            // Apply Filter
            if (statusFilter !== 'All') {
              filtered = filtered.filter(c => c.status === statusFilter);
            }
            return filtered.sort((a, b) => {
              const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bDate - aDate;
            });
          })
        );
      })
    )
  );

  private readonly hasLoadedOnce = signal<boolean>(false);
  readonly isLoading = computed(() => !this.hasLoadedOnce() && this.candidates() === undefined);

  readonly isMatchingMode = computed(() => !!this.currentJobId());
  readonly averageFitScore = computed(() => {
    const list = this.candidates() || [];
    if (!list.length) return 0;
    const total = list.reduce((sum, candidate) => sum + candidate.fitScore, 0);
    return Math.round(total / list.length);
  });

  readonly placementRate = computed(() => {
    const list = this.candidates() || [];
    if (!list.length) return 0;
    const hired = list.filter(c => c.status === 'Hired').length;
    return Math.round((hired / list.length) * 100);
  });

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
  }

  setFilter(status: 'All' | 'Interviewing' | 'Hired'): void {
    this.filterStatus.set(status);
  }

  readonly sentCandidateIds = computed(() => {
    const job = this.currentJob();
    const ids = new Set<string>();

    if (job && job.shortlistedCandidates) {
      job.shortlistedCandidates.forEach((sc: any) => {
        ids.add(sc.candidate?._id || sc.candidate || '');
      });
    }

    // Apply optimistic overrides
    this.optimisticActions().forEach((status, id) => {
      if (status === 'Sent') ids.add(id);
      if (status === 'None') ids.delete(id);
    });

    return ids;
  });

  readonly sentForCurrentJob = computed(() => this.sentCandidateIds().size);

  readonly acceptedCandidateIds = computed(() => {
    const job = this.currentJob();
    if (!job || !job.acceptedCandidates) {
      return new Set<string>();
    }
    return new Set(job.acceptedCandidates.map((ac: any) => ac.candidate?._id || ac.candidate || ''));
  });

  readonly rejectedCandidateIds = computed(() => {
    const job = this.currentJob();
    const candidates = this.candidates() || [];
    const ids = new Set<string>();

    if (job && job.rejectedCandidates) {
      job.rejectedCandidates.forEach((rc: any) => ids.add(rc.candidate?._id || rc.candidate || ''));
    }

    // Also include candidates who rejected the interview (determined by their current status)
    candidates.forEach(c => {
      if (c.status === 'Rejected') ids.add(c.id);
    });

    return ids;
  });

  readonly hiredCandidateIds = computed(() => {
    const job = this.currentJob();
    if (!job || !job.hiredCandidates) {
      return new Set<string>();
    }
    return new Set(job.hiredCandidates.map((hc: any) => hc.candidate?._id || hc.candidate || ''));
  });

  getCandidateStatus(candidateId: string): 'None' | 'Sent' | 'Accepted' | 'Rejected' | 'Hired' {
    if (this.rejectedCandidateIds().has(candidateId)) return 'Rejected';
    if (this.hiredCandidateIds().has(candidateId)) return 'Hired';
    if (this.acceptedCandidateIds().has(candidateId)) return 'Accepted';

    // Check optimistic actions first
    const optimistic = this.optimisticActions().get(candidateId);
    if (optimistic) return optimistic;

    if (this.sentCandidateIds().has(candidateId)) return 'Sent';
    return 'None';
  }

  isSent(candidateId: string): boolean {
    return this.sentCandidateIds().has(candidateId);
  }

  openCv(candidate: AdminCandidate): void {
    this.selectedCandidate.set(candidate);
    this.setModalOpen(true);
  }

  closeCv(): void {
    this.selectedCandidate.set(null);
    this.setModalOpen(false);
  }

  private setModalOpen(isOpen: boolean): void {
    document.body.classList.toggle('modal-open', isOpen);
  }

  openSentList(): void {
    const jobId = this.currentJobId();
    if (!jobId) {
      return;
    }

    this.router.navigate(['/admin/jobs', jobId]);
  }

  private triggerRefresh(): void {
    this.refreshTrigger.update(v => v + 1);
  }

  sendCandidate(candidate: AdminCandidate): void {
    const jobId = this.currentJobId();
    if (!jobId || this.processingIds().has(candidate.id)) return;

    if (!candidate.cvUrl) {
      this.toastService.error(`Unable to send ${candidate.name}: No CV uploaded.`);
      return;
    }

    // Mark as processing
    this.processingIds.update(set => {
      const newSet = new Set(set);
      newSet.add(candidate.id);
      return newSet;
    });

    // Optimistic Update
    this.optimisticActions.update(map => {
      const newMap = new Map(map);
      newMap.set(candidate.id, 'Sent');
      return newMap;
    });

    this.adminService.sendCandidate(jobId, candidate.id).subscribe({
      next: () => {
        this.toastService.success(`${candidate.name} sent`);
        this.triggerRefresh();
        this.finishProcessing(candidate.id);
      },
      error: (err) => {
        this.clearOptimisticAction(candidate.id);
        const msg = err.error?.message || 'Unable to send candidate';
        this.toastService.error(msg);
      }
    });
  }

  cancelCandidate(candidate: AdminCandidate): void {
    const jobId = this.currentJobId();
    if (!jobId) return;

    // Optimistic Update
    this.optimisticActions.update(map => {
      const newMap = new Map(map);
      newMap.set(candidate.id, 'None');
      return newMap;
    });

    this.adminService.revokeCandidate(jobId, candidate.id).subscribe({
      next: () => {
        this.toastService.info(`${candidate.name} removed`);
        this.triggerRefresh();
        this.finishProcessing(candidate.id);
      },
      error: (err) => {
        this.clearOptimisticAction(candidate.id);
        const msg = err.error?.message || 'Unable to remove candidate';
        this.toastService.error(msg);
      }
    });
  }

  private finishProcessing(candidateId: string): void {
    // We keep the optimistic state for 2 seconds to ensure the background 
    // refresh has finished and emitted the new data, preventing 'flickering'
    setTimeout(() => {
      this.processingIds.update(set => {
        const newSet = new Set(set);
        newSet.delete(candidateId);
        return newSet;
      });
      this.clearOptimisticAction(candidateId);
    }, 2000);
  }

  private clearOptimisticAction(candidateId: string): void {
    this.optimisticActions.update(map => {
      const newMap = new Map(map);
      newMap.delete(candidateId);
      return newMap;
    });
  }

  formatEnum(val: string): string {
    if (!val) return '';
    return val.replace(/([A-Z])/g, ' $1').trim();
  }

  constructor() { }

  ngOnDestroy(): void {
    this.setModalOpen(false);
  }
}
