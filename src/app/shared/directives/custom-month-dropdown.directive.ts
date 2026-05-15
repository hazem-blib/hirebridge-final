import {
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  HostListener
} from '@angular/core';

@Directive({
  selector: '[customMonthDropdown]',
  standalone: true
})
export class CustomMonthDropdownDirective implements OnInit, OnDestroy {
  @Input('customMonthDropdown') fpInstance: any;

  private monthDropdown: HTMLElement | null = null;
  private yearDropdown: HTMLElement | null = null;
  private monthLabel: HTMLElement | null = null;
  private yearLabel: HTMLElement | null = null;
  
  private listeners: (() => void)[] = [];

  private readonly months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  ngOnInit(): void {
    this.checkAndInit();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  private checkAndInit(): void {
    const interval = setInterval(() => {
      if (this.fpInstance && this.fpInstance.calendarContainer) {
        this.initializePremiumUI();
        clearInterval(interval);
      }
    }, 50);
    setTimeout(() => clearInterval(interval), 5000);
  }

  private initializePremiumUI(): void {
    const calendar = this.fpInstance.calendarContainer;
    if (!calendar) return;

    const monthsContainer = calendar.querySelector('.flatpickr-months');
    if (!monthsContainer) return;

    // Force hide native elements
    calendar.querySelectorAll('.flatpickr-monthDropdown-months, .numInputWrapper, .cur-year').forEach((el: any) => {
      this.renderer.addClass(el, 'force-hidden');
    });

    // Clear and create Container
    let container = monthsContainer.querySelector('.premium-selectors-container');
    if (container) this.renderer.removeChild(monthsContainer, container);
    
    container = this.renderer.createElement('div');
    this.renderer.addClass(container, 'premium-selectors-container');

    this.monthLabel = this.createPill('month');
    this.yearLabel = this.createPill('year');

    this.renderer.appendChild(container, this.monthLabel);
    this.renderer.appendChild(container, this.yearLabel);
    this.renderer.appendChild(monthsContainer, container);

    this.updateLabelTexts();

    // Manage Panels (Inject into root calendar for better positioning)
    calendar.querySelectorAll('.premium-selection-panel').forEach((el: any) => el.remove());
    this.monthDropdown = this.createPanel('month');
    this.yearDropdown = this.createPanel('year');
    
    this.renderer.appendChild(calendar, this.monthDropdown);
    this.renderer.appendChild(calendar, this.yearDropdown);

    this.setupListeners();
  }

  private createPill(type: 'month' | 'year'): HTMLElement {
    const pill = this.renderer.createElement('div');
    this.renderer.addClass(pill, 'custom-pill-label');
    this.renderer.addClass(pill, `pill-${type}`);
    
    const text = this.renderer.createElement('span');
    this.renderer.appendChild(pill, text);
    
    const icon = this.renderer.createElement('i');
    this.renderer.addClass(icon, 'pill-arrow');
    this.renderer.appendChild(pill, icon);
    
    return pill;
  }

  private createPanel(type: 'month' | 'year'): HTMLElement {
    const panel = this.renderer.createElement('div');
    this.renderer.addClass(panel, 'premium-selection-panel');
    this.renderer.addClass(panel, `${type}-panel`);
    
    if (type === 'month') {
      const grid = this.renderer.createElement('div');
      this.renderer.addClass(grid, 'month-grid');
      this.months.forEach((m, i) => {
        const item = this.createPanelItem(m, i, type);
        this.renderer.appendChild(grid, item);
      });
      this.renderer.appendChild(panel, grid);
    } else {
      const scrollArea = this.renderer.createElement('div');
      this.renderer.addClass(scrollArea, 'year-scroll-area');
      const startYear = new Date().getFullYear();
      for (let i = 0; i < 15; i++) {
        const y = startYear + i;
        const item = this.createPanelItem(y.toString(), y, type);
        this.renderer.appendChild(scrollArea, item);
      }
      this.renderer.appendChild(panel, scrollArea);
    }
    
    return panel;
  }

  private createPanelItem(label: string, value: number, type: 'month' | 'year'): HTMLElement {
    const item = this.renderer.createElement('div');
    this.renderer.addClass(item, 'panel-option');
    item.innerText = label;
    item.setAttribute('data-value', value.toString());

    this.renderer.listen(item, 'click', (e) => {
      e.stopPropagation();
      type === 'month' ? this.selectMonth(value) : this.selectYear(value);
    });

    return item;
  }

  private setupListeners(): void {
    this.listeners.push(
      this.renderer.listen(this.monthLabel, 'click', (e) => {
        e.stopPropagation();
        this.togglePanel('month');
      }),
      this.renderer.listen(this.yearLabel, 'click', (e) => {
        e.stopPropagation();
        this.togglePanel('year');
      }),
      this.renderer.listen('document', 'click', () => this.closeAll())
    );

    this.fpInstance.config.onMonthChange.push(() => this.onInternalChange());
    this.fpInstance.config.onYearChange.push(() => this.onInternalChange());
  }

  private onInternalChange(): void {
    this.updateLabelTexts();
    this.syncDateWithCurrentView();
    this.refreshPanelStates();
  }

  private togglePanel(type: 'month' | 'year'): void {
    const panel = type === 'month' ? this.monthDropdown : this.yearDropdown;
    const label = type === 'month' ? this.monthLabel : this.yearLabel;
    
    if (!panel || !label) return;

    const isShowing = panel.classList.contains('show');
    this.closeAll();

    if (!isShowing) {
      this.positionPanel(panel, label);
      this.renderer.addClass(panel, 'show');
      this.renderer.addClass(label, 'pill-active');
      this.highlightCurrent(type);
    }
  }

  private positionPanel(panel: HTMLElement, label: HTMLElement): void {
    const labelRect = label.getBoundingClientRect();
    const calendarRect = this.fpInstance.calendarContainer.getBoundingClientRect();
    const left = labelRect.left - calendarRect.left;
    this.renderer.setStyle(panel, 'left', `${left}px`);
  }

  private highlightCurrent(type: 'month' | 'year'): void {
    const panel = type === 'month' ? this.monthDropdown : this.yearDropdown;
    if (!panel) return;

    const currentValue = type === 'month' ? this.fpInstance.currentMonth : this.fpInstance.currentYear;
    const options = panel.querySelectorAll('.panel-option');
    
    options.forEach((opt: any) => {
      const val = parseInt(opt.getAttribute('data-value'));
      if (val === currentValue) {
        this.renderer.addClass(opt, 'active');
        opt.scrollIntoView({ block: 'center', behavior: 'smooth' });
      } else {
        this.renderer.removeClass(opt, 'active');
      }

      if (type === 'month' && this.isMonthInPast(val)) {
        this.renderer.addClass(opt, 'disabled');
      } else {
        this.renderer.removeClass(opt, 'disabled');
      }
    });
  }

  private selectMonth(index: number): void {
    if (this.isMonthInPast(index)) return;
    this.fpInstance.changeMonth(index, false);
    this.onInternalChange();
    this.closeAll();
  }

  private selectYear(year: number): void {
    this.fpInstance.changeYear(year);
    this.onInternalChange();
    this.closeAll();
  }

  private updateLabelTexts(): void {
    if (this.monthLabel) {
      const fullMonths = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      this.monthLabel.querySelector('span')!.innerText = fullMonths[this.fpInstance.currentMonth];
    }
    if (this.yearLabel) {
      this.yearLabel.querySelector('span')!.innerText = this.fpInstance.currentYear.toString();
    }
  }

  private syncDateWithCurrentView(): void {
    if (!this.fpInstance) return;
    const year = this.fpInstance.currentYear;
    const month = this.fpInstance.currentMonth;
    let day = this.fpInstance.selectedDates.length > 0 ? this.fpInstance.selectedDates[0].getDate() : 1;

    const newDate = new Date(year, month, day);
    if (newDate.getMonth() !== month) newDate.setDate(0);
    this.fpInstance.setDate(newDate, true);
    this.fpInstance.redraw();
  }

  private isMonthInPast(monthIndex: number): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = this.fpInstance.currentYear;
    if (year < today.getFullYear()) return true;
    if (year === today.getFullYear() && monthIndex < today.getMonth()) return true;
    return false;
  }

  private refreshPanelStates(): void {
    if (this.monthDropdown) {
      const options = this.monthDropdown.querySelectorAll('.panel-option');
      options.forEach((opt: any) => {
        const val = parseInt(opt.getAttribute('data-value'));
        if (this.isMonthInPast(val)) this.renderer.addClass(opt, 'disabled');
        else this.renderer.removeClass(opt, 'disabled');
      });
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    const activePanel = this.getActivePanel();
    if (!activePanel) return;

    if (event.key === 'Escape') {
      this.closeAll();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const step = (event.key === 'ArrowDown' || event.key === 'ArrowRight') ? 1 : -1;
      this.navigateOptions(activePanel, step);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.selectFocusedOption(activePanel);
    }
  }

  private getActivePanel(): HTMLElement | null {
    if (this.monthDropdown?.classList.contains('show')) return this.monthDropdown;
    if (this.yearDropdown?.classList.contains('show')) return this.yearDropdown;
    return null;
  }

  private navigateOptions(panel: HTMLElement, step: number): void {
    const options = Array.from(panel.querySelectorAll('.panel-option:not(.disabled)')) as HTMLElement[];
    const currentActive = panel.querySelector('.panel-option.focused') as HTMLElement || panel.querySelector('.panel-option.active') as HTMLElement;
    
    let nextIndex = options.indexOf(currentActive) + step;
    if (nextIndex < 0) nextIndex = options.length - 1;
    if (nextIndex >= options.length) nextIndex = 0;

    options.forEach(opt => opt.classList.remove('focused'));
    options[nextIndex].classList.add('focused');
    options[nextIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  private selectFocusedOption(panel: HTMLElement): void {
    const focused = panel.querySelector('.panel-option.focused') as HTMLElement;
    if (focused) focused.click();
  }

  private closeAll(): void {
    [this.monthDropdown, this.yearDropdown].forEach(d => d?.classList.remove('show'));
    [this.monthLabel, this.yearLabel].forEach(l => l?.classList.remove('pill-active'));
    document.querySelectorAll('.panel-option').forEach(opt => opt.classList.remove('focused'));
  }

  private cleanup(): void {
    this.listeners.forEach(fn => fn());
    this.monthDropdown?.remove();
    this.yearDropdown?.remove();
    this.monthLabel?.remove();
    this.yearLabel?.remove();
  }
}
