import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { catchError, delay, map, startWith, shareReplay, tap } from 'rxjs/operators';

export interface CompanyProfile {
  name: string;
  industry: string;
  companyEmail: string;
  website: string;
  logo?: string;
}

export interface CompanyEmployerActionPayload {
  applicantId: string;
  action: 'accept' | 'reject';
}

@Injectable({
  providedIn: 'root'
})
export class CompanyService {
  private readonly baseUrl = `http://${window.location.hostname}:3004`;
  private readonly companyProfileSubject = new BehaviorSubject<CompanyProfile>({
    name: '',
    industry: '',
    companyEmail: '',
    website: '',
    logo: ''
  });
  public readonly companyProfile$ = this.companyProfileSubject.asObservable();
  private companyProfileCache$: Observable<CompanyProfile> | null = null;
  private lastLoadedId: string | null = null;

  constructor(private http: HttpClient) {}

  createCompanyProfile(data: unknown): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/company/companyProfile`, data);
  }

  verifyCompanyOtp(email: string, otp: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/company/verifyCompanyEmail`, {
      email,
      otp
    });
  }

  resendCompanyOtp(email: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/company/resendCompanyEmail`, {
      email
    });
  }

  getPendingForCompany(companyId: string): Observable<unknown> {
    return this.http.get(
      `${this.baseUrl}/company/getAllPendingForCompany/${companyId}`,
      this.getAuthOptions()
    );
  }

  acceptOrRejectEmployer(
    companyId: string,
    payload: CompanyEmployerActionPayload
  ): Observable<unknown> {
    return this.http.put(
      `${this.baseUrl}/company/acceptOrRejectEmp/${companyId}`,
      payload,
      this.getAuthOptions()
    );
  }

  getCompanyProfile(companyId?: string | null): Observable<CompanyProfile> {
    const resolvedId = companyId || sessionStorage.getItem('companyId');

    // If we have an ID, trigger a load
    if (resolvedId) {
      this.loadCompanyProfile(resolvedId).subscribe();
    }
    
    return this.companyProfile$;
  }

  loadCompanyProfile(companyId: string): Observable<CompanyProfile> {
    // If ID changed, clear everything
    if (this.lastLoadedId && this.lastLoadedId !== companyId) {
      this.reset();
    }
    
    this.lastLoadedId = companyId;

    // Return existing in-flight request if available
    if (this.companyProfileCache$) {
      return this.companyProfileCache$;
    }

    const request$ = this.http.get<unknown>(
      `${this.baseUrl}/company/getCompanyProfile/${companyId}`,
      this.getAuthOptions()
    ).pipe(
      map(response => {
        const mapped = this.mapCompanyProfile(response);
        this.companyProfileSubject.next(mapped);
        return mapped;
      }),
      catchError(() => {
        // Fallback to myCompany
        return this.http.get<unknown>(`${this.baseUrl}/company/myCompany`, this.getAuthOptions()).pipe(
          map(response => {
            const mapped = this.mapCompanyProfile(response);
            this.companyProfileSubject.next(mapped);
            return mapped;
          })
        );
      }),
      catchError(() => {
        return of(this.companyProfileSubject.value);
      }),
      tap(() => {
        this.companyProfileCache$ = null; // Clear in-flight cache when done
      }),
      shareReplay(1)
    );

    this.companyProfileCache$ = request$;
    return request$;
  }

  updateCompanyProfile(profile: CompanyProfile): Observable<CompanyProfile> {
    const rawId = sessionStorage.getItem('companyId') || this.lastLoadedId;
    const companyId = this.extractObjectId(rawId);
    
    if (!companyId) {
      return throwError(() => new Error('Company ID missing or invalid'));
    }

    const token = String(sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '').trim();

    // The API seems to expect CompanyEmail (Capital C) based on creation logic
    const payload = {
      ...profile,
      CompanyEmail: profile.companyEmail,
      companyEmail: profile.companyEmail,
      ProfessionalEmail: profile.companyEmail,
      email: profile.companyEmail
    };

    return this.http.put<unknown>(
      `${this.baseUrl}/company/updateCompanyProfile/${companyId}`,
      payload,
      { headers: new HttpHeaders({ auth: token }) }
    ).pipe(
      map(response => {
        const mapped = this.mapCompanyProfile(response);
        // If the response is empty or partial, merge with what we sent
        const merged = { ...profile, ...mapped };
        this.companyProfileSubject.next(merged);
        this.companyProfileCache$ = null;
        return merged;
      }),
      catchError((err) => {
        console.error('Profile update failed:', err);
        this.companyProfileSubject.next(profile);
        return throwError(() => err);
      })
    );
  }

  private extractObjectId(value: unknown): string {
    const normalized = String(value || '').trim();
    return /^[a-fA-F0-9]{24}$/.test(normalized) ? normalized : '';
  }

  private getAuthOptions(): { headers: HttpHeaders } {
    const token = String(sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || '').trim();

    return {
      headers: new HttpHeaders({ auth: token })
    };
  }

  private mapCompanyProfile(response: unknown): CompanyProfile {
    const root = this.asRecord(response);
    const data = this.asRecord(root?.['data']);
    
    // Try to find company data in different locations
    let company = this.asRecord(root?.['company']) || data || root;
    
    // If the entire response is the company object (flat structure)
    const flatProfile: CompanyProfile = {
      name: this.asString(root?.['name']) || this.asString(root?.['companyName']) || '',
      industry: this.asString(root?.['industry']) || '',
      companyEmail:
        this.asString(root?.['companyEmail']) ||
        this.asString(root?.['CompanyEmail']) ||
        this.asString(root?.['ProfessionalEmail']) ||
        this.asString(root?.['email']) ||
        '',
      website: this.asString(root?.['website']) || this.asString(root?.['Website']) || '',
      logo: this.asString(root?.['logo']) || this.asString(root?.['Logo']) || ''
    };

    // If flat structure has data, use it
    if (flatProfile.name || flatProfile.industry) {
      return flatProfile;
    }

    // Otherwise extract from nested company object
    return {
      name: this.asString(company?.['name']) || this.asString(company?.['companyName']) || '',
      industry: this.asString(company?.['industry']) || '',
      companyEmail:
        this.asString(company?.['companyEmail']) ||
        this.asString(company?.['CompanyEmail']) ||
        this.asString(company?.['ProfessionalEmail']) ||
        this.asString(company?.['email']) ||
        '',
      website: this.asString(company?.['website']) || this.asString(company?.['Website']) || '',
      logo: this.asString(company?.['logo']) || this.asString(company?.['Logo']) || ''
    };
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private asString(value: unknown): string {
    return typeof value === 'string' ? value : '';
  }

  reset(): void {
    this.companyProfileCache$ = null;
    this.lastLoadedId = null;
    this.companyProfileSubject.next({
      name: '',
      industry: '',
      companyEmail: '',
      website: '',
      logo: ''
    });
  }
}
