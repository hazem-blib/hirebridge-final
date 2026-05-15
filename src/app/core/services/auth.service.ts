import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private baseUrl = `http://${window.location.hostname}:3004`;

  constructor(private http: HttpClient) {}

  // 🔐 AUTH
  register(data: any) {
    return this.http.post(`${this.baseUrl}/auth/signUp`, data);
  }

  login(data: any) {
    return this.http.post(`${this.baseUrl}/auth/login`, data);
  }

  loginSystemAdmin(data: { email: string; password: string }) {
    return this.http.post(`${this.baseUrl}/system/log-in-admins`, data);
  }

  getMyCompany() {
    const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token') || '';
    return this.http.get(`${this.baseUrl}/company/myCompany`, {
      headers: new HttpHeaders({
        auth: token
      })
    });
  }

  verifyOtp(email: string, otp: string) {
    return this.http.post(
      `${this.baseUrl}/auth/verifyOTPofPersonalEmail`,
      { email, otp }
    );
  }

  resendOtp(email: string) {
    return this.http.post(
      `${this.baseUrl}/auth/resendOTPofPersonalEmail`,
      { email }
    );
  }

  // 🔥 NEW 👉 get company by admin (الحل الأساسي)
  getCompanyByAdmin(userId: string) {
    return this.http.get(`${this.baseUrl}/company/getAllCompany/${userId}`);
  }

  // 💾 TOKEN
  saveToken(token: string) {
    sessionStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    return sessionStorage.getItem('authToken');
  }

  logout() {
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('companyId');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('companyEmail');
    sessionStorage.removeItem('signupEmail');
    sessionStorage.removeItem('allowChooseRole');
    sessionStorage.removeItem('companyAccess');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // 🔥 decode token
  getUserFromToken(): any {
    const token = this.getToken();

    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }

  getRole(): string | null {
    const tokenRole = this.getUserFromToken()?.role;
    const storedRole = sessionStorage.getItem('role');
    return tokenRole || storedRole || null;
  }

  fetchAndStoreCompanyId(): Observable<string | null> {
    const token = sessionStorage.getItem('authToken') || sessionStorage.getItem('token') || '';

    if (!token) {
      return of(null);
    }

    return this.fetchCompanyIdFromApi(token)
      .pipe(
        map(companyId => {
          sessionStorage.setItem('companyId', companyId);
          return companyId;
        }),
        catchError(() => {
          sessionStorage.removeItem('companyId');
          return of(null);
        })
      );
  }

  private fetchCompanyIdFromApi(token: string, index = 0): Observable<string> {
    const endpoints = [
      `${this.baseUrl}/job/get-company-to-store-id`
    ];

    if (index >= endpoints.length) {
      const tokenCompanyId = this.extractCompanyIdFromToken(token);

      if (tokenCompanyId) {
        return of(tokenCompanyId);
      }

      return throwError(() => new Error('Company ID missing'));
    }

    return this.http
      .get<unknown>(endpoints[index], {
        headers: new HttpHeaders({ auth: token })
      })
      .pipe(
        map(response => this.extractCompanyId(response)),
        map(companyId => {
          if (!companyId) {
            throw new Error('Company ID missing');
          }

          return companyId;
        }),
        catchError(() => this.fetchCompanyIdFromApi(token, index + 1))
      );
  }

  private extractCompanyId(response: unknown): string {
    const objectIdPattern = /^[a-fA-F0-9]{24}$/;

    const toObjectId = (value: unknown): string => {
      const normalized = String(value || '').trim();
      return objectIdPattern.test(normalized) ? normalized : '';
    };

    const asRecord = (value: unknown): Record<string, unknown> | null => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }

      return null;
    };

    const directId = toObjectId(response);

    if (directId) {
      return directId;
    }

    const root = asRecord(response);
    const data = asRecord(root?.['data']);
    const company = asRecord(root?.['company']) || asRecord(data?.['company']);

    return (
      toObjectId(root?.['_id']) ||
      toObjectId(root?.['id']) ||
      toObjectId(root?.['companyId']) ||
      toObjectId(data?.['companyId']) ||
      toObjectId(company?.['_id']) ||
      toObjectId(company?.['id'])
    );
  }

  private extractCompanyIdFromToken(token: string): string {
    try {
      const payload = JSON.parse(atob(token.split('.')[1] || '')) as Record<string, unknown>;

      return this.extractCompanyId(payload);
    } catch {
      return '';
    }
  }
}
