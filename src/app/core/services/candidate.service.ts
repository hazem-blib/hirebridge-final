import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { catchError, shareReplay, startWith, tap, map } from 'rxjs/operators';

import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class CandidateService {
  private baseUrl = `http://${window.location.hostname}:3004`;
  private profileCache$: Observable<any> | null = null;
  private profileSnapshot: any = null;
  private hasCvSubject = new BehaviorSubject<boolean>(false);
  public hasCv$ = this.hasCvSubject.asObservable();

  constructor(
    private http: HttpClient,
    private auth: AuthService
  ) {}

  getCandidateProfile(forceRefresh = false): Observable<any> {
    if (forceRefresh) {
      this.profileCache$ = null;
    }

    if (this.profileCache$) {
      return this.profileCache$;
    }

    const fallback = this.profileSnapshot || this.getTokenUserFallback();

    // Create the base request
    const request$ = this.http.get(`${this.baseUrl}/candidate/candidate-profile`).pipe(
      tap(response => {
        this.profileSnapshot = response;
      }),
      shareReplay(1)
    );

    // If forceRefresh, we don't want the fallback/cache, we want the fresh data only
    if (forceRefresh) {
      this.profileCache$ = request$;
      return request$;
    }

    // Otherwise, provide fallback immediately for better UX
    this.profileCache$ = request$.pipe(
      startWith(fallback),
      catchError(() => of(this.profileSnapshot || fallback)),
      tap(res => {
        const hasCv = this.checkCvInResponse(res);
        this.hasCvSubject.next(hasCv);
      }),
      shareReplay(1)
    );

    return this.profileCache$;
  }

  private checkCvInResponse(res: any): boolean {
    const user = res?.data?.user || res?.user || res;
    const profile = user?.candidateProfile || res?.candidateProfile || res;
    if (!profile) return false;

    return !!(profile.cv?.trim() || profile.cvUrl?.trim() || profile.isCvVerified || profile.cvVerificationStatus === 'verified');
  }

  setHasCv(status: boolean) {
    this.hasCvSubject.next(status);
  }

  updateCandidateProfile(data: any) {
    return this.http.put(`${this.baseUrl}/user/updateCandidateProfile`, data).pipe(
      tap(() => {
        this.profileCache$ = null; // Clear cache on update
        this.profileSnapshot = null; // Clear snapshot too to ensure fresh fetch
      })
    );
  }

  getProfile() {
    return this.http.get(`${this.baseUrl}/user/profile`);
  }

  uploadCv(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cv', file);
    return this.http.post(`${this.baseUrl}/candidate/upload-cv`, formData);
  }

  checkCvFraud(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('cv', file);
    return this.http.post(`${this.baseUrl}/candidate/cv-fraud-check`, formData);
  }

  getMatchedOpportunities(): Observable<any> {
    return this.http.get(`${this.baseUrl}/candidate/matched-opportunities`);
  }

  respondToInterview(interviewId: string, status: 'accepted' | 'rejected'): Observable<any> {
    return this.http.put(`${this.baseUrl}/candidate/interview/${interviewId}/respond`, { status });
  }

  private getTokenUserFallback(): any {
    const user = this.auth.getUserFromToken();
    return user ? { user } : {};
  }
}
