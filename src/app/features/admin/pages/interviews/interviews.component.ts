import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AdminService } from '../../services/admin.service';

@Component({
  selector: 'app-admin-interviews-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './interviews.component.html',
  styleUrl: './interviews.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminInterviewsComponent {
  private readonly adminService = inject(AdminService);

  readonly rawInterviews = toSignal(this.adminService.getInterviews(), { initialValue: [] });
  readonly interviews = computed(() => {
    return [...this.rawInterviews()].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  });
  readonly scheduledCount = computed(
    () => this.interviews().filter(interview => interview.status === 'Scheduled').length
  );
  readonly pendingCount = computed(
    () => this.interviews().filter(interview => 
      interview.status === 'Pending' || interview.status === 'Rescheduled'
    ).length
  );
  readonly completedCount = computed(
    () => this.interviews().filter(interview => 
      ['Completed', 'Hired', 'Rejected', 'Cancelled'].includes(interview.status)
    ).length
  );

  getStatusLabel(interview: any): string {
    if (interview.candidateStatus === 'rejected') {
      return 'Cancelled (Candidate)';
    }
    return interview.status;
  }

  getStatusClass(interview: any): string {
    if (interview.candidateStatus === 'rejected') {
      return 'status-pill-exec cancelled';
    }
    return 'status-pill-exec ' + interview.status.toLowerCase();
  }
}
