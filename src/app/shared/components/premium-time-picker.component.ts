import { Component, Input, Output, EventEmitter, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-premium-time-picker',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="time-picker-zenith" [class.focused]="isFocused">
      <div class="time-group">
        <!-- Hour Segment -->
        <div class="segment hour" 
             [class.active]="activeSegment === 'hour'"
             (click)="setActiveSegment('hour')">
          <input type="text" 
                 [(ngModel)]="displayHour" 
                 (blur)="onBlur()"
                 (focus)="onFocus($event, 'hour')"
                 (input)="onInputChange('hour')"
                 (keydown)="onKeydown($event, 'hour')"
                 maxlength="2">
        </div>

        <div class="separator">:</div>

        <!-- Minute Segment -->
        <div class="segment minute" 
             [class.active]="activeSegment === 'minute'"
             (click)="setActiveSegment('minute')">
          <input type="text" 
                 [(ngModel)]="displayMinute" 
                 (blur)="onBlur()"
                 (focus)="onFocus($event, 'minute')"
                 (input)="onInputChange('minute')"
                 (keydown)="onKeydown($event, 'minute')"
                 maxlength="2">
        </div>
      </div>

      <!-- Segmented Period Toggle -->
      <div class="period-switcher">
        <div class="period-indicator" [style.transform]="period === 'PM' ? 'translateX(100%)' : 'translateX(0)'"></div>
        <button type="button" class="p-btn" [class.on]="period === 'AM'" (click)="setPeriod('AM')">AM</button>
        <button type="button" class="p-btn" [class.on]="period === 'PM'" (click)="setPeriod('PM')">PM</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .time-picker-zenith {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 0 12px;
      transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      height: 48px;
      user-select: none;
      position: relative;
      width: 100%;
    }

    .time-picker-zenith.focused {
      border-color: #94a3b8; /* Subtle neutral focus */
      background: #ffffff;
      box-shadow: none !important;
      outline: none !important;
    }

    .time-group {
      display: flex;
      align-items: center;
      gap: 0px;
      padding-left: 2px;
    }

    .segment {
      padding: 2px;
      border-radius: 6px;
      transition: all 0.2s ease;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .segment.active {
      background: transparent;
    }

    .segment input {
      width: 22px;
      border: none;
      background: transparent;
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #0f172a;
      text-align: center;
      outline: none;
      cursor: pointer;
      padding: 0;
      transition: all 0.2s ease;
    }

    .segment.active input {
      color: #2563eb;
      transform: scale(1.1);
    }

    .separator {
      font-weight: 600;
      color: #cbd5e1;
      font-size: 14px;
      margin: 0 1px;
    }

    .period-switcher {
      display: flex;
      background: #f1f5f9;
      padding: 2px;
      border-radius: 8px;
      position: relative;
      width: 76px;
      height: 28px;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
    }

    .period-indicator {
      position: absolute;
      top: 2px;
      left: 2px;
      width: calc(50% - 2px);
      height: calc(100% - 4px);
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      z-index: 1;
    }

    .p-btn {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 9px;
      font-weight: 600;
      color: #94a3b8;
      cursor: pointer;
      z-index: 2;
      transition: all 0.3s ease;
      letter-spacing: 0.2px;
    }

    .p-btn.on {
      color: #2563eb;
    }

    .p-btn:active {
      transform: scale(0.92);
    }
  `]
})
export class PremiumTimePickerComponent implements OnInit {
  @Input() time: string = '09:00';
  @Output() timeChange = new EventEmitter<string>();

  displayHour: string = '09';
  displayMinute: string = '00';
  period: 'AM' | 'PM' = 'AM';
  
  isFocused = false;
  activeSegment: 'hour' | 'minute' | null = null;

  ngOnInit() {
    this.parseTime();
  }

  private parseTime() {
    if (!this.time) return;
    const parts = this.time.split(':');
    if (parts.length < 2) return;
    
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);

    if (h >= 12) {
      this.period = 'PM';
      this.displayHour = (h === 12 ? 12 : h - 12).toString().padStart(2, '0');
    } else {
      this.period = 'AM';
      this.displayHour = (h === 0 ? 12 : h).toString().padStart(2, '0');
    }
    this.displayMinute = m.toString().padStart(2, '0');
  }

  onFocus(event: any, segment: 'hour' | 'minute') {
    this.setActiveSegment(segment);
    if (event.target && event.target.select) {
      setTimeout(() => event.target.select(), 10);
    }
  }

  setActiveSegment(segment: 'hour' | 'minute') {
    this.activeSegment = segment;
    this.isFocused = true;
  }

  onBlur() {
    setTimeout(() => {
      this.isFocused = false;
      this.activeSegment = null;
      this.formatInputs();
      this.emitChange();
    }, 150);
  }

  private formatInputs() {
    if (this.displayHour) {
      let h = parseInt(this.displayHour);
      if (isNaN(h)) h = 12;
      if (h > 12) h = 12;
      if (h < 1) h = 1;
      this.displayHour = h.toString().padStart(2, '0');
    }
    if (this.displayMinute) {
      let m = parseInt(this.displayMinute);
      if (isNaN(m)) m = 0;
      if (m > 59) m = 59;
      if (m < 0) m = 0;
      this.displayMinute = m.toString().padStart(2, '0');
    }
  }

  onInputChange(type: 'hour' | 'minute') {
    let val = type === 'hour' ? this.displayHour : this.displayMinute;
    val = val.replace(/[^0-9]/g, '');
    
    if (type === 'hour') {
      this.displayHour = val;
      if (val.length === 2) {
        const h = parseInt(val);
        if (h > 12) this.displayHour = '12';
        this.emitChange();
      }
    } else {
      this.displayMinute = val;
      if (val.length === 2) {
        const m = parseInt(val);
        if (m > 59) this.displayMinute = '59';
        this.emitChange();
      }
    }
  }

  onKeydown(event: KeyboardEvent, type: 'hour' | 'minute') {
    const isControl = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(event.key);
    const isNumeric = /^[0-9]$/.test(event.key);
    if (!isNumeric && !isControl) {
      event.preventDefault();
    }
  }

  setPeriod(p: 'AM' | 'PM') {
    this.period = p;
    this.emitChange();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboard(event: KeyboardEvent) {
    if (!this.activeSegment) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.adjustValue(1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.adjustValue(-1);
    }
  }

  private adjustValue(step: number) {
    if (this.activeSegment === 'hour') {
      let h = parseInt(this.displayHour);
      h += step;
      if (h > 12) h = 1;
      if (h < 1) h = 12;
      this.displayHour = h.toString().padStart(2, '0');
    } else {
      let m = parseInt(this.displayMinute);
      m += step;
      if (m > 59) m = 0;
      if (m < 0) m = 59;
      this.displayMinute = m.toString().padStart(2, '0');
    }
    this.emitChange();
  }

  private emitChange() {
    let h = parseInt(this.displayHour);
    if (this.period === 'PM' && h < 12) h += 12;
    if (this.period === 'AM' && h === 12) h = 0;
    const formattedTime = `${h.toString().padStart(2, '0')}:${this.displayMinute}`;
    this.timeChange.emit(formattedTime);
  }
}
