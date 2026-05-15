import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  standalone: true,
  selector: 'app-candidate-settings',
  imports: [CommonModule, RouterLink],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {
  user: any;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.user = this.auth.getUserFromToken();
  }

  get isEmployerSettings(): boolean {
    return window.location.pathname.startsWith('/employer/settings');
  }

  logout() {
    this.auth.logout();
    sessionStorage.removeItem('role');
    window.location.href = '/login';
  }
}
